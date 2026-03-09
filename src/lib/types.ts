export interface Persona {
  id: string;
  name: string;
  emoji: string;
  accent_color: string;
  system_prompt: string;
  tagline: string | null;
  sort_order: number;
  memory_summary: string | null;
  is_default: boolean;
  created_at: string;
  // Joined from messages table for sidebar preview
  last_message_content?: string | null;
  last_message_at?: string | null;
  last_message_role?: string | null;
  total_characters?: number;
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

export interface RoomMessage {
  id: string;
  persona_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  persona_name?: string;
  persona_emoji?: string;
  persona_accent_color?: string;
}

export interface RoomStreamEvent {
  type:
    | 'persona_start'
    | 'text_delta'
    | 'persona_complete'
    | 'persona_pass'
    | 'turn_complete'
    | 'followup_start'
    | 'all_complete'
    | 'error';
  persona_id?: string;
  persona_name?: string;
  persona_emoji?: string;
  text?: string;
  message_id?: string;
  message?: string;
}
