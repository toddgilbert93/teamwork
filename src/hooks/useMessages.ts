'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Message } from '@/lib/types';

export function useMessages(personaId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!personaId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/messages?persona_id=${personaId}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setMessages(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const clearMessages = async (saveMemory: boolean = false) => {
    if (!personaId) return;

    if (saveMemory) {
      await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: personaId, action: 'summarize' }),
      });
    }

    const res = await fetch(`/api/messages?persona_id=${personaId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear messages');
    setMessages([]);
  };

  return { messages, loading, error, refetch: fetchMessages, addMessage, clearMessages };
}
