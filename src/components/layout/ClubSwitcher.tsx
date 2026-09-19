import { ClipboardList, Mail } from 'lucide-react';
import { clubSwitcherLinks } from '@/lib/club-switcher';

const CONSOLE_ICON = { forms: ClipboardList, mail: Mail } as const;

export function ClubSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <nav aria-label="Kulüp konsolları" className="space-y-1">
      {clubSwitcherLinks('admin').map((app) => {
        const Icon = CONSOLE_ICON[app.id as keyof typeof CONSOLE_ICON];
        return (
          <a
            key={app.id}
            href={app.href}
            aria-label={collapsed ? app.label : undefined}
            title={collapsed ? app.label : undefined}
            className={`flex min-h-9 items-center rounded-md py-2 text-sm text-neutral-400 hover:bg-white/5 hover:text-neutral-100 ${
              collapsed ? 'justify-center px-1' : 'gap-3 px-2'
            }`}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
            {collapsed ? null : app.label}
          </a>
        );
      })}
    </nav>
  );
}
