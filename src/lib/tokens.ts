import type { Message } from './types';

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export function estimateMessagesTokens(messages: { role: string; content: string }[]): number {
  return messages.reduce((sum, msg) => {
    return sum + estimateTokens(msg.content) + 4;
  }, 0);
}

export function applyWindowToMessages(
  messages: Message[],
  availableTokens: number
): { windowed: Message[]; trimmed: Message[] } {
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

  return {
    windowed: messages.slice(cutoffIndex),
    trimmed: messages.slice(0, cutoffIndex),
  };
}
