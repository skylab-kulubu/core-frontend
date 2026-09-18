import { listStatus } from './list-status';

describe('listStatus', () => {
  it('keeps loading ahead of an empty first paint', () => {
    expect(
      listStatus({ loading: true, rowCount: 0, emptyMessage: 'Kullanıcı yok' }),
    ).toEqual({ kind: 'loading' });
  });

  it('names an empty loaded list', () => {
    expect(
      listStatus({ loading: false, rowCount: 0, emptyMessage: 'Kullanıcı yok' }),
    ).toEqual({ kind: 'empty', message: 'Kullanıcı yok' });
  });

  it('does not call a failed fetch empty', () => {
    expect(
      listStatus({
        loading: false,
        failed: true,
        rowCount: 0,
        emptyMessage: 'Kullanıcı yok',
      }),
    ).toEqual({ kind: 'ready' });
  });

  it('is ready when there are rows', () => {
    expect(
      listStatus({ loading: false, rowCount: 3, emptyMessage: 'Kullanıcı yok' }),
    ).toEqual({ kind: 'ready' });
  });
});
