import { RELATIONSHIP_MAX_CHARS } from './constants';

export const RELATIONSHIP_LABELS = ['Stranger', 'Acquaintance', 'Colleague', 'Collaborator', 'Partner'] as const;

/** Returns 0-4 score based on total conversation characters */
export function getRelationshipScore(totalChars: number): number {
  const pct = Math.min(100, Math.round((totalChars / RELATIONSHIP_MAX_CHARS) * 100));
  if (pct >= 80) return 4;
  if (pct >= 55) return 3;
  if (pct >= 30) return 2;
  if (pct >= 10) return 1;
  return 0;
}

/** Returns the relationship label for a persona */
export function getRelationshipLabel(totalChars: number): string {
  return RELATIONSHIP_LABELS[getRelationshipScore(totalChars)];
}

/** Returns the percentage (0-100) for the individual relationship meter */
export function getRelationshipPct(totalChars: number): number {
  return Math.min(100, Math.round((totalChars / RELATIONSHIP_MAX_CHARS) * 100));
}

/** Returns team progress percentage (0-100) based on aggregate relationship scores */
export function getTeamProgressPct(personas: { total_characters?: number }[]): number {
  if (personas.length === 0) return 0;
  const totalScore = personas.reduce((sum, p) => sum + getRelationshipScore(p.total_characters ?? 0), 0);
  const maxScore = personas.length * 4;
  return Math.round((totalScore / maxScore) * 100);
}

const TEAM_LABELS: [number, string][] = [
  [100, 'You\'ve built strong relationships with your entire team. Consider adding a new member.'],
  [75, 'Your inner circle is almost complete. A few more conversations to go.'],
  [50, 'Strong connections are forming. Your team is getting to know you well.'],
  [25, 'You\'re building real rapport with your team. Keep the momentum going.'],
  [1, 'You\'re just getting started. Keep chatting to build stronger connections.'],
  [0, 'Your team members are all strangers. Start a conversation to get to know them.'],
];

/** Returns a full-sentence label for the team progress */
export function getTeamProgressLabel(pct: number): string {
  for (const [threshold, label] of TEAM_LABELS) {
    if (pct >= threshold) return label;
  }
  return TEAM_LABELS[TEAM_LABELS.length - 1][1];
}
