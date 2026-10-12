import { lookupPeople } from '@/lib/people-lookup';
import type { Person } from '@/lib/api/identity';

jest.mock('@/lib/api/identity', () => ({ identityApi: { getUser: jest.fn() } }));

const ada: Person = { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'L' };

describe('lookupPeople', () => {
  it('fetches each unknown id once and keeps the known ones', async () => {
    const getUser = jest.fn(async (id: string) => ({
      id,
      email: `${id}@example.com`,
      firstName: id,
      lastName: '',
      groups: [],
    }));
    const out = await lookupPeople(
      ['u-ada', 'u-bo', 'u-bo', ''],
      new Map([[ada.id, ada]]),
      getUser,
    );
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledWith('u-bo');
    expect(out.get('u-ada')).toBe(ada);
    expect(out.get('u-bo')).toEqual({
      id: 'u-bo',
      email: 'u-bo@example.com',
      firstName: 'u-bo',
      lastName: '',
    });
  });

  it('skips people it cannot read', async () => {
    const getUser = jest.fn().mockRejectedValue(new Error('403'));
    const out = await lookupPeople(['u-x'], new Map(), getUser);
    expect(out.size).toBe(0);
  });
});
