'use client';

import { useAppStore } from '@/stores/app-store';
import type { Persona } from '@/lib/types';

interface ParticipantListProps {
  personas: Persona[];
  loading: boolean;
}

export function ParticipantList({ personas, loading }: ParticipantListProps) {
  const { sidebarOpen, mutedPersonaIds, toggleMutedPersona } = useAppStore();

  return (
    <aside
      className={`
        h-full flex-shrink-0 overflow-hidden
        bg-white/50 backdrop-blur-sm
        flex flex-col
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'w-[280px] border-r border-gray-200/40' : 'w-0'}
      `}
    >
      <div className="w-[280px] h-full flex flex-col">
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <h1 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Participants
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 space-y-1">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : personas.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              No companions yet.
            </div>
          ) : (
            personas.map((persona) => {
              const isMuted = mutedPersonaIds.has(persona.id);
              return (
                <div
                  key={persona.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-opacity ${isMuted ? 'opacity-40' : ''}`}
                    style={{ backgroundColor: persona.accent_color + '15' }}
                  >
                    {persona.emoji}
                  </div>
                  <p className={`flex-1 min-w-0 text-sm font-medium truncate transition-colors ${isMuted ? 'text-gray-400' : 'text-gray-900'}`}>
                    {persona.name}
                  </p>
                  <button
                    onClick={() => toggleMutedPersona(persona.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-all
                      ${isMuted
                        ? 'bg-gray-100 text-gray-400 hover:bg-gray-200/60'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isMuted ? 'bg-gray-300' : 'bg-emerald-400'}`} />
                    {isMuted ? 'Muted' : 'Active'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-3 flex-shrink-0 border-t border-gray-200/40">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Room conversations are not saved to companion memories.
          </p>
        </div>
      </div>
    </aside>
  );
}
