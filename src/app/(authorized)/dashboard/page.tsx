'use client';

import { useEffect, useState } from 'react';
import { ListItem } from '@/components/chrome/ListItem';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { newsApi } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';
import { eventsApi } from '@/lib/api/events';
import { identityApi } from '@/lib/api/identity';
import { sessionsApi } from '@/lib/api/sessions';
import { isLeader, isPrivileged } from '@/lib/auth/groups';

export default function DashboardPage() {
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const privileged = isPrivileged(groups);
  const leader = isLeader(groups);
  const [users, setUsers] = useState(0);
  const [events, setEvents] = useState(0);
  const [news, setNews] = useState(0);
  const [sessions, setSessions] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const eventRows = await eventsApi.list().catch(() => []);
        setEvents(eventRows.length);
        setSessions((await sessionsApi.listAll(eventRows).catch(() => [])).length);
        if (privileged) {
          setUsers((await identityApi.listUsers().catch(() => [])).length);
          const page = await newsApi.list({ limit: 100 }).catch(() => ({ items: [] }));
          setNews((page.items ?? []).filter((item) => Boolean(item.slug)).length);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof ProblemError ? err.title : 'Özet yüklenemedi');
      }
    }
    void load();
  }, [privileged, user?.id]);

  if (!privileged && !leader) {
    return <p className="text-sm text-neutral-500">Bu özet paneli yetkili üyelere açık.</p>;
  }

  const cards = [
    ...(privileged
      ? [
          { href: '/users', title: 'Kullanıcılar', subtitle: String(users) },
          { href: '/announcements', title: 'Duyurular', subtitle: String(news) },
        ]
      : []),
    { href: '/events', title: 'Etkinlikler', subtitle: String(events) },
    { href: '/sessions', title: 'Oturumlar', subtitle: String(sessions) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Özet" description={user?.email} />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
        {cards.map((card) => (
          <ListItem key={card.href} href={card.href} title={card.title} subtitle={card.subtitle} />
        ))}
      </div>
    </div>
  );
}
