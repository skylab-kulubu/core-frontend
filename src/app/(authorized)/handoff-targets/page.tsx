'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, ShieldAlert } from 'lucide-react';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StateCard } from '@/components/chrome/StateCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { HandoffTargetsTable } from '@/components/handoff/HandoffTargetsTable';
import { HandoffProblemError, handoffTargetsApi } from '@/lib/api/handoff-targets';
import type { HandoffTarget } from '@/lib/handoff/targets';

function enabledFirst(targets: HandoffTarget[]): HandoffTarget[] {
  return [...targets].sort(
    (a, b) =>
      Number(b.enabled === true) - Number(a.enabled === true) ||
      a.clientId.localeCompare(b.clientId, 'tr'),
  );
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; targets: HandoffTarget[] }
  | { kind: 'forbidden' }
  | { kind: 'failed'; detail: string };

export default function HandoffTargetsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ready', targets: enabledFirst(await handoffTargetsApi.list()) });
    } catch (error) {
      if (error instanceof HandoffProblemError && error.status === 403) {
        setState({ kind: 'forbidden' });
      } else {
        setState({
          kind: 'failed',
          detail:
            error instanceof HandoffProblemError ? error.detail : 'Liste yüklenemedi. Tekrar dene.',
        });
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'forbidden') {
    return (
      <div className="space-y-6">
        <PageHeader title="SkyApp'ten geçiş" />
        <StateCard
          title="Bu sayfa realm süper yöneticisine açık"
          description="SkyApp'ten hangi sitelere geçilebileceğini yalnız Keycloak realm süper yöneticisi değiştirir."
          Icon={ShieldAlert}
          tone="warning"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SkyApp'ten geçiş"
        description="SkyApp, açık bir siteyi uygulamadaki kullanıcının oturumuyla açar; kişi o sitede yeniden giriş yapmaz."
      />
      {state.kind === 'failed' ? (
        <StateCard
          title="Liste yüklenemedi"
          description={state.detail}
          Icon={CircleAlert}
          tone="danger"
        >
          <SaveButton type="button" onClick={() => void load()}>
            Tekrar dene
          </SaveButton>
        </StateCard>
      ) : (
        <HandoffTargetsTable
          loading={state.kind === 'loading'}
          targets={state.kind === 'ready' ? state.targets : []}
          onSaved={(updated) =>
            setState((current) =>
              current.kind === 'ready'
                ? {
                    kind: 'ready',
                    targets: current.targets.map((target) =>
                      target.clientId === updated.clientId ? updated : target,
                    ),
                  }
                : current,
            )
          }
          onForbidden={() => setState({ kind: 'forbidden' })}
        />
      )}
    </div>
  );
}
