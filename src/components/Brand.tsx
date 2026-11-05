import { brand } from '../integrations/config';

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <img
      className={`brand-mark ${className}`}
      src="/visuals/mascot/pli-logo-head.webp"
      width="48"
      height="48"
      alt=""
      aria-hidden="true"
    />
  );
}

export default function Brand({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <span
      className={`studio-brand ${iconOnly ? 'icon-only' : ''}`}
      role="img"
      aria-label={brand.name}
    >
      <BrandMark />
      {!iconOnly && (
        <span className="studio-wordmark" aria-hidden="true">
          {brand.name === 'Plivvi' ? (
            <>
              pli<span className="wordmark-fold">vv</span>i
            </>
          ) : (
            brand.name
          )}
          <span className="wordmark-dot">.</span>
        </span>
      )}
    </span>
  );
}
