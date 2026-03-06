'use client';

import { useState, useEffect } from 'react';
import type { Persona } from '@/lib/types';

interface MemoryModalProps {
  open: boolean;
  persona: Persona;
  onClose: () => void;
}

export function MemoryModal({ open, persona, onClose }: MemoryModalProps) {
  const [memory, setMemory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/memory?persona_id=${persona.id}`)
      .then((res) => res.json())
      .then((data) => setMemory(data.memory_summary))
      .catch(() => setMemory(null))
      .finally(() => setLoading(false));
  }, [open, persona.id]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span>{persona.emoji}</span>
            {persona.name}&apos;s Memory
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-400">Loading memory...</div>
        ) : memory ? (
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl p-4">
            {memory}
          </div>
        ) : (
          <div className="text-sm text-gray-400 text-center py-8">
            No memory summary yet. This persona hasn&apos;t had enough conversation to build a memory.
            Memories are created automatically when conversations get long, or when you clear history with memory saving.
          </div>
        )}
      </div>
    </div>
  );
}
