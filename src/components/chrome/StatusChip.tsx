'use client';

import { Badge, StatusDot as Dot, type BadgeTone } from '@skylab-kulubu/skylcn-ui';
import { statusChip, type StatusChipKind } from '@/lib/status-chip';

const TONE: Record<StatusChipKind, BadgeTone> = {
  active: 'success',
  passive: 'danger',
  pending: 'warning',
  'checked-in': 'success',
  guest: 'brand',
  member: 'strong',
  featured: 'brand',
  winner: 'success',
  neutral: 'neutral',
};

const DOT_TONE: Record<StatusChipKind, 'neutral' | 'brand' | 'success' | 'warning' | 'danger'> = {
  active: 'success',
  passive: 'danger',
  pending: 'warning',
  'checked-in': 'success',
  guest: 'brand',
  member: 'neutral',
  featured: 'brand',
  winner: 'success',
  neutral: 'neutral',
};

export function StatusChip({
  kind,
  label,
  className,
}: {
  kind: StatusChipKind;
  label?: string;
  className?: string;
}) {
  return (
    <Badge tone={TONE[kind]} className={className}>
      {label ?? statusChip(kind).label}
    </Badge>
  );
}

export function StatusDot({
  kind,
  title,
  className,
}: {
  kind: StatusChipKind;
  title?: string;
  className?: string;
}) {
  return (
    <Dot tone={DOT_TONE[kind]} label={title ?? statusChip(kind).label} className={className} />
  );
}
