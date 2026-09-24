import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import HandoffTargetsPage from '@/app/(authorized)/handoff-targets/page';
import { HandoffProblemError, handoffTargetsApi } from '@/lib/api/handoff-targets';
import type { HandoffTarget } from '@/lib/handoff/targets';

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

function row(name: string): HTMLElement {
  const cell = screen.getByText(name);
  const tr = cell.closest('tr');
  if (!tr) throw new Error(`${name} row missing`);
  return tr;
}

describe("SkyApp'ten geçiş page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (handoffTargetsApi.list as jest.Mock).mockResolvedValue([accountCenter, skyforms]);
  });

  it('lists Keycloak clients with their handoff state and fields', async () => {
    render(<HandoffTargetsPage />);

    expect(await screen.findByText('SkyForms')).toBeInTheDocument();
    expect(
      screen.getByText(/SkyApp, açık bir siteyi uygulamadaki kullanıcının oturumuyla açar/),
    ).toBeInTheDocument();

    const forms = row('SkyForms');
    expect(within(forms).getByText(/skyforms · https:\/\/forms\.yildizskylab\.com/)).toBeVisible();
    expect(within(forms).getByText('Açık')).toBeInTheDocument();
    expect(within(forms).getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(within(forms).getByRole('textbox', { name: /Giriş kapısı yolu/ })).toHaveValue(
      '/auth/signin',
    );
    expect(within(forms).getByRole('textbox', { name: /Dönüş parametresi/ })).toHaveValue(
      'callbackUrl',
    );

    const account = row('Hesap Merkezi');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toEqual([forms, account]);
    expect(within(account).getByText('Kapalı')).toBeInTheDocument();
    expect(within(account).getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(within(account).getByRole('textbox', { name: /Giriş kapısı yolu/ })).toHaveValue('');
  });

  it('hides the settings when Keycloak says the admin is not a realm super admin', async () => {
    (handoffTargetsApi.list as jest.Mock).mockRejectedValue(
      new HandoffProblemError(403, 'Bu işlem için realm süper yöneticisi olmalısın.'),
    );

    render(<HandoffTargetsPage />);

    expect(await screen.findByText('Bu sayfa realm süper yöneticisine açık')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('shows why the list could not load and lets the admin retry', async () => {
    (handoffTargetsApi.list as jest.Mock)
      .mockRejectedValueOnce(
        new HandoffProblemError(502, 'Keycloak şu an yanıt vermiyor. Biraz sonra tekrar dene.'),
      )
      .mockResolvedValueOnce([skyforms]);
    const user = userEvent.setup();

    render(<HandoffTargetsPage />);

    expect(
      await screen.findByText('Keycloak şu an yanıt vermiyor. Biraz sonra tekrar dene.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(await screen.findByText('SkyForms')).toBeInTheDocument();
  });

  it('enables a site and shows it as open only after Keycloak stores it', async () => {
    let answer: (target: HandoffTarget) => void = () => undefined;
    (handoffTargetsApi.update as jest.Mock).mockReturnValue(
      new Promise<HandoffTarget>((resolve) => {
        answer = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    await screen.findByText('Hesap Merkezi');
    const account = row('Hesap Merkezi');

    await user.click(within(account).getByRole('switch'));
    await user.type(
      within(account).getByRole('textbox', { name: /Giriş kapısı yolu/ }),
      '/api/auth/login',
    );
    await user.type(
      within(account).getByRole('textbox', { name: /Dönüş parametresi/ }),
      'returnTo',
    );
    await user.click(within(account).getByRole('button', { name: 'Kaydet' }));

    expect(handoffTargetsApi.update).toHaveBeenCalledWith('account-center', {
      enabled: true,
      signInPath: '/api/auth/login',
      returnParam: 'returnTo',
    });
    expect(within(account).getByText('Kapalı')).toBeInTheDocument();
    expect(within(account).getByRole('button', { name: 'Kaydediliyor…' })).toBeDisabled();

    await act(async () => {
      answer({
        ...accountCenter,
        enabled: true,
        signInPath: '/api/auth/login',
        returnParam: 'returnTo',
      });
    });

    expect(within(account).getByText('Açık')).toBeInTheDocument();
    expect(within(account).getByText('Kaydedildi')).toBeInTheDocument();
    expect(within(account).queryByRole('button', { name: 'Kaydet' })).toBeDisabled();
  });

  it('turns a site off with its stored fields', async () => {
    (handoffTargetsApi.update as jest.Mock).mockResolvedValue({ ...skyforms, enabled: false });
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    await screen.findByText('SkyForms');
    const forms = row('SkyForms');

    await user.click(within(forms).getByRole('switch'));
    await user.click(within(forms).getByRole('button', { name: 'Kaydet' }));

    expect(handoffTargetsApi.update).toHaveBeenCalledWith('skyforms', {
      enabled: false,
      signInPath: '/auth/signin',
      returnParam: 'callbackUrl',
    });
    expect(await within(forms).findByText('Kapalı')).toBeInTheDocument();
    expect(within(forms).getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('checks the fields before saving, the same way Keycloak does', async () => {
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    await screen.findByText('Hesap Merkezi');
    const account = row('Hesap Merkezi');
    const path = within(account).getByRole('textbox', { name: /Giriş kapısı yolu/ });
    const param = within(account).getByRole('textbox', { name: /Dönüş parametresi/ });

    await user.click(within(account).getByRole('switch'));
    await user.type(path, '//evil.example');
    await user.type(param, 'return-to');

    expect(path).toHaveAccessibleDescription('Giriş kapısı yolu "//", "\\" veya ".." içeremez.');
    expect(path).toHaveAttribute('aria-invalid', 'true');
    expect(param).toHaveAccessibleDescription(
      'Dönüş parametresi harfle başlamalı; yalnız harf, rakam ve _ içerebilir (en çok 32).',
    );
    expect(within(account).getByRole('button', { name: 'Kaydet' })).toBeDisabled();

    await user.type(param, '{Enter}');
    expect(handoffTargetsApi.update).not.toHaveBeenCalled();
  });

  it("shows Keycloak's Turkish detail next to the field it names", async () => {
    (handoffTargetsApi.update as jest.Mock).mockRejectedValue(
      new HandoffProblemError(400, 'Bu dönüş parametresi bu sitede kullanılamaz.', 'returnParam'),
    );
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    await screen.findByText('SkyForms');
    const forms = row('SkyForms');
    const param = within(forms).getByRole('textbox', { name: /Dönüş parametresi/ });

    await user.clear(param);
    await user.type(param, 'next');
    await user.click(within(forms).getByRole('button', { name: 'Kaydet' }));

    expect(param).toHaveAccessibleDescription('Bu dönüş parametresi bu sitede kullanılamaz.');
    expect(param).toHaveValue('next');
    expect(within(forms).getByText('Açık')).toBeInTheDocument();

    await user.type(param, 'Url');
    expect(param).not.toHaveAccessibleDescription('Bu dönüş parametresi bu sitede kullanılamaz.');
  });

  it("shows a problem about the site itself on the site's row", async () => {
    (handoffTargetsApi.update as jest.Mock).mockRejectedValue(
      new HandoffProblemError(400, "Bu istemcinin kök adresi yildizskylab.com'da değil."),
    );
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    await screen.findByText('SkyForms');
    const forms = row('SkyForms');

    await user.click(within(forms).getByRole('switch'));
    await user.click(within(forms).getByRole('button', { name: 'Kaydet' }));

    expect(
      await within(forms).findByText("Bu istemcinin kök adresi yildizskylab.com'da değil."),
    ).toBeInTheDocument();
    expect(within(forms).getByText('Açık')).toBeInTheDocument();
    expect(within(forms).getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('does not offer to enable a client whose root URL is outside yildizskylab.com', async () => {
    (handoffTargetsApi.list as jest.Mock).mockResolvedValue([
      {
        ...accountCenter,
        clientId: 'partner',
        name: 'Partner',
        rootUrl: 'https://partner.example',
      },
    ]);
    render(<HandoffTargetsPage />);
    await screen.findByText('Partner');
    const partner = row('Partner');

    expect(within(partner).getByRole('switch')).toBeDisabled();
    expect(
      within(partner).getByText('Kök adres https://*.yildizskylab.com değil; açılamaz.'),
    ).toBeInTheDocument();
  });

  it('puts back the stored values when the admin changes their mind', async () => {
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    await screen.findByText('SkyForms');
    const forms = row('SkyForms');
    const path = within(forms).getByRole('textbox', { name: /Giriş kapısı yolu/ });

    await user.click(within(forms).getByRole('switch'));
    await user.type(path, 'x');
    await user.click(within(forms).getByRole('button', { name: 'Vazgeç' }));

    expect(within(forms).getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(path).toHaveValue('/auth/signin');
    expect(within(forms).queryByRole('button', { name: 'Vazgeç' })).not.toBeInTheDocument();
    expect(handoffTargetsApi.update).not.toHaveBeenCalled();
  });

  it('saves a row with Enter', async () => {
    (handoffTargetsApi.update as jest.Mock).mockResolvedValue({ ...skyforms, returnParam: 'next' });
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    await screen.findByText('SkyForms');
    const param = within(row('SkyForms')).getByRole('textbox', { name: /Dönüş parametresi/ });

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
      new HandoffProblemError(403, 'Bu işlem için realm süper yöneticisi olmalısın.'),
    );
    const user = userEvent.setup();
    render(<HandoffTargetsPage />);
    await screen.findByText('SkyForms');
    const forms = row('SkyForms');

    await user.click(within(forms).getByRole('switch'));
    await user.click(within(forms).getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Bu sayfa realm süper yöneticisine açık')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
