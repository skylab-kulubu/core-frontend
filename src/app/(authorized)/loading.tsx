import { PageSkeleton } from '@/components/chrome/PageSkeleton';

/** Shown at once on a move to another page, while its server part answers. */
export default function Loading() {
  return <PageSkeleton />;
}
