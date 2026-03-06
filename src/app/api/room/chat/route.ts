import { createServerClient } from '@/lib/supabase/server';
import { getAnthropicClient } from '@/lib/anthropic';
import { MODEL_NAME } from '@/lib/constants';
import { estimateTokens } from '@/lib/tokens';
import type { Persona, RoomStreamEvent } from '@/lib/types';

const ROOM_MAX_RESPONSE_TOKENS = 300;
const ROOM_AVAILABLE_TOKENS = 60000;

const PERSONA_TEMPERATURES: Record<string, number> = {
  'Sol': 0.3,
  'Rex': 0.5,
  'Mira': 0.7,
  'Mean guy': 0.9,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function cleanPersonaResponse(
  response: string,
  currentPersona: Persona,
  allPersonas: Persona[]
): string {
  let cleaned = response;

  // Strip own [Name]: prefix at the start
  const ownPrefixRe = new RegExp(`^\\[${currentPersona.name}\\]:\\s*`, 'i');
  cleaned = cleaned.replace(ownPrefixRe, '');

  // Strip XML-style tags
  cleaned = cleaned.replace(/<message from="[^"]*">\n?/g, '');
  cleaned = cleaned.replace(/\n?<\/message>/g, '');

  // Truncate at the first occurrence of another persona's name being "spoken as"
  // This catches patterns like: "Rex:", "[Rex]:", "🔮Mira", "⚡Dash", etc.
  const otherPersonas = allPersonas.filter((p) => p.id !== currentPersona.id);
  for (const p of otherPersonas) {
    // Match Name: at start of a line, or [Name]:, or emoji+Name patterns
    const patterns = [
      new RegExp(`\\n${p.emoji}\\s*${p.name}`, 'i'),
      new RegExp(`\\n\\[${p.name}\\]:`, 'i'),
      new RegExp(`\\n${p.name}:\\s`, 'i'),
    ];
    for (const pat of patterns) {
      const match = cleaned.search(pat);
      if (match !== -1) {
        cleaned = cleaned.substring(0, match);
      }
    }
  }

  return cleaned.trim();
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
  prompt += `IMPORTANT: You are ONLY ${persona.name}. Respond ONLY as yourself. NEVER generate text on behalf of other personas. Do NOT prefix your response with your name or anyone else's name (e.g. no "[${persona.name}]:" or "[OtherName]:"). Just write your response directly — attribution is handled by the system.\n`;
  prompt += `Keep your response very short — 1 to 2 sentences max. This is a quick group chat, not a monologue.\n`;
  prompt += `Do NOT agree with or rephrase what another persona just said. If you agree, pass. Only respond if you have a genuinely different angle.\n`;
  prompt += `You can reference other personas by name when responding to their points.\n`;

  if (!forceRespond) {
    prompt += `If you have nothing meaningful to add, respond with just the word "pass" (nothing else) to skip your turn.\n`;
  } else {
    prompt += `You must respond to this message — do not pass.\n`;
  }

  if (isFollowUp) {
    prompt += `\n## Follow-Up Instructions\nRespond to or build on something one of the other personas just said. Do not repeat your earlier point. One sentence only.\n`;
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

  // Convert room history — keep each assistant message as a separate exchange
  // Persona attribution is only in the system prompt context, not in the content
  for (const msg of history) {
    if (messages.length > 0 && messages[messages.length - 1].role === msg.role) {
      messages[messages.length - 1].content += '\n\n' + msg.content;
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Build the user message, including context about other personas' responses this turn
  let fullUserMessage = userMessage;

  if (turnResponses.length > 0) {
    const context = turnResponses
      .map((r) => `${r.name}: "${r.content}"`)
      .join('\n\n');
    fullUserMessage += `\n\n[Other companions have already responded to this message:]\n${context}\n\n[It is now your turn. Write only your own response.]`;
  }

  // Add the user message
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    messages[messages.length - 1].content += '\n\n' + fullUserMessage;
  } else {
    messages.push({ role: 'user', content: fullUserMessage });
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
  personaName: string,
  emit: (event: RoomStreamEvent) => void,
  signal: AbortSignal
): Promise<string> {
  const temperature = PERSONA_TEMPERATURES[personaName] ?? 0.5;
  const stream = anthropic.messages.stream({
    model: MODEL_NAME,
    max_tokens: ROOM_MAX_RESPONSE_TOKENS,
    temperature,
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
    const { message, mutedPersonaIds = [] } = await req.json();

    if (!message) {
      return Response.json({ error: 'message is required' }, { status: 400 });
    }

    const mutedSet = new Set<string>(mutedPersonaIds);

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
      const rowPersona = row.personas as { name: string } | null;
      let content = row.content as string;

      // Clean old contaminated history — truncate at first sign of another persona
      if (row.role === 'assistant' && rowPersona) {
        const thisPersona = (personas as Persona[]).find((p) => p.name === rowPersona.name);
        if (thisPersona) {
          content = cleanPersonaResponse(content, thisPersona, personas as Persona[]);
        }
      }

      return {
        role: row.role as 'user' | 'assistant',
        content,
        persona_name: rowPersona?.name ?? null,
      };
    });

    // 4. Parse @-mentions and filter muted personas
    const mentions = parseMentions(message, personas as Persona[]);
    const activePersonas = (personas as Persona[]).filter((p) => !mutedSet.has(p.id));
    const MAX_INITIAL_RESPONDERS = 3;
    const respondingPersonas: Persona[] =
      mentions.length > 0
        ? activePersonas.filter((p) =>
            mentions.includes(p.name.toLowerCase())
          )
        : shuffleArray(activePersonas).slice(0, MAX_INITIAL_RESPONDERS);

    if (respondingPersonas.length === 0) {
      return Response.json({ error: 'No active personas to respond' }, { status: 400 });
    }

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

            // Natural delay between personas (not before the first one)
            if (i > 0) await delay(800 + Math.random() * 700);

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

            const rawResponse = await streamPersonaResponse(
              anthropic,
              systemPrompt,
              apiMessages,
              persona.id,
              persona.name,
              emit,
              controller.signal
            );
            const response = cleanPersonaResponse(rawResponse, persona, personas as Persona[]);

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

              const rawForced = await streamPersonaResponse(
                anthropic,
                forcePrompt,
                apiMessages,
                persona.id,
                persona.name,
                emit,
                controller.signal
              );
              const forcedResponse = cleanPersonaResponse(rawForced, persona, personas as Persona[]);

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

            // Get the last persona who responded — exclude them from being first follow-up
            const lastResponderId = turnResponses[turnResponses.length - 1].persona_id;
            const nonPassIds = turnResponses.map((r) => r.persona_id);
            const eligibleForFirst = (personas as Persona[]).filter(
              (p) => nonPassIds.includes(p.id) && p.id !== lastResponderId
            );
            const restCandidates = (personas as Persona[]).filter(
              (p) => nonPassIds.includes(p.id) && p.id === lastResponderId
            );

            // First pick from non-last-responder, then append the last responder
            const candidates = [
              ...shuffleArray(eligibleForFirst),
              ...shuffleArray(restCandidates),
            ];

            const followupCount = 1;
            const followupPersonas = candidates.slice(
              0,
              Math.min(followupCount, candidates.length)
            );

            for (const persona of followupPersonas) {
              if (controller.signal.aborted) break;

              // Delay before follow-up
              await delay(1000 + Math.random() * 500);

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

              const rawFollowup = await streamPersonaResponse(
                anthropic,
                systemPrompt,
                apiMessages,
                persona.id,
                persona.name,
                emit,
                controller.signal
              );
              const response = cleanPersonaResponse(rawFollowup, persona, personas as Persona[]);

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
