'use client';

import {
  DataList as List,
  cn,
  type DataListPartsProps,
  type DataListRowsProps,
} from '@skylab-kulubu/skylcn-ui';
import type { ReactElement } from 'react';

/**
 * The panel's row density (Entra's "compact" list, ~40px a two-line row): less
 * padding in the row, the title and the line under it set tight. skylcn-ui's
 * DataList draws ~52px rows; `comfortable` keeps them.
 */
const COMPACT = cn(
  '[&_[data-slot=data-list-row]]:py-1',
  '[&_[data-slot=data-list-title]_p]:leading-[18px]',
  '[&_[data-slot=data-list-title]_p+div]:mt-0',
  '[&_[data-slot=data-list-title]_p+div_span]:leading-4',
);

type Density = { density?: 'compact' | 'comfortable' };

/**
 * skylcn-ui's DataList at the panel's density: compact unless a list asks for room
 * (a picture in the row). Its header stays at the top while the rows scroll.
 * Every list of the panel draws through this one, so they read alike.
 */
export function DataList<T>(props: DataListRowsProps<T> & Density): ReactElement;
export function DataList(props: DataListPartsProps & Density): ReactElement;
export function DataList({
  density = 'compact',
  className,
  ...props
}: (DataListRowsProps<unknown> | DataListPartsProps) & Density) {
  return (
    <List
      data-density={density}
      className={cn(density === 'compact' && COMPACT, className)}
      {...(props as DataListRowsProps<unknown>)}
    />
  );
}
