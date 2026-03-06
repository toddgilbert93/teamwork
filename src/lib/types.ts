export interface Persona {
  id: string;
  name: string;
  emoji: string;
  accent_color: string;
  system_prompt: string;
  tagline: string | null;
  sort_order: number;
  memory_summary: string | null;
  created_at: string;
  // Joined from messages table for sidebar preview
  last_message_content?: string | null;
  last_message_at?: string | null;
  last_message_role?: string | null;
}

export interface Message {
  id: string;
  persona_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface StreamEvent {
  type: 'text_delta' | 'message_complete' | 'error';
  text?: string;
  message?: string;
}
