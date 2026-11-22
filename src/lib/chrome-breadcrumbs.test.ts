import { chromeCrumbs, chromeDocumentTitle } from './chrome-breadcrumbs';

describe('chromeCrumbs', () => {
  it('labels Özet for dashboard', () => {
    expect(chromeCrumbs('/dashboard')).toEqual([{ href: '/dashboard', label: 'Özet' }]);
  });

  it('nests a user record under Kullanıcılar', () => {
    expect(chromeCrumbs('/users/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).toEqual([
      { href: '/users', label: 'Kullanıcılar' },
      { href: '/users/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', label: '…' },
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

  it('leads a ticket back to the Katılımcılar tab, never to a missing tickets page', () => {
    const event = '/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    expect(chromeCrumbs(`${event}/tickets/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`)).toEqual([
      { href: '/events', label: 'Etkinlikler' },
      { href: event, label: '…' },
      { href: `${event}/participants`, label: 'Katılımcılar' },
      { href: `${event}/tickets/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`, label: '…' },
    ]);
  });

  it('names a competitor and a template by their kind until a name is known', () => {
    expect(chromeCrumbs('/events/e1/competition/c1').at(-1)?.label).toBe('Yarışmacı');
    expect(chromeCrumbs('/events/e1/competition/new').at(-1)?.label).toBe('Yeni');
    expect(chromeCrumbs('/certificates/templates/t1').at(-1)?.label).toBe('Şablon');
    expect(
      chromeCrumbs('/certificates/templates/t1', { '/certificates/templates/t1': 'Katılım' }).at(-1)
        ?.label,
    ).toBe('Katılım');
  });

  it('puts the door under its event', () => {
    expect(
      chromeCrumbs('/events/e1/door', { '/events/e1': 'Yıldız Hackathon' }).map(
        (crumb) => crumb.label,
      ),
    ).toEqual(['Etkinlikler', 'Yıldız Hackathon', 'Kapı']);
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

  it('names a record by what its page read, with a pause until then', () => {
    const event = '/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    expect(
      chromeCrumbs(`${event}/participants`, { [event]: "Yıldız Hackathon '26" }).map(
        (crumb) => crumb.label,
      ),
    ).toEqual(['Etkinlikler', "Yıldız Hackathon '26", 'Katılımcılar']);
    expect(chromeCrumbs(event, {}).at(-1)?.label).toBe('…');
  });

  it('matches a name to its address whether or not the address is encoded', () => {
    expect(chromeCrumbs('/groups/a%20b', { '/groups/a b': 'Yönetim Kurulu' }).at(-1)).toEqual({
      href: '/groups/a%20b',
      label: 'Yönetim Kurulu',
    });
  });
});

describe('chromeDocumentTitle', () => {
  const event = '/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  it('names a plain page and the club', () => {
    expect(chromeDocumentTitle('/dashboard')).toBe('Özet · SKY LAB');
    expect(chromeDocumentTitle('/certificates/templates')).toBe(
      'Sertifikalar · Şablonlar · SKY LAB',
    );
  });

  it('starts at the record once its page names it', () => {
    const names = { [event]: 'Yıldız Hackathon' };
    expect(chromeDocumentTitle(event, names)).toBe('Yıldız Hackathon · SKY LAB');
    expect(chromeDocumentTitle(`${event}/participants`, names)).toBe(
      'Yıldız Hackathon · Katılımcılar · SKY LAB',
    );
    expect(chromeDocumentTitle(`${event}/door`, names)).toBe('Yıldız Hackathon · Kapı · SKY LAB');
  });

  it('leaves out an id still waiting for its name', () => {
    expect(chromeDocumentTitle(`${event}/participants`)).toBe(
      'Etkinlikler · Katılımcılar · SKY LAB',
    );
  });
});
