import { render } from '@testing-library/react';
import React from 'react';
import { EventCoverImage } from '@/components/scheduling/EventCoverImage';

describe('EventCoverImage', () => {
  it('shows the whole picture in a 16:9 frame instead of cropping it to a strip', () => {
    const { container } = render(<EventCoverImage src="https://cdn.example/cover.png" />);
    const frame = container.querySelector('[data-slot="event-cover"]');
    const img = frame?.querySelector('img');

    expect(frame).toHaveClass('aspect-video', 'w-full', 'overflow-hidden', 'bg-muted');
    expect(img).toHaveAttribute('src', 'https://cdn.example/cover.png');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveClass('size-full', 'object-contain');
    expect(img).not.toHaveClass('object-cover');
    expect(img?.className).not.toMatch(/\bh-40\b/);
  });

  it('takes a width cap from the caller', () => {
    const { container } = render(<EventCoverImage src="/c.png" className="max-w-xs" />);
    expect(container.querySelector('[data-slot="event-cover"]')).toHaveClass('max-w-xs');
  });
});
