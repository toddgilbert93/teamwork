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

  // 1-on-1 chat streaming
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  streamingText: string;
  appendStreamingText: (text: string) => void;
  clearStreamingText: () => void;

  // Room streaming
  roomIsStreaming: boolean;
  setRoomIsStreaming: (streaming: boolean) => void;
  roomStreamingPersonaId: string | null;
  setRoomStreamingPersonaId: (id: string | null) => void;
  roomStreamingText: string;
  appendRoomStreamingText: (text: string) => void;
  clearRoomStreamingText: () => void;

  // Room topic
  roomTopic: string | null;
  setRoomTopic: (topic: string | null) => void;

  // Room muted personas
  mutedPersonaIds: Set<string>;
  toggleMutedPersona: (id: string) => void;

  // Room reset confirm
  showRoomResetConfirm: boolean;
  setShowRoomResetConfirm: (show: boolean) => void;

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

  roomIsStreaming: false,
  setRoomIsStreaming: (streaming) => set({ roomIsStreaming: streaming }),
  roomStreamingPersonaId: null,
  setRoomStreamingPersonaId: (id) => set({ roomStreamingPersonaId: id }),
  roomStreamingText: '',
  appendRoomStreamingText: (text) =>
    set((s) => ({ roomStreamingText: s.roomStreamingText + text })),
  clearRoomStreamingText: () => set({ roomStreamingText: '' }),

  roomTopic: typeof window !== 'undefined' ? localStorage.getItem('room-topic') : null,
  setRoomTopic: (topic) => {
    if (typeof window !== 'undefined') {
      if (topic) localStorage.setItem('room-topic', topic);
      else localStorage.removeItem('room-topic');
    }
    set({ roomTopic: topic });
  },

  mutedPersonaIds: new Set<string>(),
  toggleMutedPersona: (id) =>
    set((s) => {
      const next = new Set(s.mutedPersonaIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { mutedPersonaIds: next };
    }),

  showRoomResetConfirm: false,
  setShowRoomResetConfirm: (show) => set({ showRoomResetConfirm: show }),

  editingPersona: null,
  setEditingPersona: (p) => set({ editingPersona: p }),
  showNewPersonaForm: false,
  setShowNewPersonaForm: (show) => set({ showNewPersonaForm: show }),
  showMemoryModal: false,
  setShowMemoryModal: (show) => set({ showMemoryModal: show }),
  showConfirmClear: false,
  setShowConfirmClear: (show) => set({ showConfirmClear: show }),
}));
