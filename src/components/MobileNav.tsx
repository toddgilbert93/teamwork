'use client';

import { useAppStore } from '@/stores/app-store';

export function MobileNav() {
  const { toggleSidebar } = useAppStore();

  return (
    <button
      onClick={toggleSidebar}
      className="lg:hidden fixed top-3 left-3 z-30 w-10 h-10 flex items-center justify-center
               rounded-xl bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200/60"
    >
      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
