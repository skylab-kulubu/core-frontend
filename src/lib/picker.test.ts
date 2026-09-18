import { pickerMatch, roleKey } from './picker';

describe('pickerMatch', () => {
  it('keeps every row when the query is empty', () => {
    expect(pickerMatch('', 'skyforms:access', 'skyforms')).toBe(true);
  });

  it('matches client or role text', () => {
    expect(pickerMatch('forms', 'skyforms:access', 'skyforms')).toBe(true);
    expect(pickerMatch('access', 'skyforms:access', 'skyforms')).toBe(true);
  });

  it('hides rows that do not match', () => {
    expect(pickerMatch('cms', 'skyforms:access', 'skyforms')).toBe(false);
  });
});

describe('roleKey', () => {
  it('joins client and role', () => {
    expect(roleKey({ clientId: 'skyforms', role: 'skyforms:access' })).toBe(
      'skyforms:skyforms:access',
    );
  });
});
