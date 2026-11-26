'use client';

import { cn } from '@skylab-kulubu/skylcn-ui';
import { FileText } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { CertificateLayout } from '@/lib/api/certificates';
import { SAMPLE, certificateFontStack } from '@/lib/certificate-layout';
import './certificate-fonts.css';

/**
 * The picture inside a fixed box (a card's or a row's), whole: a portrait page stands as
 * tall as the box, a landscape one as wide.
 */
export function TemplateThumbBox({
  layout,
  background,
  className,
}: {
  layout: CertificateLayout;
  background?: { url: string; type?: string } | null;
  className?: string;
}) {
  const portrait = (layout.height || 794) > (layout.width || 1123);
  return (
    <div className={cn('bg-muted grid place-items-center overflow-hidden rounded-md', className)}>
      <TemplateThumb
        layout={layout}
        background={background}
        className={portrait ? 'h-full w-auto' : 'h-auto w-full'}
      />
    </div>
  );
}

/**
 * A certificate's layout drawn small, as the editor draws it: the page colour, the
 * background picture when it is one, each layer in place with its sample text. A PDF
 * background shows as a plain page with a mark, since a PDF cannot be drawn this small.
 * Decorative: the name beside it says which template it is.
 */
export function TemplateThumb({
  layout,
  background,
  className,
}: {
  layout: CertificateLayout;
  /** The background's address and type, once read. */
  background?: { url: string; type?: string } | null;
  className?: string;
}) {
  const pdf = background?.type === 'application/pdf';
  const width = layout.width || 1123;
  const height = layout.height || 794;
  return (
    <div
      aria-hidden
      className={cn(
        'border-border-subtle relative w-full overflow-hidden rounded-md border bg-white',
        className,
      )}
      style={{
        aspectRatio: `${width} / ${height}`,
        containerType: 'inline-size',
        backgroundColor: layout.backgroundColor || '#ffffff',
        backgroundImage: background?.url && !pdf ? `url(${background.url})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {pdf ? (
        <FileText className="absolute top-1.5 right-1.5 size-3.5 text-black/30" aria-hidden />
      ) : null}
      {(layout.elements ?? []).map((element) => {
        const style: CSSProperties = {
          left: `${(element.x / width) * 100}%`,
          top: `${(element.y / height) * 100}%`,
          width: `${(element.width / width) * 100}%`,
          height: `${(element.height / height) * 100}%`,
          color: element.color,
          fontFamily: certificateFontStack(element.fontFamily),
          fontSize: `${((element.fontSize ?? 16) / width) * 100}cqw`,
          fontWeight: element.fontWeight,
          textAlign: element.align,
          opacity: element.opacity,
          transform: `rotate(${element.rotation ?? 0}deg)`,
          backgroundColor: element.kind === 'image' ? 'rgba(0,0,0,0.08)' : element.backgroundColor,
          borderColor: element.borderColor,
          borderWidth: element.borderWidth ? Math.max(1, element.borderWidth / 4) : 0,
          borderRadius: element.borderRadius ? element.borderRadius / 4 : 0,
          lineHeight: element.lineHeight,
        };
        return (
          <span
            key={element.id}
            style={style}
            className={cn(
              'absolute flex items-center justify-center overflow-hidden whitespace-nowrap',
              element.kind === 'verificationQr' &&
                'bg-[repeating-conic-gradient(#111_0_25%,#fff_0_50%)] bg-[length:4px_4px]',
            )}
          >
            {element.kind === 'staticText' ? element.text : SAMPLE[element.kind]}
          </span>
        );
      })}
    </div>
  );
}
