import {
  ArrowRightLeft,
  Award,
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  Clock,
  FolderTree,
  Image,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  Link2,
  List,
  ListChecks,
  Newspaper,
  QrCode,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Ticket,
  Trophy,
  Mail,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

const PAGE_ICON: Record<string, LucideIcon> = {
  '/dashboard': LayoutDashboard,
  '/events': List,
  '/events?view=calendar': CalendarRange,
  '/events/new': CalendarPlus,
  '/seasons': Layers,
  '/qr': QrCode,
  '/competitors': Trophy,
  '/users': Users,
  '/groups': FolderTree,
  '/teams': UsersRound,
  '/announcements': Newspaper,
  '/media': Image,
  '/urls': Link2,
  '/certificates/templates': LayoutTemplate,
  '/certificates/defaults': SlidersHorizontal,
  '/certificates/issued': BadgeCheck,
  '/certificates/jobs': ListChecks,
  '/handoff-targets': ArrowRightLeft,
};

// The current event's pages link to sections of its workspace
const EVENT_SECTION_ICON: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  participants: Ticket,
  program: Clock,
  competitors: Trophy,
  certificates: Award,
};

const GROUP_ICON: Record<string, LucideIcon> = {
  events: CalendarDays,
  'active-event': CalendarCheck,
  club: UsersRound,
  content: Newspaper,
  certificates: Award,
  system: Settings2,
};

/** One line under each console's name in the switcher. */
export const CONSOLE_DESCRIPTION: Record<string, string> = {
  admin: 'Üyeler ve etkinlikler',
  forms: 'Formlar ve başvurular',
  mail: 'Toplu e-posta ve listeler',
  playground: 'Bileşen kütüphanesi',
};

export const CONSOLE_ICON: Record<string, LucideIcon> = {
  admin: ShieldCheck,
  forms: ClipboardList,
  mail: Mail,
};

export function navIcon(href: string): LucideIcon {
  const [path, hash] = href.split('#');
  if (hash && path.startsWith('/events/')) return EVENT_SECTION_ICON[hash] ?? ChevronRight;
  if (path.startsWith('/qr?')) return QrCode;
  return PAGE_ICON[path] ?? ChevronRight;
}

export function groupIcon(id: string): LucideIcon {
  return GROUP_ICON[id] ?? FolderTree;
}
