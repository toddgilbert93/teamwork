'use client';

interface EmptyStateProps {
  onOpenSidebar: () => void;
}

export function EmptyState({ onOpenSidebar }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 min-w-0">
      <div className="text-5xl mb-4 opacity-80">✨</div>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">AI Companions</h2>
      <p className="text-sm text-gray-500 max-w-xs mb-6">
        Select a companion to start a conversation, or create a new one.
      </p>
      <button
        onClick={onOpenSidebar}
        className="lg:hidden px-4 py-2 bg-gray-900/80 text-white rounded-xl text-sm hover:bg-gray-800 transition-colors"
      >
        Open Sidebar
      </button>
    </div>
  );
}
