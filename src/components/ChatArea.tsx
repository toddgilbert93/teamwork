'use client';

import { useAppStore } from '@/stores/app-store';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { EmptyState } from './EmptyState';
import type { Persona, Message } from '@/lib/types';

interface ChatAreaProps {
  persona: Persona | null;
  messages: Message[];
  messagesLoading: boolean;
  onSendMessage: (text: string) => void;
  onAbort: () => void;
  onRefreshPersonas: () => void;
}

export function ChatArea({
  persona,
  messages,
  messagesLoading,
  onSendMessage,
  onAbort,
  onRefreshPersonas,
}: ChatAreaProps) {
  const { isStreaming, streamingText, toggleSidebar } = useAppStore();

  if (!persona) {
    return <EmptyState onOpenSidebar={toggleSidebar} />;
  }

  return (
    <div
      className="flex-1 flex flex-col h-full relative min-w-0"
      style={{ '--persona-accent': persona.accent_color } as React.CSSProperties}
    >
      <ChatHeader persona={persona} onRefreshPersonas={onRefreshPersonas} />

      <MessageList
        messages={messages}
        persona={persona}
        isStreaming={isStreaming}
        streamingText={streamingText}
        loading={messagesLoading}
      />

      <ChatInput
        persona={persona}
        onSend={onSendMessage}
        onAbort={onAbort}
        isStreaming={isStreaming}
      />
    </div>
  );
}
