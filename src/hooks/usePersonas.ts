'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Persona } from '@/lib/types';

export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPersonas = useCallback(async () => {
    try {
      const res = await fetch('/api/personas');
      if (!res.ok) throw new Error('Failed to fetch personas');
      const data = await res.json();
      setPersonas(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  const createPersona = async (data: {
    name: string;
    emoji: string;
    accent_color: string;
    tagline: string;
    personality: string;
  }) => {
    const res = await fetch('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create persona');
    await fetchPersonas();
    const created = await res.json();
    return created as Persona;
  };

  const updatePersona = async (
    id: string,
    data: {
      name: string;
      emoji: string;
      accent_color: string;
      tagline: string;
      personality: string;
    }
  ) => {
    const res = await fetch(`/api/personas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update persona');
    await fetchPersonas();
  };

  const deletePersona = async (id: string) => {
    const res = await fetch(`/api/personas/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete persona');
    await fetchPersonas();
  };

  return { personas, loading, error, refetch: fetchPersonas, createPersona, updatePersona, deletePersona };
}
