'use server';

import { cookies } from 'next/headers';
import { getTokenFromCookies } from '@/lib/auth/token';
import { newsApi } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';
import type { AnnouncementDto } from '@/types/api';

export async function getAnnouncements(_params?: {
  includeUser?: boolean;
  includeEventType?: boolean;
  includeImages?: boolean;
}): Promise<AnnouncementDto[]> {
  try {
    const token = getTokenFromCookies(await cookies());
    const page = await newsApi.list({ limit: 50 }, token);
    return (page.items ?? [])
      .filter((item) => Boolean(item.slug))
      .map((item) => ({
        id: item.slug,
        title: item.data?.title || item.slug,
        body: item.data?.body || '',
        active: item.data?.featured ?? true,
        coverImageUrl: item.data?.heroImage,
      }));
  } catch (error) {
    if (error instanceof ProblemError && error.status === 404) {
      return [];
    }
    throw error;
  }
}
