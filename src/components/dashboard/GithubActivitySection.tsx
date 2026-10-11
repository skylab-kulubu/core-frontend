'use client';

import {
  AvatarGroup,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Sparkline,
  StatCard,
  Timeline,
} from '@skylab-kulubu/skylcn-ui';
import { GitCommitHorizontal, GitMerge, GitPullRequest, Tag, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  fetchGithubActivity,
  githubActivityConfigured,
  type GithubActivity,
} from '@/lib/dashboard/github-activity';
import { fromNow } from './format';

const number = new Intl.NumberFormat('tr-TR');

function delta(
  current: number,
  previous: number,
): { text: string; tone: 'positive' | 'negative' | 'neutral' } {
  const diff = current - previous;
  if (diff === 0) return { text: '±0', tone: 'neutral' };
  return {
    text: `${diff > 0 ? '+' : ''}${number.format(diff)}`,
    tone: diff > 0 ? 'positive' : 'negative',
  };
}

/**
 * What the club is building: the organisation's activity over the window, the
 * public repositories being worked on now and the latest merges and releases.
 * Hidden until an activity endpoint is configured.
 */
export function GithubActivitySection() {
  const [data, setData] = useState<GithubActivity | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!githubActivityConfigured) return;
    const controller = new AbortController();
    fetchGithubActivity(controller.signal)
      .then(setData)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFailed(true);
        if (process.env.NODE_ENV !== 'production') console.warn(error);
      });
    return () => controller.abort();
  }, []);

  if (!githubActivityConfigured || failed || !data) return null;

  const { totals } = data;
  const change = delta(totals.commits, totals.commitsPrevious);
  const top = data.repositories.slice(0, 6);
  const hidden = totals.privateRepositories;
  const notes = [
    hidden?.active
      ? `Toplamlara ${hidden.active} özel repodaki ${number.format(hidden.commits)} commit de dahil.`
      : null,
    data.stale ? 'GitHub şu an okunamadı; son alınan veriler gösteriliyor.' : null,
    data.truncated
      ? 'GitHub yanıtı kısaltıldı; sayılar gerçekte biraz daha yüksek olabilir.'
      : null,
  ].filter(Boolean);

  return (
    <section aria-labelledby="club-development" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="club-development" className="text-foreground text-base font-semibold">
          Kulüp geliştirmesi
        </h2>
        <p className="text-subtle-foreground text-xs">
          Son {data.window.days} gün ·{' '}
          <a
            href={`https://github.com/${data.org}`}
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            github.com/{data.org}
          </a>{' '}
          · {fromNow(data.generatedAt)} güncellendi
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Commit"
          value={totals.commits}
          icon={GitCommitHorizontal}
          delta={change.text}
          deltaTone={change.tone}
          hint="Önceki döneme göre"
        />
        <StatCard label="Birleşen PR" value={totals.mergedPullRequests} icon={GitMerge} />
        <StatCard label="Açık PR" value={totals.openPullRequests} icon={GitPullRequest} />
        <StatCard label="Aktif katkıcı" value={totals.activeContributors} icon={Users} />
      </div>
      {notes.length ? (
        <p className="text-2xs text-subtle-foreground -mt-2">{notes.join(' ')}</p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Şu an geliştirilenler</CardTitle>
            <CardDescription>Bu dönem en çok hareket gören açık repolar</CardDescription>
          </CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                Bu dönemde açık repolarda hareket yok
              </p>
            ) : (
              <ul className="divide-border-subtle flex flex-col divide-y">
                {top.map((repo) => (
                  <li key={repo.name} className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={repo.url}
                          className="text-foreground truncate text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {repo.name}
                        </a>
                        {repo.language ? <Badge tone="neutral">{repo.language}</Badge> : null}
                      </div>
                      {repo.description ? (
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {repo.description}
                        </p>
                      ) : null}
                      <p className="text-2xs text-subtle-foreground mt-1 tabular-nums">
                        {number.format(repo.commits)} commit · {repo.openPullRequests} açık PR · son
                        push {fromNow(repo.pushedAt)}
                      </p>
                    </div>
                    <Sparkline
                      values={repo.commitsByDay}
                      className="hidden w-28 shrink-0 sm:block"
                    />
                    <AvatarGroup
                      size="sm"
                      max={3}
                      people={repo.contributors.map((person) => ({
                        name: person.login,
                        src: person.avatarUrl,
                      }))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Son olaylar</CardTitle>
            <CardDescription>Birleşen PR’lar ve sürümler</CardDescription>
          </CardHeader>
          <CardContent>
            {data.events.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">Henüz bir olay yok</p>
            ) : (
              <Timeline
                items={data.events.slice(0, 8).map((event, index) => ({
                  id: `${event.url}-${index}`,
                  title: (
                    <a href={event.url} className="underline-offset-4 hover:underline">
                      {event.title}
                    </a>
                  ),
                  description: `${event.repository}${event.author ? ` · ${event.author}` : ''}`,
                  time: fromNow(event.at),
                  icon: event.kind === 'release' ? Tag : GitMerge,
                  tone: event.kind === 'release' ? 'brand' : 'success',
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
