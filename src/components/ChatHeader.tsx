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

  return (
    <div className="border-b border-gray-200/40 bg-white/30 px-4 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-base"
          style={{ backgroundColor: persona.accent_color + '15' }}
        >
          {persona.emoji}
        </div>
        <div>
          <h2 className="font-semibold text-sm text-gray-900">{persona.name}</h2>
          {persona.tagline && (
            <p className="text-xs text-gray-500">{persona.tagline}</p>
          )}
        </div>
      </div>

      {/* Actions menu */}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 text-sm transition-colors outline-none">
            Customize
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl">
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
          <DropdownMenuItem
            onClick={handleExport}
            className="text-sm text-gray-700"
          >
            Export as Markdown
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
    </div>
  );
}
