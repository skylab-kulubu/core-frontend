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

  it('labels tickets as Başvuranlar under an event', () => {
    expect(chromeCrumbs('/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/tickets')).toEqual([
      { href: '/events', label: 'Etkinlikler' },
      { href: '/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', label: 'Kayıt' },
      { href: '/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/tickets', label: 'Başvuranlar' },
    ]);
  });
});
