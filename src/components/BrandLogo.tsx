interface BrandLogoProps {
  label: string;
  idPrefix: string;
}

export function BrandLogo({ label, idPrefix }: BrandLogoProps) {
  const strokeId = `${idPrefix}-orbit-stroke`;
  const glowId = `${idPrefix}-star-glow`;
  const filterId = `${idPrefix}-orbit-glow`;

  return (
    <span className="dearm-brand-logo">
      <span className="dearm-brand-logo-text">{label}</span>
      <svg
        className="dearm-brand-logo-orbit"
        viewBox="0 0 50 58"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={strokeId}
            x1="8"
            y1="10"
            x2="42"
            y2="50"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#e6a234" stopOpacity="0.88" />
            <stop offset="0.46" stopColor="#8f6c2d" stopOpacity="0.4" />
            <stop offset="1" stopColor="#f3bc58" stopOpacity="0.82" />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#fffef1" stopOpacity="1" />
            <stop offset="0.2" stopColor="#fff7d2" stopOpacity="0.82" />
            <stop offset="0.48" stopColor="#f0a93a" stopOpacity="0.42" />
            <stop offset="1" stopColor="#f0a93a" stopOpacity="0" />
          </radialGradient>
          <filter id={filterId} x="-55%" y="-55%" width="210%" height="210%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <ellipse
          cx="22"
          cy="28"
          rx="17"
          ry="29"
          transform="rotate(32 22 28)"
          fill="none"
          stroke={`url(#${strokeId})`}
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.94"
          filter={`url(#${filterId})`}
        />
        <circle
          cx="33.5"
          cy="34"
          r="5.5"
          fill={`url(#${glowId})`}
          opacity="0.76"
        />
        <path
          d="M33.5 28.5 L35 32.8 L39.5 34 L35 35.2 L33.5 39.5 L32 35.2 L27.5 34 L32 32.8 Z"
          fill="#fffced"
          opacity="1"
          filter={`url(#${filterId})`}
        />
        <path
          d="M33.5 30.5 L34.3 33.2 L37 34 L34.3 34.8 L33.5 37.5 L32.7 34.8 L30 34 L32.7 33.2 Z"
          fill="#ffd36b"
          opacity="0.72"
        />
        <circle cx="33.5" cy="34" r="0.72" fill="#fffef7" />
      </svg>
    </span>
  );
}
