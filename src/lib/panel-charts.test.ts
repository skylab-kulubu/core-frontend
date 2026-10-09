import { ticketCheckInMix, ticketMix, topClickUrls } from './panel-charts';

describe('ticketMix', () => {
  it('splits guest vs member even when one side is empty', () => {
    expect(
      ticketMix([{ ticketType: 'GUEST' }, { ticketType: 'GUEST' }, { ticketType: 'REGISTERED' }]),
    ).toEqual([
      { label: 'Misafir', count: 2 },
      { label: 'Üye', count: 1 },
    ]);
  });
});

describe('ticketCheckInMix', () => {
  it('counts checked-in vs still registered', () => {
    expect(
      ticketCheckInMix([
        { checkIns: [{ id: '1' }] },
        { checkIns: [] },
        { checkIns: [{ id: '2' }, { id: '3' }] },
      ]),
    ).toEqual([
      { label: 'Giriş yaptı', count: 2 },
      { label: 'Kayıtlı', count: 1 },
    ]);
  });
});

describe('topClickUrls', () => {
  it('ranks aliases by clicks and drops zeros', () => {
    expect(
      topClickUrls(
        [
          { alias: 'quiet', clickCount: 0 },
          { alias: 'jam', clickCount: 12 },
          { alias: 'ctf', clickCount: 40 },
        ],
        2,
      ),
    ).toEqual([
      { label: 'ctf', count: 40 },
      { label: 'jam', count: 12 },
    ]);
  });
});
