import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import HandoffTargetsPage from '@/app/(authorized)/handoff-targets/page';
import { HandoffProblemError, handoffTargetsApi } from '@/lib/api/handoff-targets';
import type { HandoffTarget } from '@/lib/handoff/targets';
import { sceneTitle } from '@/test/error-scenes';

jest.mock('@/lib/api/handoff-targets', () => {
  const actual = jest.requireActual('@/lib/api/handoff-targets');
  return {
    ...actual,
    handoffTargetsApi: { list: jest.fn(), update: jest.fn() },
  };
});

const skyforms: HandoffTarget = {
  clientId: 'skyforms',
  name: 'SkyForms',
  rootUrl: 'https://forms.yildizskylab.com',
  originAllowed: true,
  enabled: true,
  signInPath: '/auth/signin',
  returnParam: 'callbackUrl',
};

const accountCenter: HandoffTarget = {
  clientId: 'account-center',
  name: 'Hesap Merkezi',
  rootUrl: 'https://my.yildizskylab.com',
  originAllowed: true,
  enabled: null,
  signInPath: null,
  returnParam: null,
};

// The address is the list's state (the open row too): the hook writes history, this reads it back
const mockListeners = new Set<() => void>();
function mockSubscribe(listener: () => void) {
  mockListeners.add(listener);
  return () => mockListeners.delete(listener);
}
for (const method of ['pushState', 'replaceState'] as const) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args: Parameters<History['pushState']>) => {
    original(...args);
    mockListeners.forEach((listener) => listener());
  };
}
window.addEventListener('popstate', () => mockListeners.forEach((listener) => listener()));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/handoff-targets',
  useSearchParams: () => {
    const { useSyncExternalStore } = jest.requireActual('react') as typeof import('react');
    const text = useSyncExternalStore(
      mockSubscribe,
      () => window.location.search,
      () => '',
    );
    return new URLSearchParams(text);
  },
}));

// jsdom has no PointerEvent; base-ui's Switch sends one on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

type User = ReturnType<typeof userEvent.setup>;

/** Opens a site's row in the side panel and gives the panel. */
async function open(user: User, name: string): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('dialog', { name });
}

/** The "Açık" figure over the list. */
function openCount(): string {
  // The open side panel hides the page from the accessibility tree
  const figures = screen.getByRole('group', { name: 'Özet', hidden: true });
  return within(figures).getByRole('button', { name: /^Açık/, hidden: true }).textContent ?? '';
}

describe("SkyApp'ten geçiş page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState(null, '', '/handoff-targets');
    (handoffTargetsApi.list as jest.Mock).mockResolvedValue([accountCenter, skyforms]);
  });

  it('lists the sites, open ones first, each with one mark and no fields in the row', async () => {
    render(<HandoffTargetsPage />);

    expect(await screen.findByRole('button', { name: 'SkyForms' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "SkyApp'ten geçiş" })).toBeInTheDocument();
    const names = screen
      .getAllByRole('button', { name: /SkyForms|Hesap Merkezi/ })
      .map((node) => node.getAttribute('aria-label') ?? node.textContent);
    expect(names[0]).toMatch(/SkyForms/);
    expect(screen.getByText('https://forms.yildizskylab.com')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(openCount()).toMatch(/1/);
  });

  it('opens a site beside the list with its switch and fields', async () => {
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    const panel = await open(user, 'SkyForms');

    expect(within(panel).getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(within(panel).getByRole('textbox', { name: /Giriş kapısı yolu/ })).toHaveValue(
      '/auth/signin',
    );
    expect(within(panel).getByRole('textbox', { name: /Dönüş parametresi/ })).toHaveValue(
      'callbackUrl',
    );
    expect(within(panel).getByText('skyforms')).toBeInTheDocument();
    expect(window.location.search).toBe('?panel=skyforms');
  });

  it('hides the settings when Keycloak says the admin is not a realm super admin', async () => {
    (handoffTargetsApi.list as jest.Mock).mockRejectedValue(
      new HandoffProblemError(403, 'Bu işlem için ADMIN grubunda olmalısın.'),
    );

    render(<HandoffTargetsPage />);

    expect(
      await screen.findByRole('heading', { name: sceneTitle('forbidden') }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('shows why the list could not load and lets the admin retry', async () => {
    (handoffTargetsApi.list as jest.Mock)
      .mockRejectedValueOnce(
        new HandoffProblemError(
          502,
          'Hesap sistemi şu an yanıt vermiyor. Biraz sonra tekrar dene.',
        ),
      )
      .mockResolvedValueOnce([skyforms]);
    const user = userEvent.setup();

    render(<HandoffTargetsPage />);

    expect(
      await screen.findByText('Hesap sistemi şu an yanıt vermiyor. Biraz sonra tekrar dene.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(await screen.findByRole('button', { name: 'SkyForms' })).toBeInTheDocument();
  });

  it('enables a site and counts it open only after Keycloak stores it', async () => {
    let answer: (target: HandoffTarget) => void = () => undefined;
    (handoffTargetsApi.update as jest.Mock).mockReturnValue(
      new Promise<HandoffTarget>((resolve) => {
        answer = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    const panel = await open(user, 'Hesap Merkezi');

    await user.click(within(panel).getByRole('switch'));
    await user.type(
      within(panel).getByRole('textbox', { name: /Giriş kapısı yolu/ }),
      '/api/auth/login',
    );
    await user.type(within(panel).getByRole('textbox', { name: /Dönüş parametresi/ }), 'returnTo');
    await user.click(within(panel).getByRole('button', { name: 'Kaydet' }));

    expect(handoffTargetsApi.update).toHaveBeenCalledWith('account-center', {
      enabled: true,
      signInPath: '/api/auth/login',
      returnParam: 'returnTo',
    });
    expect(openCount()).toMatch(/1/);
    expect(within(panel).getByRole('button', { name: 'Kaydediliyor…' })).toBeDisabled();

    await act(async () => {
      answer({
        ...accountCenter,
        enabled: true,
        signInPath: '/api/auth/login',
        returnParam: 'returnTo',
      });
    });

    expect(openCount()).toMatch(/2/);
    expect(within(panel).getByText('Kaydedildi')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Kaydet' })).toBeDisabled();
  });

  it('turns a site off with its stored fields', async () => {
    (handoffTargetsApi.update as jest.Mock).mockResolvedValue({ ...skyforms, enabled: false });
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    const panel = await open(user, 'SkyForms');

    await user.click(within(panel).getByRole('switch'));
    await user.click(within(panel).getByRole('button', { name: 'Kaydet' }));

    expect(handoffTargetsApi.update).toHaveBeenCalledWith('skyforms', {
      enabled: false,
      signInPath: '/auth/signin',
      returnParam: 'callbackUrl',
    });
    await waitFor(() =>
      expect(within(panel).getByRole('switch')).toHaveAttribute('aria-checked', 'false'),
    );
    expect(openCount()).toMatch(/0/);
  });

  it('checks the fields before saving, the same way Keycloak does', async () => {
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    const panel = await open(user, 'Hesap Merkezi');
    const path = within(panel).getByRole('textbox', { name: /Giriş kapısı yolu/ });
    const param = within(panel).getByRole('textbox', { name: /Dönüş parametresi/ });

    await user.click(within(panel).getByRole('switch'));
    await user.type(path, '//evil.example');
    await user.type(param, 'return-to');

    expect(path).toHaveAccessibleDescription('Giriş kapısı yolu "//", "\\" veya ".." içeremez.');
    expect(path).toHaveAttribute('aria-invalid', 'true');
    expect(param).toHaveAccessibleDescription(
      'Dönüş parametresi harfle başlamalı; yalnız harf, rakam ve _ içerebilir (en çok 32).',
    );
    expect(within(panel).getByRole('button', { name: 'Kaydet' })).toBeDisabled();

    await user.type(param, '{Enter}');
    expect(handoffTargetsApi.update).not.toHaveBeenCalled();
  });

  it("shows Keycloak's Turkish detail next to the field it names", async () => {
    (handoffTargetsApi.update as jest.Mock).mockRejectedValue(
      new HandoffProblemError(400, 'Bu dönüş parametresi bu sitede kullanılamaz.', 'returnParam'),
    );
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    const panel = await open(user, 'SkyForms');
    const param = within(panel).getByRole('textbox', { name: /Dönüş parametresi/ });

    await user.clear(param);
    await user.type(param, 'next');
    await user.click(within(panel).getByRole('button', { name: 'Kaydet' }));

    expect(param).toHaveAccessibleDescription('Bu dönüş parametresi bu sitede kullanılamaz.');
    expect(param).toHaveValue('next');

    await user.type(param, 'Url');
    expect(param).not.toHaveAccessibleDescription('Bu dönüş parametresi bu sitede kullanılamaz.');
  });

  it('shows a problem about the site itself in its panel', async () => {
    (handoffTargetsApi.update as jest.Mock).mockRejectedValue(
      new HandoffProblemError(400, "Bu istemcinin kök adresi yildizskylab.com'da değil."),
    );
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    const panel = await open(user, 'SkyForms');

    await user.click(within(panel).getByRole('switch'));
    await user.click(within(panel).getByRole('button', { name: 'Kaydet' }));

    expect(
      await within(panel).findByText("Bu istemcinin kök adresi yildizskylab.com'da değil."),
    ).toBeInTheDocument();
    expect(within(panel).getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(openCount()).toMatch(/1/);
  });

  it('marks a client outside yildizskylab.com once in its row and does not offer to enable it', async () => {
    (handoffTargetsApi.list as jest.Mock).mockResolvedValue([
      {
        ...accountCenter,
        clientId: 'partner',
        name: 'Partner',
        rootUrl: 'https://partner.example',
      },
      { ...accountCenter, clientId: 'other', name: 'Other', rootUrl: 'https://other.example' },
      skyforms,
    ]);
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    await screen.findByRole('button', { name: 'Partner' });
    // One short mark per such row; the sentence itself only in the panel
    expect(screen.getAllByText('Açılamaz')).toHaveLength(2);
    expect(
      screen.queryByText('Kök adres https://*.yildizskylab.com değil; açılamaz.'),
    ).not.toBeInTheDocument();

    const panel = await open(user, 'Partner');
    expect(within(panel).getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
    expect(
      within(panel).getByText('Kök adres https://*.yildizskylab.com değil; açılamaz.'),
    ).toBeInTheDocument();
  });

  it('puts back the stored values when the admin changes their mind', async () => {
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    const panel = await open(user, 'SkyForms');
    const path = within(panel).getByRole('textbox', { name: /Giriş kapısı yolu/ });

    await user.click(within(panel).getByRole('switch'));
    await user.type(path, 'x');
    await user.click(within(panel).getByRole('button', { name: 'Vazgeç' }));

    expect(within(panel).getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(path).toHaveValue('/auth/signin');
    expect(within(panel).queryByRole('button', { name: 'Vazgeç' })).not.toBeInTheDocument();
    expect(handoffTargetsApi.update).not.toHaveBeenCalled();
  });

  it('saves with Enter', async () => {
    (handoffTargetsApi.update as jest.Mock).mockResolvedValue({ ...skyforms, returnParam: 'next' });
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    const panel = await open(user, 'SkyForms');
    const param = within(panel).getByRole('textbox', { name: /Dönüş parametresi/ });

    await user.clear(param);
    await user.type(param, 'next{Enter}');

    expect(handoffTargetsApi.update).toHaveBeenCalledWith('skyforms', {
      enabled: true,
      signInPath: '/auth/signin',
      returnParam: 'next',
    });
  });

  it('hides the settings when Keycloak refuses a save with 403', async () => {
    (handoffTargetsApi.update as jest.Mock).mockRejectedValue(
      new HandoffProblemError(403, 'Bu işlem için ADMIN grubunda olmalısın.'),
    );
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    const panel = await open(user, 'SkyForms');

    await user.click(within(panel).getByRole('switch'));
    await user.click(within(panel).getByRole('button', { name: 'Kaydet' }));

    expect(
      await screen.findByRole('heading', { name: sceneTitle('forbidden') }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
