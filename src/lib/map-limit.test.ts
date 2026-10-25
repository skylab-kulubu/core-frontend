import { mapLimit } from './map-limit';

describe('mapLimit', () => {
  it('keeps at most `limit` calls in flight and answers in order', async () => {
    let inFlight = 0;
    let most = 0;
    const answers = await mapLimit([5, 1, 4, 2, 3, 0], 3, async (wait) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, wait));
      inFlight -= 1;
      return wait * 10;
    });
    expect(answers).toEqual([50, 10, 40, 20, 30, 0]);
    expect(most).toBe(3);
  });

  it('answers an empty list without a call', async () => {
    const run = jest.fn();
    await expect(mapLimit([], 3, run)).resolves.toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects on the first refusal', async () => {
    await expect(
      mapLimit([1, 2], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });
});
