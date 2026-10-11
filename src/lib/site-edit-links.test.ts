import { siteEditLinks } from '@/lib/site-edit-links';

describe('siteEditLinks', () => {
  it("opens each production site's editor sign-in", () => {
    expect(
      siteEditLinks([
        { clientId: 'frontend-main', name: 'Ana site', url: 'https://yildizskylab.com' },
        { clientId: 'frontend-artlab', name: 'ARTLAB', url: 'https://artlab.yildizskylab.com' },
      ]),
    ).toEqual([
      { href: 'https://yildizskylab.com/api/signin', label: 'Ana site' },
      { href: 'https://artlab.yildizskylab.com/api/signin', label: 'ARTLAB' },
    ]);
  });

  it('follows the sandbox addresses the sandbox core names', () => {
    expect(
      siteEditLinks([
        { clientId: 'frontend-arge', name: 'Ar-Ge', url: 'https://sandbox-arge.yildizskylab.com' },
      ]),
    ).toEqual([{ href: 'https://sandbox-arge.yildizskylab.com/api/signin', label: 'Ar-Ge' }]);
  });

  it('gives nothing for a person who edits no site', () => {
    expect(siteEditLinks([])).toEqual([]);
    expect(siteEditLinks(undefined)).toEqual([]);
  });

  it('drops a trailing slash and leaves out anything but an http(s) address', () => {
    expect(
      siteEditLinks([
        { clientId: 'frontend-main', name: 'Ana site', url: 'https://yildizskylab.com/' },
        { clientId: 'bad', name: 'Kötü', url: 'javascript:alert(1)' },
        { clientId: 'empty', name: 'Boş', url: '' },
      ]),
    ).toEqual([{ href: 'https://yildizskylab.com/api/signin', label: 'Ana site' }]);
  });
});
