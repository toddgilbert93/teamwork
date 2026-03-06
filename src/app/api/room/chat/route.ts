import { createServerClient } from '@/lib/supabase/server';
import { getAnthropicClient } from '@/lib/anthropic';
import { MODEL_NAME } from '@/lib/constants';
import { estimateTokens } from '@/lib/tokens';
import type { Persona, RoomStreamEvent } from '@/lib/types';

const ROOM_MAX_RESPONSE_TOKENS = 1024;
const ROOM_AVAILABLE_TOKENS = 60000;

interface TurnResponse {
  persona_id: string;
  name: string;
  content: string;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseMentions(message: string, personas: Persona[]): string[] {
  const mentionRegex = /@(\w+)/gi;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(message)) !== null) {
    const name = match[1].toLowerCase();
    if (personas.some((p) => p.name.toLowerCase() === name)) {
      mentions.push(name);
    }
  }
  return [...new Set(mentions)];
}

function isPass(response: string): boolean {
  return response.trim().toLowerCase().replace(/[.,!?]$/, '') === 'pass';
}

function buildRoomSystemPrompt(
  persona: Persona,
  allPersonas: Persona[],
  isFollowUp: boolean,
  forceRespond: boolean
): string {
  const otherNames = allPersonas
    .filter((p) => p.id !== persona.id)
    .map((p) => `${p.emoji} ${p.name}`)
    .join(', ');

  let prompt = `## Your Identity\n${persona.system_prompt}\n\n`;

  if (persona.memory_summary) {
    prompt += `## Private Memory\nHere is what you know about the user from your private conversations:\n\n${persona.memory_summary}\n\n`;
  }

  prompt += `## Group Discussion Context\n`;
  prompt += `You are in a group discussion with the user and these other companions: ${otherNames}.\n`;
  prompt += `Keep your response concise — 2 to 4 sentences. This is a group chat, not a monologue.\n`;
  prompt += `You can reference other personas by name when responding to their points.\n`;

  if (!forceRespond) {
    prompt += `If you have nothing meaningful to add, respond with just the word "pass" (nothing else) to skip your turn.\n`;
  } else {
    prompt += `You must respond to this message — do not pass.\n`;
  }

  if (isFollowUp) {
    prompt += `\n## Follow-Up Instructions\nRespond to or build on something one of the other personas just said. Do not repeat your earlier point. Keep it to 1-2 sentences.\n`;
  }

  return prompt;
}

interface RoomHistoryMsg {
  role: 'user' | 'assistant';
  content: string;
  persona_name?: string | null;
}

function buildAnthropicMessages(
  history: RoomHistoryMsg[],
  turnResponses: TurnResponse[],
  userMessage: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Convert room history to alternating messages with persona prefixes
  for (const msg of history) {
    const prefix =
      msg.role === 'assistant' && msg.persona_name ? `[${msg.persona_name}]: ` : '';
    const content = prefix + msg.content;

    if (messages.length > 0 && messages[messages.length - 1].role === msg.role) {
      messages[messages.length - 1].content += '\n\n' + content;
    } else {
      messages.push({ role: msg.role, content });
    }
  }

  // Add the new user message
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    messages[messages.length - 1].content += '\n\n' + userMessage;
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  // Add current-turn responses if any
  if (turnResponses.length > 0) {
    const combined = turnResponses
      .map((r) => `[${r.name}]: ${r.content}`)
      .join('\n\n');
    messages.push({ role: 'assistant', content: combined });
    messages.push({
      role: 'user',
      content: '[Continue the group discussion. It is now your turn to respond.]',
    });
  }

  return messages;
}

function applyRoomWindow(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  availableTokens: number
): Array<{ role: 'user' | 'assistant'; content: string }> {
  let tokenCount = 0;
  let cutoffIndex = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i].content) + 4;
    if (tokenCount + msgTokens > availableTokens) {
      cutoffIndex = i + 1;
      break;
    }
    tokenCount += msgTokens;
  }

  return messages.slice(cutoffIndex);
}

async function streamPersonaResponse(
  anthropic: ReturnType<typeof getAnthropicClient>,
  systemPrompt: string,
  apiMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  personaId: string,
  emit: (event: RoomStreamEvent) => void,
  signal: AbortSignal
): Promise<string> {
  const stream = anthropic.messages.stream({
    model: MODEL_NAME,
    max_tokens: ROOM_MAX_RESPONSE_TOKENS,
    system: systemPrompt,
    messages: apiMessages,
  });

  let fullResponse = '';

  return new Promise<string>((resolve, reject) => {
    const onAbort = () => {
      stream.abort();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (signal.aborted) {
      stream.abort();
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    signal.addEventListener('abort', onAbort, { once: true });

    stream.on('text', (text) => {
      fullResponse += text;
      emit({ type: 'text_delta', persona_id: personaId, text });
    });

    stream.on('end', () => {
      signal.removeEventListener('abort', onAbort);
      resolve(fullResponse);
    });

    stream.on('error', (error) => {
      signal.removeEventListener('abort', onAbort);
      reject(error);
    });
  });
}

export async function POST(req: Request) {
  const controller = new AbortController();

  // Forward client abort to our controller
  req.signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const { message } = await req.json();

    if (!message) {
      return Response.json({ error: 'message is required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const anthropic = getAnthropicClient();

    // 1. Save user message
    await supabase
      .from('room_messages')
      .insert({ persona_id: null, role: 'user', content: message });

    // 2. Fetch all personas
    const { data: personas, error: personasError } = await supabase
      .from('personas')
      .select('*')
      .order('sort_order', { ascending: true });

    if (personasError || !personas || personas.length === 0) {
      return Response.json({ error: 'No personas found' }, { status: 404 });
    }

    // 3. Fetch room history (excluding the message we just inserted — it's added manually)
    const { data: historyRows } = await supabase
      .from('room_messages')
      .select('*, personas(name, emoji, accent_color)')
      .order('created_at', { ascending: true });

    const history: RoomHistoryMsg[] = (historyRows || []).slice(0, -1).map((row: Record<string, unknown>) => {
      const persona = row.personas as { name: string } | null;
      return {
        role: row.role as 'user' | 'assistant',
        content: row.content as string,
        persona_name: persona?.name ?? null,
      };
    });

    // 4. Parse @-mentions
    const mentions = parseMentions(message, personas as Persona[]);
    const respondingPersonas: Persona[] =
      mentions.length > 0
        ? (personas as Persona[]).filter((p) =>
            mentions.includes(p.name.toLowerCase())
          )
        : shuffleArray(personas as Persona[]);

    // 5. Stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(streamController) {
        const emit = (event: RoomStreamEvent) => {
          try {
            streamController.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          } catch {
            // Stream may be closed
          }
        };

        const turnResponses: TurnResponse[] = [];
        const passedPersonaIds: string[] = [];

        try {
          // --- INITIAL ROUND ---
          for (let i = 0; i < respondingPersonas.length; i++) {
            if (controller.signal.aborted) break;

            const persona = respondingPersonas[i];
            const isLast = i === respondingPersonas.length - 1;
            const allOthersPassed =
              isLast && turnResponses.length === 0 && passedPersonaIds.length === i;

            emit({
              type: 'persona_start',
              persona_id: persona.id,
              persona_name: persona.name,
              persona_emoji: persona.emoji,
            });

            const systemPrompt = buildRoomSystemPrompt(
              persona,
              personas as Persona[],
              false,
              allOthersPassed
            );

            const apiMessages = applyRoomWindow(
              buildAnthropicMessages(history, turnResponses, message),
              ROOM_AVAILABLE_TOKENS
            );

            const response = await streamPersonaResponse(
              anthropic,
              systemPrompt,
              apiMessages,
              persona.id,
              emit,
              controller.signal
            );

            if (isPass(response) && !allOthersPassed) {
              passedPersonaIds.push(persona.id);
              emit({ type: 'persona_pass', persona_id: persona.id });
              continue;
            }

            // If all others passed and this one also passed, re-call with forceRespond
            if (isPass(response) && allOthersPassed) {
              const forcePrompt = buildRoomSystemPrompt(
                persona,
                personas as Persona[],
                false,
                true
              );

              emit({
                type: 'persona_start',
                persona_id: persona.id,
                persona_name: persona.name,
                persona_emoji: persona.emoji,
              });

              const forcedResponse = await streamPersonaResponse(
                anthropic,
                forcePrompt,
                apiMessages,
                persona.id,
                emit,
                controller.signal
              );

              const { data: saved } = await supabase
                .from('room_messages')
                .insert({
                  persona_id: persona.id,
                  role: 'assistant',
                  content: forcedResponse,
                })
                .select('id')
                .single();

              emit({
                type: 'persona_complete',
                persona_id: persona.id,
                message_id: saved?.id,
              });

              turnResponses.push({
                persona_id: persona.id,
                name: persona.name,
                content: forcedResponse,
              });
              continue;
            }

            // Normal response — save to DB
            const { data: saved } = await supabase
              .from('room_messages')
              .insert({
                persona_id: persona.id,
                role: 'assistant',
                content: response,
              })
              .select('id')
              .single();

            emit({
              type: 'persona_complete',
              persona_id: persona.id,
              message_id: saved?.id,
            });

            turnResponses.push({
              persona_id: persona.id,
              name: persona.name,
              content: response,
            });
          }

          emit({ type: 'turn_complete' });

          // --- FOLLOW-UP ROUND ---
          if (
            !controller.signal.aborted &&
            mentions.length === 0 &&
            turnResponses.length >= 2 &&
            Math.random() < 0.5
          ) {
            emit({ type: 'followup_start' });

            const nonPassIds = turnResponses.map((r) => r.persona_id);
            const candidates = shuffleArray(
              (personas as Persona[]).filter((p) => nonPassIds.includes(p.id))
            );

            const followupCount = Math.random() < 0.7 ? 1 : 2;
            const followupPersonas = candidates.slice(
              0,
              Math.min(followupCount, candidates.length)
            );

            for (const persona of followupPersonas) {
              if (controller.signal.aborted) break;

              emit({
                type: 'persona_start',
                persona_id: persona.id,
                persona_name: persona.name,
                persona_emoji: persona.emoji,
              });

              const systemPrompt = buildRoomSystemPrompt(
                persona,
                personas as Persona[],
                true,
                true // follow-ups don't get pass option
              );

              const apiMessages = applyRoomWindow(
                buildAnthropicMessages(history, turnResponses, message),
                ROOM_AVAILABLE_TOKENS
              );

              const response = await streamPersonaResponse(
                anthropic,
                systemPrompt,
                apiMessages,
                persona.id,
                emit,
                controller.signal
              );

              const { data: saved } = await supabase
                .from('room_messages')
                .insert({
                  persona_id: persona.id,
                  role: 'assistant',
                  content: response,
                })
                .select('id')
                .single();

              emit({
                type: 'persona_complete',
                persona_id: persona.id,
                message_id: saved?.id,
              });

              turnResponses.push({
                persona_id: persona.id,
                name: persona.name,
                content: response,
              });
            }
          }

          emit({ type: 'all_complete' });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            // Client disconnected
          } else {
            emit({
              type: 'error',
              message: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        } finally {
          try {
            streamController.close();
          } catch {
            // Already closed
          }
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
