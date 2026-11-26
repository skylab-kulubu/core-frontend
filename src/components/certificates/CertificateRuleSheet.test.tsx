import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  CertificateRuleSheet,
  draftFromRule,
  ruleBodyFromDraft,
} from '@/components/certificates/CertificateRuleSheet';
import {
  certificatesApi,
  type CertificateRule,
  type CertificateRuleSession,
} from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';

jest.mock('@/lib/api/certificates', () => ({
  certificatesApi: { setRule: jest.fn() },
}));

const setRule = certificatesApi.setRule as jest.Mock;

function session(id: string, extra: Partial<CertificateRuleSession> = {}): CertificateRuleSession {
  return {
    id,
    dayId: 'd1',
    title: id,
    sessionType: 'WORKSHOP',
    startTime: '2026-11-28T07:00:00Z',
    endTime: '2026-11-28T08:00:00Z',
    cancelled: false,
    counted: true,
    required: false,
    ...extra,
  };
}

const sessions = [
  session('Açılış'),
  session('Atölye 1'),
  session('Atölye 2'),
  session('Networking', { sessionType: 'NETWORKING', counted: false }),
  session('Kapanış', { dayId: 'd2' }),
  session('Söyleşi', { dayId: 'd2', cancelled: true }),
];

function rule(extra: Partial<CertificateRule> = {}): CertificateRule {
  return {
    rule: 'count',
    minCount: null,
    effectiveMin: 3,
    countedTotal: 4,
    sessions,
    ...extra,
  };
}

function renderSheet(value = rule(), finalized = false, templateWarning?: string) {
  const onSaved = jest.fn();
  render(
    <CertificateRuleSheet
      open
      rule={value}
      eventId="e1"
      days={[
        { id: 'd1', eventId: 'e1', name: '1. gün' },
        { id: 'd2', eventId: 'e1', name: '2. gün' },
      ]}
      finalized={finalized}
      templateWarning={templateWarning}
      onClose={jest.fn()}
      onSaved={onSaved}
    />,
  );
  return { onSaved, sheet: screen.getByRole('dialog', { name: 'Sertifika kuralı' }) };
}

beforeEach(() => jest.clearAllMocks());

it('starts an older ratio rule as the count it stands for', () => {
  const draft = draftFromRule(rule({ rule: 'ratio', ratio: 0.67, minCount: null }));
  expect(draft).toMatchObject({ rule: 'count', minCount: 3 });
  // Saved, it writes count with that threshold and leaves the Sessions alone
  expect(ruleBodyFromDraft(rule({ rule: 'ratio', ratio: 0.67 }), draft)).toEqual({
    rule: 'count',
    minCount: 3,
    sessions: [],
  });
});

it('shows N, the default threshold and its percentage, grouped by day', () => {
  const { sheet } = renderSheet();
  expect(within(sheet).getByText('4')).toBeInTheDocument();
  expect(within(sheet).getByRole('spinbutton', { name: 'En az kaç oturum' })).toHaveValue(3);
  expect(within(sheet).getByText('(%75)')).toBeInTheDocument();
  expect(within(sheet).getByText('1. gün')).toBeInTheDocument();
  expect(within(sheet).getByText('2. gün')).toBeInTheDocument();
  // A cancelled Session's boxes are off
  expect(within(sheet).getByRole('checkbox', { name: 'Söyleşi: sayılır' })).toBeDisabled();
  expect(within(sheet).getByRole('checkbox', { name: 'Söyleşi: zorunlu' })).toBeDisabled();
});

it('locks Sayılır while Zorunlu is ticked and counts N live', async () => {
  const user = userEvent.setup();
  const { sheet } = renderSheet();
  await user.click(within(sheet).getByRole('checkbox', { name: 'Networking: zorunlu' }));
  const counted = within(sheet).getByRole('checkbox', { name: 'Networking: sayılır' });
  expect(counted).toBeChecked();
  expect(counted).toBeDisabled();
  expect(within(sheet).getByText('5')).toBeInTheDocument();
  expect(within(sheet).getByText('(%80)')).toBeInTheDocument();
});

it('saves with one PUT: the threshold typed and only the Sessions changed', async () => {
  const user = userEvent.setup();
  const saved = rule({ minCount: 2 });
  setRule.mockResolvedValue(saved);
  const { sheet, onSaved } = renderSheet();
  const min = within(sheet).getByRole('spinbutton', { name: 'En az kaç oturum' });
  await user.clear(min);
  await user.type(min, '2');
  expect(within(sheet).getByText('(%50)')).toBeInTheDocument();
  await user.click(within(sheet).getByRole('checkbox', { name: 'Açılış: zorunlu' }));
  await user.click(within(sheet).getByRole('button', { name: 'Kaydet' }));
  expect(setRule).toHaveBeenCalledTimes(1);
  expect(setRule).toHaveBeenCalledWith('e1', {
    rule: 'count',
    minCount: 2,
    sessions: [{ id: 'Açılış', counted: true, required: true }],
  });
  expect(onSaved).toHaveBeenCalledWith(saved);
});

it('goes back to the default with Varsayılan', async () => {
  const user = userEvent.setup();
  setRule.mockResolvedValue(rule());
  const { sheet } = renderSheet(rule({ minCount: 2 }));
  await user.click(within(sheet).getByRole('button', { name: 'Varsayılan (%75)' }));
  expect(within(sheet).getByRole('spinbutton', { name: 'En az kaç oturum' })).toHaveValue(3);
  await user.click(within(sheet).getByRole('button', { name: 'Kaydet' }));
  expect(setRule).toHaveBeenCalledWith('e1', { rule: 'count', minCount: null, sessions: [] });
});

it('says beside the field why the threshold cannot be saved', async () => {
  const user = userEvent.setup();
  const { sheet } = renderSheet();
  const min = within(sheet).getByRole('spinbutton', { name: 'En az kaç oturum' });
  await user.clear(min);
  await user.type(min, '9');
  expect(within(sheet).getByRole('alert')).toHaveTextContent('1 ile 4 arasında olmalı');
  expect(within(sheet).getByRole('button', { name: 'Kaydet' })).toBeDisabled();
});

it('says why core refused the rule and keeps the sheet', async () => {
  const user = userEvent.setup();
  setRule.mockRejectedValue(new ProblemError(400, 'Bad Request'));
  const { sheet, onSaved } = renderSheet();
  await user.click(within(sheet).getByRole('checkbox', { name: 'Atölye 1: sayılır' }));
  await user.click(within(sheet).getByRole('button', { name: 'Kaydet' }));
  expect(await within(sheet).findByRole('alert')).toBeInTheDocument();
  expect(onSaved).not.toHaveBeenCalled();
});

it('warns that a closed attendance moves only the list and a rescan', () => {
  const { sheet } = renderSheet(rule(), true);
  expect(within(sheet).getByText(/Katılım kapandı/)).toBeInTheDocument();
});

it('shows the automatic sending switch only once core sends it', () => {
  const { sheet } = renderSheet();
  expect(within(sheet).queryByText('Sertifikaları otomatik gönder')).not.toBeInTheDocument();
});

it('names what the switch does', () => {
  const { sheet } = renderSheet(rule({ autoFinalize: false }));
  expect(within(sheet).getByText('Sertifikaları otomatik gönder')).toBeInTheDocument();
  expect(
    within(sheet).getByText('Son oturumdan 1 saat sonra üretilir ve postalanır'),
  ).toBeInTheDocument();
});

it('says the template while the switch is on and it is not the Event’s own', async () => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
  const user = userEvent.setup();
  const { sheet } = renderSheet(
    rule({ autoFinalize: false }),
    false,
    'SKY LAB varsayılan şablonuyla basılacak',
  );
  expect(within(sheet).queryByText('SKY LAB varsayılan şablonuyla basılacak')).toBeNull();
  await user.click(within(sheet).getByRole('switch'));
  expect(within(sheet).getByText('SKY LAB varsayılan şablonuyla basılacak')).toBeInTheDocument();
  await user.selectOptions(within(sheet).getByRole('combobox'), 'none');
  expect(within(sheet).queryByText('SKY LAB varsayılan şablonuyla basılacak')).toBeNull();
});

it('sends the automatic closing switch when core has it', async () => {
  // jsdom has no PointerEvent; base-ui's Switch sends one on a click
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
  const user = userEvent.setup();
  setRule.mockResolvedValue(rule({ autoFinalize: false }));
  const { sheet } = renderSheet(rule({ autoFinalize: true }));
  await user.click(within(sheet).getByRole('switch'));
  await user.click(within(sheet).getByRole('button', { name: 'Kaydet' }));
  expect(setRule).toHaveBeenCalledWith('e1', {
    rule: 'count',
    minCount: null,
    sessions: [],
    autoFinalize: false,
  });
});
