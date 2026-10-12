/** @jest-environment node */

import CertificateJobsRedirect from '@/app/(authorized)/certificates/jobs/page';
import IssuedCertificatesRedirect from '@/app/(authorized)/certificates/issued/page';
import EditCompetitorRedirect from '@/app/(authorized)/competitors/[id]/edit/page';
import NewCompetitorRedirect from '@/app/(authorized)/competitors/new/page';
import CompetitorsRedirect from '@/app/(authorized)/competitors/page';
import MediaRedirect from '@/app/(authorized)/media/page';
import { redirectTarget } from '@/test/server/redirect';

jest.mock('next/navigation', () => jest.requireActual('@/test/server/redirect').navigation);

const query = (search: Record<string, string> = {}) => Promise.resolve(search);

describe('removed global pages', () => {
  it('sends /media to the events, whose İçerik tab holds the files', async () => {
    expect(await redirectTarget(() => MediaRedirect())).toBe('/events');
  });

  it.each([
    ['Verilenler', IssuedCertificatesRedirect],
    ['Üretim işleri', CertificateJobsRedirect],
  ])('sends the old %s page to the event Sertifikalar tab', async (_name, Redirect) => {
    expect(await redirectTarget(() => Redirect({ searchParams: query({ eventId: 'e1' }) }))).toBe(
      '/events/e1/certificates',
    );
    expect(await redirectTarget(() => Redirect({ searchParams: query() }))).toBe('/events');
  });

  it('sends the old competitor list and forms to the event Yarışma tab', async () => {
    expect(
      await redirectTarget(() => CompetitorsRedirect({ searchParams: query({ eventId: 'e1' }) })),
    ).toBe('/events/e1/competition');
    expect(await redirectTarget(() => CompetitorsRedirect({ searchParams: query() }))).toBe(
      '/events',
    );
    expect(
      await redirectTarget(() => NewCompetitorRedirect({ searchParams: query({ eventId: 'e1' }) })),
    ).toBe('/events/e1/competition/new');
    expect(
      await redirectTarget(() =>
        EditCompetitorRedirect({
          params: Promise.resolve({ id: 'c1' }),
          searchParams: query({ eventId: 'e1' }),
        }),
      ),
    ).toBe('/events/e1/competition/c1');
    expect(
      await redirectTarget(() =>
        EditCompetitorRedirect({ params: Promise.resolve({ id: 'c1' }), searchParams: query() }),
      ),
    ).toBe('/events');
  });
});
