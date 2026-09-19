'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { StateCard } from '@/components/chrome/StateCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import {
  certificatesApi,
  type CertificateTemplate,
  type CertificateTemplateBinding,
} from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { teamsApi } from '@/lib/api/teams';
import { isPrivileged, ownerLevels } from '@/lib/auth/groups';

export default function CertificateDefaultsPage() {
  const { user } = useAuth();
  const groups = useMemo(() => user?.groups ?? [], [user?.groups]);
  const privileged = isPrivileged(groups);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [bindings, setBindings] = useState<CertificateTemplateBinding[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [scope, setScope] = useState<'club' | 'ownerTeam'>('ownerTeam');
  const [team, setTeam] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    Promise.all([certificatesApi.templates(), certificatesApi.bindings(), teamsApi.list()])
      .then(([templateRows, bindingRows, teamRows]) => {
        setTemplates(templateRows.filter((item) => item.publishedVersion));
        setBindings(bindingRows);
        const allowed = teamRows
          .map((item) => item.team)
          .filter((ownerTeam) => privileged || ownerLevels(groups, ownerTeam).length > 0);
        setTeams(allowed);
        setTeam(allowed[0] ?? '');
      })
      .catch((cause) =>
        setError(cause instanceof ProblemError ? cause.title : 'Varsayılanlar yüklenemedi'),
      )
      .finally(() => setLoading(false));
  }, [groups, privileged]);

  const availableTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          template.ownerTeam === '' || (scope === 'ownerTeam' && template.ownerTeam === team),
      ),
    [scope, team, templates],
  );
  const bindingKey = scope === 'club' ? 'SKY_LAB' : team;
  const currentBinding = bindings.find(
    (binding) => binding.scope === scope && binding.scopeKey === bindingKey,
  );

  useEffect(() => {
    setTemplateId(currentBinding?.templateId ?? '');
  }, [currentBinding?.templateId, scope, team]);

  if (loading) return <StateCard title="Varsayılanlar yükleniyor…" isLoading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sertifika varsayılanları"
        description="Çözüm sırası: etkinliğe özel şablon → sahip ekip varsayılanı → SKY LAB varsayılanı."
      />
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <div className="max-w-2xl space-y-4 rounded-xl border border-white/10 bg-neutral-950/40 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <FieldLabel>Kapsam</FieldLabel>
            <Select
              value={scope}
              onChange={(event) => setScope(event.target.value as typeof scope)}
            >
              <option value="ownerTeam">Sahip ekip</option>
              {privileged ? <option value="club">SKY LAB geneli</option> : null}
            </Select>
          </label>
          {scope === 'ownerTeam' ? (
            <label className="space-y-1.5">
              <FieldLabel>Ekip</FieldLabel>
              <Select value={team} onChange={(event) => setTeam(event.target.value)}>
                {teams.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
        </div>
        <label className="block space-y-1.5">
          <FieldLabel>Yayınlanmış şablon</FieldLabel>
          <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">Şablon seç</option>
            {availableTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · v{template.publishedVersion?.version}
              </option>
            ))}
          </Select>
        </label>
        <SaveButton
          type="button"
          disabled={saving || !templateId || (scope === 'ownerTeam' && !team)}
          onClick={async () => {
            setSaving(true);
            setError(undefined);
            try {
              const updated = await certificatesApi.setBinding({
                scope,
                scopeKey: bindingKey,
                templateId,
              });
              setBindings((current) => [
                ...current.filter(
                  (binding) =>
                    !(binding.scope === updated.scope && binding.scopeKey === updated.scopeKey),
                ),
                updated,
              ]);
              setMessage(
                scope === 'club'
                  ? 'SKY LAB varsayılanı güncellendi.'
                  : `${team} varsayılanı güncellendi.`,
              );
            } catch (cause) {
              setError(cause instanceof ProblemError ? cause.title : 'Varsayılan güncellenemedi');
            } finally {
              setSaving(false);
            }
          }}
        >
          <Link2 className="h-4 w-4" /> Varsayılan yap
        </SaveButton>
        {scope === 'ownerTeam' && currentBinding ? (
          <button
            type="button"
            disabled={saving}
            className="h-8 rounded-md border border-red-500/20 px-3 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            onClick={async () => {
              if (!window.confirm(`${team} varsayılanını kaldırmak istediğine emin misin?`)) return;
              setSaving(true);
              setError(undefined);
              try {
                await certificatesApi.clearBinding('ownerTeam', team);
                setBindings((current) =>
                  current.filter(
                    (binding) => !(binding.scope === 'ownerTeam' && binding.scopeKey === team),
                  ),
                );
                setMessage(`${team} artık SKY LAB varsayılanına düşecek.`);
              } catch (cause) {
                setError(cause instanceof ProblemError ? cause.title : 'Varsayılan kaldırılamadı');
              } finally {
                setSaving(false);
              }
            }}
          >
            Ekip varsayılanını kaldır
          </button>
        ) : null}
        {message ? (
          <p role="status" className="text-skylab-300 text-sm">
            {message}
          </p>
        ) : null}
      </div>
      <StateCard
        title="Etkinliğe özel seçim etkinlik detayında yapılır"
        description="Etkinlikteki Sertifikalar sekmesi geçerli şablonun nereden geldiğini açıkça gösterir ve yalnızca o etkinlik için geçersiz kılmana izin verir."
      />
    </div>
  );
}
