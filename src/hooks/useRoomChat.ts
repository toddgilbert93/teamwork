'use client';

import { useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import type { Persona, RoomMessage, RoomStreamEvent } from '@/lib/types';

interface UseRoomChatOptions {
  personas: Persona[];
  onMessageAdded: (message: RoomMessage) => void;
}

export function useRoomChat({ personas, onMessageAdded }: UseRoomChatOptions) {
  const abortRef = useRef<AbortController | null>(null);
  const {
    setRoomIsStreaming,
    setRoomStreamingPersonaId,
    appendRoomStreamingText,
    clearRoomStreamingText,
  } = useAppStore();

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Add user message optimistically
      const userMessage: RoomMessage = {
        id: 'temp-' + Date.now(),
        persona_id: null,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };
      onMessageAdded(userMessage);

      setRoomIsStreaming(true);
      clearRoomStreamingText();
      setRoomStreamingPersonaId(null);

      const controller = new AbortController();
      abortRef.current = controller;

      let currentPersonaAccumulator = '';

      try {
        const res = await fetch('/api/room/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errData.error || 'Room chat request failed');
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data: RoomStreamEvent = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'persona_start':
                  currentPersonaAccumulator = '';
                  setRoomStreamingPersonaId(data.persona_id ?? null);
                  clearRoomStreamingText();
                  break;

                case 'text_delta':
                  currentPersonaAccumulator += data.text ?? '';
                  appendRoomStreamingText(data.text ?? '');
                  break;

                case 'persona_complete': {
                  const p = personas.find((p) => p.id === data.persona_id);
                  const assistantMessage: RoomMessage = {
                    id: data.message_id || 'msg-' + Date.now(),
                    persona_id: data.persona_id ?? null,
                    role: 'assistant',
                    content: currentPersonaAccumulator,
                    created_at: new Date().toISOString(),
                    persona_name: p?.name,
                    persona_emoji: p?.emoji,
                    persona_accent_color: p?.accent_color,
                  };
                  onMessageAdded(assistantMessage);
                  clearRoomStreamingText();
                  setRoomStreamingPersonaId(null);
                  currentPersonaAccumulator = '';
                  break;
                }

                case 'persona_pass':
                  clearRoomStreamingText();
                  setRoomStreamingPersonaId(null);
                  currentPersonaAccumulator = '';
                  break;

                case 'all_complete':
                  break;

                case 'error':
                  console.error('Room stream error:', data.message);
                  break;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User aborted
        } else {
          console.error('Room chat error:', err);
        }
      } finally {
        setRoomIsStreaming(false);
        setRoomStreamingPersonaId(null);
        clearRoomStreamingText();
        abortRef.current = null;
      }
    },
    [
      personas,
      onMessageAdded,
      setRoomIsStreaming,
      setRoomStreamingPersonaId,
      appendRoomStreamingText,
      clearRoomStreamingText,
    ]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, abort };
}
