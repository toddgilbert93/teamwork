'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import type { Persona } from '@/lib/types';

interface ChatInputProps {
  persona: Persona;
  onSend: (text: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
}

export function ChatInput({ persona, onSend, onAbort, isStreaming }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { setShowConfirmClear, setShowMemoryModal } = useAppStore();

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [text]);

  // Focus on persona change
  useEffect(() => {
    textareaRef.current?.focus();
  }, [persona.id]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Command handling
    if (trimmed === '/clear') {
      setShowConfirmClear(true);
      setText('');
      return;
    }
    if (trimmed === '/memory') {
      setShowMemoryModal(true);
      setText('');
      return;
    }

    onSend(trimmed);
    setText('');
  }, [text, isStreaming, onSend, setShowConfirmClear, setShowMemoryModal]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4 flex-shrink-0">
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${persona.name}...`}
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
        Enter to send, Shift+Enter for newline. Type /clear or /memory for commands.
      </p>
    </div>
  );
}
