'use client';

import { useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import type { Message } from '@/lib/types';

interface UseChatOptions {
  personaId: string | null;
  onMessageAdded: (message: Message) => void;
  onRefreshPersonas: () => void;
}

export function useChat({ personaId, onMessageAdded, onRefreshPersonas }: UseChatOptions) {
  const abortRef = useRef<AbortController | null>(null);
  const {
    setIsStreaming,
    appendStreamingText,
    clearStreamingText,
  } = useAppStore();

  const sendMessage = useCallback(async (text: string) => {
    if (!personaId || !text.trim()) return;

    // Add user message optimistically
    const userMessage: Message = {
      id: 'temp-' + Date.now(),
      persona_id: personaId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    onMessageAdded(userMessage);

    // Start streaming
    setIsStreaming(true);
    clearStreamingText();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: personaId, message: text }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || 'Chat request failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text_delta') {
                fullResponse += data.text;
                appendStreamingText(data.text);
              } else if (data.type === 'message_complete') {
                // Add completed assistant message
                const assistantMessage: Message = {
                  id: data.message_id || 'msg-' + Date.now(),
                  persona_id: personaId,
                  role: 'assistant',
                  content: fullResponse,
                  created_at: new Date().toISOString(),
                };
                onMessageAdded(assistantMessage);
              } else if (data.type === 'error') {
                console.error('Stream error:', data.message);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User aborted — that's fine
      } else {
        console.error('Chat error:', err);
      }
    } finally {
      setIsStreaming(false);
      clearStreamingText();
      abortRef.current = null;
      onRefreshPersonas();
    }
  }, [personaId, onMessageAdded, onRefreshPersonas, setIsStreaming, appendStreamingText, clearStreamingText]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, abort };
}
