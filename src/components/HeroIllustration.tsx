/**
 * Hero — Cinematic Ladakh dusk.
 *
 * A layered SVG composition rendered fully inline so it ships with the
 * bundle and works offline. Sunset alpenglow on snow peaks, a moonrise,
 * a lone motorcyclist with a warm headlight glow, prayer flags catching
 * the last light, a distant stupa. ~7 KB gzip.
 */
export function HeroIllustration({ height = 360 }: { height?: number }) {
  return (
    <div style={{
      width: '100%',
      height,
      borderRadius: 24,
      overflow: 'hidden',
      position: 'relative',
      border: '1px solid rgba(255,255,255,0.08)',
      background: '#0a0e1a',
      boxShadow:
        '0 30px 80px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
    }}>
      <svg viewBox="0 0 1400 500" preserveAspectRatio="xMidYMid slice"
           width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="hero-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#0a0e1a" />
            <stop offset="18%"  stopColor="#1e1b4b" />
            <stop offset="38%"  stopColor="#581c87" />
            <stop offset="58%"  stopColor="#be185d" />
            <stop offset="78%"  stopColor="#f59e0b" />
            <stop offset="93%"  stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#fef3c7" />
          </linearGradient>

          <linearGradient id="hero-far" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#a78bfa" stopOpacity="0.55" />
            <stop offset="60%"  stopColor="#5b21b6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>

          <linearGradient id="hero-mid" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#4c1d95" />
            <stop offset="100%" stopColor="#0f0a2a" />
          </linearGradient>

          <linearGradient id="hero-near" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#050813" />
          </linearGradient>

          <linearGradient id="hero-rim" x1="1" x2="0" y1="0" y2="0">
            <stop offset="0%"   stopColor="#fbbf24" stopOpacity="0.9" />
            <stop offset="60%"  stopColor="#f97316" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="hero-moon" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%"  stopColor="#fef3c7" stopOpacity="1" />
            <stop offset="55%" stopColor="#fde68a" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="hero-headlight" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%"   stopColor="#fef3c7" stopOpacity="0.85" />
            <stop offset="55%"  stopColor="#f59e0b" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="hero-haze" cx="0.5" cy="1" r="1">
            <stop offset="0%"   stopColor="#f97316" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>

          <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Sky */}
        <rect width="1400" height="500" fill="url(#hero-sky)" />

        {/* Stars in the upper night band */}
        <g fill="#f8fafc">
          <circle cx="60"   cy="22"  r="0.8" opacity="0.7" />
          <circle cx="140"  cy="58"  r="1.0" opacity="0.85" />
          <circle cx="220"  cy="34"  r="0.7" opacity="0.6" />
          <circle cx="310"  cy="74"  r="0.9" opacity="0.75" />
          <circle cx="390"  cy="20"  r="0.6" opacity="0.5" />
          <circle cx="500"  cy="60"  r="1.1" opacity="0.9" />
          <circle cx="620"  cy="30"  r="0.7" opacity="0.6" />
          <circle cx="730"  cy="80"  r="0.8" opacity="0.7" />
          <circle cx="860"  cy="40"  r="0.9" opacity="0.8" />
          <circle cx="960"  cy="22"  r="0.6" opacity="0.55" />
          <circle cx="1060" cy="70"  r="0.8" opacity="0.7" />
          <circle cx="1180" cy="32"  r="1.0" opacity="0.85" />
          <circle cx="1280" cy="64"  r="0.7" opacity="0.6" />
          <circle cx="1350" cy="40"  r="0.8" opacity="0.7" />
        </g>

        {/* Moon with glow */}
        <circle cx="1130" cy="110" r="80" fill="url(#hero-moon)" opacity="0.7" />
        <circle cx="1130" cy="110" r="22" fill="#fef3c7" opacity="0.92" />
        <circle cx="1124" cy="106" r="3" fill="#fde68a" opacity="0.5" />
        <circle cx="1136" cy="115" r="2" fill="#fde68a" opacity="0.4" />

        {/* Warm atmospheric haze along the horizon */}
        <ellipse cx="700" cy="500" rx="900" ry="200" fill="url(#hero-haze)" />

        {/* Far range — purple haze, snow caps catch the light */}
        <path d="M0,260 L70,220 L140,245 L210,180 L280,225 L360,170 L440,230 L520,160 L600,225 L680,180 L770,240 L860,190 L950,235 L1040,200 L1130,250 L1220,205 L1320,240 L1400,220 L1400,500 L0,500 Z"
              fill="url(#hero-far)" />
        {/* Rim light along upper edge of far range — coming from the right */}
        <path d="M210,180 L280,225 M360,170 L440,230 M520,160 L600,225 M680,180 L770,240 M860,190 L950,235 M1040,200 L1130,250 M1220,205 L1320,240"
              stroke="url(#hero-rim)" strokeWidth="2.2" fill="none" opacity="0.85" />
        {/* Tiny snow highlights on peaks */}
        <g fill="#fef3c7" opacity="0.9">
          <path d="M280,225 L283,222 L289,228 L286,231 Z" />
          <path d="M440,230 L443,226 L450,233 L446,236 Z" />
          <path d="M600,225 L604,221 L610,227 L606,231 Z" />
          <path d="M770,240 L774,236 L781,243 L777,246 Z" />
          <path d="M950,235 L954,231 L961,238 L957,241 Z" />
          <path d="M1130,250 L1134,246 L1141,253 L1137,256 Z" />
        </g>

        {/* Mid range */}
        <path d="M0,330 L80,290 L180,325 L270,260 L380,310 L470,255 L580,310 L690,250 L800,315 L900,260 L1010,310 L1130,265 L1240,310 L1340,280 L1400,300 L1400,500 L0,500 Z"
              fill="url(#hero-mid)" opacity="0.96" />
        {/* Mid rim light */}
        <path d="M270,260 L380,310 M470,255 L580,310 M690,250 L800,315 M900,260 L1010,310 M1130,265 L1240,310"
              stroke="url(#hero-rim)" strokeWidth="1.6" fill="none" opacity="0.6" />

        {/* Distant stupa silhouette catching the light */}
        <g transform="translate(960,340)">
          <rect x="-7" y="2" width="14" height="18" fill="#3f3f5e" />
          <path d="M-14,2 L14,2 L9,-8 L-9,-8 Z" fill="#3f3f5e" />
          <circle cx="0" cy="-13" r="6" fill="#3f3f5e" />
          <path d="M-1,-19 L1,-19 L0,-28 Z" fill="#3f3f5e" />
          {/* warm rim */}
          <path d="M7,2 L7,20 M9,-8 L14,2 M6,-13 L6,-7" stroke="#fbbf24" strokeWidth="1" opacity="0.6" />
        </g>

        {/* Near range / foreground ridge */}
        <path d="M0,395 L130,355 L260,388 L390,345 L530,380 L680,350 L820,385 L960,360 L1110,385 L1260,370 L1400,388 L1400,500 L0,500 Z"
              fill="url(#hero-near)" />

        {/* Headlight glow on the road */}
        <ellipse cx="360" cy="445" rx="160" ry="40" fill="url(#hero-headlight)" />

        {/* Winding road */}
        <path d="M-50,500 Q200,470 380,448 Q560,425 720,420 Q860,415 1010,400 Q1150,386 1320,370 Q1430,361 1480,355"
              stroke="#1e1b4b" strokeWidth="22" fill="none" strokeLinecap="round" />
        <path d="M-50,500 Q200,470 380,448 Q560,425 720,420 Q860,415 1010,400 Q1150,386 1320,370 Q1430,361 1480,355"
              stroke="#fbbf24" strokeWidth="1.6" strokeDasharray="20 28" fill="none" opacity="0.75" />

        {/* Motorcyclist */}
        <g transform="translate(330,438) scale(2)" fill="#050813">
          <circle cx="-9" cy="5" r="5.2" />
          <circle cx="13" cy="5" r="5.2" />
          <circle cx="-9" cy="5" r="2" fill="#1e1b4b" />
          <circle cx="13" cy="5" r="2" fill="#1e1b4b" />
          <path d="M-9,3 L-4,-5 L9,-5 L13,3 Z" />
          <path d="M-11,-3 L-5,-9 L-1,-8 L-3,-3 Z" />
          <path d="M0,-12 L6,-19 L10,-11 L7,-4 L1,-4 Z" />
          <path d="M-2,-12 L-8,-7 L-6,-5 L0,-9 Z" />
          <circle cx="6" cy="-21" r="4.4" />
          {/* visor catches the sunset */}
          <rect x="2.5" y="-22" width="6" height="1.6" fill="#fbbf24" />
          {/* tail-light */}
          <circle cx="-13" cy="-1" r="1.2" fill="#ef4444" />
          {/* headlight core */}
          <circle cx="14" cy="0" r="1.2" fill="#fef3c7" />
        </g>

        {/* Prayer flag string 1 — left, longer */}
        <line x1="40" y1="140" x2="380" y2="95" stroke="#1e1b4b" strokeWidth="1.6" />
        <PrayerFlag x={80}  y={138} sway={2}  color="#3b82f6" />
        <PrayerFlag x={120} y={132} sway={1}  color="#f8fafc" />
        <PrayerFlag x={160} y={125} sway={3}  color="#ef4444" />
        <PrayerFlag x={200} y={119} sway={2}  color="#10b981" />
        <PrayerFlag x={240} y={113} sway={1}  color="#fbbf24" />
        <PrayerFlag x={280} y={107} sway={3}  color="#3b82f6" />
        <PrayerFlag x={320} y={101} sway={2}  color="#f8fafc" />

        {/* Prayer flag string 2 — right, shorter */}
        <line x1="780" y1="170" x2="980" y2="195" stroke="#1e1b4b" strokeWidth="1.2" opacity="0.85" />
        <PrayerFlag x={810} y={175} sway={1} color="#3b82f6" small />
        <PrayerFlag x={845} y={181} sway={2} color="#ef4444" small />
        <PrayerFlag x={880} y={186} sway={1} color="#10b981" small />
        <PrayerFlag x={915} y={189} sway={2} color="#fbbf24" small />

        {/* Subtle vignette on edges */}
        <radialGradient id="hero-vignette" cx="0.5" cy="0.55" r="0.7">
          <stop offset="65%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <rect width="1400" height="500" fill="url(#hero-vignette)" />
      </svg>

      {/* Optional bottom fade to merge into surface below */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 80,
        background: 'linear-gradient(180deg, rgba(10,14,26,0) 0%, rgba(10,14,26,0.85) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

function PrayerFlag({ x, y, color, sway = 0, small = false }: {
  x: number; y: number; color: string; sway?: number; small?: boolean;
}) {
  const w = small ? 11 : 18;
  const h = small ? 14 : 20;
  return (
    <path
      d={`M${x},${y} L${x + w},${y + sway} L${x + w - 1.5},${y + h + sway} L${x + 1.5},${y + h} Z`}
      fill={color}
      stroke="#1e1b4b" strokeWidth="0.4"
      opacity={small ? 0.9 : 0.95}
    />
  );
}
