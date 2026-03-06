'use client';

interface StreamingIndicatorProps {
  emoji: string;
}

export function StreamingIndicator({ emoji }: StreamingIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{emoji}</span>
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
