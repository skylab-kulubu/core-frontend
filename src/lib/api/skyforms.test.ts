import { readFormBrand } from './skyforms';

jest.mock('./core', () => ({
  ...jest.requireActual('./core'),
  bearer: jest.fn().mockResolvedValue('belirtec'),
}));

function answer(status: number, body: unknown) {
  const text = JSON.stringify(body);
  return Promise.resolve({ ok: status < 400, status, text: () => Promise.resolve(text) });
}

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('readFormBrand', () => {
  it('reads the theme from the form’s public meta', async () => {
    fetchMock.mockReturnValue(
      answer(200, { success: true, data: { title: 'Kayıt', brand: 'artlab' } }),
    );
    await expect(readFormBrand('f1')).resolves.toBe('artlab');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/forms\/f1\/meta$/);
  });

  it('is null for SKY LAB’s own look, a closed or a missing form', async () => {
    fetchMock.mockReturnValueOnce(
      answer(200, { success: true, data: { title: 'Kayıt', brand: null } }),
    );
    await expect(readFormBrand('f1')).resolves.toBeNull();
    fetchMock.mockReturnValueOnce(answer(410, { success: false, message: 'Kapalı' }));
    await expect(readFormBrand('f1')).resolves.toBeNull();
    fetchMock.mockReturnValueOnce(answer(404, { success: false }));
    await expect(readFormBrand('f1')).resolves.toBeNull();
  });
});
