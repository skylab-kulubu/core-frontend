import {
  forgetNotedAccessToken,
  noteAccessToken,
  SESSION_RENEWED_EVENT,
} from '@/lib/auth/session-renewal';

describe('noteAccessToken', () => {
  const renewed = jest.fn();

  beforeEach(() => {
    forgetNotedAccessToken();
    renewed.mockClear();
    window.addEventListener(SESSION_RENEWED_EVENT, renewed);
  });

  afterEach(() => {
    window.removeEventListener(SESSION_RENEWED_EVENT, renewed);
  });

  it('says nothing for the first token of the page, nor for the same one again', () => {
    noteAccessToken('token-1');
    noteAccessToken('token-1');
    expect(renewed).not.toHaveBeenCalled();
  });

  it('says so once the requests carry a new token', () => {
    noteAccessToken('token-1');
    noteAccessToken('token-2');
    noteAccessToken('token-2');
    expect(renewed).toHaveBeenCalledTimes(1);
  });

  it('ignores a request that carried no token', () => {
    noteAccessToken('token-1');
    noteAccessToken(null);
    noteAccessToken('token-1');
    expect(renewed).not.toHaveBeenCalled();
  });
});
