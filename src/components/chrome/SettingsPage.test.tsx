import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Link from 'next/link';
import React, { useState } from 'react';
import { DangerSection, SettingsPage, SettingsSection } from '@/components/chrome/SettingsPage';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function GroupSettings({
  save,
  remove = jest.fn(),
  reportErrors = true,
}: {
  save: (name: string) => Promise<void>;
  remove?: () => void;
  /** false: the page leaves the failure to SettingsPage (a plain rejecting onSave). */
  reportErrors?: boolean;
}) {
  const [saved, setSaved] = useState('GeceKodu');
  const [name, setName] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <SettingsPage
      dirty={name !== saved}
      saving={saving}
      error={error}
      onSave={async () => {
        if (!reportErrors) {
          await save(name);
          setSaved(name);
          return;
        }
        setSaving(true);
        try {
          await save(name);
          setSaved(name);
          setError(null);
        } catch {
          setError('Kaydedilemedi');
        } finally {
          setSaving(false);
        }
      }}
      onDiscard={() => setName(saved)}
    >
      <SettingsSection title="Ad">
        <input aria-label="Görünen ad" value={name} onChange={(e) => setName(e.target.value)} />
      </SettingsSection>
      <SettingsSection title="Görünürlük">
        <Link href="/groups">Gruplar</Link>
      </SettingsSection>
      <DangerSection
        title="Grubu sil"
        actionLabel="Sil"
        confirm={{ title: '"GeceKodu" silinsin mi?', actionLabel: 'Grubu sil', onConfirm: remove }}
      />
    </SettingsPage>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => push.mockClear());

  it('names its cards and shows the save bar only once something changed', async () => {
    const pointer = userEvent.setup();
    render(<GroupSettings save={jest.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByRole('region', { name: 'Ad' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Grubu sil' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument();
    await pointer.type(screen.getByLabelText('Görünen ad'), ' 2');
    expect(screen.getByRole('region', { name: 'Kaydedilmemiş değişiklikler' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeInTheDocument();
  });

  it('saves every card with one Kaydet and hides the bar after', async () => {
    const pointer = userEvent.setup();
    const save = jest.fn().mockResolvedValue(undefined);
    render(<GroupSettings save={save} />);
    await pointer.type(screen.getByLabelText('Görünen ad'), ' 2');
    await pointer.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(save).toHaveBeenCalledWith('GeceKodu 2');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument(),
    );
  });

  it('puts the fields back with Vazgeç', async () => {
    const pointer = userEvent.setup();
    render(<GroupSettings save={jest.fn()} />);
    await pointer.type(screen.getByLabelText('Görünen ad'), ' 2');
    await pointer.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(screen.getByLabelText('Görünen ad')).toHaveValue('GeceKodu');
    expect(screen.queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument();
  });

  it('says a failed save in the bar and keeps the change', async () => {
    const pointer = userEvent.setup();
    render(<GroupSettings save={jest.fn().mockRejectedValue(new Error('x'))} />);
    await pointer.type(screen.getByLabelText('Görünen ad'), ' 2');
    await pointer.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Kaydedilemedi');
    expect(screen.getByLabelText('Görünen ad')).toHaveValue('GeceKodu 2');
  });

  it('asks before a link leaves unsaved changes', async () => {
    const pointer = userEvent.setup();
    render(<GroupSettings save={jest.fn()} />);
    await pointer.type(screen.getByLabelText('Görünen ad'), ' 2');
    await pointer.click(screen.getByRole('link', { name: 'Gruplar' }));
    expect(
      await screen.findByRole('alertdialog', { name: 'Kaydedilmemiş değişiklikler silinsin mi?' }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('says a rejected save in the bar when the page leaves it to the bar', async () => {
    const pointer = userEvent.setup();
    const save = jest.fn().mockRejectedValue(new Error('x'));
    render(<GroupSettings save={save} reportErrors={false} />);
    await pointer.type(screen.getByLabelText('Görünen ad'), ' 2');
    await pointer.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Kaydedilemedi');
    expect(screen.getByLabelText('Görünen ad')).toHaveValue('GeceKodu 2');
  });

  it('asks before the dangerous work and does nothing unasked', async () => {
    const pointer = userEvent.setup();
    const remove = jest.fn();
    render(<GroupSettings save={jest.fn()} remove={remove} />);
    await pointer.click(screen.getByRole('button', { name: 'Sil' }));
    const ask = await screen.findByRole('alertdialog', { name: '"GeceKodu" silinsin mi?' });
    expect(remove).not.toHaveBeenCalled();
    await pointer.click(within(ask).getByRole('button', { name: 'Vazgeç' }));
    expect(remove).not.toHaveBeenCalled();
    await pointer.click(screen.getByRole('button', { name: 'Sil' }));
    await pointer.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Grubu sil' }),
    );
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
