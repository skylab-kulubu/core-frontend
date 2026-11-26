import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { EventFormSlots } from '@/components/scheduling/EventFormSlots';
import { ProblemError } from '@/lib/api/core';
import { urlsApi } from '@/lib/api/urls';
import { formRespondentsApi } from '@/lib/api/form-respondents';
import { listMyForms, readFormTitle } from '@/lib/api/skyforms';
import { emptyFeedbackSlot, slotsFromEvent } from '@/lib/event-forms';
import { moveSkyformsLink, skyformsLinkIn } from '@/lib/external-registration';

jest.mock('@/lib/api/skyforms', () => ({
  ...jest.requireActual('@/lib/api/skyforms'),
  readFormGate: jest.fn(),
  setFormGate: jest.fn(),
  listMyForms: jest.fn(),
  readFormTitle: jest.fn(() => Promise.resolve('')),
}));
jest.mock('@/lib/api/form-respondents', () => {
  const { ProblemError } = jest.requireActual('@/lib/api/core');
  // An Event core does not have: the mapping shows nothing
  const missing = () => Promise.reject(new ProblemError(404, 'Not Found'));
  return { formRespondentsApi: { questions: jest.fn(missing), mapping: jest.fn(missing) } };
});
jest.mock('@/lib/api/urls', () => ({
  ...jest.requireActual('@/lib/api/urls'),
  urlsApi: { create: jest.fn(), update: jest.fn() },
}));

const savedSlots = slotsFromEvent({
  formUrl: 'https://apply.example.test',
  formAlias: 'gecekodu-skydays2026',
});

describe('EventFormSlots short link button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (urlsApi.create as jest.Mock).mockRejectedValue(new ProblemError(409, 'Conflict'));
  });

  it('says the saved link exists on a 409 instead of failing or renaming', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <EventFormSlots
        slots={savedSlots}
        eventName="SkyDays"
        ownerTeam="GECEKODU"
        startLocal="2026-05-01T12:00"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Kısa link oluştur' }));

    expect(
      await screen.findByText(/Bu etkinliğin kısa linki zaten var: .*\/gecekodu-skydays2026$/),
    ).toBeInTheDocument();
    expect(urlsApi.create).toHaveBeenCalledTimes(1);
    expect(urlsApi.create).toHaveBeenCalledWith({
      url: 'https://apply.example.test',
      alias: 'gecekodu-skydays2026',
    });
    expect(screen.queryByText(/Kayıt şu anki durumunda/)).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('still reports a 409 for an alias the Event has not saved', async () => {
    const user = userEvent.setup();
    const [slot] = savedSlots;
    render(
      <EventFormSlots
        slots={[{ ...slot, alias: 'baska-ad' }]}
        eventName="SkyDays"
        ownerTeam="GECEKODU"
        startLocal="2026-05-01T12:00"
        onChange={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Kısa link oluştur' }));

    expect(await screen.findByText(/Kayıt şu anki durumunda/)).toBeInTheDocument();
    expect(screen.queryByText(/kısa linki zaten var/)).not.toBeInTheDocument();
  });
});

describe('EventFormSlots form gate', () => {
  beforeEach(() => jest.clearAllMocks());
  // jsdom has no PointerEvent; base-ui's Switch sends one on a click
  beforeAll(() => {
    if (!('PointerEvent' in window)) {
      Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
    }
  });

  it('tells the caller once Skyforms closed the form, and says when that failed', async () => {
    const { readFormGate, setFormGate } = jest.requireMock('@/lib/api/skyforms') as {
      readFormGate: jest.Mock;
      setFormGate: jest.Mock;
    };
    readFormGate.mockResolvedValue('open');
    setFormGate.mockResolvedValue('closed');
    const onGateChange = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('down'));
    const user = userEvent.setup();
    const [slot] = slotsFromEvent({
      formUrl: 'https://forms.yildizskylab.com/55555555-5555-4555-8555-555555555555',
    });
    render(
      <EventFormSlots
        slots={[slot!]}
        eventName="SkyDays"
        ownerTeam="GECEKODU"
        startLocal="2026-05-01T12:00"
        addable={false}
        onGateChange={onGateChange}
        onChange={jest.fn()}
      />,
    );

    const gate = await screen.findByRole('switch', { name: /Form açık/ });
    await user.click(gate);
    expect(setFormGate).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555', false);
    expect(onGateChange).toHaveBeenCalledWith(expect.objectContaining({ key: 'apply' }), 'closed');
    expect(screen.queryByText('Form ekle')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('switch', { name: /Form kapalı/ }));
    expect(
      await screen.findByText('Form kapandı, ama bekleyen hatırlatmalar iptal edilemedi'),
    ).toBeInTheDocument();
  });
});

describe('EventFormSlots form in use (409 form_in_use)', () => {
  const formId = '0b6f1c1e-6a39-4d0f-9d0c-3a8c5d1e2f00';
  const skyforms = slotsFromEvent({ formUrl: `https://forms.yildizskylab.com/${formId}` });

  beforeEach(() => jest.clearAllMocks());

  it('names the event holding the form and offers a new form made from it', () => {
    render(
      <EventFormSlots
        slots={skyforms}
        eventName="Gecekodu"
        ownerTeam="GECEKODU"
        startLocal="2026-05-01T12:00"
        reservedEventId="e1"
        onChange={jest.fn()}
        inUse={{ formId, event: { id: 'e9', name: 'Gecekodu 2025' } }}
      />,
    );
    expect(screen.getByText(/Bu form şu etkinlikte kullanılıyor:/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Gecekodu 2025 (yeni sekmede açılır)' }),
    ).toHaveAttribute('href', '/events/e9');
    const href = new URL(
      screen.getByRole('link', { name: 'Bu formdan yeni form aç' }).getAttribute('href') ?? '',
    );
    expect(href.pathname).toBe('/admin/forms/new-form');
    expect(href.searchParams.get('fromForm')).toBe(formId);
    expect(href.searchParams.get('ownerTeam')).toBe('GECEKODU');
  });

  it('says only that the form is elsewhere when core names no event', () => {
    render(
      <EventFormSlots
        slots={skyforms}
        eventName="Gecekodu"
        startLocal=""
        onChange={jest.fn()}
        inUse={{ formId }}
      />,
    );
    expect(screen.getByText('Bu form başka bir yerde kullanılıyor.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bu formdan yeni form aç' })).toBeInTheDocument();
  });

  it('says nothing on a slot with another form, and offers no Skyforms copy of an outside form', () => {
    const { rerender } = render(
      <EventFormSlots
        slots={savedSlots}
        eventName="Gecekodu"
        startLocal=""
        onChange={jest.fn()}
        inUse={{ formId, event: { id: 'e9', name: 'Gecekodu 2025' } }}
      />,
    );
    expect(screen.queryByText(/kullanılıyor/)).not.toBeInTheDocument();

    rerender(
      <EventFormSlots
        slots={slotsFromEvent({ formUrl: `https://apply.example.test/${formId}` })}
        eventName="Gecekodu"
        startLocal=""
        onChange={jest.fn()}
        inUse={{ formId, event: { id: 'e9', name: 'Gecekodu 2025' } }}
      />,
    );
    expect(screen.getByText(/Bu form şu etkinlikte kullanılıyor:/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bu formdan yeni form aç' })).not.toBeInTheDocument();
  });
});

describe('EventFormSlots Skyforms form picker', () => {
  const FORM = '33333333-3333-4333-8333-333333333333';
  const VIEWED = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => {
    jest.clearAllMocks();
    const { readFormGate } = jest.requireMock('@/lib/api/skyforms') as { readFormGate: jest.Mock };
    readFormGate.mockResolvedValue('open');
    (readFormTitle as jest.Mock).mockResolvedValue('Gecekodu 2026 başvuru');
    (listMyForms as jest.Mock).mockResolvedValue({
      items: [
        { id: FORM, title: 'Gecekodu 2026 başvuru', status: 2, userRole: 3, responseCount: 41 },
        { id: VIEWED, title: 'Başka ekibin formu', status: 1, userRole: 1, responseCount: 3 },
      ],
      totalCount: 2,
      page: 1,
      pageSize: 20,
    });
    (formRespondentsApi.questions as jest.Mock).mockRejectedValue(
      new ProblemError(404, 'Not Found'),
    );
    (formRespondentsApi.mapping as jest.Mock).mockRejectedValue(new ProblemError(404, 'Not Found'));
  });

  it('picks the form from the person’s Forms list and writes its address', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const [apply] = slotsFromEvent({});
    render(
      <EventFormSlots
        slots={[{ ...apply!, mode: 'skyforms' }]}
        eventName="Gecekodu"
        startLocal="2026-05-01T12:00"
        addable={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('Form seçilmedi')).toBeInTheDocument();
    // The address is typed by hand only under "Gelişmiş"
    expect(screen.getByText('Gelişmiş')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Form seç' }));
    expect(await screen.findByText('Gecekodu 2026 başvuru')).toBeInTheDocument();
    expect(screen.getByText('41 yanıt · Açık')).toBeInTheDocument();
    expect(screen.getByText('Görüntüleyen')).toBeInTheDocument();
    expect(listMyForms).toHaveBeenCalledWith({ search: '', page: 1, pageSize: 20 });

    await user.click(screen.getByRole('button', { name: 'Gecekodu 2026 başvuru' }));
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        key: 'apply',
        mode: 'skyforms',
        url: `https://forms.yildizskylab.com/${FORM}`,
      }),
    ]);
  });

  it('shows the form a moved external link put in the slot (fix/dis-kayit) as chosen', async () => {
    const link = skyformsLinkIn(`https://forms.yildizskylab.com/admin/forms/${FORM}/edit`);
    const slots = moveSkyformsLink(slotsFromEvent({}), link!);
    render(
      <EventFormSlots
        slots={slots}
        eventName="Gecekodu"
        startLocal=""
        reservedEventId="55555555-5555-4555-8555-555555555555"
        addable={false}
        onChange={jest.fn()}
      />,
    );
    expect(await screen.findByText('Gecekodu 2026 başvuru')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Değiştir' })).toBeInTheDocument();
    expect(readFormTitle).toHaveBeenCalledWith(FORM);
    // The mapping is asked for the Event and the form
    expect(formRespondentsApi.questions).toHaveBeenCalledWith(
      '55555555-5555-4555-8555-555555555555',
      FORM,
    );
  });

  it('keeps the address box for an outside form and for the feedback form', () => {
    const { rerender } = render(
      <EventFormSlots
        slots={savedSlots}
        eventName="Gecekodu"
        startLocal=""
        addable={false}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Form adresi')).toBeVisible();
    expect(screen.queryByText('Gelişmiş')).not.toBeInTheDocument();

    rerender(
      <EventFormSlots
        slots={[{ ...emptyFeedbackSlot(), mode: 'skyforms' }]}
        eventName="Gecekodu"
        startLocal=""
        addable={false}
        onChange={jest.fn()}
      />,
    );
    const slot = screen.getByText('Yanıtlar kayıt açmaz.').closest('div')!.parentElement!
      .parentElement!;
    expect(within(slot).queryByRole('button', { name: 'Form seç' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Form adresi')).toBeInTheDocument();
  });
});
