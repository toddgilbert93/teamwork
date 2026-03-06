'use client';

import { useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { usePersonas } from '@/hooks/usePersonas';
import { useMessages } from '@/hooks/useMessages';
import { useChat } from '@/hooks/useChat';
import { TopBar } from '@/components/TopBar';
import { Sidebar } from '@/components/Sidebar';
import { ChatArea } from '@/components/ChatArea';
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
    activeTab,
  } = useAppStore();

  const { personas, loading: personasLoading, refetch: refetchPersonas, createPersona, updatePersona, deletePersona } = usePersonas();
  const { messages, loading: messagesLoading, addMessage, clearMessages } = useMessages(activePersonaId);

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

  return (
    <div
      className="h-screen w-screen flex items-center justify-center p-4 sm:p-6 md:p-10"
      style={{
        backgroundImage: 'url(/b3.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* App card */}
      <div className="relative w-full h-full max-w-6xl max-h-[900px] flex flex-col rounded-2xl overflow-hidden
                      bg-[#faf9f6]/90 backdrop-blur-xl shadow-2xl shadow-black/20
                      ring-1 ring-black/10">
        <TopBar />

        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'chat' && (
            <Sidebar personas={personas} loading={personasLoading} />
          )}

          {activeTab === 'chat' ? (
            <ChatArea
              persona={activePersona}
              messages={messages}
              messagesLoading={messagesLoading}
              onSendMessage={sendMessage}
              onAbort={abort}
              onRefreshPersonas={handleRefreshPersonas}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="text-5xl mb-4 opacity-80">🏠</div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Room</h2>
              <p className="text-sm text-gray-500 max-w-xs">
                Coming soon. This is where shared spaces will live.
              </p>
            </div>
          )}
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
    </div>
  );
}
