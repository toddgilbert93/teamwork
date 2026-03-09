'use client';

import { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { StreamingIndicator } from './StreamingIndicator';
import type { Persona, RoomMessage } from '@/lib/types';
import { accentBg } from '@/lib/utils';

interface RoomMessageListProps {
  messages: RoomMessage[];
  personas: Persona[];
  isStreaming: boolean;
  streamingText: string;
  streamingPersonaId: string | null;
  loading: boolean;
}

export function RoomMessageList({
  messages,
  personas,
  isStreaming,
  streamingText,
  streamingPersonaId,
  loading,
}: RoomMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
          Loading room...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 space-y-4">
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="flex -space-x-2 mb-4">
            {personas.map((p) => (
              <div
                key={p.id}
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl ring-2 ring-white"
                style={{ backgroundColor: accentBg(p.accent_color, '15') }}
              >
                {p.emoji}
              </div>
            ))}
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Start a group conversation</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Send a message and all your members will join in.
          </p>
        </div>
      )}

      {messages.map((msg) => {
        const persona = msg.persona_id
          ? personas.find((p) => p.id === msg.persona_id)
          : null;

        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            accentColor={msg.persona_accent_color || persona?.accent_color || '#6366f1'}
            personaName={msg.role === 'assistant' ? (msg.persona_name || persona?.name) : undefined}
            personaEmoji={msg.role === 'assistant' ? (msg.persona_emoji || persona?.emoji) : undefined}
          />
        );
      })}

      {/* Streaming message */}
      {isStreaming && streamingPersonaId && (() => {
        const p = personas.find((p) => p.id === streamingPersonaId);
        if (!p) return null;
        return (
          <div className="flex justify-start">
            <div className="max-w-[80%]">
              <div className="flex items-center gap-1.5 mb-1 ml-1 text-xs text-gray-500">
                <span className="text-sm">{p.emoji}</span>
                <span className="font-medium" style={{ color: p.accent_color }}>
                  {p.name}
                </span>
              </div>
              <div
                className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm"
                style={{ backgroundColor: accentBg(p.accent_color, '10') }}
              >
                {streamingText ? (
                  <div className="prose-message whitespace-pre-wrap">{streamingText}</div>
                ) : (
                  <StreamingIndicator emoji={p.emoji} />
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div ref={bottomRef} />
    </div>
  );
}
