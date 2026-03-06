import { createServerClient } from '@/lib/supabase/server';
import { getAnthropicClient } from '@/lib/anthropic';
import { MODEL_NAME, MAX_RESPONSE_TOKENS, AVAILABLE_FOR_MESSAGES } from '@/lib/constants';
import { applyWindowToMessages } from '@/lib/tokens';
import { generateMemorySummary } from '@/lib/memory';
import type { Message } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { persona_id, message } = await req.json();

    if (!persona_id || !message) {
      return Response.json({ error: 'persona_id and message are required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const anthropic = getAnthropicClient();

    // 1. Fetch persona
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', persona_id)
      .single();

    if (personaError || !persona) {
      return Response.json({ error: 'Persona not found' }, { status: 404 });
    }

    // 2. Fetch all messages for this persona
    const { data: allMessages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('persona_id', persona_id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      return Response.json({ error: messagesError.message }, { status: 500 });
    }

    // 3. Save user message
    const { error: insertError } = await supabase
      .from('messages')
      .insert({ persona_id, role: 'user', content: message });

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
            .eq('id', persona_id);
        })
        .catch(console.error);
    }

    // 7. Build system prompt with memory
    let systemPrompt = persona.system_prompt;
    if (persona.memory_summary) {
      systemPrompt = `## Conversation Memory\nThe following is a summary of earlier conversations with this user:\n\n${persona.memory_summary}\n\n---\n\n## Your Identity\n${systemPrompt}`;
    }

    // 8. Format messages for Anthropic API
    const apiMessages = windowed.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // 9. Stream response
    const stream = anthropic.messages.stream({
      model: MODEL_NAME,
      max_tokens: MAX_RESPONSE_TOKENS,
      system: systemPrompt,
      messages: apiMessages,
    });

    const encoder = new TextEncoder();
    let fullResponse = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          stream.on('text', (text) => {
            fullResponse += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text })}\n\n`)
            );
          });

          stream.on('end', async () => {
            // Save assistant response to Supabase
            const { data: savedMsg } = await supabase
              .from('messages')
              .insert({ persona_id, role: 'assistant', content: fullResponse })
              .select('id')
              .single();

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'message_complete',
                message_id: savedMsg?.id,
              })}\n\n`)
            );
            controller.close();
          });

          stream.on('error', (error) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                message: error instanceof Error ? error.message : 'Stream error',
              })}\n\n`)
            );
            controller.close();
          });
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
