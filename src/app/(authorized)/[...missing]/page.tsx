import { notFound } from 'next/navigation';

/** Any address the panel has no page for: the not-found page inside the chrome. */
export default function MissingPage() {
  notFound();
}
