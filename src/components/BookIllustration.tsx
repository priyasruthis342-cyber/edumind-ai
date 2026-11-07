export function BookIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 260" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="pageGlow" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFFDF7" />
          <stop offset="100%" stopColor="#F3EBDD" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="236" rx="132" ry="14" fill="#0F2A3D" opacity="0.12" />

      <g>
        <rect x="46" y="182" width="230" height="38" rx="6" fill="#0D9488" />
        <rect x="46" y="182" width="230" height="6" rx="3" fill="#14B8A6" />
        <rect x="58" y="196" width="36" height="5" rx="2.5" fill="#CCFBF1" opacity="0.8" />
        <rect x="262" y="182" width="14" height="38" rx="3" fill="#0F766E" />
      </g>
      <g>
        <rect x="62" y="150" width="200" height="32" rx="6" fill="#F59E0B" />
        <rect x="62" y="150" width="200" height="6" rx="3" fill="#FBBF24" />
        <rect x="76" y="164" width="40" height="5" rx="2.5" fill="#FEF3C7" opacity="0.9" />
        <rect x="248" y="150" width="14" height="32" rx="3" fill="#B45309" />
      </g>
      <g>
        <rect x="38" y="120" width="216" height="30" rx="6" fill="#E11D48" />
        <rect x="38" y="120" width="216" height="6" rx="3" fill="#FB7185" />
        <rect x="52" y="134" width="46" height="5" rx="2.5" fill="#FFE4E6" opacity="0.9" />
        <rect x="238" y="120" width="16" height="30" rx="3" fill="#9F1239" />
      </g>

      <g>
        <path d="M70 118 Q160 96 250 118 L250 98 Q160 76 70 98 Z" fill="url(#pageGlow)" stroke="#E7DCC8" strokeWidth="1" />
        <path d="M76 110 Q160 88 244 110" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
        <path d="M86 100 Q160 80 234 100" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
        <rect x="58" y="88" width="204" height="28" rx="4" fill="#38BDF8" opacity="0.9" />
        <rect x="58" y="88" width="204" height="5" rx="2.5" fill="#7DD3FC" />
      </g>

      <g transform="translate(202 26) rotate(10)">
        <path d="M0 0 L56 14 L56 62 L0 48 Z" fill="#FFFDF7" stroke="#E7DCC8" />
        <path d="M-2 4 L-58 18 L-58 66 L-2 52 Z" fill="#FFFFFF" stroke="#E7DCC8" />
        <path d="M-2 4 L-2 52" stroke="#0D9488" strokeWidth="3" />
        <line x1="8" y1="22" x2="46" y2="32" stroke="#CBD5E1" strokeWidth="2" />
        <line x1="8" y1="34" x2="46" y2="44" stroke="#CBD5E1" strokeWidth="2" />
        <line x1="-48" y1="28" x2="-12" y2="36" stroke="#CBD5E1" strokeWidth="2" />
        <line x1="-48" y1="40" x2="-12" y2="48" stroke="#CBD5E1" strokeWidth="2" />
      </g>

      <g fill="#FBBF24">
        <path d="M44 40 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" />
        <path d="M112 18 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" />
      </g>
    </svg>
  );
}
