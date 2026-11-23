'use client';

import { Banner } from '@skylab-kulubu/skylcn-ui';
import { Hourglass } from 'lucide-react';
import Link from 'next/link';
import { useCapabilities } from '@/lib/capabilities-context';
import { showsManagementTerms } from '@/lib/management-terms';

/**
 * The strip over every page while the person holds a YK, DK or Team Leader
 * membership whose term expired (core's `expiredManagementMemberships`).
 * Nothing until core answers, and nothing when it cannot be read.
 */
export function ExpiredTermsBanner() {
  const capabilities = useCapabilities();
  if (capabilities.status !== 'ready') return null;
  const expired = capabilities.data.expiredManagementMemberships ?? [];
  if (!expired.length) return null;
  const paths = expired.map((term) => term.groupPath).join(', ');
  const text =
    expired.length === 1
      ? `Yönetim üyeliğinin süresi doldu: ${paths}`
      : `${expired.length} yönetim üyeliğinin süresi doldu: ${paths}`;
  return (
    <Banner
      icon={Hourglass}
      action={
        showsManagementTerms(capabilities) ? (
          <Link href="/management-memberships" className="text-skylab-300 hover:underline">
            Dönem devri
          </Link>
        ) : null
      }
    >
      {text}
    </Banner>
  );
}
