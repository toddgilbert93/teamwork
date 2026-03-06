'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, RoomMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: Message | RoomMessage;
  accentColor: string;
  personaName?: string;
  personaEmoji?: string;
}

export function MessageBubble({ message, accentColor, personaName, personaEmoji }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[80%]">
        {!isUser && personaName && (
          <div className="flex items-center gap-1.5 mb-1 ml-1 text-xs text-gray-500">
            <span className="text-sm">{personaEmoji}</span>
            <span className="font-medium" style={{ color: accentColor }}>{personaName}</span>
          </div>
        )}
        <div
          className={`
            rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${isUser
              ? 'bg-gray-900 text-white rounded-tr-sm'
              : 'rounded-tl-sm'
            }
          `}
          style={!isUser ? { backgroundColor: accentColor + '10' } : undefined}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="prose-message">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
