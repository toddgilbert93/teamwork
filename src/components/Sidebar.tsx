'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/app-store';
import { createBrowserClient } from '@/lib/supabase/client';
import { PersonaCard } from './PersonaCard';
import { LogOut } from 'lucide-react';
import type { Persona } from '@/lib/types';

interface SidebarProps {
  personas: Persona[];
  loading: boolean;
}

export function Sidebar({ personas, loading }: SidebarProps) {
  const {
    activePersonaId,
    setActivePersonaId,
    sidebarOpen,
    setShowNewPersonaForm,
  } = useAppStore();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Sort personas by most recent interaction
  const sortedPersonas = useMemo(() => {
    return [...personas].sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      // Fall back to created_at for personas with no messages
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [personas]);

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
        {/* Overline header */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <h1 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Companions
          </h1>
        </div>

        {/* Persona list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 space-y-1">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : personas.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              No companions yet. Create one to get started.
            </div>
          ) : (
            sortedPersonas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                isActive={persona.id === activePersonaId}
                onClick={() => {
                  setActivePersonaId(persona.id);
                }}
              />
            ))
          )}
        </div>

        {/* Add button and sign out at bottom */}
        <div className="px-2 pb-3 pt-1 flex-shrink-0 space-y-1">
          <button
            onClick={() => setShowNewPersonaForm(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
                     text-sm text-gray-500 hover:bg-black/[0.04] transition-colors"
          >
            <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-xs">+</span>
            New companion
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl
                     text-sm text-gray-400 hover:text-gray-600 hover:bg-black/[0.04] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
          {userEmail && (
            <p className="text-[11px] text-gray-400 px-3 truncate">
              Signed in as: {userEmail}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
