'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/stores/app-store';
import type { Persona } from '@/lib/types';
import { accentBg } from '@/lib/utils';

interface RoomInputProps {
  personas: Persona[];
  onSend: (text: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
}

export function RoomInput({ personas, onSend, onAbort, isStreaming }: RoomInputProps) {
  const [text, setText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);
  const { setShowRoomResetConfirm, setRoomTopic } = useAppStore();

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [text]);

  const filteredPersonas = useMemo(() => {
    if (!mentionFilter) return personas;
    return personas.filter((p) =>
      p.name.toLowerCase().startsWith(mentionFilter.toLowerCase())
    );
  }, [personas, mentionFilter]);

  // Reset mention index when filter changes
  useEffect(() => {
    setMentionIndex(0);
  }, [mentionFilter]);

  const insertMention = useCallback(
    (persona: Persona) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const cursorPos = ta.selectionStart;
      const before = text.slice(0, cursorPos);
      const after = text.slice(cursorPos);

      // Find the @ position
      const atIndex = before.lastIndexOf('@');
      if (atIndex === -1) return;

      const newText = before.slice(0, atIndex) + `@${persona.name} ` + after;
      setText(newText);
      setShowMentions(false);
      setMentionFilter('');

      // Focus and set cursor after the inserted mention
      setTimeout(() => {
        const newPos = atIndex + persona.name.length + 2; // @ + name + space
        ta.focus();
        ta.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [text]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Check for @ mention trigger
    const cursorPos = e.target.selectionStart;
    const before = val.slice(0, cursorPos);
    const atMatch = before.match(/@(\w*)$/);

    if (atMatch) {
      setShowMentions(true);
      setMentionFilter(atMatch[1]);
    } else {
      setShowMentions(false);
      setMentionFilter('');
    }
  };

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Command handling
    if (trimmed === '/reset') {
      setShowRoomResetConfirm(true);
      setText('');
      return;
    }
    if (trimmed.startsWith('/topic ')) {
      const topic = trimmed.slice(7).trim();
      setRoomTopic(topic || null);
      setText('');
      return;
    }
    if (trimmed === '/topic') {
      setRoomTopic(null);
      setText('');
      return;
    }

    onSend(trimmed);
    setText('');
  }, [text, isStreaming, onSend, setShowRoomResetConfirm, setRoomTopic]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredPersonas.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredPersonas.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredPersonas.length) % filteredPersonas.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        insertMention(filteredPersonas[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4 flex-shrink-0">
      <div className="relative max-w-3xl mx-auto">
        {/* @-mention dropdown */}
        {showMentions && filteredPersonas.length > 0 && (
          <div
            ref={mentionRef}
            className="absolute bottom-full mb-2 left-0 w-56 bg-white rounded-xl shadow-lg border border-gray-200/60 overflow-hidden z-20"
          >
            {filteredPersonas.map((p, i) => (
              <button
                key={p.id}
                onClick={() => insertMention(p)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                  ${i === mentionIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center text-xs"
                  style={{ backgroundColor: accentBg(p.accent_color, '15') }}
                >
                  {p.emoji}
                </span>
                <span className="font-medium text-gray-700">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Message the room..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200/60 bg-white/70 px-4 py-3
                     text-sm focus:outline-none focus:ring-2 focus:ring-gray-200/50
                     placeholder:text-gray-400"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              onClick={onAbort}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500 text-white
                       flex items-center justify-center hover:bg-red-600 transition-colors"
              title="Stop generating"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <rect x="3" y="3" width="10" height="10" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-900 text-white
                       flex items-center justify-center hover:bg-gray-800 transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-[11px] text-gray-400 text-center mt-2">
          Enter to send, Shift+Enter for newline. @name to mention. /reset or /topic for commands.
        </p>
      </div>
    </div>
  );
}
