import { act, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { Breadcrumbs } from '@skylab-kulubu/skylcn-ui';
import {
  ChromeCrumbNamesProvider,
  useChromeCrumbName,
  useChromeCrumbNames,
} from '@/components/layout/chrome-crumb-names';
import { chromeCrumbs } from '@/lib/chrome-breadcrumbs';

const EVENT = '/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function Trail() {
  const names = useChromeCrumbNames();
  return <Breadcrumbs items={chromeCrumbs(`${EVENT}/program`, names)} />;
}

function EventPage({ name }: { name: string | null }) {
  useChromeCrumbName(EVENT, name);
  return null;
}

let rename: (name: string | null) => void = () => undefined;
function Harness({ initial }: { initial: string | null }) {
  const [name, setName] = useState(initial);
  rename = setName;
  return (
    <ChromeCrumbNamesProvider>
      <Trail />
      <EventPage name={name} />
    </ChromeCrumbNamesProvider>
  );
}

const trail = () => screen.getAllByRole('navigation')[0].textContent;

describe('chrome crumb names', () => {
  it('shows Kayıt while the event loads, then its name, and follows a rename', () => {
    render(<Harness initial={null} />);
    expect(trail()).toContain('Kayıt');

    act(() => rename("Yıldız Hackathon '26"));
    expect(trail()).toContain("Yıldız Hackathon '26");
    expect(trail()).not.toContain('Kayıt');

    act(() => rename('Yıldız Hackathon 2026'));
    expect(trail()).toContain('Yıldız Hackathon 2026');
  });

  it('forgets the name when the page that set it closes', () => {
    const view = render(
      <ChromeCrumbNamesProvider>
        <Trail />
        <EventPage name="GeceKodu" />
      </ChromeCrumbNamesProvider>,
    );
    expect(trail()).toContain('GeceKodu');

    view.rerender(
      <ChromeCrumbNamesProvider>
        <Trail />
      </ChromeCrumbNamesProvider>,
    );
    expect(trail()).toContain('Kayıt');
  });

  it('does nothing outside the chrome', () => {
    expect(() => render(<EventPage name="GeceKodu" />)).not.toThrow();
  });
});
