import type { CSSProperties } from 'react';

export function SkylabLoader({ size = 80, color = '#e5e5e5' }: { size?: number; color?: string }) {
  return (
    <span
      className="skylab-loader"
      style={
        {
          width: size,
          height: size,
          '--skylab-loader-color': color,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <span className="skylab-loader__halo" />
      <span className="skylab-loader__mark" />
    </span>
  );
}
