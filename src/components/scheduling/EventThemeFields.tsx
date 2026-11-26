'use client';

import { useEffect, useState } from 'react';
import { Paintbrush, RotateCw } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { Field } from '@/components/chrome/Field';
import { Select } from '@/components/chrome/Select';
import { ProblemError } from '@/lib/api/core';
import {
  DEFAULT_EVENT_THEME,
  eventThemesApi,
  HEX_COLOR,
  type EventTheme,
} from '@/lib/api/event-themes';
import { readFormBrand } from '@/lib/api/skyforms';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

/** The default theme's name when the catalog does not list it. */
const DEFAULT_THEME_NAME = 'SKY LAB (Kurumsal)';

/** The ticket page's last fallback when Kurumsal's cover gives no colour (core's purple). */
const FALLBACK_ACCENT = '#8B5CF6';

export type EventThemeValue = {
  theme?: string | null;
  ticketAccentColor?: string | null;
};

type EventThemeFieldsProps = EventThemeValue & {
  onChange: (next: EventThemeValue) => void;
  /** The Skyforms forms linked to the Event, first the one to follow. */
  formIds?: string[];
};

/**
 * "Görünüm" (core docs/event-theme.md): the theme the ticket PDF, the ticket mails and the ticket
 * page take, and the ticket page's accent colour over the theme's own (Kurumsal's comes from the
 * cover). Saved with the form. An older core without the catalog says it is not there yet.
 */
export function EventThemeFields({
  theme,
  ticketAccentColor,
  onChange,
  formIds = [],
}: EventThemeFieldsProps) {
  const [themes, setThemes] = useState<EventTheme[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported' | 'failed'>('loading');
  const [formBrand, setFormBrand] = useState<string | null>(null);
  // "Yeniden dene" reads the catalog again
  const [attempt, setAttempt] = useState(0);
  const formKey = formIds.join(',');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    eventThemesApi
      .list()
      .then((rows) => {
        if (cancelled) return;
        setThemes(rows);
        setState('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState(err instanceof ProblemError && err.status === 404 ? 'unsupported' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    setFormBrand(null);
    if (!formKey) return;
    let cancelled = false;
    void (async () => {
      // The first linked form with a theme of its own; a form that cannot be read is skipped
      for (const id of formKey.split(',')) {
        const brand = await readFormBrand(id).catch(() => null);
        if (cancelled) return;
        if (brand) {
          setFormBrand(brand);
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formKey]);

  if (state === 'loading') return <Shell>Yükleniyor…</Shell>;
  if (state === 'unsupported') return <Shell>Bu özellik henüz sunucuda yok.</Shell>;
  const failed = state === 'failed';

  const options = themes.some((row) => row.key === DEFAULT_EVENT_THEME)
    ? themes
    : [{ key: DEFAULT_EVENT_THEME, name: DEFAULT_THEME_NAME }, ...themes];
  const chosenKey = theme || DEFAULT_EVENT_THEME;
  // A key core no longer lists is drawn as Kurumsal (core reads it so); kept until changed
  const chosen =
    options.find((row) => row.key === chosenKey) ??
    options.find((row) => row.key === DEFAULT_EVENT_THEME);
  const suggestion =
    formBrand && formBrand !== chosenKey
      ? options.find((row) => row.key === formBrand && row.key !== DEFAULT_EVENT_THEME)
      : undefined;

  const accentText = ticketAccentColor ?? '';
  const accentTrimmed = accentText.trim();
  const accentInvalid = accentTrimmed !== '' && !HEX_COLOR.test(accentTrimmed);
  // Kurumsal's page takes the cover's first colour (core); another theme its own
  // Without the catalog the stored key still tells which; its colour is not known then
  const kurumsal = failed
    ? chosenKey === DEFAULT_EVENT_THEME
    : (chosen?.key ?? DEFAULT_EVENT_THEME) === DEFAULT_EVENT_THEME;
  const themeAccent = kurumsal || failed ? '' : (chosen?.accent ?? '');
  const swatch = HEX_COLOR.test(accentTrimmed) ? accentTrimmed : themeAccent || FALLBACK_ACCENT;

  return (
    <div className="space-y-3" data-slot="event-theme">
      <div className="grid gap-3 sm:grid-cols-2">
        {failed ? (
          <div className="space-y-1">
            <FieldLabel>Tema</FieldLabel>
            <div className="flex flex-wrap items-center gap-3">
              <span role="alert" className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
                Temalar yüklenemedi.
              </span>
              <ActionButton
                icon={RotateCw}
                showLabel
                label="Yeniden dene"
                onClick={() => setAttempt((n) => n + 1)}
              />
            </div>
          </div>
        ) : (
          <label className="block space-y-1">
            <FieldLabel>Tema</FieldLabel>
            <Select
              value={chosen?.key ?? DEFAULT_EVENT_THEME}
              onChange={(e) =>
                onChange({
                  theme: e.target.value === DEFAULT_EVENT_THEME ? null : e.target.value,
                })
              }
              aria-label="Tema"
              aria-describedby="etkinlik-tema-ipucu"
            >
              {options.map((row) => (
                <option key={row.key} value={row.key}>
                  {row.name}
                </option>
              ))}
            </Select>
            <span
              id="etkinlik-tema-ipucu"
              className={`text-subtle-foreground block ${TEXT_SECONDARY}`}
            >
              Bilet, bilet postaları ve bilet sayfası bu temayla çıkar.
            </span>
          </label>
        )}
        <div className="space-y-1">
          <label htmlFor="etkinlik-vurgu-rengi">
            <FieldLabel>Vurgu rengi</FieldLabel>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Vurgu rengi seç"
              value={swatch.toLowerCase()}
              onChange={(e) => onChange({ ticketAccentColor: e.target.value.toUpperCase() })}
              className="border-border h-9 w-11 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1 pointer-coarse:h-11"
            />
            <Field
              id="etkinlik-vurgu-rengi"
              value={accentText}
              onChange={(e) => onChange({ ticketAccentColor: e.target.value || null })}
              placeholder={
                kurumsal
                  ? 'Kapağın rengi'
                  : themeAccent
                    ? `Temanın rengi (${themeAccent})`
                    : 'Temanın rengi'
              }
              spellCheck={false}
              autoComplete="off"
              maxLength={7}
              aria-invalid={accentInvalid}
              aria-describedby="etkinlik-vurgu-ipucu"
            />
          </div>
          <span
            id="etkinlik-vurgu-ipucu"
            className={`${accentInvalid ? 'text-destructive' : 'text-subtle-foreground'} flex items-center gap-2 ${TEXT_SECONDARY}`}
          >
            {accentInvalid
              ? '#RRGGBB biçiminde yaz.'
              : `Bilet sayfasının rengi. Boş: ${kurumsal ? 'kapaktan alınır' : 'temanın rengi'}.`}
            {accentTrimmed && !accentInvalid ? (
              <button
                type="button"
                className="text-skylab-300 hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => onChange({ ticketAccentColor: null })}
              >
                Temizle
              </button>
            ) : null}
          </span>
        </div>
      </div>
      {suggestion && !failed ? (
        <div className={`flex flex-wrap items-center gap-3 ${TEXT_SECONDARY}`}>
          <span className="text-muted-foreground">Formun teması: {suggestion.name}</span>
          <ActionButton
            icon={Paintbrush}
            showLabel
            label="Etkinliğe de uygula"
            onClick={() => onChange({ theme: suggestion.key })}
          />
        </div>
      ) : null}
    </div>
  );
}

function Shell({ children }: { children: string }) {
  return (
    <div className="space-y-1" data-slot="event-theme">
      <FieldLabel>Tema</FieldLabel>
      <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>{children}</p>
    </div>
  );
}
