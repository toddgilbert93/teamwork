'use client';

import { useAppStore } from '@/stores/app-store';
import { RoomMessageList } from './RoomMessageList';
import { RoomInput } from './RoomInput';
import type { Persona, RoomMessage } from '@/lib/types';

interface RoomAreaProps {
  personas: Persona[];
  messages: RoomMessage[];
  messagesLoading: boolean;
  onSendMessage: (text: string) => void;
  onAbort: () => void;
}

export function RoomArea({
  personas,
  messages,
  messagesLoading,
  onSendMessage,
  onAbort,
}: RoomAreaProps) {
  const { roomIsStreaming, roomStreamingText, roomStreamingPersonaId } =
    useAppStore();

  return (
    <div className="flex-1 flex flex-col h-full relative min-w-0">

      <RoomMessageList
        messages={messages}
        personas={personas}
        isStreaming={roomIsStreaming}
        streamingText={roomStreamingText}
        streamingPersonaId={roomStreamingPersonaId}
        loading={messagesLoading}
      />

      <RoomInput
        personas={personas}
        onSend={onSendMessage}
        onAbort={onAbort}
        isStreaming={roomIsStreaming}
      />
    </div>
  );
}
