import {
  ArrowRightLeft,
  Award,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock,
  FolderTree,
  Hourglass,
  DoorOpen,
  Image,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Layers,
  Link2,
  Map as MapIcon,
  Newspaper,
  QrCode,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Ticket,
  Trophy,
  Type,
  Mail,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { eventTabFromPath, type EventTab } from '@/lib/event-workspace';

const PAGE_ICON: Record<string, LucideIcon> = {
  '/dashboard': LayoutDashboard,
  '/events': CalendarDays,
  '/seasons': Layers,
  '/qr': QrCode,
  '/users': Users,
  '/groups': FolderTree,
  '/apps': LayoutGrid,
  '/teams': UsersRound,
  '/my-teams': UsersRound,
  '/management-memberships': Hourglass,
  '/subject-requests': ShieldCheck,
  '/announcements': Newspaper,
  '/urls': Link2,
  '/certificates/templates': LayoutTemplate,
  '/certificates/defaults': SlidersHorizontal,
  '/certificates/fonts': Type,
  '/handoff-targets': ArrowRightLeft,
  '/map-regions': MapIcon,
};

// The current event's pages link to the tabs of its workspace
const EVENT_TAB_ICON: Record<EventTab, LucideIcon> = {
  overview: LayoutDashboard,
  participants: Ticket,
  program: Clock,
  checkin: DoorOpen,
  emails: Mail,
  certificates: Award,
  content: Image,
  competition: Trophy,
};

const GROUP_ICON: Record<string, LucideIcon> = {
  people: UsersRound,
  content: Newspaper,
  settings: Settings2,
};

/** One line under each console's name in the switcher. */
export const CONSOLE_DESCRIPTION: Record<string, string> = {
  admin: 'Üyeler ve etkinlikler',
  forms: 'Formlar ve başvurular',
  mail: 'E-posta ve bildirim gönderimi',
  playground: 'Bileşen kütüphanesi',
};

export const CONSOLE_ICON: Record<string, LucideIcon> = {
  admin: ShieldCheck,
  forms: ClipboardList,
  mail: Mail,
};

export function navIcon(href: string): LucideIcon {
  const [path] = href.split('#');
  const tab = eventTabFromPath(path);
  if (tab) return EVENT_TAB_ICON[tab];
  if (path.startsWith('/qr?')) return QrCode;
  return PAGE_ICON[path] ?? ChevronRight;
}

export function groupIcon(id: string): LucideIcon {
  return GROUP_ICON[id] ?? FolderTree;
}
