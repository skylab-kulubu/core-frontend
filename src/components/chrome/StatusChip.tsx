'use client';

import { statusChip, type StatusChipKind } from '@/lib/status-chip';

export function StatusChip({
  kind,
  label,
  className = '',
}: {
  kind: StatusChipKind;
  label?: string;
  className?: string;
}) {
  const spec = statusChip(kind);
  return (
    <span
      className={`text-4xs inline-flex items-center rounded-md border px-1.5 py-0.5 font-medium tracking-[0.18em] uppercase ${spec.className} ${className}`}
    >
      {label ?? spec.label}
    </span>
  );
}

export function StatusDot({
  kind,
  title,
  className = '',
}: {
  kind: StatusChipKind;
  title?: string;
  className?: string;
}) {
  const spec = statusChip(kind);
  return (
    <span
      title={title ?? spec.label}
      className={`relative z-10 size-1.5 shrink-0 rounded-full ${spec.dotClassName} ${className}`}
    />
  );
}
