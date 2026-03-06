import { create } from 'zustand';
import type { Persona } from '@/lib/types';

interface AppState {
  activePersonaId: string | null;
  setActivePersonaId: (id: string | null) => void;

  activeTab: 'chat' | 'room';
  setActiveTab: (tab: 'chat' | 'room') => void;

  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  streamingText: string;
  appendStreamingText: (text: string) => void;
  clearStreamingText: () => void;

  editingPersona: Persona | null;
  setEditingPersona: (p: Persona | null) => void;
  showNewPersonaForm: boolean;
  setShowNewPersonaForm: (show: boolean) => void;
  showMemoryModal: boolean;
  setShowMemoryModal: (show: boolean) => void;
  showConfirmClear: boolean;
  setShowConfirmClear: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activePersonaId: null,
  setActivePersonaId: (id) => set({ activePersonaId: id }),

  activeTab: 'chat',
  setActiveTab: (tab) => set({ activeTab: tab }),

  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  isStreaming: false,
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  streamingText: '',
  appendStreamingText: (text) =>
    set((s) => ({ streamingText: s.streamingText + text })),
  clearStreamingText: () => set({ streamingText: '' }),

  editingPersona: null,
  setEditingPersona: (p) => set({ editingPersona: p }),
  showNewPersonaForm: false,
  setShowNewPersonaForm: (show) => set({ showNewPersonaForm: show }),
  showMemoryModal: false,
  setShowMemoryModal: (show) => set({ showMemoryModal: show }),
  showConfirmClear: false,
  setShowConfirmClear: (show) => set({ showConfirmClear: show }),
}));
