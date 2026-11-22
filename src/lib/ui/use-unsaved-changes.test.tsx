import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { guardedHref, useDirtySince } from '@/lib/ui/use-unsaved-changes';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

function click(anchor: HTMLAnchorElement, init: MouseEventInit = {}) {
  let seen: string | null = 'unset';
  const listener = (event: MouseEvent) => {
    seen = guardedHref(event, window.location);
    event.preventDefault();
  };
  document.addEventListener('click', listener, true);
  anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
  document.removeEventListener('click', listener, true);
  return seen;
}

function anchor(href: string, attrs: Record<string, string> = {}) {
  const a = document.createElement('a');
  a.href = href;
  for (const [key, value] of Object.entries(attrs)) a.setAttribute(key, value);
  document.body.appendChild(a);
  return a;
}

describe('guardedHref', () => {
  beforeEach(() => window.history.replaceState(null, '', '/events/e1/edit'));
  afterEach(() => document.body.replaceChildren());

  it('names an in-app page the click goes to', () => {
    expect(click(anchor('/events/e1/participants'))).toBe('/events/e1/participants');
  });

  it('lets through in-page jumps, new tabs, modifier clicks and other sites', () => {
    expect(click(anchor('#sertifika'))).toBeNull();
    expect(click(anchor('/events', { target: '_blank' }))).toBeNull();
    expect(click(anchor('/events'), { metaKey: true })).toBeNull();
    expect(click(anchor('https://forms.example.com/new'))).toBeNull();
  });
});

describe('useDirtySince', () => {
  it('compares with what the drawer opened with, and forgets it on close', () => {
    const { result, rerender } = renderHook(
      ({ open, value }: { open: boolean; value: string }) => useDirtySince(open, value),
      { initialProps: { open: false, value: 'a' } },
    );
    expect(result.current).toBe(false);
    rerender({ open: true, value: 'b' });
    expect(result.current).toBe(false);
    rerender({ open: true, value: 'c' });
    expect(result.current).toBe(true);
    rerender({ open: false, value: 'c' });
    expect(result.current).toBe(false);
    rerender({ open: true, value: 'c' });
    expect(result.current).toBe(false);
  });
});

function Harness({ dirty }: { dirty: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <span>{open ? 'açık' : 'kapalı'}</span>
      <Drawer open={open} onClose={() => setOpen(false)} title="Sezon ekle" dirty={dirty}>
        <input aria-label="Ad" />
      </Drawer>
    </>
  );
}

describe('Drawer with unsaved work', () => {
  it('closes on Esc at once when nothing was typed', async () => {
    const user = userEvent.setup();
    render(<Harness dirty={false} />);
    await screen.findByRole('dialog', { name: 'Sezon ekle' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByText('kapalı')).toBeInTheDocument());
  });

  it('asks on Esc before dropping typed work, and stays open on Vazgeç', async () => {
    const user = userEvent.setup();
    render(<Harness dirty />);
    await screen.findByRole('dialog', { name: 'Sezon ekle' });
    await user.keyboard('{Escape}');
    const ask = await screen.findByRole('alertdialog', {
      name: 'Kaydedilmemiş değişiklikler silinsin mi?',
    });
    expect(screen.getByText('açık')).toBeInTheDocument();
    await user.click(within(ask).getByRole('button', { name: 'Vazgeç' }));
    expect(screen.getByText('açık')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    const again = await screen.findByRole('alertdialog', {
      name: 'Kaydedilmemiş değişiklikler silinsin mi?',
    });
    await user.click(within(again).getByRole('button', { name: 'Değişiklikleri sil' }));
    await waitFor(() => expect(screen.getByText('kapalı')).toBeInTheDocument());
  });
});
