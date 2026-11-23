'use client';

import { Button, Notice } from '@skylab-kulubu/skylcn-ui';
import { useState } from 'react';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

/**
 * Something that should be listed could not be read: said where the list
 * would be, with a retry, instead of an empty list that reads as "none".
 */
export function LoadError({
  title,
  onRetry,
  className,
}: {
  /** What did not load: "Başvurular yüklenemedi". */
  title: string;
  onRetry?: () => void | Promise<unknown>;
  className?: string;
}) {
  const [retrying, setRetrying] = useState(false);
  return (
    <Notice
      tone="danger"
      title={title}
      className={className}
      action={
        onRetry ? (
          <Button
            className={BUTTON_TEXT}
            size="sm"
            pending={retrying}
            onClick={async () => {
              setRetrying(true);
              try {
                await onRetry();
              } finally {
                setRetrying(false);
              }
            }}
          >
            Yeniden dene
          </Button>
        ) : undefined
      }
    />
  );
}
