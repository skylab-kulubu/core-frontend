import { CertificateTemplateEditor } from '@/components/certificates/CertificateTemplateEditor';
import { PageHeader } from '@/components/layout/PageHeader';

export default function NewCertificateTemplatePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Yeni sertifika şablonu"
        description="Arka planı yükle, dinamik alanları yerleştir ve değişmez bir sürüm yayınla."
      />
      <CertificateTemplateEditor />
    </div>
  );
}
