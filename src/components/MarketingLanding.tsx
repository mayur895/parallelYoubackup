import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeroIllustration } from './HeroIllustration';
import { BikerPersona, TrekkerPersona, VillagePersona } from './Personas';
import { PROTOCOL_COUNT } from '../engine/triageEngine';

// ===========================================================================
// Tokens (mirror TendTab's palette)
// ===========================================================================

const T = {
  bg0:           '#070b18',
  glass:         'rgba(255,255,255,0.04)',
  glassHi:       'rgba(255,255,255,0.07)',
  glassBorder:   'rgba(255,255,255,0.08)',
  amber:         '#fbbf24',
  amberStrong:   '#f59e0b',
  amberDim:      'rgba(251,191,36,0.15)',
  cyan:          '#22d3ee',
  cyanDim:       'rgba(34,211,238,0.14)',
  rose:          '#fb7185',
  roseStrong:    '#f43f5e',
  violet:        '#a78bfa',
  emerald:       '#34d399',
  emeraldDim:    'rgba(52,211,153,0.14)',
  text:          '#f1f5f9',
  textMute:      '#cbd5e1',
  textSoft:      '#94a3b8',
  textFaint:     '#64748b',
};

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DISPLAY = "'Space Grotesk', 'Inter', sans-serif";

// ===========================================================================
// Public root
// ===========================================================================

interface SavedSummary { ts: number; protocolTitle: string; severity: number }

export function MarketingLanding({ onStart, savedCount }: {
  onStart: () => void;
  savedCount: number;
  history?: SavedSummary[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
      <Hero onStart={onStart} savedCount={savedCount} />
      <TrustStrip />
      <StatsStrip />
      <ProductPreview onStart={onStart} />
      <Features />
      <HowItWorks />
      <Personas />
      <Scenarios />
      <TrustAndSafety />
      <FAQ />
      <BigCTA onStart={onStart} />
      <Footer />
    </div>
  );
}

// ===========================================================================
// Hero
// ===========================================================================

function Hero({ onStart, savedCount }: { onStart: () => void; savedCount: number }) {
  return (
    <motion.section {...sectionMotion(0)} id="hero" style={{
      ...glassCard, padding: 0, overflow: 'hidden', position: 'relative',
    }}>
      <HeroIllustration height={420} />
      <div style={{ padding: '36px 36px 40px' }}>
        <div style={statusPill}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: T.emerald,
            boxShadow: `0 0 12px ${T.emerald}`,
          }} />
          On-device · works offline · 0 bytes uploaded
        </div>
        <h1 style={{
          fontSize: 'clamp(32px, 5.5vw, 56px)', fontWeight: 700, color: T.text,
          lineHeight: 1.05, margin: '18px 0 0',
          fontFamily: DISPLAY, letterSpacing: '-0.025em',
        }}>
          Care that doesn't{' '}
          <span style={{
            background: `linear-gradient(135deg, ${T.amber}, ${T.rose})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            need a signal
          </span>.
        </h1>
        <p style={{
          fontSize: 18, color: T.textMute, lineHeight: 1.6, marginTop: 18, maxWidth: 680,
        }}>
          Tend is on-device AI first-aid for the high passes, frozen rivers, and far-flung
          villages of Ladakh. Describe what's happening in plain words — a small local model
          routes to a hand-authored protocol and points you at the nearest place to find help.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 28 }}>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onStart} style={{ ...primaryButton, padding: '15px 26px', fontSize: 16 }}>
            Start a consultation →
          </motion.button>
          <a href="#preview" style={{ ...secondaryButton, padding: '15px 22px', textDecoration: 'none' }}>
            See how it works
          </a>
          {savedCount > 0 && (
            <div style={{
              alignSelf: 'center', fontSize: 13, color: T.textSoft, marginLeft: 6,
            }}>
              You have {savedCount} saved consultation{savedCount > 1 ? 's' : ''} on this device.
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

// ===========================================================================
// Trust strip
// ===========================================================================

function TrustStrip() {
  const sources = ['WHO', 'Red Cross', 'NHS', 'St John Ambulance', 'IFRC'];
  return (
    <motion.section {...sectionMotion(0)} style={{
      padding: '22px 24px',
      background: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 16,
      display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSoft,
        letterSpacing: '.18em', textTransform: 'uppercase', flexShrink: 0 }}>
        Protocols inspired by
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 32px',
        alignItems: 'center', justifyContent: 'center', opacity: 0.85 }}>
        {sources.map((s) => (
          <span key={s} style={{
            fontSize: 15, color: T.textMute, fontWeight: 600,
            fontFamily: DISPLAY, letterSpacing: '0.02em',
          }}>{s}</span>
        ))}
      </div>
    </motion.section>
  );
}

// ===========================================================================
// Stats strip
// ===========================================================================

function StatsStrip() {
  return (
    <motion.section {...sectionMotion(0)} style={{
      display: 'grid', gap: 14,
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    }}>
      <StatChip n={PROTOCOL_COUNT.toString()} label="Authored protocols" accent={T.cyan} />
      <StatChip n="9" label="Red-flag rules" accent={T.amber} />
      <StatChip n="0" label="Bytes uploaded" accent={T.emerald} />
      <StatChip n="₹0" label="Per consultation" accent={T.rose} />
    </motion.section>
  );
}

function StatChip({ n, label, accent }: { n: string; label: string; accent: string }) {
  return (
    <div style={{
      ...glassCard, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4,
      position: 'relative', overflow: 'hidden',
    }}>
      <span style={{
        position: 'absolute', top: 0, left: 20, right: 20, height: 2,
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
      }} />
      <div style={{
        fontSize: 32, fontWeight: 700, color: T.text,
        fontFamily: DISPLAY, letterSpacing: '-0.02em', lineHeight: 1,
      }}>{n}</div>
      <div style={{ fontSize: 12, color: T.textSoft, letterSpacing: '.06em' }}>{label}</div>
    </div>
  );
}

// ===========================================================================
// Product preview — three "phone screen" cards
// ===========================================================================

function ProductPreview({ onStart }: { onStart: () => void }) {
  return (
    <motion.section {...sectionMotion(0)} id="preview" style={glassCard}>
      <SectionHead kicker="THE FLOW" title="From a hurt finger to a clear plan in 30 seconds" />
      <p style={sectionSub}>
        Tend isn't a chatbot. It's a guided form, an on-device AI router, and a hand-authored
        protocol library — wired together so the AI never makes the medical call.
      </p>
      <div style={{
        marginTop: 28, display: 'grid', gap: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      }}>
        <PhoneScreen step={1} caption="Describe in plain words. Red flags are scanned live as you type.">
          <FakeDescribe />
        </PhoneScreen>
        <PhoneScreen step={2} caption={`A small local model routes your symptoms to one of ${PROTOCOL_COUNT} protocols.`}>
          <FakeAnalyze />
        </PhoneScreen>
        <PhoneScreen step={3} caption="Clear steps, what to avoid, when to escalate, and who to call.">
          <FakePlan />
        </PhoneScreen>
      </div>
      <div style={{ marginTop: 26, textAlign: 'center' }}>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
          onClick={onStart} style={{ ...primaryButton, padding: '14px 24px' }}>
          Try it now →
        </motion.button>
      </div>
    </motion.section>
  );
}

function PhoneScreen({ step, caption, children }: {
  step: number; caption: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        position: 'relative', borderRadius: 28, padding: 14,
        background: 'linear-gradient(180deg, #14182a, #0a0e1a)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 60px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
        aspectRatio: '9 / 14',
        overflow: 'hidden',
      }}>
        {/* notch */}
        <div style={{
          position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
          width: 70, height: 18, borderRadius: 12, background: '#000',
          border: '1px solid rgba(255,255,255,0.06)',
        }} />
        {/* screen */}
        <div style={{
          marginTop: 18, height: 'calc(100% - 18px)',
          background: T.bg0, borderRadius: 18, padding: '14px 12px',
          display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.04)',
          fontSize: 11,
        }}>
          {/* mini status bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 9, color: T.textSoft, fontFamily: DISPLAY, letterSpacing: '.06em',
          }}>
            <span>9:41</span>
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%', background: T.emerald,
              }} />
              OFFLINE
            </span>
          </div>
          {children}
        </div>
        {/* step badge */}
        <div style={{
          position: 'absolute', top: 26, right: 24,
          width: 30, height: 30, borderRadius: '50%',
          background: `linear-gradient(135deg, ${T.amber}, ${T.rose})`,
          color: '#fff', fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 18px -4px rgba(244,63,94,0.6)',
          fontFamily: DISPLAY,
        }}>{step}</div>
      </div>
      <div style={{ fontSize: 13, color: T.textMute, lineHeight: 1.5, textAlign: 'center' }}>
        {caption}
      </div>
    </div>
  );
}

function FakeDescribe() {
  return (
    <>
      <div style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: DISPLAY }}>
        Tell us what's happening
      </div>
      <div style={{
        background: T.glassHi, border: `1px solid ${T.glassBorder}`, borderRadius: 8,
        padding: '8px 10px', fontSize: 10, color: T.textMute, lineHeight: 1.5,
        minHeight: 60,
      }}>
        burned my hand on a hot pan about 10 minutes ago, the skin is red and starting to blister
      </div>
      <MiniField label="Severity" value="6/10" />
      <MiniField label="Duration" value="< 1 hour" />
      <div style={{ flex: 1 }} />
      <div style={{
        background: `linear-gradient(135deg, ${T.amberStrong}, ${T.roseStrong})`,
        color: '#fff', padding: '8px 0', textAlign: 'center', borderRadius: 8,
        fontSize: 10, fontWeight: 700, fontFamily: DISPLAY,
      }}>Get my plan →</div>
    </>
  );
}

function FakeAnalyze() {
  return (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            border: `2px solid ${T.glassBorder}`, borderRadius: '50%',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            border: `2px solid transparent`,
            borderTopColor: T.amber, borderRightColor: T.rose,
            borderRadius: '50%', animation: 'tend-spin 1.2s linear infinite',
          }} />
        </div>
        <div style={{
          fontSize: 11, color: T.text, fontWeight: 600, fontFamily: DISPLAY,
          textAlign: 'center',
        }}>
          Selecting the right protocol…
        </div>
        <div style={{ fontSize: 9, color: T.textSoft, textAlign: 'center', lineHeight: 1.4, maxWidth: 160 }}>
          Everything runs on your device — nothing is uploaded.
        </div>
      </div>
    </>
  );
}

function FakePlan() {
  return (
    <>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <FakePill bg={T.cyanDim} color={T.cyan}>burns</FakePill>
        <FakePill bg={T.amberDim} color={T.amber}>moderate</FakePill>
      </div>
      <div style={{ fontSize: 12, color: T.text, fontWeight: 700, fontFamily: DISPLAY, lineHeight: 1.2 }}>
        Minor thermal burn
      </div>
      <FakeBlock title="WHAT TO DO" color={T.emerald} bg={T.emeraldDim} items={[
        'Cool under cool running water 20 min',
        'Remove tight items before swelling',
        'Cover loosely with cling film',
      ]} />
      <FakeBlock title="SEE A DOCTOR IF" color={T.rose} bg="rgba(251,113,133,0.14)" items={[
        'Burn larger than the palm',
        'On face, hands, or joints',
      ]} />
    </>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
      <span style={{ color: T.textSoft }}>{label}</span>
      <span style={{ color: T.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function FakePill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 999, background: bg, color,
      fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
    }}>{children}</span>
  );
}

function FakeBlock({ title, color, bg, items }: {
  title: string; color: string; bg: string; items: string[];
}) {
  return (
    <div style={{
      background: bg, borderRadius: 6, padding: '6px 8px',
      border: `1px solid ${color}33`,
    }}>
      <div style={{
        fontSize: 8, fontWeight: 700, color, letterSpacing: '.08em',
      }}>{title}</div>
      <ul style={{ paddingLeft: 12, marginTop: 3, fontSize: 9, color: T.text, lineHeight: 1.4 }}>
        {items.map((i, n) => <li key={n} style={{ marginBottom: 1 }}>{i}</li>)}
      </ul>
    </div>
  );
}

// ===========================================================================
// Features grid
// ===========================================================================

function Features() {
  const items: { title: string; body: string; accent: string; icon: React.ReactNode }[] = [
    {
      title: 'On-device AI', accent: T.cyan,
      body: 'A small language model runs locally in your browser to route symptoms — never a server round-trip.',
      icon: <Icon path="M9 3v2H5v4H3v6h2v4h4v2h6v-2h4v-4h2V9h-2V5h-4V3H9zm0 6h6v6H9V9z" />,
    },
    {
      title: 'Works offline', accent: T.emerald,
      body: 'Cache once on the first connection. Open Tend on a pass with no signal and the full app is right there.',
      icon: <Icon path="M3 3l18 18M9 5a13 13 0 0 1 13 8M6 8a9 9 0 0 1 4-1.6M3 12a7 7 0 0 1 2-3M6 16a3 3 0 0 1 3-1M12 20h.01" />,
    },
    {
      title: 'Hand-authored protocols', accent: T.amber,
      body: `${PROTOCOL_COUNT} protocols traceable to WHO, Red Cross, NHS and St John Ambulance — not whatever the AI feels like saying.`,
      icon: <Icon path="M5 4h12a2 2 0 0 1 2 2v14l-4-3-4 3-4-3-2 2V6a2 2 0 0 1 2-2zM8 9h6M8 13h6" />,
    },
    {
      title: 'Red-flag detection', accent: T.rose,
      body: 'Chest pain plus sweating, FAST signs, anaphylaxis, severe bleeding — pattern-matched before the AI even runs.',
      icon: <Icon path="M12 3l9 16H3l9-16zm0 5v6m0 2v2" />,
    },
    {
      title: 'Nearby care directory', accent: T.violet,
      body: 'Ladakh facilities and helplines bundled with the app: SNM Hospital Leh, Kargil, CHCs at Diskit, Nyoma, more.',
      icon: <Icon path="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />,
    },
    {
      title: 'Privacy by design', accent: T.cyan,
      body: 'No accounts, no analytics, no cloud. Your symptoms stay on your device — verified by browser DevTools.',
      icon: <Icon path="M12 3l8 4v5a9 9 0 0 1-8 9 9 9 0 0 1-8-9V7l8-4zM9 12l2 2 4-4" />,
    },
  ];

  return (
    <motion.section {...sectionMotion(0)} id="features" style={glassCard}>
      <SectionHead kicker="WHY TEND" title="A first-aid app that doesn't outsource your safety" />
      <p style={sectionSub}>
        Built around one principle: the AI helps you get to the right protocol — it never invents one.
      </p>
      <div style={{
        marginTop: 26, display: 'grid', gap: 14,
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      }}>
        {items.map((f) => (
          <div key={f.title} style={{
            background: T.glassHi, border: `1px solid ${T.glassBorder}`, borderRadius: 16,
            padding: '20px', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `${f.accent}22`, border: `1px solid ${f.accent}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: f.accent,
            }}>
              {f.icon}
            </div>
            <div style={{
              fontSize: 17, fontWeight: 700, color: T.text,
              fontFamily: DISPLAY, letterSpacing: '-0.01em',
            }}>{f.title}</div>
            <div style={{ fontSize: 14, color: T.textMute, lineHeight: 1.55 }}>{f.body}</div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ===========================================================================
// How it works
// ===========================================================================

function HowItWorks() {
  return (
    <motion.section {...sectionMotion(0)} id="how" style={glassCard}>
      <SectionHead kicker="THREE STEPS" title="What happens when you tap Start" />
      <div style={{
        marginTop: 22, display: 'grid', gap: 14,
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      }}>
        <StepCard n={1} accent={T.cyan} title="Describe"
          body="Type what's happening in plain English. Severity, age, duration — all on one screen." />
        <StepCard n={2} accent={T.violet} title="Analyze"
          body="A small on-device AI routes your symptoms to one of 23 hand-authored protocols. Nothing leaves the device." />
        <StepCard n={3} accent={T.amber} title="Act"
          body="Clear steps to take, things to avoid, when to see a professional, and who to call in your region." />
      </div>
    </motion.section>
  );
}

function StepCard({ n, title, body, accent }: {
  n: number; title: string; body: string; accent: string;
}) {
  return (
    <div style={{
      background: T.glass, border: `1px solid ${T.glassBorder}`,
      borderRadius: 16, padding: '20px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${accent}22`, border: `1px solid ${accent}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, color: accent, fontFamily: DISPLAY,
      }}>
        {String(n).padStart(2, '0')}
      </div>
      <div style={{
        fontSize: 17, fontWeight: 700, color: T.text,
        fontFamily: DISPLAY, letterSpacing: '-0.01em',
      }}>{title}</div>
      <div style={{ fontSize: 14, color: T.textMute, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

// ===========================================================================
// Personas
// ===========================================================================

function Personas() {
  return (
    <motion.section {...sectionMotion(0)} id="who" style={glassCard}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <SectionHead kicker="MADE FOR" title="People who can't always reach a clinic" />
        <span style={{ fontSize: 12, color: T.textSoft, fontFamily: DISPLAY }}>
          Leh · Kargil · Nubra · Changthang
        </span>
      </div>
      <p style={sectionSub}>
        Where the nearest hospital may be a six-hour drive — or further if a pass closes.
      </p>
      <div style={{
        marginTop: 22, display: 'grid', gap: 14,
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      }}>
        <BikerPersona
          title="Riders on the high passes"
          body="Khardung La, Chang La, Tanglang La. Mobile signal is rare and altitude is unforgiving."
        />
        <TrekkerPersona
          title="Trekkers on remote trails"
          body="Markha, Chadar, Zanskar. Days from the nearest road head, the weather sets the schedule."
        />
        <VillagePersona
          title="Villages off the grid"
          body="Border hamlets and high-pasture homes where a clinic is a long journey, not a short walk."
        />
      </div>
    </motion.section>
  );
}

// ===========================================================================
// Scenarios
// ===========================================================================

function Scenarios() {
  const items = [
    {
      location: 'Sumur, Nubra Valley',
      altitude: '3,050 m',
      situation: 'A camp cook spills boiling water across his forearm. The nearest CHC is 40 minutes away on a rough road.',
      tend: 'Tend gives the 20-minute cool-water protocol, what not to apply (no ash, no oil), and dials the Diskit CHC ahead.',
      accent: T.amber,
    },
    {
      location: 'Markha Valley trek',
      altitude: '3,500 m',
      situation: 'A trekker rolls her ankle on day three. She is six hours from Sara, in a stretch with no cell signal.',
      tend: 'R.I.C.E. steps with stop-rules, signs that mean a serious sprain, and a note for the next clinic she reaches.',
      accent: T.cyan,
    },
    {
      location: 'Chang La pass',
      altitude: '5,360 m',
      situation: 'A rider gets a nosebleed in the cold dry wind near the top. Easy to panic at altitude.',
      tend: 'A calm 10-minute pinch-and-tilt protocol, what would make it serious, and AMS warning signs to watch for.',
      accent: T.violet,
    },
  ];

  return (
    <motion.section {...sectionMotion(0)} style={glassCard}>
      <SectionHead kicker="REAL SITUATIONS" title="The moments Tend was built for" />
      <div style={{
        marginTop: 22, display: 'grid', gap: 14,
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      }}>
        {items.map((s) => (
          <div key={s.location} style={{
            background: T.glassHi, border: `1px solid ${T.glassBorder}`,
            borderRadius: 16, padding: '20px',
            display: 'flex', flexDirection: 'column', gap: 12, position: 'relative',
            overflow: 'hidden',
          }}>
            <span style={{
              position: 'absolute', top: 0, left: 20, right: 20, height: 2,
              background: `linear-gradient(90deg, transparent, ${s.accent}, transparent)`,
            }} />
            <div>
              <div style={{
                fontSize: 11, color: s.accent, fontWeight: 700,
                letterSpacing: '.1em', textTransform: 'uppercase',
              }}>
                {s.location} · {s.altitude}
              </div>
            </div>
            <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6 }}>
              {s.situation}
            </div>
            <div style={{
              fontSize: 13, color: T.textMute, lineHeight: 1.6,
              padding: '12px 14px', background: T.glass, borderRadius: 10,
              borderLeft: `2px solid ${s.accent}`,
            }}>
              <strong style={{ color: s.accent, fontFamily: DISPLAY, letterSpacing: '.04em' }}>
                What Tend does
              </strong>
              <br />{s.tend}
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

// ===========================================================================
// Trust & safety explainer
// ===========================================================================

function TrustAndSafety() {
  return (
    <motion.section {...sectionMotion(0)} id="trust" style={{
      ...glassCard,
      background: `linear-gradient(135deg, rgba(34,211,238,0.07), rgba(167,139,250,0.05))`,
    }}>
      <SectionHead kicker="TRUST & SAFETY" title="How we keep the AI out of medical decisions" />
      <p style={sectionSub}>
        Tend's AI has a small, specific job. The actual medical content always comes from the
        deterministic engine.
      </p>
      <div style={{
        marginTop: 24, display: 'grid', gap: 14,
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      }}>
        <SafetyPoint accent={T.cyan} title="The AI only routes">
          The on-device model returns a small JSON object: which body system, a paraphrase, and
          an "urgent" hint. It cannot invent protocols, dosages, or diagnoses.
        </SafetyPoint>
        <SafetyPoint accent={T.amber} title="Protocols are authored">
          Every step, every warning, every escalation line is written by humans, traceable to
          public sources like WHO, Red Cross, NHS, and St John Ambulance.
        </SafetyPoint>
        <SafetyPoint accent={T.rose} title="Red flags bypass the AI">
          Chest pain plus sweating, FAST stroke signs, anaphylaxis, severe bleeding — these are
          pattern-matched in code, before the model even runs.
        </SafetyPoint>
        <SafetyPoint accent={T.emerald} title="User has the last word">
          The plan screen lets you re-pick the body area in one tap if the AI mis-routed.
          You're never locked in to its first guess.
        </SafetyPoint>
      </div>
    </motion.section>
  );
}

function SafetyPoint({ accent, title, children }: {
  accent: string; title: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: T.glass, border: `1px solid ${T.glassBorder}`,
      borderRadius: 14, padding: '18px',
    }}>
      <div style={{
        fontSize: 11, color: accent, fontWeight: 700,
        letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6,
      }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: T.textMute, lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}

// ===========================================================================
// FAQ accordion
// ===========================================================================

function FAQ() {
  const items = [
    {
      q: 'Is this real medical advice?',
      a: 'No. Tend is a structured first-aid guide — the kind of thing you would find on the back of a poster at a community health centre, made tappable and personalised. It is not a substitute for a doctor. Every protocol ends with "see a doctor if…" lines and a recommended specialty.',
    },
    {
      q: 'How does it actually work without internet?',
      a: 'The browser downloads a small AI model and the app code once, on the first visit. Both are stored in private browser storage (OPFS) and a service-worker cache. After that, the app launches, the model runs, and your symptoms are matched — all without a network request.',
    },
    {
      q: 'Is the AI making decisions about my health?',
      a: 'No. The AI returns a small JSON object — which body system best matches your description, a paraphrase of what you said, and a flag for whether it sounds urgent. The actual protocol comes from a hand-authored library. The model cannot invent steps or change escalation rules.',
    },
    {
      q: 'What if I am in a real emergency?',
      a: 'Tend scans your description and triage answers for life-threatening signs — chest pain with sweating, stroke FAST signs, severe bleeding, anaphylaxis, unresponsiveness — and immediately switches to a red emergency screen with a one-tap call to your local emergency number (108 in India, 112, 999, 911 elsewhere).',
    },
    {
      q: 'Why focus on Ladakh?',
      a: 'Because the use case for offline edge-AI healthcare is sharpest there: high altitude, long distances between facilities, frequent telecom blackouts, and a steady flow of riders and trekkers from outside the region. The architecture is generic; the bundled facility directory and tone are the Ladakh edition.',
    },
    {
      q: 'How is my data used?',
      a: 'It isn\'t — by us or anyone else. Tend has no accounts, no analytics, no cloud sync. Past consultations are saved in your browser\'s localStorage, on your device, and you can clear them anytime by clearing site data.',
    },
  ];

  return (
    <motion.section {...sectionMotion(0)} id="faq" style={glassCard}>
      <SectionHead kicker="QUESTIONS" title="Asked & answered" />
      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => <FAQItem key={i} q={it.q} a={it.a} />)}
      </div>
    </motion.section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: T.glassHi, border: `1px solid ${T.glassBorder}`, borderRadius: 14,
      overflow: 'hidden',
    }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, cursor: 'pointer', textAlign: 'left',
        fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: T.text,
        letterSpacing: '-0.01em',
      }}>
        <span>{q}</span>
        <span style={{
          width: 26, height: 26, borderRadius: 999,
          background: open ? T.amberDim : T.glass,
          border: `1px solid ${open ? 'rgba(251,191,36,0.4)' : T.glassBorder}`,
          color: open ? T.amber : T.textSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
          transition: 'all .15s',
        }}>{open ? '−' : '+'}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 18px 18px', fontSize: 14, color: T.textMute, lineHeight: 1.65,
            }}>{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================================================================
// Big CTA
// ===========================================================================

function BigCTA({ onStart }: { onStart: () => void }) {
  return (
    <motion.section {...sectionMotion(0)} style={{
      ...glassCard,
      padding: '52px 36px',
      background: `
        radial-gradient(60% 80% at 50% 0%, rgba(245,158,11,0.18), transparent 70%),
        radial-gradient(60% 80% at 50% 100%, rgba(244,63,94,0.18), transparent 70%),
        rgba(255,255,255,0.04)
      `,
      textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <div style={statusPill}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.emerald,
          boxShadow: `0 0 12px ${T.emerald}` }} />
        Free · No account · Works offline
      </div>
      <h2 style={{
        fontSize: 'clamp(28px, 4.4vw, 42px)', fontWeight: 700, color: T.text,
        margin: '18px 0 0', lineHeight: 1.1,
        fontFamily: DISPLAY, letterSpacing: '-0.025em',
      }}>
        Ready before you{' '}
        <span style={{
          background: `linear-gradient(135deg, ${T.amber}, ${T.rose})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>need it</span>.
      </h2>
      <p style={{
        fontSize: 17, color: T.textMute, lineHeight: 1.6, marginTop: 14,
        maxWidth: 580, marginLeft: 'auto', marginRight: 'auto',
      }}>
        Cache Tend once, then open it on the pass, in the village, on the trail.
        It's there when you need it — and silent when you don't.
      </p>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 26,
        justifyContent: 'center',
      }}>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
          onClick={onStart} style={{ ...primaryButton, padding: '15px 28px', fontSize: 16 }}>
          Start a consultation →
        </motion.button>
        <a href="#faq" style={{ ...secondaryButton, padding: '15px 22px', textDecoration: 'none' }}>
          I have questions
        </a>
      </div>
    </motion.section>
  );
}

// ===========================================================================
// Footer
// ===========================================================================

function Footer() {
  return (
    <motion.footer {...sectionMotion(0)} style={{
      borderTop: `1px solid ${T.glassBorder}`,
      paddingTop: 32, paddingBottom: 28,
      marginTop: 8,
    }}>
      <div style={{
        display: 'grid', gap: 28,
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      }}>
        <div>
          <div style={{
            fontSize: 20, fontWeight: 700, color: T.text,
            fontFamily: DISPLAY, letterSpacing: '-0.02em', marginBottom: 8,
          }}>
            <span style={{
              background: `linear-gradient(135deg, ${T.cyan}, ${T.amber})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Tend</span>
          </div>
          <div style={{ fontSize: 13, color: T.textSoft, lineHeight: 1.6, maxWidth: 220 }}>
            On-device first aid for the high places. Made with care for the mountains.
          </div>
        </div>
        <FooterCol title="Product" links={[
          { label: 'How it works', href: '#how' },
          { label: 'Features', href: '#features' },
          { label: 'Trust & safety', href: '#trust' },
          { label: 'FAQ', href: '#faq' },
        ]} />
        <FooterCol title="Region" links={[
          { label: 'Ladakh edition', href: '#who' },
          { label: 'Care directory', href: '#preview' },
          { label: 'Sources', href: '#trust' },
        ]} />
        <FooterCol title="About" links={[
          { label: 'Mission', href: '#hero' },
          { label: 'Privacy', href: '#trust' },
          { label: 'Open source', href: 'https://github.com', external: true },
        ]} />
      </div>
      <div style={{
        marginTop: 28, paddingTop: 18,
        borderTop: `1px solid ${T.glassBorder}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12,
        fontSize: 12, color: T.textFaint,
      }}>
        <div>© Tend {new Date().getFullYear()} — Not a substitute for professional medical care.</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999,
            background: T.emeraldDim, color: T.emerald,
            border: '1px solid rgba(52,211,153,0.3)',
            fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.emerald }} />
            ALL SYSTEMS LOCAL
          </span>
        </div>
      </div>
    </motion.footer>
  );
}

function FooterCol({ title, links }: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <div style={{
        fontSize: 11, color: T.amber, fontWeight: 700,
        letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 12,
      }}>{title}</div>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href}
               {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
               style={{
                 fontSize: 13.5, color: T.textMute, textDecoration: 'none',
                 fontFamily: FONT, transition: 'color .15s',
               }}
               onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
               onMouseLeave={(e) => (e.currentTarget.style.color = T.textMute)}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ===========================================================================
// Shared helpers / styles
// ===========================================================================

function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: T.amber,
        letterSpacing: '.14em', textTransform: 'uppercase',
      }}>{kicker}</div>
      <h2 style={{
        fontSize: 'clamp(22px, 3.4vw, 32px)', fontWeight: 700, color: T.text,
        margin: '6px 0 0', fontFamily: DISPLAY,
        letterSpacing: '-0.02em', lineHeight: 1.15,
      }}>{title}</h2>
    </div>
  );
}

function sectionMotion(_index: number) {
  return {
    initial: { opacity: 0, y: 22 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  };
}

const glassCard: React.CSSProperties = {
  background: T.glass,
  border: `1px solid ${T.glassBorder}`,
  borderRadius: 22,
  padding: '28px',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 24px 80px -32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
};

const sectionSub: React.CSSProperties = {
  fontSize: 15, color: T.textMute, lineHeight: 1.6, marginTop: 10, maxWidth: 640,
};

const primaryButton: React.CSSProperties = {
  padding: '12px 22px',
  background: `linear-gradient(135deg, ${T.amberStrong}, ${T.roseStrong})`,
  color: '#fff', border: 'none', borderRadius: 12,
  fontSize: 15, fontWeight: 700,
  cursor: 'pointer', fontFamily: DISPLAY, letterSpacing: '-0.01em',
  boxShadow: `0 12px 32px -10px ${T.amberStrong}, inset 0 1px 0 rgba(255,255,255,0.25)`,
  transition: 'all .15s',
};

const secondaryButton: React.CSSProperties = {
  padding: '12px 20px',
  background: T.glassHi, color: T.text,
  border: `1px solid ${T.glassBorder}`, borderRadius: 12,
  fontSize: 14.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: DISPLAY, letterSpacing: '-0.01em',
  display: 'inline-flex', alignItems: 'center',
};

const statusPill: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '5px 12px', background: T.emeraldDim,
  border: '1px solid rgba(52,211,153,0.3)',
  color: T.emerald, borderRadius: 999,
  fontSize: 11.5, fontWeight: 700,
  letterSpacing: '.08em', textTransform: 'uppercase',
};
