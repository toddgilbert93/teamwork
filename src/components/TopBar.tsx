'use client';

import { useAppStore } from '@/stores/app-store';
import { PanelLeft, Plus } from 'lucide-react';

const TABS = [
  { key: 'room', label: 'Room' },
  { key: 'chat', label: 'Chat' },
] as const;

export function TopBar() {
  const { activeTab, setActiveTab, toggleSidebar, setShowNewPersonaForm } = useAppStore();

  return (
    <div className="flex items-center px-3 py-2 border-b border-gray-200/50 bg-white/15 flex-shrink-0">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/[0.04] text-gray-500 transition-colors"
      >
        <PanelLeft className="w-[18px] h-[18px]" />
      </button>

      {/* Tabs - centered */}
      <div className="flex-1 flex justify-center">
        <div className="flex gap-1 bg-black/[0.04] rounded-lg p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200
                ${activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* New member */}
      <button
        onClick={() => setShowNewPersonaForm(true)}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/[0.04] text-gray-500 transition-colors"
      >
        <Plus className="w-[18px] h-[18px]" />
      </button>
    </div>
  );
}
