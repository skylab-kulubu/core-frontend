import { redirect } from 'next/navigation';
import SessionsRedirect from '@/app/(authorized)/sessions/page';
import NewSessionRedirect from '@/app/(authorized)/sessions/new/page';
import EditSessionRedirect from '@/app/(authorized)/sessions/[id]/edit/page';
import DeleteSessionRedirect from '@/app/(authorized)/sessions/[id]/delete/page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

function invoke(page: () => unknown) {
  try {
    page();
  } catch {
    return;
  }
}

describe('sessions routes send operators to events', () => {
  beforeEach(() => {
    (redirect as unknown as jest.Mock).mockClear();
  });

  it.each([
    ['/sessions', SessionsRedirect],
    ['/sessions/new', NewSessionRedirect],
    ['/sessions/:id/edit', EditSessionRedirect],
    ['/sessions/:id/delete', DeleteSessionRedirect],
  ])('%s redirects to /events', (_path, page) => {
    invoke(page);
    expect(redirect).toHaveBeenCalledWith('/events');
  });
});
