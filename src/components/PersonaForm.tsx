'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Persona } from '@/lib/types';

const EmojiPicker = dynamic(() => import('@emoji-mart/react').then((mod) => mod.default), {
  ssr: false,
  loading: () => <div className="w-[352px] h-[435px] bg-gray-50 rounded-xl animate-pulse" />,
});

interface PersonaFormProps {
  open: boolean;
  persona?: Persona | null;
  onSave: (data: {
    name: string;
    emoji: string;
    accent_color: string;
    tagline: string;
    personality: string;
  }) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

const PALETTE = [
  // Row 1
  '#F59E0B', '#F97316', '#EF4444', '#EC4899', '#8B5CF6', '#6366F1',
  // Row 2 (custom color button fills the 6th slot)
  '#3B82F6', '#06B6D4', '#10B981', '#84CC16', '#78716C',
];

export function PersonaForm({ open, persona, onSave, onDelete, onClose }: PersonaFormProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [accentColor, setAccentColor] = useState('#6366F1');
  const [tagline, setTagline] = useState('');
  const [personality, setPersonality] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCustomColor, setShowCustomColor] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const isEditing = !!persona;
  const isViewOnly = !!persona?.is_default;

  useEffect(() => {
    if (persona) {
      setName(persona.name);
      setEmoji(persona.emoji);
      setAccentColor(persona.accent_color);
      setTagline(persona.tagline || '');
      setPersonality(persona.system_prompt);
    } else {
      setName('');
      setEmoji('🤖');
      setAccentColor('#6366F1');
      setTagline('');
      setPersonality('');
    }
    setShowDelete(false);
    setShowEmojiPicker(false);
    setShowCustomColor(false);
  }, [persona, open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showEmojiPicker) {
          setShowEmojiPicker(false);
        } else {
          onClose();
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose, showEmojiPicker]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    function handleClick(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmojiPicker]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !personality.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), emoji, accent_color: accentColor, tagline: tagline.trim(), personality: personality.trim() });
      onClose();
    } catch (err) {
      console.error('Failed to save persona:', err);
    } finally {
      setSaving(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEmojiSelect = (emojiData: any) => {
    setEmoji(emojiData.native);
    setShowEmojiPicker(false);
  };

  const isCustomColor = !PALETTE.includes(accentColor);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 overflow-y-auto flex-1" style={{ overflow: showEmojiPicker ? 'visible' : undefined }}>
        <h3 className="font-semibold text-gray-900 mb-5">
          {isViewOnly ? 'View Companion' : isEditing ? 'Edit Persona' : 'New Companion'}
        </h3>

        {isViewOnly ? (
          /* View-only layout for default personas */
          <div className="space-y-5">
            {/* Emoji + Name */}
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: accentColor + '15' }}
              >
                {emoji}
              </div>
              <div>
                <p className="font-medium text-gray-900">{name}</p>
                {tagline && <p className="text-sm text-gray-500">{tagline}</p>}
              </div>
              <div
                className="ml-auto w-6 h-6 rounded-full border border-gray-200"
                style={{ backgroundColor: accentColor }}
                title={accentColor}
              />
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">System Prompt</label>
              <div className="w-full max-h-64 overflow-y-auto rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {personality}
              </div>
            </div>

            {/* Close button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium
                         text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Emoji + Name row */}
          <div className="flex gap-3 items-start">
            {/* Emoji picker trigger */}
            <div className="relative" ref={emojiPickerRef}>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Emoji</label>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-2xl
                         hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
                style={{ backgroundColor: accentColor + '10' }}
              >
                {emoji}
              </button>

              {/* Emoji picker dropdown */}
              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-2 z-[70] shadow-xl rounded-xl overflow-hidden">
                  <EmojiPicker
                    onEmojiSelect={handleEmojiSelect}
                    theme="light"
                    set="native"
                    skinTonePosition="search"
                    previewPosition="none"
                    maxFrequentRows={2}
                  />
                </div>
              )}
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 rounded-xl border border-gray-200 px-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-gray-200"
                placeholder="e.g. Atlas"
                required
              />
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Accent Color</label>
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => { setAccentColor(color); setShowCustomColor(false); }}
                  className="group relative w-8 h-8 rounded-md transition-all duration-150"
                  style={{ backgroundColor: color }}
                >
                  {accentColor === color && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-md ring-2 ring-transparent group-hover:ring-black/10 transition-all" />
                </button>
              ))}

              {/* Custom color toggle — fills last slot in row 2 */}
              <button
                type="button"
                onClick={() => setShowCustomColor(!showCustomColor)}
                className={`w-8 h-8 rounded-md border-2 border-dashed transition-all duration-150 flex items-center justify-center
                  ${isCustomColor
                    ? 'border-transparent'
                    : 'border-gray-200 hover:border-gray-300'
                  }`}
                style={isCustomColor ? { backgroundColor: accentColor } : undefined}
              >
                {isCustomColor ? (
                  <svg className="w-3.5 h-3.5 text-white drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </button>
            </div>

            {/* Custom color input */}
            {showCustomColor && (
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-28 h-10 rounded-lg border border-gray-200 px-3 text-sm font-mono
                           focus:outline-none focus:ring-2 focus:ring-gray-200 uppercase"
                  placeholder="#000000"
                  maxLength={7}
                />
              </div>
            )}
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-gray-200"
              placeholder="One-line description shown in sidebar"
            />
          </div>

          {/* Personality */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {isEditing ? 'System Prompt' : 'Personality Description'}
            </label>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              className="w-full h-36 rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none leading-relaxed"
              placeholder={isEditing
                ? "The full system prompt for this persona..."
                : "Describe their personality, how they think, what they care about... The app will generate a full system prompt from this."
              }
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <div>
              {isEditing && onDelete && (
                showDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Delete permanently?</span>
                    <button
                      type="button"
                      onClick={onDelete}
                      className="text-xs text-red-600 font-medium hover:underline"
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDelete(false)}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDelete(true)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete persona
                  </button>
                )
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium
                         text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim() || !personality.trim()}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium
                         hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Companion'}
              </button>
            </div>
          </div>
        </form>
        )}
        </div>
      </div>
    </div>
  );
}
