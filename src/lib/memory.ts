import { getAnthropicClient } from './anthropic';
import { MODEL_NAME } from './constants';
import type { Message } from './types';

const SUMMARIZE_PROMPT = `You are a memory management system. Create a concise summary of this conversation that captures the essential context needed to continue naturally.

Previous memory summary (if any):
{existingMemory}

Recent messages to incorporate:
{messages}

Create an updated summary that:
1. Preserves key facts, decisions, and context from both the existing summary and new messages
2. Notes the user's preferences, goals, and ongoing projects
3. Tracks any commitments, action items, or decisions made
4. Captures the emotional tone and relationship dynamics
5. Notes specific names, dates, and details mentioned
6. Stays under 500 words
7. Uses present tense and third person ("The user is working on...")

Updated summary:`;

export async function generateMemorySummary(
  messages: Message[],
  existingMemory: string | null
): Promise<string> {
  const client = getAnthropicClient();

  const messagesText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const prompt = SUMMARIZE_PROMPT
    .replace('{existingMemory}', existingMemory || 'None')
    .replace('{messages}', messagesText);

  const response = await client.messages.create({
    model: MODEL_NAME,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock?.text || '';
}
