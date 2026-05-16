/**
 * Persona vignettes — three stylised characters communicating who Tend
 * is built for. Glass card aesthetic, warm rim lights, fully inline SVG.
 */

const STROKE = '#22d3ee';
const RIM = '#fbbf24';
const FILL_SOFT = 'rgba(34,211,238,0.10)';
const TEXT = '#f1f5f9';
const TEXT_MUTE = '#94a3b8';
const GLASS_BG = 'rgba(255,255,255,0.035)';
const GLASS_BORDER = 'rgba(255,255,255,0.08)';

interface PersonaProps { title: string; body: string }

export function BikerPersona({ title, body }: PersonaProps) {
  return (
    <PersonaCard title={title} body={body} accent="#f59e0b">
      <svg viewBox="0 0 200 110" width="100%" height="110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="biker-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"  stopColor="#1e1b4b" />
            <stop offset="65%" stopColor="#7c2d12" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        {/* sky band */}
        <rect width="200" height="86" fill="url(#biker-sky)" rx="6" />
        {/* distant ridge silhouette */}
        <path d="M0,80 L25,68 L55,76 L90,60 L130,72 L170,62 L200,72 L200,86 L0,86 Z" fill="#1e1b4b" />
        {/* near ridge */}
        <path d="M0,86 L40,80 L80,84 L120,78 L160,84 L200,80 L200,98 L0,98 Z" fill="#050813" />
        {/* road */}
        <path d="M-10,108 Q70,98 200,86" stroke="#fbbf24" strokeWidth="1" strokeDasharray="6 8" fill="none" opacity="0.8" />
        {/* prayer flags */}
        <line x1="10" y1="20" x2="60" y2="14" stroke="#94a3b8" strokeWidth="0.6" />
        <rect x="18" y="19" width="6" height="8" fill="#3b82f6" />
        <rect x="28" y="18" width="6" height="8" fill="#ef4444" />
        <rect x="38" y="17" width="6" height="8" fill="#10b981" />
        <rect x="48" y="16" width="6" height="8" fill="#fbbf24" />
        {/* moon */}
        <circle cx="170" cy="22" r="8" fill="#fef3c7" opacity="0.85" />
        {/* motorcycle and rider */}
        <g transform="translate(80,80)" fill="#050813" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="-12" cy="8" r="8" fill="#050813" />
          <circle cx="22" cy="8" r="8" fill="#050813" />
          <circle cx="-12" cy="8" r="2.5" fill="#1e1b4b" stroke="none" />
          <circle cx="22" cy="8" r="2.5" fill="#1e1b4b" stroke="none" />
          <path d="M-12,5 L-3,-6 L14,-6 L22,5 Z" fill="#050813" />
          <path d="M-3,-6 L14,-6 L17,-12 L-6,-12 Z" fill={FILL_SOFT} />
          {/* rider body */}
          <path d="M5,-12 L11,-22 L17,-12" fill={FILL_SOFT} />
          <path d="M5,-12 L-2,-7" fill="none" />
          {/* helmet */}
          <circle cx="13" cy="-26" r="6" fill="#050813" />
          {/* visor catching sunset */}
          <rect x="9" y="-27" width="7" height="1.8" fill={RIM} stroke="none" />
          {/* tail glow */}
          <circle cx="-18" cy="-2" r="1.8" fill="#ef4444" stroke="none" />
          {/* head light glow */}
          <circle cx="24" cy="0" r="2.5" fill="#fef3c7" stroke="none" />
        </g>
        {/* warm haze along road */}
        <ellipse cx="100" cy="100" rx="120" ry="6" fill="#f59e0b" opacity="0.18" />
      </svg>
    </PersonaCard>
  );
}

export function TrekkerPersona({ title, body }: PersonaProps) {
  return (
    <PersonaCard title={title} body={body} accent="#22d3ee">
      <svg viewBox="0 0 200 110" width="100%" height="110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="trekker-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"  stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0c4a6e" />
          </linearGradient>
        </defs>
        <rect width="200" height="86" fill="url(#trekker-sky)" rx="6" />
        {/* high snow peaks */}
        <path d="M0,80 L30,40 L55,60 L85,30 L115,55 L150,38 L185,62 L200,55 L200,86 L0,86 Z" fill="#1e1b4b" />
        {/* snow highlights */}
        <g fill="#f8fafc" opacity="0.95">
          <path d="M85,30 L92,40 L78,40 Z" />
          <path d="M30,40 L37,50 L23,50 Z" />
          <path d="M150,38 L157,48 L143,48 Z" />
          <path d="M115,55 L120,62 L110,62 Z" />
        </g>
        {/* warm rim light on right side of peaks */}
        <path d="M85,30 L115,55 M150,38 L185,62" stroke={RIM} strokeWidth="0.8" opacity="0.6" fill="none" />
        {/* foreground */}
        <path d="M0,86 L50,82 L100,86 L150,82 L200,86 L200,110 L0,110 Z" fill="#050813" />
        {/* trekker */}
        <g transform="translate(100,60)" fill="none" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="0" cy="0" r="5" fill={FILL_SOFT} />
          {/* body */}
          <path d="M0,5 L0,22" />
          {/* backpack — warm accent */}
          <rect x="-9" y="7" width="8" height="14" rx="1.5" fill="rgba(245,158,11,0.25)" stroke={RIM} />
          {/* arms */}
          <path d="M0,10 L7,20" />
          <path d="M0,10 L-7,18" />
          {/* legs */}
          <path d="M0,22 L-4,34" />
          <path d="M0,22 L4,34" />
          {/* pole */}
          <line x1="7" y1="20" x2="11" y2="38" stroke={RIM} />
          {/* head torch beam */}
          <path d="M5,-2 L18,-10 L18,4 L5,2 Z" fill="rgba(254,243,199,0.18)" stroke="none" />
        </g>
        {/* stars */}
        <circle cx="50" cy="20" r="0.8" fill="#f8fafc" opacity="0.7" />
        <circle cx="120" cy="14" r="0.6" fill="#f8fafc" opacity="0.55" />
        <circle cx="170" cy="22" r="0.7" fill="#f8fafc" opacity="0.65" />
      </svg>
    </PersonaCard>
  );
}

export function VillagePersona({ title, body }: PersonaProps) {
  return (
    <PersonaCard title={title} body={body} accent="#f43f5e">
      <svg viewBox="0 0 200 110" width="100%" height="110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="village-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"  stopColor="#1e1b4b" />
            <stop offset="60%" stopColor="#831843" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <rect width="200" height="86" fill="url(#village-sky)" rx="6" />
        {/* distant peaks */}
        <path d="M0,75 L40,55 L80,68 L120,50 L160,65 L200,58 L200,86 L0,86 Z" fill="#1e1b4b" />
        <path d="M40,55 L80,68 M120,50 L160,65" stroke={RIM} strokeWidth="0.6" opacity="0.5" fill="none" />
        {/* foreground */}
        <path d="M0,86 L200,86 L200,110 L0,110 Z" fill="#050813" />
        {/* stupa */}
        <g transform="translate(40,72)">
          <rect x="-6" y="6" width="12" height="14" fill="#f8fafc" opacity="0.95" />
          <path d="M-11,6 L11,6 L7,-2 L-7,-2 Z" fill="#f8fafc" />
          <circle cx="0" cy="-7" r="4.5" fill="#f8fafc" />
          <path d="M-1,-11 L1,-11 L0,-17 Z" fill="#fbbf24" />
          {/* warm light on stupa */}
          <rect x="3" y="6" width="3" height="14" fill={RIM} opacity="0.5" />
        </g>
        {/* parent + child */}
        <g transform="translate(130,62)" fill="none" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="0" cy="0" r="5" fill={FILL_SOFT} />
          <path d="M0,5 L0,22" />
          <path d="M0,8 L-7,14" />
          <path d="M0,8 L7,14" />
          <path d="M0,22 L-3,34" />
          <path d="M0,22 L3,34" />
        </g>
        <g transform="translate(150,72)" fill="none" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="0" cy="0" r="3.8" fill={FILL_SOFT} />
          <path d="M0,4 L0,14" />
          <path d="M0,6 L-4,11" />
          <path d="M0,6 L4,11" />
          <path d="M0,14 L-2,22" />
          <path d="M0,14 L2,22" />
        </g>
        {/* a window light in a distant home */}
        <rect x="172" y="78" width="2" height="3" fill={RIM} />
      </svg>
    </PersonaCard>
  );
}

function PersonaCard({ title, body, accent, children }: PersonaProps & {
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: GLASS_BG,
      border: `1px solid ${GLASS_BORDER}`,
      borderRadius: 18,
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      position: 'relative',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      overflow: 'hidden',
    }}>
      {/* accent rail */}
      <span style={{
        position: 'absolute', top: 0, left: 14, right: 14, height: 2,
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        opacity: 0.85,
      }} />
      <div style={{
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {children}
      </div>
      <div>
        <div style={{
          fontSize: 14, fontWeight: 600, color: TEXT,
          fontFamily: "'Space Grotesk', 'Inter', sans-serif",
          letterSpacing: '-0.01em',
        }}>{title}</div>
        <div style={{ fontSize: 12.5, color: TEXT_MUTE, lineHeight: 1.55, marginTop: 4 }}>{body}</div>
      </div>
    </div>
  );
}
