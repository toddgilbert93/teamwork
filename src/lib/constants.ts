export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-20250514';
export const MAX_RESPONSE_TOKENS = 4096;
export const TARGET_MESSAGE_TOKENS = 80000;
export const SYSTEM_PROMPT_BUFFER = 4000;
export const AVAILABLE_FOR_MESSAGES = TARGET_MESSAGE_TOKENS - SYSTEM_PROMPT_BUFFER - MAX_RESPONSE_TOKENS;
export const MEMORY_MAX_TOKENS = 1024;
export const RELATIONSHIP_MAX_CHARS = 10000;

export const PERSONA_MODELS: Record<string, string> = {
  'Mira': 'anthropic/claude-sonnet-4.6',
  'Sol': 'anthropic/claude-sonnet-4.6',
  'Rex': 'anthropic/claude-sonnet-4.6',
};
