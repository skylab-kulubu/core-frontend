'use client';

import { useEffect, useState } from 'react';
import { Award, Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { certificatesApi, type CertificateTemplate } from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { canManageCertificateTemplates } from '@/lib/auth/groups';
import { listStatus } from '@/lib/list-status';
import { useAuth } from '@/context/AuthContext';

export default function CertificateTemplatesPage() {
  const { user } = useAuth();
  const canCreate = canManageCertificateTemplates(user?.groups ?? [], user?.roles ?? []);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    certificatesApi
      .templates()
      .then(setTemplates)
      .catch((cause) =>
        setError(cause instanceof ProblemError ? cause.title : 'Şablonlar yüklenemedi'),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sertifika şablonları"
        description="Canva, Figma veya yüklenen bir tasarımın üstündeki dinamik alanları yönet."
        actions={
          canCreate ? (
            <ActionButton
              href="/certificates/templates/new"
              icon={Plus}
              variant="primary"
              label="Şablon oluştur"
            />
          ) : undefined
        }
      />
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: templates.length,
          emptyMessage: 'Şablon yok',
        })}
        emptyIcon={Award}
        emptyDescription="İlk şablonu oluşturup ekip veya etkinlik varsayılanı yap."
      >
        {templates.map((template) => (
          <ListItem
            key={template.id}
            href={`/certificates/templates/${template.id}`}
            title={template.name}
            subtitle={`${template.ownerTeam || 'SKY LAB geneli'} · ${template.sourceKind.toUpperCase()} · ${template.publishedVersion ? `v${template.publishedVersion.version}` : 'taslak'}`}
            trailing={
              template.system ? (
                <StatusChip kind="neutral" label="Sistem" />
              ) : template.publishedVersion ? (
                <StatusChip kind="active" label="Yayında" />
              ) : (
                <StatusChip kind="pending" label="Taslak" />
              )
            }
          />
        ))}
      </ListPanel>
    </div>
  );
}
