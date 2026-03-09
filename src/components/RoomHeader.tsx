'use client';

import type { Persona } from '@/lib/types';
import { accentBg } from '@/lib/utils';

interface RoomHeaderProps {
  personas: Persona[];
  topic: string | null;
}

export function RoomHeader({ personas, topic }: RoomHeaderProps) {
  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Persona avatars */}
        <div className="flex -space-x-1.5">
          {personas.map((p) => (
            <div
              key={p.id}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm ring-2 ring-white/80"
              style={{ backgroundColor: accentBg(p.accent_color, '20') }}
              title={p.name}
            >
              {p.emoji}
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Room</h2>
          {topic && (
            <p className="text-xs text-gray-500 truncate">{topic}</p>
          )}
        </div>
      </div>
    </div>
  );
}
