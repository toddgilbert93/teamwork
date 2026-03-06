'use client';

import { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { StreamingIndicator } from './StreamingIndicator';
import type { Persona, Message } from '@/lib/types';

interface MessageListProps {
  messages: Message[];
  persona: Persona;
  isStreaming: boolean;
  streamingText: string;
  loading: boolean;
}

export function MessageList({ messages, persona, isStreaming, streamingText, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
          Loading conversation...
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 space-y-4"
    >
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
            style={{ backgroundColor: persona.accent_color + '15' }}
          >
            {persona.emoji}
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">
            Start a conversation with {persona.name}
          </h3>
          <p className="text-sm text-gray-500 max-w-sm">
            {persona.tagline}
          </p>
        </div>
      )}

      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} accentColor={persona.accent_color} />
      ))}

      {/* Streaming message */}
      {isStreaming && (
        <div className="flex justify-start">
          <div
            className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm"
            style={{ backgroundColor: persona.accent_color + '10' }}
          >
            {streamingText ? (
              <div className="prose-message whitespace-pre-wrap">{streamingText}</div>
            ) : (
              <StreamingIndicator emoji={persona.emoji} />
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
