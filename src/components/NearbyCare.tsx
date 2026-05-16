import {
  LADAKH_CARE,
  facilitiesForSystem,
  rankFacilities,
  facilityTypeLabel,
  type CareFacility,
} from '../data/nearbyCare';
import type { BodySystem } from '../engine/triageEngine';

const T = {
  glass:        'rgba(255,255,255,0.04)',
  glassHi:      'rgba(255,255,255,0.07)',
  glassBorder:  'rgba(255,255,255,0.08)',
  amber:        '#fbbf24',
  amberDim:     'rgba(251,191,36,0.15)',
  cyan:         '#22d3ee',
  cyanDim:      'rgba(34,211,238,0.14)',
  rose:         '#fb7185',
  text:         '#f1f5f9',
  textMute:     '#cbd5e1',
  textSoft:     '#94a3b8',
};

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DISPLAY = "'Space Grotesk', 'Inter', sans-serif";

interface Props {
  bodySystem: BodySystem;
  region?: string;
  limit?: number;
}

export function NearbyCare({ bodySystem, region = 'Ladakh', limit = 4 }: Props) {
  if (region !== 'Ladakh') return null;

  const filtered = facilitiesForSystem(LADAKH_CARE, bodySystem);
  const ranked = rankFacilities(filtered).slice(0, limit);

  if (ranked.length === 0) return null;

  return (
    <div style={{
      marginTop: 24,
      padding: '20px 20px 16px',
      background: T.glass,
      border: `1px solid ${T.glassBorder}`,
      borderRadius: 18,
      position: 'relative',
      overflow: 'hidden',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>
      {/* warm gradient bar at the top */}
      <span style={{
        position: 'absolute', top: 0, left: 20, right: 20, height: 2,
        background: 'linear-gradient(90deg, transparent, #f59e0b, #f43f5e, transparent)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.amber,
            textTransform: 'uppercase', letterSpacing: '.1em' }}>Nearby care</div>
          <h3 style={{
            fontSize: 18, fontWeight: 700, color: T.text, margin: '2px 0 0',
            fontFamily: DISPLAY, letterSpacing: '-0.01em',
          }}>
            Who to reach in Ladakh
          </h3>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '4px 10px',
          background: T.amberDim, color: T.amber, borderRadius: 999,
          letterSpacing: '.06em', textTransform: 'uppercase',
          border: '1px solid rgba(251,191,36,0.3)',
        }}>
          Region pack
        </span>
      </div>
      <p style={{ fontSize: 13, color: T.textSoft, marginTop: 6, marginBottom: 14, lineHeight: 1.55 }}>
        Public facilities and helplines bundled with the app. Tap a card to dial.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ranked.map((f) => <FacilityRow key={f.id} facility={f} />)}
      </div>
    </div>
  );
}

function FacilityRow({ facility }: { facility: CareFacility }) {
  const isCritical = facility.type === 'ambulance' || facility.type === 'helpline';
  const accent = isCritical ? T.amber : T.cyan;
  const accentDim = isCritical ? T.amberDim : T.cyanDim;

  return (
    <a
      href={`tel:${facility.phone.replace(/[^0-9+]/g, '')}`}
      style={{
        display: 'flex', gap: 14, padding: '14px 16px',
        background: T.glassHi,
        border: `1px solid ${isCritical ? 'rgba(251,191,36,0.35)' : T.glassBorder}`,
        borderRadius: 14,
        textDecoration: 'none', color: 'inherit',
        fontFamily: FONT,
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform .15s, border-color .15s, background .15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
        (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.09)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLAnchorElement).style.background = T.glassHi;
      }}
    >
      <FacilityIcon type={facility.type} accent={accent} accentDim={accentDim} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: T.text, fontFamily: DISPLAY }}>
            {facility.name}
          </div>
          <div style={{
            fontSize: 10.5, fontWeight: 700,
            color: accent,
            background: accentDim,
            padding: '2px 8px', borderRadius: 999,
            textTransform: 'uppercase', letterSpacing: '.06em',
            border: `1px solid ${isCritical ? 'rgba(251,191,36,0.35)' : 'rgba(34,211,238,0.25)'}`,
          }}>
            {facilityTypeLabel(facility.type)}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: T.textSoft, marginTop: 3, lineHeight: 1.45 }}>
          {facility.distanceHint}
          {facility.notes && <> · {facility.notes}</>}
        </div>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        gap: 2, whiteSpace: 'nowrap', alignSelf: 'center',
      }}>
        <div style={{ fontSize: 10, color: T.textSoft, fontWeight: 600, letterSpacing: '.06em' }}>TAP TO CALL</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: accent, fontFamily: DISPLAY }}>
          {facility.phone}
        </div>
      </div>
    </a>
  );
}

function FacilityIcon({ type, accent, accentDim }: {
  type: CareFacility['type']; accent: string; accentDim: string;
}) {
  const wrap = (children: React.ReactNode) => (
    <div style={{
      width: 40, height: 40, flex: '0 0 40px',
      background: accentDim, borderRadius: 10,
      border: `1px solid ${accent === '#fbbf24' ? 'rgba(251,191,36,0.3)' : 'rgba(34,211,238,0.25)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">{children}</svg>
    </div>
  );

  switch (type) {
    case 'ambulance':
      return wrap(<>
        <rect x="2" y="9" width="14" height="9" rx="1.5" stroke={accent} strokeWidth="1.8" />
        <path d="M16 11h4l2 3v4h-6z" stroke={accent} strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="7" cy="20" r="2" stroke={accent} strokeWidth="1.8" />
        <circle cx="18" cy="20" r="2" stroke={accent} strokeWidth="1.8" />
        <path d="M9 13v2M8 14h2" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
      </>);
    case 'helpline':
      return wrap(<>
        <path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"
              stroke={accent} strokeWidth="1.8" strokeLinejoin="round" />
      </>);
    case 'district-hospital':
    case 'sub-district-hospital':
      return wrap(<>
        <rect x="4" y="8" width="16" height="13" rx="1" stroke={accent} strokeWidth="1.8" />
        <path d="M9 8V4h6v4" stroke={accent} strokeWidth="1.8" />
        <path d="M12 12v6M9 15h6" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
      </>);
    case 'community-health-center':
    case 'primary-health-center':
    default:
      return wrap(<>
        <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"
              stroke={accent} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M11 13h2M12 12v2" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
      </>);
  }
}
