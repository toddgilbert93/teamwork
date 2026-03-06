'use client';

import { useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { usePersonas } from '@/hooks/usePersonas';
import { useMessages } from '@/hooks/useMessages';
import { useChat } from '@/hooks/useChat';
import { useRoomMessages } from '@/hooks/useRoomMessages';
import { useRoomChat } from '@/hooks/useRoomChat';
import { TopBar } from '@/components/TopBar';
import { Sidebar } from '@/components/Sidebar';
import { ChatArea } from '@/components/ChatArea';
import { RoomArea } from '@/components/RoomArea';
import { ParticipantList } from '@/components/ParticipantList';
import { PersonaForm } from '@/components/PersonaForm';
import { MemoryModal } from '@/components/MemoryModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function Home() {
  const {
    activePersonaId,
    setActivePersonaId,
    showNewPersonaForm,
    setShowNewPersonaForm,
    editingPersona,
    setEditingPersona,
    showMemoryModal,
    setShowMemoryModal,
    showConfirmClear,
    setShowConfirmClear,
    showRoomResetConfirm,
    setShowRoomResetConfirm,
    activeTab,
  } = useAppStore();

  const { personas, loading: personasLoading, refetch: refetchPersonas, createPersona, updatePersona, deletePersona } = usePersonas();
  const { messages, loading: messagesLoading, addMessage, clearMessages } = useMessages(activePersonaId);

  // Room hooks
  const {
    messages: roomMessages,
    loading: roomMessagesLoading,
    addMessage: addRoomMessage,
    clearMessages: clearRoomMessages,
  } = useRoomMessages();

  const { sendMessage: sendRoomMessage, abort: abortRoom } = useRoomChat({
    personas,
    onMessageAdded: addRoomMessage,
  });

  // Auto-select the most recently interacted persona on initial load
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (hasAutoSelected.current || personasLoading || personas.length === 0 || activePersonaId) return;
    hasAutoSelected.current = true;

    const sorted = [...personas].sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });
    setActivePersonaId(sorted[0].id);
  }, [personas, personasLoading, activePersonaId, setActivePersonaId]);

  const activePersona = useMemo(
    () => personas.find((p) => p.id === activePersonaId) ?? null,
    [personas, activePersonaId]
  );

  const handleRefreshPersonas = useCallback(() => {
    refetchPersonas();
  }, [refetchPersonas]);

  const { sendMessage, abort } = useChat({
    personaId: activePersonaId,
    onMessageAdded: addMessage,
    onRefreshPersonas: handleRefreshPersonas,
  });

  const handleCreatePersona = async (data: {
    name: string;
    emoji: string;
    accent_color: string;
    tagline: string;
    personality: string;
  }) => {
    const created = await createPersona(data);
    if (created) {
      setActivePersonaId(created.id);
    }
  };

  const handleUpdatePersona = async (data: {
    name: string;
    emoji: string;
    accent_color: string;
    tagline: string;
    personality: string;
  }) => {
    if (!editingPersona) return;
    await updatePersona(editingPersona.id, data);
  };

  const handleDeletePersona = async () => {
    if (!editingPersona) return;
    await deletePersona(editingPersona.id);
    if (activePersonaId === editingPersona.id) {
      setActivePersonaId(null);
    }
    setEditingPersona(null);
  };

  const handleClearHistory = async (saveMemory: boolean) => {
    await clearMessages(saveMemory);
    setShowConfirmClear(false);
    refetchPersonas();
  };

  const handleRoomReset = async () => {
    await clearRoomMessages();
    setShowRoomResetConfirm(false);
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center p-0 sm:p-6 md:p-10 relative">
      {/* Background image — hidden on mobile */}
      <div
        className="hidden sm:block absolute inset-0"
        style={{
          backgroundImage: 'url(/b3.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {/* App card */}
      <div className="relative w-full h-full max-w-6xl sm:max-h-[900px] flex flex-col
                      rounded-none sm:rounded-2xl overflow-hidden
                      bg-[#faf9f6] sm:bg-[#faf9f6]/90 sm:backdrop-blur-xl
                      shadow-none sm:shadow-2xl sm:shadow-black/20
                      ring-0 sm:ring-1 sm:ring-black/10">
        <TopBar />

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar / Participant list */}
          {activeTab === 'chat' && (
            <Sidebar personas={personas} loading={personasLoading} />
          )}
          {activeTab === 'room' && (
            <ParticipantList personas={personas} loading={personasLoading} />
          )}

          {/* Main content with crossfade */}
          <div className="flex-1 relative min-w-0">
            <div
              className={`absolute inset-0 flex flex-col transition-opacity duration-200
                ${activeTab === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            >
              <ChatArea
                persona={activePersona}
                messages={messages}
                messagesLoading={messagesLoading}
                onSendMessage={sendMessage}
                onAbort={abort}
                onRefreshPersonas={handleRefreshPersonas}
              />
            </div>
            <div
              className={`absolute inset-0 flex flex-col transition-opacity duration-200
                ${activeTab === 'room' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            >
              <RoomArea
                personas={personas}
                messages={roomMessages}
                messagesLoading={roomMessagesLoading}
                onSendMessage={sendRoomMessage}
                onAbort={abortRoom}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PersonaForm
        open={showNewPersonaForm}
        onSave={handleCreatePersona}
        onClose={() => setShowNewPersonaForm(false)}
      />

      <PersonaForm
        open={!!editingPersona}
        persona={editingPersona}
        onSave={handleUpdatePersona}
        onDelete={handleDeletePersona}
        onClose={() => setEditingPersona(null)}
      />

      {activePersona && (
        <MemoryModal
          open={showMemoryModal}
          persona={activePersona}
          onClose={() => setShowMemoryModal(false)}
        />
      )}

      <ConfirmDialog
        open={showConfirmClear}
        title="Clear conversation?"
        message={`This will delete all messages with ${activePersona?.name || 'this persona'}. This cannot be undone.`}
        confirmLabel="Clear without saving"
        variant="danger"
        extraAction={{
          label: 'Save memory, then clear',
          onClick: () => handleClearHistory(true),
        }}
        onConfirm={() => handleClearHistory(false)}
        onCancel={() => setShowConfirmClear(false)}
      />

      <ConfirmDialog
        open={showRoomResetConfirm}
        title="Reset Room?"
        message="This will clear all Room conversation history. This cannot be undone."
        confirmLabel="Reset"
        variant="danger"
        onConfirm={handleRoomReset}
        onCancel={() => setShowRoomResetConfirm(false)}
      />
    </div>
  );
}
