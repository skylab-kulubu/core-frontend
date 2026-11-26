import { coreFetch } from './core';

/** The theme an Event takes when it has none (core's `null`). */
export const DEFAULT_EVENT_THEME = 'kurumsal';

/** A ready-made theme from core's catalog (`GET /v1/event-themes`, public, Kurumsal first). */
export type EventTheme = {
  key: string;
  name: string;
  /** The theme's own accent colour, `#RRGGBB` (`preview.accent`). */
  accent?: string;
};

type ThemeRow = { key?: unknown; name?: unknown; preview?: { accent?: unknown } | null };

/** `#RRGGBB`, the only form core keeps for `ticketAccentColor`. */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function themeOf(row: ThemeRow): EventTheme | null {
  if (typeof row.key !== 'string' || !row.key) return null;
  const name = typeof row.name === 'string' && row.name ? row.name : row.key;
  const raw = row.preview?.accent;
  const accent = typeof raw === 'string' && HEX_COLOR.test(raw) ? raw : '';
  return { key: row.key, name, ...(accent ? { accent } : {}) };
}

/** The catalog's rows that have a key. */
export function themesOf(answer: unknown): EventTheme[] {
  const rows: unknown[] = Array.isArray(answer) ? answer : [];
  return rows
    .map((row) => (row && typeof row === 'object' ? themeOf(row as ThemeRow) : null))
    .filter((row): row is EventTheme => row !== null);
}

export const eventThemesApi = {
  list: () => coreFetch<unknown>('/v1/event-themes').then(themesOf),
};
