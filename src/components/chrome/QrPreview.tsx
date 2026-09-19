'use client';

import { downloadBlob } from '@/lib/api/core';
import { SaveButton } from '@/components/chrome/SaveButton';

export function QrPreview({
  imageUrl,
  downloadPath,
  fileName,
  label,
}: {
  imageUrl: string;
  downloadPath: string;
  fileName: string;
  label: string;
}) {
  return (
    <div className="space-y-3">
      <object
        data={imageUrl}
        type="image/png"
        className="h-48 w-48 rounded-md bg-white"
        aria-label={label}
      />
      <SaveButton type="button" onClick={() => void downloadBlob(downloadPath, fileName)}>
        İndir
      </SaveButton>
    </div>
  );
}
