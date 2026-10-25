import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { SideScroll } from '@/components/chrome/SideScroll';

function sized(
  el: HTMLElement,
  { scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number },
) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
}

function scrollTo(el: HTMLElement, left: number) {
  el.scrollLeft = left;
  fireEvent.scroll(el);
}

describe('SideScroll', () => {
  it('fades no edge when everything fits', () => {
    render(
      <SideScroll data-testid="row">
        <span>Tümü</span>
      </SideScroll>,
    );
    const row = screen.getByTestId('row');
    sized(row, { scrollWidth: 300, clientWidth: 300 });
    act(() => scrollTo(row, 0));
    expect(row).toHaveAttribute('data-fade', 'none');
  });

  it('fades the side that still has pills, and both in the middle', () => {
    render(
      <SideScroll data-testid="row">
        <span>Tümü</span>
      </SideScroll>,
    );
    const row = screen.getByTestId('row');
    sized(row, { scrollWidth: 600, clientWidth: 300 });

    act(() => scrollTo(row, 0));
    expect(row).toHaveAttribute('data-fade', 'end');

    act(() => scrollTo(row, 150));
    expect(row).toHaveAttribute('data-fade', 'both');

    act(() => scrollTo(row, 300));
    expect(row).toHaveAttribute('data-fade', 'start');
  });

  it('scrolls sideways instead of widening the page', () => {
    render(
      <SideScroll data-testid="row">
        <span>Tümü</span>
      </SideScroll>,
    );
    expect(screen.getByTestId('row')).toHaveClass('overflow-x-auto', 'max-w-full');
  });
});
