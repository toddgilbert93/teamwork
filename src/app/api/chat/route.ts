import { streamText } from 'ai';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser, userIdField } from '@/lib/auth';
import { getModel } from '@/lib/ai';
import { MAX_RESPONSE_TOKENS, AVAILABLE_FOR_MESSAGES } from '@/lib/constants';
import { applyWindowToMessages } from '@/lib/tokens';
import { generateMemorySummary } from '@/lib/memory';
import { resolveSystemPrompt } from '@/lib/default-personas';
import type { Message } from '@/lib/types';

const PERSONA_TEMPERATURES: Record<string, number> = {
  'Rex': 0.3,
  'Sol': 0.6,
  'Mira': 0.9,
};

const PERSONA_CHAT_STYLE: Record<string, string> = {
  'Sol': 'Keep responses conversational and concise by default. Go deeper when the topic warrants it, but don\'t over-explain. Have genuine opinions. Push back when you disagree. You\'re not here to validate — you\'re here to help them win.',
  'Mira': 'Keep responses conversational and concise by default. Go deeper when the topic calls for it, but don\'t lecture. Have genuine perspectives. Push back gently when you see something they\'re missing. You\'re here to help them see clearly.',
  'Rex': 'Keep responses short by default. You\'re not a monologue person. One sharp paragraph beats three gentle ones. Have strong opinions. Don\'t hedge. If you agree with someone, don\'t just say "yeah" — add something they hadn\'t considered. You\'re here to make them sharper.',
};

export async function POST(req: Request) {
  try {
    const { persona_id, message } = await req.json();

    if (!persona_id || !message) {
      return Response.json({ error: 'persona_id and message are required' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch persona
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', persona_id)
      .eq('user_id', user.id)
      .single();

    if (personaError || !persona) {
      return Response.json({ error: 'Persona not found' }, { status: 404 });
    }

    // 2. Fetch all messages for this persona
    const { data: allMessages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('persona_id', persona_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      return Response.json({ error: messagesError.message }, { status: 500 });
    }

    // 3. Save user message
    const { error: insertError } = await supabase
      .from('messages')
      .insert({ persona_id, role: 'user', content: message, ...userIdField(user) });

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    // 4. Build messages array (including the new user message)
    const messages: Message[] = [...(allMessages || []), {
      id: 'new',
      persona_id,
      role: 'user' as const,
      content: message,
      created_at: new Date().toISOString(),
    }];

    // 5. Apply sliding window
    const { windowed, trimmed } = applyWindowToMessages(messages, AVAILABLE_FOR_MESSAGES);

    // 6. Trigger background summarization if we trimmed a lot
    if (trimmed.length > 20) {
      generateMemorySummary(trimmed, persona.memory_summary)
        .then(async (summary) => {
          await supabase
            .from('personas')
            .update({ memory_summary: summary })
            .eq('id', persona_id)
            .eq('user_id', user.id);
        })
        .catch(console.error);
    }

    // 7. Build system prompt with memory (code is source of truth for defaults)
    let systemPrompt = resolveSystemPrompt(persona);
    const chatStyle = PERSONA_CHAT_STYLE[persona.name];
    if (chatStyle) {
      systemPrompt += `\n\n${chatStyle}`;
    }
    if (persona.memory_summary) {
      systemPrompt = `## Conversation Memory\nThe following is a summary of earlier conversations with this user:\n\n${persona.memory_summary}\n\n---\n\n## Your Identity\n${systemPrompt}`;
    }

    // 8. Format messages for API
    const apiMessages = windowed.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // 9. Stream response
    const temperature = PERSONA_TEMPERATURES[persona.name] ?? 0.5;
    const model = getModel(persona.name);

    const result = streamText({
      model,
      maxOutputTokens: MAX_RESPONSE_TOKENS,
      temperature,
      system: systemPrompt,
      messages: apiMessages,
    });

    const encoder = new TextEncoder();
    let fullResponse = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            fullResponse += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text: chunk })}\n\n`)
            );
          }

          // Save assistant response to Supabase
          const { data: savedMsg } = await supabase
            .from('messages')
            .insert({ persona_id, role: 'assistant', content: fullResponse, ...userIdField(user) })
            .select('id')
            .single();

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'message_complete',
              message_id: savedMsg?.id,
            })}\n\n`)
          );
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              message: err instanceof Error ? err.message : 'Unknown error',
            })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
