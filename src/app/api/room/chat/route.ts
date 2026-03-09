import { streamText } from 'ai';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser, userIdField } from '@/lib/auth';
import { getModel } from '@/lib/ai';
import { estimateTokens } from '@/lib/tokens';
import { resolveSystemPrompt } from '@/lib/default-personas';
import type { Persona, RoomStreamEvent } from '@/lib/types';

const ROOM_MAX_RESPONSE_TOKENS = 500;
const ROOM_AVAILABLE_TOKENS = 60000;

const PERSONA_TEMPERATURES: Record<string, number> = {
  'Rex': 0.5,
  'Sol': 0.6,
  'Mira': 0.9,
};

// Generous safety-net limits — actual length is guided by the system prompt
const PERSONA_ROOM_TOKENS: Record<string, number> = {
  'Rex': 200,
  'Sol': 350,
  'Mira': 500,
};

const PERSONA_LENGTH_GUIDE: Record<string, { blind: string; normal: string }> = {
  'Rex': {
    blind: 'Respond in exactly ONE sentence. Stop after the period.',
    normal: 'Respond in exactly ONE sentence. Stop after the period.',
  },
  'Sol': {
    blind: 'Respond in ONE sentence only. Maximum 25 words / 150 characters. Do not write more than one sentence.',
    normal: 'Respond in 1–2 sentences only. Maximum 40 words / 250 characters. Do not write more than two sentences.',
  },
  'Mira': {
    blind: 'Respond in 1–2 sentences only. Maximum 40 words / 250 characters. Do not write more than two sentences.',
    normal: 'Respond in 2–3 sentences only. Maximum 60 words / 400 characters. Do not write more than three sentences.',
  },
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

  // Strip own [Name]: or "Name here—" prefix at the start
  const ownPrefixRe = new RegExp(`^\\[?${currentPersona.name}\\]?[:\\s]*here[—–-]\\s*|^\\[${currentPersona.name}\\]:\\s*`, 'i');
  cleaned = cleaned.replace(ownPrefixRe, '');

  // Strip XML-style tags
  cleaned = cleaned.replace(/<message from="[^"]*">\n?/g, '');
  cleaned = cleaned.replace(/\n?<\/message>/g, '');

  // Strip Grok internal reasoning artifacts
  cleaned = cleaned.replace(/<\|vq_\d+\|>\s*/g, '');
  cleaned = cleaned.replace(/<query_has_boxed>\s*\w+\s*<\/query_has_boxed>\s*/g, '');
  cleaned = cleaned.replace(/<\|?[a-z_]+\|?>\s*/gi, '');

  // Truncate at the first occurrence of ANY persona's name being "spoken as"
  // (including the current persona talking to itself in third person)
  // This catches patterns like: "Rex:", "[Rex]:", "🔮Mira", "Rex, you're..." etc.
  for (const p of allPersonas) {
    const patterns = [
      new RegExp(`\\n${p.emoji}\\s*${p.name}`, 'i'),
      new RegExp(`\\n\\[${p.name}\\]:`, 'i'),
      new RegExp(`\\n${p.name}:\\s`, 'i'),
      new RegExp(`\\n${p.name},\\s`, 'i'),  // "Rex, you're hedging..."
    ];
    for (const pat of patterns) {
      const match = cleaned.search(pat);
      if (match !== -1) {
        cleaned = cleaned.substring(0, match);
      }
    }
  }

  // Detect repetition loops — keep only the first sentence if the rest is repeating
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 2) {
    const first = sentences[0].toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const repeats = sentences.slice(1).filter((s) => {
      const norm = s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      // Check if subsequent sentences share >60% of words with the first
      const firstWords = new Set(first.split(/\s+/));
      const sWords = norm.split(/\s+/);
      const overlap = sWords.filter((w) => firstWords.has(w)).length;
      return sWords.length > 0 && overlap / sWords.length > 0.6;
    });
    if (repeats.length >= 2) {
      cleaned = sentences[0];
    }
  }

  return cleaned.trim();
}

function buildRoomSystemPrompt(
  persona: Persona,
  allPersonas: Persona[],
  isFollowUp: boolean,
  forceRespond: boolean,
  isBlindRound: boolean = false
): string {
  const otherNames = allPersonas
    .filter((p) => p.id !== persona.id)
    .map((p) => `${p.emoji} ${p.name}`)
    .join(', ');

  let prompt = `## Your Identity\n${resolveSystemPrompt(persona)}\n\n`;

  if (persona.memory_summary) {
    prompt += `## Private Memory\nHere is what you know about the user from your private conversations:\n\n${persona.memory_summary}\n\n`;
  }

  prompt += `## Group Discussion Context\n`;
  prompt += `You are in a group discussion with the user and these other members: ${otherNames}.\n`;
  if (persona.name === 'Rex') {
    prompt += `When other members reach similar conclusions, find the weakness in their thinking. You're here to stress-test, not agree.\n`;
  }
  prompt += `IMPORTANT: You are ONLY ${persona.name}. Respond ONLY as yourself. NEVER generate text on behalf of other personas. Do NOT prefix your response with your name or anyone else's name (e.g. no "[${persona.name}]:" or "[OtherName]:"). Just write your response directly — attribution is handled by the system.\n`;

  if (isBlindRound) {
    prompt += `This is a quick blind round where each member responds independently.\n`;
    prompt += `You must respond to this message — do not pass.\n`;
  } else {
    prompt += `Do NOT agree with or rephrase what another persona just said. If you agree, pass. Only respond if you have a genuinely different angle.\n`;
    prompt += `You can reference other personas by name when responding to their points.\n`;

    if (!forceRespond) {
      prompt += `If you have nothing meaningful to add, respond with just the word "pass" (nothing else) to skip your turn.\n`;
    } else {
      prompt += `You must respond to this message — do not pass.\n`;
    }
  }

  if (isFollowUp) {
    prompt += `\n## Follow-Up Instructions\nYou just read the other members' responses. Pick ONE response you either agree or disagree with. Name the member, say whether you agree or disagree, and explain why in your own voice. Be specific about what they said and what you think about it.\n`;
  }

  // Length guide goes LAST so it's the final instruction before generation
  const lengthGuide = PERSONA_LENGTH_GUIDE[persona.name];
  const guide = isBlindRound
    ? lengthGuide?.blind ?? 'Keep your response to ONE sentence.'
    : lengthGuide?.normal ?? 'Keep your response very short — 1 to 2 sentences max.';

  prompt += `\n## Response Length\n${guide} No bullet points, no lists, no headers. Plain conversational text only.\n`;

  return prompt;
}

interface RoomHistoryMsg {
  role: 'user' | 'assistant';
  content: string;
  persona_name?: string | null;
}

function buildApiMessages(
  history: RoomHistoryMsg[],
  turnResponses: TurnResponse[],
  userMessage: string,
  isFollowUp: boolean = false
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Convert room history — keep each assistant message as a separate exchange
  // Persona attribution is only in the system prompt context, not in the content
  for (const msg of history) {
    if (!msg.content || msg.content.trim() === '') continue;
    if (messages.length > 0 && messages[messages.length - 1].role === msg.role) {
      messages[messages.length - 1].content += '\n\n' + msg.content;
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Build the user message, including context about other personas' responses this turn
  let fullUserMessage = userMessage;

  if (turnResponses.length > 0) {
    if (isFollowUp) {
      // For follow-ups, show all responses and ask the persona to react to one
      const context = turnResponses
        .map((r) => `${r.name}: "${r.content}"`)
        .join('\n\n');
      fullUserMessage += `\n\n[Here's what the other members said:]\n${context}\n\n[Pick ONE of these responses. Say whether you agree or disagree with it, and why.]`;
    } else {
      const context = turnResponses
        .map((r) => `${r.name}: "${r.content}"`)
        .join('\n\n');
      fullUserMessage += `\n\n[The following responses are from OTHER members — not you. Do not repeat, claim, or rephrase their words as your own.]\n${context}\n\n[Now respond as yourself with a DIFFERENT perspective. Do not echo what was already said.]`;
    }
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

  return messages.slice(cutoffIndex).filter((m) => m.content && m.content.trim() !== '');
}

/** Strip Grok internal tokens from a streaming chunk, buffering partial `<` tags */
function stripStreamArtifacts(text: string, tagBuffer: { partial: string }): string {
  let input = tagBuffer.partial + text;
  tagBuffer.partial = '';

  // Strip complete tags: <|token|>, <tag>...</tag>, etc.
  input = input.replace(/<\|[^|>]*\|>/g, '');
  input = input.replace(/<query_has_boxed>\s*\w+\s*<\/query_has_boxed>/g, '');
  input = input.replace(/<[a-z_/][^>]*>/gi, '');

  // If input ends with an incomplete `<`, buffer it for the next chunk
  const lastOpen = input.lastIndexOf('<');
  if (lastOpen !== -1 && !input.slice(lastOpen).includes('>')) {
    tagBuffer.partial = input.slice(lastOpen);
    input = input.slice(0, lastOpen);
  }

  return input;
}

async function streamPersonaResponse(
  personaName: string,
  systemPrompt: string,
  apiMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  personaId: string,
  emit: (event: RoomStreamEvent) => void,
  signal: AbortSignal,
  options?: { suppressPass?: boolean }
): Promise<string> {
  const temperature = PERSONA_TEMPERATURES[personaName] ?? 0.5;
  const suppressPass = options?.suppressPass ?? false;
  const model = getModel(personaName);

  const result = streamText({
    model,
    maxOutputTokens: PERSONA_ROOM_TOKENS[personaName] ?? ROOM_MAX_RESPONSE_TOKENS,
    temperature,
    system: systemPrompt,
    messages: apiMessages,
    abortSignal: signal,
  });

  let fullResponse = '';
  let passBuffer = '';
  let passFlushed = false;
  const tagBuffer = { partial: '' };

  for await (const chunk of result.textStream) {
    fullResponse += chunk;

    // Strip Grok artifacts before emitting to client
    const cleaned = stripStreamArtifacts(chunk, tagBuffer);
    if (!cleaned) continue;

    // When suppressPass is active, buffer initial text to detect "pass"
    // before showing anything to the user
    if (!suppressPass || passFlushed) {
      emit({ type: 'text_delta', persona_id: personaId, text: cleaned });
      continue;
    }

    passBuffer += cleaned;
    if (passBuffer.length > 10) {
      // Definitely not just "pass" — flush buffer and stream normally
      emit({ type: 'text_delta', persona_id: personaId, text: passBuffer });
      passBuffer = '';
      passFlushed = true;
    }
  }

  // Flush any remaining tag buffer content (incomplete tag at end of stream)
  if (tagBuffer.partial) {
    const remaining = tagBuffer.partial;
    tagBuffer.partial = '';
    if (!suppressPass || passFlushed) {
      emit({ type: 'text_delta', persona_id: personaId, text: remaining });
    } else {
      passBuffer += remaining;
    }
    fullResponse += '';  // already counted
  }

  // Flush remaining buffer if it wasn't a pass
  if (suppressPass && !passFlushed && passBuffer.length > 0 && !isPass(fullResponse)) {
    emit({ type: 'text_delta', persona_id: personaId, text: passBuffer });
  }

  return fullResponse;
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

    const supabase = await createServerClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Save user message
    await supabase
      .from('room_messages')
      .insert({ persona_id: null, role: 'user', content: message, ...userIdField(user) });

    // 2. Fetch all personas
    const { data: personas, error: personasError } = await supabase
      .from('personas')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

    if (personasError || !personas || personas.length === 0) {
      return Response.json({ error: 'No personas found' }, { status: 404 });
    }

    // 3. Fetch room history (excluding the message we just inserted — it's added manually)
    const { data: historyRows } = await supabase
      .from('room_messages')
      .select('*, personas(name, emoji, accent_color)')
      .eq('user_id', user.id)
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
    const MAX_INITIAL_RESPONDERS = 2;
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
              true,
              true // blind round
            );

            // Blind round: each persona responds independently (no visibility into others' responses)
            const apiMessages = applyRoomWindow(
              buildApiMessages(history, [], message),
              ROOM_AVAILABLE_TOKENS
            );

            const rawResponse = await streamPersonaResponse(
              persona.name,
              systemPrompt,
              apiMessages,
              persona.id,
              emit,
              controller.signal,
              { suppressPass: true }
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
                persona.name,
                forcePrompt,
                apiMessages,
                persona.id,
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
                  ...userIdField(user),
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
                ...userIdField(user),
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
            false // follow-up disabled for now
          ) {
            emit({ type: 'followup_start' });

            // Any active persona can do the follow-up —
            // they react to the responses from this round.
            const candidates = shuffleArray(activePersonas);

            const followupPersona = candidates[0];
            if (followupPersona) {
              // Show them the OTHER responses (exclude their own if they responded)
              const othersResponses = turnResponses.filter(
                (r) => r.persona_id !== followupPersona.id
              );

              if (!controller.signal.aborted && othersResponses.length > 0) {
              // Delay before follow-up
              await delay(1000 + Math.random() * 500);

              emit({
                type: 'persona_start',
                persona_id: followupPersona.id,
                persona_name: followupPersona.name,
                persona_emoji: followupPersona.emoji,
              });

              const systemPrompt = buildRoomSystemPrompt(
                followupPersona,
                personas as Persona[],
                true,
                true // follow-ups don't get pass option
              );

              // Pass the other personas' responses as context
              const apiMessages = applyRoomWindow(
                buildApiMessages(history, othersResponses, message, true),
                ROOM_AVAILABLE_TOKENS
              );

              const rawFollowup = await streamPersonaResponse(
                followupPersona.name,
                systemPrompt,
                apiMessages,
                followupPersona.id,
                emit,
                controller.signal
              );
              const response = cleanPersonaResponse(rawFollowup, followupPersona, personas as Persona[]);

              const { data: saved } = await supabase
                .from('room_messages')
                .insert({
                  persona_id: followupPersona.id,
                  role: 'assistant',
                  content: response,
                  ...userIdField(user),
                })
                .select('id')
                .single();

              emit({
                type: 'persona_complete',
                persona_id: followupPersona.id,
                message_id: saved?.id,
              });

              turnResponses.push({
                persona_id: followupPersona.id,
                name: followupPersona.name,
                content: response,
              });
              }
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
