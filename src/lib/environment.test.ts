import { isSandbox } from './environment';

describe('isSandbox', () => {
  it('reads the sandbox from the core address baked into the image', () => {
    expect(isSandbox('https://sandbox-api.yildizskylab.com')).toBe(true);
    expect(isSandbox('http://localhost:3000/sandbox-api')).toBe(true);
  });

  it('never marks production or a missing address', () => {
    expect(isSandbox('https://api.yildizskylab.com')).toBe(false);
    expect(isSandbox('')).toBe(false);
    expect(isSandbox('not a url')).toBe(false);
  });
});
