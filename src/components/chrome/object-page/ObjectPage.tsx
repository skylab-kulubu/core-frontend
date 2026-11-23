'use client';

import {
  Card,
  DescriptionList,
  SideNav,
  SideNavLayout,
  cn,
  type DescriptionItem,
  type SideNavSection,
} from '@skylab-kulubu/skylcn-ui';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { CoverBackdrop, CoverFrame } from './ObjectCover';

/**
 * The top band of an object page (an event, a group, an app, a person): the picture whole in
 * front of its own colours, the kind of thing and its owner, the name with the open page beside
 * it, state badges and a line of facts.
 */
export function ObjectPageHeader({
  eyebrow,
  title,
  section,
  badges,
  meta,
  cover,
}: {
  /** The kind of thing and whose it is: "Etkinlik · GECEKODU". */
  eyebrow?: ReactNode;
  title: string;
  /** The open page's name, written after the title: "Yıldız Hackathon | Program". */
  section?: string;
  badges?: ReactNode;
  meta?: ReactNode;
  /** The picture and the initials that stand in for it; none: no picture place. */
  cover?: { src?: string; initials: string };
}) {
  return (
    <div
      data-slot="object-page-header"
      className="border-border-subtle bg-card relative overflow-hidden rounded-xl border"
    >
      {cover ? <CoverBackdrop src={cover.src} /> : null}
      <div className="relative flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-5 sm:p-4">
        {cover ? (
          <CoverFrame
            src={cover.src}
            initials={cover.initials}
            className="w-full shrink-0 sm:w-52"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1.5">
          {eyebrow ? (
            <p className={`text-muted-foreground font-medium ${TEXT_SECONDARY}`}>{eyebrow}</p>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <h1 className="text-foreground-strong text-xl leading-tight font-semibold sm:text-2xl">
              {title}
            </h1>
            {section ? (
              <span className="text-muted-foreground text-xl leading-tight sm:text-2xl">
                | {section}
              </span>
            ) : null}
          </div>
          {badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
          {meta ? (
            <div className={`text-secondary-foreground ${TEXT_SECONDARY}`}>{meta}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * An object page: its top band and command bar, notices under them, then the object's own menu
 * on the left (a button opening it on a phone) beside the open page. Without a menu, the page
 * alone at full width.
 */
export function ObjectPage({
  header,
  commands,
  notices,
  menu,
  children,
}: {
  header: ReactNode;
  commands?: ReactNode;
  notices?: ReactNode;
  menu?: { label: string; sections: readonly SideNavSection[]; activeHref?: string };
  children: ReactNode;
}) {
  return (
    <div className="space-y-4" data-slot="object-page">
      <header className="space-y-2">
        {header}
        {commands}
      </header>
      {notices}
      {menu ? (
        <SideNavLayout
          nav={
            <SideNav
              aria-label={menu.label}
              sections={menu.sections}
              activeHref={menu.activeHref}
            />
          }
        >
          {children}
        </SideNavLayout>
      ) : (
        <div className="min-w-0">{children}</div>
      )}
    </div>
  );
}

/** A framed block of an object's overview: its name, an optional way into its page, its content. */
export function ObjectCard({
  title,
  href,
  linkLabel = 'Aç',
  linkName,
  action,
  children,
  className,
}: {
  title: ReactNode;
  href?: string;
  linkLabel?: string;
  /** The link's name for screen readers when its label alone is not enough ("Açıklamayı düzenle"). */
  linkName?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex min-w-0 flex-col gap-3 p-4', className)}>
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h2 className="text-foreground-strong text-sm font-semibold">{title}</h2>
        {action ??
          (href ? (
            <Link
              href={href}
              aria-label={linkName}
              className={`text-skylab-300 hover:text-foreground inline-flex items-center gap-1 ${TEXT_SECONDARY}`}
            >
              {linkLabel}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : null)}
      </div>
      {children}
    </Card>
  );
}

/** The object's key facts in two columns (the admin centre's "Essentials"), with a way to edit them. */
export function ObjectEssentials({
  items,
  editHref,
  title = 'Temel bilgiler',
  editName = 'Temel bilgileri düzenle',
  columns = 2,
}: {
  items: readonly DescriptionItem[];
  editHref?: string;
  title?: string;
  editName?: string;
  columns?: 1 | 2 | 3;
}) {
  return (
    <ObjectCard title={title} href={editHref} linkLabel="Düzenle" linkName={editName}>
      <DescriptionList items={items} columns={columns} />
    </ObjectCard>
  );
}
