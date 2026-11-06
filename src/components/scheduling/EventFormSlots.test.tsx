import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { EventFormSlots } from '@/components/scheduling/EventFormSlots';
import { ProblemError } from '@/lib/api/core';
import { urlsApi } from '@/lib/api/urls';
import { slotsFromEvent } from '@/lib/event-forms';

jest.mock('@/lib/api/skyforms', () => ({ readFormGate: jest.fn(), setFormGate: jest.fn() }));
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
