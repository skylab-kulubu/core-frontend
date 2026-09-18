import { clubSwitcherLinks } from '@/lib/club-switcher';

export function ClubSwitcher() {
  return (
    <nav aria-label="Kulüp konsolları" className="border-t border-white/10 px-2 py-2">
      <ul className="space-y-1">
        {clubSwitcherLinks('admin').map((app) => (
          <li key={app.id}>
            <a
              href={app.href}
              className="flex items-center rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
            >
              {app.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
