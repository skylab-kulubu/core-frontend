export type StatusChipKind =
  | 'active'
  | 'passive'
  | 'pending'
  | 'checked-in'
  | 'guest'
  | 'member'
  | 'featured'
  | 'winner'
  | 'neutral';

export type StatusChipSpec = {
  label: string;
  className: string;
  dotClassName: string;
};

export const STATUS_CHIPS: Record<StatusChipKind, StatusChipSpec> = {
  active: {
    label: 'Aktif',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    dotClassName: 'bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/40',
  },
  passive: {
    label: 'Pasif',
    className: 'border-red-500/30 bg-red-500/10 text-red-200',
    dotClassName: 'bg-red-400 shadow-[0_0_6px] shadow-red-400/40',
  },
  pending: {
    label: 'Kayıtlı',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    dotClassName: 'bg-amber-400 shadow-[0_0_6px] shadow-amber-400/40',
  },
  'checked-in': {
    label: 'Giriş yaptı',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    dotClassName: 'bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/40',
  },
  guest: {
    label: 'Misafir',
    className: 'border-skylab-400/40 bg-skylab-500/10 text-skylab-300',
    dotClassName: 'bg-skylab-400 shadow-[0_0_6px] shadow-skylab-400/40',
  },
  member: {
    label: 'Üye',
    className: 'border-white/20 bg-white/10 text-neutral-200',
    dotClassName: 'bg-neutral-400 shadow-[0_0_6px] shadow-neutral-400/40',
  },
  featured: {
    label: 'Öne çıkan',
    className: 'border-skylab-400/40 bg-skylab-500/10 text-skylab-300',
    dotClassName: 'bg-skylab-400 shadow-[0_0_6px] shadow-skylab-400/40',
  },
  winner: {
    label: 'Kazanan',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    dotClassName: 'bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/40',
  },
  neutral: {
    label: 'Durumsuz',
    className: 'border-white/10 bg-white/5 text-neutral-400',
    dotClassName: 'bg-neutral-600',
  },
};

export function statusChip(kind: StatusChipKind): StatusChipSpec {
  return STATUS_CHIPS[kind];
}

export function activeStatus(active: boolean): StatusChipKind {
  return active ? 'active' : 'passive';
}

export function ticketTypeStatus(type: string): StatusChipKind {
  return type === 'REGISTERED' ? 'member' : 'guest';
}

export function ticketCheckInStatus(hasCheckIn: boolean): StatusChipKind {
  return hasCheckIn ? 'checked-in' : 'pending';
}
