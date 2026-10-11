import { render, screen } from '@testing-library/react';
import { EventWorkspaceNav } from '@/components/scheduling/EventWorkspaceNav';

describe('EventWorkspaceNav', () => {
  it('links each tab the operator can use to its own route', () => {
    render(
      <EventWorkspaceNav
        eventId="e1"
        active="overview"
        canSeeParticipants
        canSeeCompetitors
        canUseDoor
        canSeeCertificates
        canSeeFiles
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Etkinlik çalışma alanı' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Genel bakış',
      'Katılımcılar',
      'Program',
      'Sertifikalar',
      'İçerik',
      'Yarışma',
    ]);
    expect(screen.getByRole('tab', { name: 'Genel bakış' })).toHaveAttribute('href', '/events/e1');
    expect(screen.getByRole('tab', { name: 'Katılımcılar' })).toHaveAttribute(
      'href',
      '/events/e1/participants',
    );
    expect(screen.getByRole('tab', { name: 'Program' })).toHaveAttribute(
      'href',
      '/events/e1/program',
    );
    expect(screen.getByRole('tab', { name: 'Sertifikalar' })).toHaveAttribute(
      'href',
      '/events/e1/certificates',
    );
    expect(screen.getByRole('tab', { name: 'İçerik' })).toHaveAttribute(
      'href',
      '/events/e1/content',
    );
    expect(screen.getByRole('tab', { name: 'Yarışma' })).toHaveAttribute(
      'href',
      '/events/e1/competition',
    );
    expect(screen.getByRole('link', { name: 'Kapı' })).toHaveAttribute('href', '/qr?eventId=e1');
  });

  it('marks the open tab as selected', () => {
    render(<EventWorkspaceNav eventId="e1" active="program" canSeeParticipants />);
    expect(screen.getByRole('tab', { name: 'Program' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Genel bakış' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tab', { name: 'Katılımcılar' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('does not render task links without capability', () => {
    render(<EventWorkspaceNav eventId="e1" active="overview" />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Genel bakış',
      'Program',
    ]);
    expect(screen.queryByRole('link', { name: 'Kapı' })).not.toBeInTheDocument();
  });
});
