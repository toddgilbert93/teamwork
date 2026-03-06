'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import type { RoomMessage } from '@/lib/types';

export function useRoomMessages() {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const hasFetched = useRef(false);
  const activeTab = useAppStore((s) => s.activeTab);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/room/messages');
      if (!res.ok) throw new Error('Failed to fetch room messages');
      const data = await res.json();
      setMessages(data);
      hasFetched.current = true;
    } catch (err) {
      console.error('Failed to fetch room messages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch when the Room tab is active and we haven't fetched yet
  useEffect(() => {
    if (activeTab === 'room' && !hasFetched.current) {
      fetchMessages();
    }
  }, [activeTab, fetchMessages]);

  const addMessage = (message: RoomMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const clearMessages = async () => {
    const res = await fetch('/api/room/messages', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear room messages');
    setMessages([]);
  };

  return { messages, loading, addMessage, clearMessages, refetch: fetchMessages };
}
