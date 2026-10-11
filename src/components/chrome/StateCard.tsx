'use client';

import { StateCard as Card } from '@skylab-kulubu/skylcn-ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** A loading, empty or error state; skylcn-ui's StateCard with the prop names the pages use. */
export function StateCard({
  title,
  description,
  Icon,
  isLoading,
  tone = 'neutral',
  children,
}: {
  title: string;
  description?: string;
  Icon?: LucideIcon;
  isLoading?: boolean;
  tone?: 'neutral' | 'danger' | 'warning' | 'brand';
  children?: ReactNode;
}) {
  return (
    <Card title={title} description={description} icon={Icon} loading={isLoading} tone={tone}>
      {children}
    </Card>
  );
}
