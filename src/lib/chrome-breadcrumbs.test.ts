import { chromeCrumbs } from './chrome-breadcrumbs';

describe('chromeCrumbs', () => {
  it('labels Özet for dashboard', () => {
    expect(chromeCrumbs('/dashboard')).toEqual([{ href: '/dashboard', label: 'Özet' }]);
  });

  it('nests a user record under Kullanıcılar', () => {
    expect(chromeCrumbs('/users/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).toEqual([
      { href: '/users', label: 'Kullanıcılar' },
      { href: '/users/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', label: 'Kayıt' },
    ]);
  });

  it('labels announcement edit', () => {
    expect(chromeCrumbs('/announcements/n1/edit')).toEqual([
      { href: '/announcements', label: 'Duyurular' },
      { href: '/announcements/n1', label: 'N1' },
      { href: '/announcements/n1/edit', label: 'Düzenle' },
    ]);
  });

  it('names the event tabs in Turkish', () => {
    const event = '/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    expect(chromeCrumbs(`${event}/participants`).at(-1)?.label).toBe('Katılımcılar');
    expect(chromeCrumbs(`${event}/program`).at(-1)?.label).toBe('Program');
    expect(chromeCrumbs(`${event}/certificates`).at(-1)?.label).toBe('Sertifikalar');
    expect(chromeCrumbs(`${event}/content`).at(-1)?.label).toBe('İçerik');
    expect(chromeCrumbs(`${event}/competition`).at(-1)?.label).toBe('Yarışma');
  });

  it('labels tickets as Başvuranlar under an event', () => {
    expect(chromeCrumbs('/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/tickets')).toEqual([
      { href: '/events', label: 'Etkinlikler' },
      { href: '/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', label: 'Kayıt' },
      { href: '/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/tickets', label: 'Başvuranlar' },
    ]);
  });

  it('labels the SkyApp handoff settings', () => {
    expect(chromeCrumbs('/handoff-targets')).toEqual([
      { href: '/handoff-targets', label: "SkyApp'ten geçiş" },
    ]);
  });

  it('labels the certificate pages in Turkish', () => {
    expect(chromeCrumbs('/certificates/templates')).toEqual([
      { href: '/certificates', label: 'Sertifikalar' },
      { href: '/certificates/templates', label: 'Şablonlar' },
    ]);
  });
});
