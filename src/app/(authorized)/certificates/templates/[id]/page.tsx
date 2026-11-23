'use client';

import { use } from 'react';
import { CertificateTemplateEditor } from '@/components/certificates/CertificateTemplateEditor';
import { PageHeader } from '@/components/layout/PageHeader';

export default function CertificateTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="space-y-6">
      <PageHeader title="Sertifika şablonu" />
      <CertificateTemplateEditor templateId={id} />
    </div>
  );
}
