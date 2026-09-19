import { render, screen } from '@testing-library/react';
import { EventWorkspaceNav } from '@/components/scheduling/EventWorkspaceNav';

describe('EventWorkspaceNav', () => {
  it('links directly to the event tasks the operator can use', () => {
    render(<EventWorkspaceNav eventId="e1" canSeeParticipants canSeeCompetitors canUseDoor />);
    expect(screen.getByRole('navigation', { name: 'Etkinlik çalışma alanı' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Özet' })).toHaveAttribute('href', '#overview');
    expect(screen.getByRole('link', { name: 'Başvuranlar' })).toHaveAttribute(
      'href',
      '#participants',
    );
    expect(screen.getByRole('link', { name: 'Program' })).toHaveAttribute('href', '#program');
    expect(screen.getByRole('link', { name: 'Yarışmacılar' })).toHaveAttribute(
      'href',
      '#competitors',
    );
    expect(screen.getByRole('link', { name: 'Kapı' })).toHaveAttribute('href', '/qr?eventId=e1');
  });

  it('does not render task links without capability', () => {
    render(<EventWorkspaceNav eventId="e1" />);
    expect(screen.queryByRole('link', { name: 'Başvuranlar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Yarışmacılar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kapı' })).not.toBeInTheDocument();
  });
});
