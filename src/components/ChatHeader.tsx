'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/app-store';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { getRelationshipLabel, getRelationshipScore } from '@/lib/relationship';
import { accentBg } from '@/lib/utils';
import type { Persona } from '@/lib/types';

interface ChatHeaderProps {
  persona: Persona;
  onRefreshPersonas: () => void;
}

export function ChatHeader({ persona, onRefreshPersonas }: ChatHeaderProps) {
  const [open, setOpen] = useState(false);
  const {
    setEditingPersona,
    setShowMemoryModal,
    setShowConfirmClear,
  } = useAppStore();

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/export?persona_id=${persona.id}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${persona.name}-conversation.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const totalChars = persona.total_characters ?? 0;
  const relationshipScore = getRelationshipScore(totalChars);
  const relationshipLabel = getRelationshipLabel(totalChars);

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3 flex items-center flex-shrink-0">
      {/* Member info as dropdown trigger */}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 hover:bg-black/[0.03] rounded-lg px-2 py-1 -ml-2 transition-colors outline-none">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
              style={{ backgroundColor: accentBg(persona.accent_color, '15') }}
            >
              {persona.emoji}
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-sm text-gray-900">{persona.name}</h2>
              {persona.tagline && (
                <p className="text-xs text-gray-500">{persona.tagline}</p>
              )}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 rounded-xl">
          <DropdownMenuItem
            onClick={() => setEditingPersona(persona)}
            className="text-sm text-gray-700"
          >
            {persona.is_default ? 'View Details' : 'Edit Persona'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowMemoryModal(true)}
            className="text-sm text-gray-700"
          >
            View Memory
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowConfirmClear(true)}
            variant="destructive"
            className="text-sm"
          >
            Clear History
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      {/* Relationship meter */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200">
        <span className="text-xs font-medium text-gray-600">{relationshipLabel}</span>
        <div className="flex flex-col-reverse gap-[3px]">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`w-3 h-[3px] rounded-full transition-colors duration-300 ${
                level <= relationshipScore ? 'bg-emerald-400' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
