import { ProblemError } from '@/lib/api/core';
import {
  aliasHint,
  isManaged,
  isManagedRefusal,
  LINK_KIND_FILTERS,
  linkKind,
  linkKindLabel,
  managedDeleteWarning,
  managedNote,
  managedRefusalMessage,
  shouldCheckAlias,
} from '@/lib/short-links';

const FORM = '11111111-1111-1111-1111-111111111111';
const EVENT = '22222222-2222-2222-2222-222222222222';

describe('linkKind', () => {
  it('calls a link an event names an event link, before its form', () => {
    expect(linkKind({ formId: FORM, eventId: EVENT })).toBe('event');
    expect(linkKind({ eventId: EVENT })).toBe('event');
  });

  it('calls any other form-bound link a form link', () => {
    expect(linkKind({ formId: FORM })).toBe('form');
  });

  it('calls a link with neither personal, with empty or null ids too', () => {
    expect(linkKind({})).toBe('personal');
    expect(linkKind({ formId: null, eventId: '' })).toBe('personal');
  });

  it('labels each kind in Turkish', () => {
    expect(linkKindLabel('personal')).toBe('Kişisel');
    expect(linkKindLabel('form')).toBe('Form');
    expect(linkKindLabel('event')).toBe('Etkinlik');
  });

  it('offers Tümü first, then the three kinds, as the list filter', () => {
    expect(LINK_KIND_FILTERS).toEqual([
      { value: 'all', label: 'Tümü' },
      { value: 'personal', label: 'Kişisel' },
      { value: 'form', label: 'Form' },
      { value: 'event', label: 'Etkinlik' },
    ]);
  });
});

describe('managed links', () => {
  it('treats form and event links as managed elsewhere, and a personal one as not', () => {
    expect(isManaged({ formId: FORM })).toBe(true);
    expect(isManaged({ formId: FORM, eventId: EVENT })).toBe(true);
    expect(isManaged({})).toBe(false);
  });

  it('says where a managed link is managed, and nothing for a personal one', () => {
    expect(managedNote({ formId: FORM })).toBe('Forms’ta yönetiliyor');
    expect(managedNote({ formId: FORM, eventId: EVENT })).toBe('Etkinlikte yönetiliyor');
    expect(managedNote({})).toBeNull();
  });

  it('warns before a managed link is deleted that its form or event keeps no link', () => {
    expect(managedDeleteWarning({ formId: FORM })).toBe(
      'Bu link bir formun linki; silersen form linksiz kalır.',
    );
    expect(managedDeleteWarning({ formId: FORM, eventId: EVENT })).toBe(
      'Bu link bir etkinliğin form linki; silersen etkinlik linksiz kalır.',
    );
    expect(managedDeleteWarning({})).toBeNull();
  });

  it('recognises only a 409 with code managed as a managed refusal', () => {
    expect(isManagedRefusal(new ProblemError(409, 'Conflict', { code: 'managed' }))).toBe(true);
    expect(isManagedRefusal(new ProblemError(409, 'Conflict'))).toBe(false);
    expect(isManagedRefusal(new ProblemError(403, 'Forbidden', { code: 'managed' }))).toBe(false);
    expect(isManagedRefusal(new Error('managed'))).toBe(false);
  });

  it('explains a managed refusal by the row, and names both when the list still showed it personal', () => {
    expect(managedRefusalMessage({ formId: FORM })).toBe(
      'Forms’ta yönetiliyor; buradan değiştirilemez.',
    );
    expect(managedRefusalMessage({ eventId: EVENT })).toBe(
      'Etkinlikte yönetiliyor; buradan değiştirilemez.',
    );
    expect(managedRefusalMessage({})).toBe(
      'Forms’ta ya da etkinlikte yönetiliyor; buradan değiştirilemez.',
    );
  });
});

describe('alias availability', () => {
  it('checks a typed alias, but not an empty one or the link’s own alias', () => {
    expect(shouldCheckAlias('hack')).toBe(true);
    expect(shouldCheckAlias('  ')).toBe(false);
    expect(shouldCheckAlias('')).toBe(false);
    expect(shouldCheckAlias('Hack ', 'hack')).toBe(false);
    expect(shouldCheckAlias('hack2', 'hack')).toBe(true);
  });

  it('says Uygun for an available alias, without blocking', () => {
    expect(aliasHint({ alias: 'hack', available: true }, 'create')).toEqual({
      tone: 'ok',
      text: 'Uygun',
      blocks: false,
    });
  });

  it('blocks an invalid or reserved alias, in both modes', () => {
    for (const mode of ['create', 'edit'] as const) {
      expect(aliasHint({ alias: '-x', available: false, reason: 'invalid' }, mode)).toEqual({
        tone: 'error',
        text: 'Geçersiz ad: harf ya da rakamla başlar; harf, rakam, - ve _; en fazla 64 karakter.',
        blocks: true,
      });
      expect(aliasHint({ alias: 'c', available: false, reason: 'reserved' }, mode)).toEqual({
        tone: 'error',
        text: 'Bu ad ayrılmış; başka bir ad seç.',
        blocks: true,
      });
    }
  });

  it('blocks a taken alias for a new link, but only warns while editing', () => {
    const taken = { alias: 'old', available: false, reason: 'taken' };
    expect(aliasHint(taken, 'create')).toEqual({
      tone: 'error',
      text: 'Bu ad kullanılıyor (eski adlar da dolu sayılır).',
      blocks: true,
    });
    expect(aliasHint(taken, 'edit')).toEqual({
      tone: 'warning',
      text: 'Bu ad kullanılıyor (eski adlar da dolu sayılır). Linkin kendi eski adıysa kaydedebilirsin.',
      blocks: false,
    });
  });

  it('shows nothing for a reason it does not know', () => {
    expect(aliasHint({ alias: 'x', available: false, reason: 'later' }, 'create')).toBeNull();
    expect(aliasHint({ alias: 'x', available: false }, 'create')).toBeNull();
  });
});
