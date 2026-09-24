/**
 * @jest-environment node
 */
import { asProblem } from '@/lib/handoff/problem';

describe('asProblem', () => {
  it.each([
    ['invalid_sign_in_path', 'signInPath'],
    ['invalid_return_param', 'returnParam'],
  ])('places Keycloak code %s under the %s field', (code, field) => {
    const problem = asProblem(
      { type: `tag:x:${code}`, title: 'Bad Request', status: 400, detail: 'Hatalı.', code },
      400,
    );
    expect(problem).toEqual(expect.objectContaining({ status: 400, detail: 'Hatalı.', field }));
  });

  it('keeps a code without a field (such as origin_not_allowed) as a row-level problem', () => {
    const problem = asProblem(
      { detail: 'Kök adres uygun değil.', code: 'origin_not_allowed' },
      400,
    );
    expect(problem?.field).toBeUndefined();
    expect(problem?.detail).toBe('Kök adres uygun değil.');
  });

  it('prefers an explicit field over the code', () => {
    expect(
      asProblem({ detail: 'x', field: 'returnParam', code: 'invalid_sign_in_path' }, 400)?.field,
    ).toBe('returnParam');
  });

  it('refuses a body without a detail', () => {
    expect(asProblem({ code: 'invalid_sign_in_path' }, 400)).toBeNull();
  });
});
