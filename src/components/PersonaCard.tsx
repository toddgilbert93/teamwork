'use client';

import type { Persona } from '@/lib/types';
import { formatRelativeTime, accentBg } from '@/lib/utils';

interface PersonaCardProps {
  persona: Persona;
  isActive: boolean;
  onClick: () => void;
}

export function PersonaCard({ persona, isActive, onClick }: PersonaCardProps) {
  const lastMessage = persona.last_message_content;
  const lastTime = persona.last_message_at;
  const isUnread = persona.last_message_role === 'assistant';

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-xl transition-all duration-200
        flex items-start gap-3 group
        ${isActive
          ? 'bg-black/[0.04]'
          : 'hover:bg-black/[0.02]'
        }
      `}
    >
      {/* Emoji avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: accentBg(persona.accent_color, '15') }}
      >
        {persona.emoji}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm text-gray-900">{persona.name}</span>
          {lastTime && (
            <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
              {formatRelativeTime(lastTime)}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate mt-0.5">
          {lastMessage || persona.tagline || 'Start a conversation...'}
        </p>
      </div>

      {/* Unread dot */}
      {isUnread && !isActive && (
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
          style={{ backgroundColor: persona.accent_color }}
        />
      )}
    </button>
  );
}
