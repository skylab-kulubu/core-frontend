import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { DatePicker } from '@/components/forms/DatePicker';

function Field({ initial = '', mode }: { initial?: string; mode?: 'date' | 'datetime' }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DatePicker label="Başlangıç" value={value} onChange={setValue} mode={mode} />
      <output aria-label="Değer">{value}</output>
    </>
  );
}

describe('DatePicker', () => {
  it('takes a typed day and time as soon as it reads as one', async () => {
    const user = userEvent.setup();
    render(<Field />);
    const field = screen.getByRole('textbox', { name: 'Başlangıç' });
    await user.type(field, '15.11.2026 19:30');
    expect(screen.getByLabelText('Değer')).toHaveTextContent('2026-11-15T19:30');
  });

  it('shows the stored value the way it is typed, and the calendar beside it', () => {
    render(<Field initial="2026-11-15T19:00" />);
    expect(screen.getByRole('textbox', { name: 'Başlangıç' })).toHaveValue('15.11.2026 19:00');
    expect(screen.getByRole('button', { name: 'Başlangıç: takvimden seç' })).toBeInTheDocument();
  });

  it('says how to write it when the text is no date, keeping the last value', async () => {
    const user = userEvent.setup();
    render(<Field initial="2026-11-15T19:00" />);
    const field = screen.getByRole('textbox', { name: 'Başlangıç' });
    await user.clear(field);
    await user.type(field, '31.02.2026');
    await user.tab();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('GG.AA.YYYY SS:DD biçiminde yaz.')).toBeInTheDocument();
  });

  it('keeps a day alone in date mode', async () => {
    const user = userEvent.setup();
    render(<Field mode="date" />);
    await user.type(screen.getByRole('textbox', { name: 'Başlangıç' }), '01.10.2026');
    expect(screen.getByLabelText('Değer')).toHaveTextContent(/^2026-10-01$/);
  });
});
