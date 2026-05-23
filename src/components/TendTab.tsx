import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModelCategory } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { initSDK } from '../runanywhere';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';
import { NearbyCare } from './NearbyCare';
import { MarketingLanding } from './MarketingLanding';
import {
  BODY_SYSTEMS,
  detectRedFlags,
  pickProtocol,
  severityLabel,
  ageBandLabel,
  buildRoutingPrompt,
  parseRouting,
  PROTOCOL_COUNT,
  type BodySystem,
  type AgeBand,
  type Protocol,
  type RedFlag,
  type TriageInput,
  type AiRouting,
} from '../engine/triageEngine';

type Phase = 'intro' | 'input' | 'analyzing' | 'plan' | 'emergency';

// ===========================================================================
// Theme tokens
// ===========================================================================

const T = {
  bg0:           '#070b18',
  bg1:           '#0f1426',
  bg2:           '#161c33',

  glass:         'rgba(255,255,255,0.04)',
  glassHi:       'rgba(255,255,255,0.07)',
  glassBorder:   'rgba(255,255,255,0.08)',
  glassBorderHi: 'rgba(255,255,255,0.18)',

  amber:         '#fbbf24',
  amberStrong:   '#f59e0b',
  amberDim:      'rgba(251,191,36,0.15)',
  cyan:          '#22d3ee',
  cyanStrong:    '#06b6d4',
  cyanDim:       'rgba(34,211,238,0.14)',
  rose:          '#fb7185',
  roseStrong:    '#f43f5e',
  roseDim:       'rgba(251,113,133,0.14)',
  violet:        '#a78bfa',
  emerald:       '#34d399',
  emeraldDim:    'rgba(52,211,153,0.14)',

  text:          '#f1f5f9',
  textMute:      '#cbd5e1',
  textSoft:      '#94a3b8',
  textFaint:     '#64748b',
} as const;

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DISPLAY = "'Space Grotesk', 'Inter', sans-serif";

const STORAGE_KEY = 'tendHistory';
const EMERGENCY_KEY = 'tendEmergencyNumber';
const MANUAL_MODE_KEY = 'tendManualMode';

interface SavedConsult {
  ts: number;
  bodySystem: BodySystem;
  severity: number;
  protocolId: string;
  protocolTitle: string;
  description: string;
}

// ===========================================================================
// Root
// ===========================================================================

export function TendTab() {
  const [phase, setPhase] = useState<Phase>('intro');

  // Input state
  const [description, setDescription] = useState('');
  const [manualBodySystem, setManualBodySystem] = useState<BodySystem | null>(null);
  const [severity, setSeverity] = useState(4);
  const [durationHours, setDurationHours] = useState(1);
  const [ageBand, setAgeBand] = useState<AgeBand>('adult');
  const [consciousAndBreathing, setConsciousAndBreathing] = useState(true);
  const [manualMode, setManualMode] = useState<boolean>(
    () => localStorage.getItem(MANUAL_MODE_KEY) === '1',
  );

  // Result state
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [routing, setRouting] = useState<AiRouting | null>(null);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [analyzingStep, setAnalyzingStep] = useState<string>('Preparing…');

  // Persistence
  const [history, setHistory] = useState<SavedConsult[]>([]);
  const [emergencyNumber, setEmergencyNumber] = useState<string>(
    () => localStorage.getItem(EMERGENCY_KEY) || '',
  );

  const loader = useModelLoader(ModelCategory.Language);
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    initSDK().catch((err) => console.warn('[Tend] initSDK failed:', err));
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {/* ignore */}
  }, []);

  useEffect(() => {
    if (phase === 'input' && !manualMode && loader.state === 'idle') {
      loader.ensure().catch(() => {/* shown in banner */});
    }
  }, [phase, manualMode, loader]);

  useEffect(() => {
    localStorage.setItem(MANUAL_MODE_KEY, manualMode ? '1' : '0');
  }, [manualMode]);

  // ---- helpers ----

  const reset = useCallback(() => {
    setPhase('intro');
    setDescription('');
    setManualBodySystem(null);
    setSeverity(4);
    setDurationHours(1);
    setAgeBand('adult');
    setConsciousAndBreathing(true);
    setRedFlags([]);
    setRouting(null);
    setProtocol(null);
    setAnalyzingStep('Preparing…');
  }, []);

  const saveEmergencyNumber = (n: string) => {
    setEmergencyNumber(n);
    localStorage.setItem(EMERGENCY_KEY, n);
  };

  const persistConsult = (p: Protocol) => {
    const entry: SavedConsult = {
      ts: Date.now(),
      bodySystem: p.bodySystem,
      severity,
      protocolId: p.id,
      protocolTitle: p.title,
      description: description.slice(0, 200),
    };
    const next = [entry, ...history].slice(0, 30);
    setHistory(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {/* ignore */}
  };

  const liveRedFlags = useMemo(() => detectRedFlags(description), [description]);

  const triggerEmergency = (flags: RedFlag[]) => {
    setRedFlags(flags);
    setPhase('emergency');
  };

  async function runAiRouting(): Promise<AiRouting> {
    const fallback: AiRouting = {
      bodySystem: manualBodySystem ?? 'other',
      paraphrase: description.slice(0, 160),
      urgent: false,
      parsed: false,
    };
    if (manualMode || !description.trim()) return fallback;

    const ok = await loader.ensure();
    if (!ok) return fallback;

    try {
      const prompt = buildRoutingPrompt(description);
      const { stream } = await TextGeneration.generateStream(prompt, { maxTokens: 140 });
      let acc = '';
      for await (const token of stream) {
        acc += token;
        if (acc.indexOf('{') !== -1 && acc.lastIndexOf('}') > acc.indexOf('{')
            && /\}\s*$/.test(acc.trim())) break;
      }
      return parseRouting(acc, description);
    } catch (err) {
      console.warn('[Tend] AI routing failed:', err);
      return fallback;
    }
  }

  const handleSubmit = async () => {
    const triagePartial: Partial<TriageInput> = { severity, consciousAndBreathing };
    const preFlags = detectRedFlags(description, triagePartial);
    if (preFlags.length > 0) { triggerEmergency(preFlags); return; }

    setPhase('analyzing');
    setAnalyzingStep('Reading your description…');

    const ai = await runAiRouting();
    setRouting(ai);

    if (ai.urgent) {
      const combined = detectRedFlags(description, triagePartial);
      if (combined.length > 0) { triggerEmergency(combined); return; }
    }

    setAnalyzingStep('Selecting the right protocol…');

    const chosenBodySystem = manualMode && manualBodySystem ? manualBodySystem : ai.bodySystem;
    const triage: TriageInput = {
      bodySystem: chosenBodySystem,
      severity, durationHours, ageBand, consciousAndBreathing, description,
    };
    const picked = pickProtocol(triage);
    await new Promise((r) => setTimeout(r, 500));
    setProtocol(picked);
    persistConsult(picked);
    setPhase('plan');
  };

  const repickBodySystem = (bs: BodySystem) => {
    const triage: TriageInput = {
      bodySystem: bs, severity, durationHours, ageBand, consciousAndBreathing, description,
    };
    const picked = pickProtocol(triage);
    setProtocol(picked);
    setRouting((r) => r ? { ...r, bodySystem: bs } : r);
    persistConsult(picked);
  };

  return (
    <div style={shell}>
      <GlobalStyles />
      <AmbientBackground />
      <Header phase={phase} onHome={reset} onStart={() => setPhase('input')} historyCount={history.length} />
      {!emergencyNumber && phase === 'intro' && (
        <EmergencyNumberPrompt onSave={saveEmergencyNumber} />
      )}

      <main style={phase === 'intro' ? mainStyleWide : mainStyle}>
        <AnimatePresence mode="wait">
          {phase === 'intro' && (
            <motion.div key="intro" {...fadeInUp}>
              <MarketingLanding
                onStart={() => setPhase('input')}
                savedCount={history.length}
              />
            </motion.div>
          )}
          {phase === 'input' && (
            <motion.div key="input" {...fadeInUp}>
              <InputView
                description={description} setDescription={setDescription}
                severity={severity} setSeverity={setSeverity}
                durationHours={durationHours} setDurationHours={setDurationHours}
                ageBand={ageBand} setAgeBand={setAgeBand}
                consciousAndBreathing={consciousAndBreathing} setConsciousAndBreathing={setConsciousAndBreathing}
                manualMode={manualMode} setManualMode={setManualMode}
                manualBodySystem={manualBodySystem} setManualBodySystem={setManualBodySystem}
                liveFlags={liveRedFlags}
                onBack={reset} onSubmit={handleSubmit}
                loader={loader}
              />
            </motion.div>
          )}
          {phase === 'analyzing' && (
            <motion.div key="analyzing" {...fadeInUp}>
              <AnalyzingView label={analyzingStep} />
            </motion.div>
          )}
          {phase === 'plan' && protocol && (
            <motion.div key="plan" {...fadeInUp}>
              <PlanView
                protocol={protocol} routing={routing}
                severity={severity} ageBand={ageBand}
                onRestart={reset} onRepick={repickBodySystem}
              />
            </motion.div>
          )}
          {phase === 'emergency' && (
            <motion.div key="emergency" {...fadeInUp}>
              <EmergencyView
                flags={redFlags}
                emergencyNumber={emergencyNumber}
                onSaveNumber={saveEmergencyNumber}
                onBack={reset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Disclaimer />
    </div>
  );
}

// ===========================================================================
// Motion presets
// ===========================================================================

const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
};

// ===========================================================================
// Chrome
// ===========================================================================

function Header({ phase, onHome, onStart, historyCount }: {
  phase: Phase; onHome: () => void; onStart: () => void; historyCount: number;
}) {
  const phaseLabel: Record<Phase, string> = {
    intro: '',
    input: 'New consultation',
    analyzing: 'Analyzing',
    plan: 'Your plan',
    emergency: 'Emergency',
  };
  const showNav = phase === 'intro';
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 22px',
      borderBottom: `1px solid ${T.glassBorder}`,
      background: 'rgba(7,11,24,0.7)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      gap: 16,
    }}>
      <button onClick={onHome} style={{
        ...linkButton, fontWeight: 700, fontSize: 18, color: T.text,
        fontFamily: DISPLAY, letterSpacing: '-0.01em', flexShrink: 0,
      }}>
        <Logo /> Tend
        <span style={{
          marginLeft: 12, fontSize: 10.5, fontWeight: 700, padding: '3px 9px',
          background: T.amberDim, color: T.amber, borderRadius: 999,
          letterSpacing: '.1em', textTransform: 'uppercase',
          border: '1px solid rgba(251,191,36,0.3)',
        }}>
          Ladakh edition
        </span>
      </button>

      {showNav && (
        <nav className="tend-nav-links" style={{
          display: 'flex', gap: 26, alignItems: 'center',
        }}>
          {[
            { href: '#features', label: 'Features' },
            { href: '#how',      label: 'How it works' },
            { href: '#who',      label: 'Who it\'s for' },
            { href: '#trust',    label: 'Trust' },
            { href: '#faq',      label: 'FAQ' },
          ].map((l) => (
            <a key={l.href} href={l.href} style={{
              fontSize: 13.5, color: T.textMute, textDecoration: 'none',
              fontFamily: FONT, fontWeight: 500, transition: 'color .15s',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.textMute)}>
              {l.label}
            </a>
          ))}
        </nav>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        {!showNav && (
          <span style={{ fontSize: 12, color: T.textSoft, letterSpacing: '.04em' }}>
            {phaseLabel[phase]}
          </span>
        )}
        {showNav && (
          <>
            {historyCount > 0 && (
              <span className="tend-nav-saved" style={{
                fontSize: 12, color: T.textSoft, fontFamily: FONT,
              }}>
                {historyCount} saved
              </span>
            )}
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={onStart} style={{
                padding: '9px 16px',
                background: `linear-gradient(135deg, ${T.amberStrong}, ${T.roseStrong})`,
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13.5, fontWeight: 700,
                cursor: 'pointer', fontFamily: DISPLAY, letterSpacing: '-0.01em',
                boxShadow: `0 8px 24px -8px ${T.amberStrong}`,
              }}>
              Try Tend free
            </motion.button>
          </>
        )}
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
      style={{ verticalAlign: 'middle', marginRight: 10 }}>
      <defs>
        <linearGradient id="tend-logo-grad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={T.cyan} />
          <stop offset="100%" stopColor={T.amber} />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="6" stroke="url(#tend-logo-grad)" strokeWidth="2"/>
      <path d="M12 8v8M8 12h8" stroke="url(#tend-logo-grad)" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function AmbientBackground() {
  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(60% 50% at 15% 0%, rgba(124,58,237,0.22), transparent 70%),
          radial-gradient(50% 40% at 85% 10%, rgba(245,158,11,0.18), transparent 65%),
          radial-gradient(80% 60% at 50% 100%, rgba(34,211,238,0.12), transparent 70%),
          ${T.bg0}
        `,
      }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)`,
        backgroundSize: '32px 32px',
        opacity: 0.4,
      }} />
    </>
  );
}

function Disclaimer() {
  return (
    <footer style={{
      padding: '14px 22px',
      borderTop: `1px solid ${T.glassBorder}`,
      background: 'rgba(7,11,24,0.7)',
      backdropFilter: 'blur(10px)',
      fontSize: 12, lineHeight: 1.55, color: T.textSoft, textAlign: 'center',
      position: 'relative', zIndex: 5,
    }}>
      Not a substitute for professional medical care. Information is general guidance.
      Your data stays on this device — nothing is uploaded.
    </footer>
  );
}

function EmergencyNumberPrompt({ onSave }: { onSave: (n: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div style={{
      margin: '18px 22px 0', padding: '16px 18px',
      background: 'linear-gradient(135deg, rgba(251,191,36,0.14), rgba(244,63,94,0.10))',
      border: '1px solid rgba(251,191,36,0.35)',
      borderRadius: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      position: 'relative', zIndex: 5,
    }}>
      <div style={{ fontSize: 14, color: T.text, flex: '1 1 240px' }}>
        <strong style={{ color: T.amber }}>Set your local emergency number</strong>
        {' '}so Tend can show it on the emergency screen. Examples: 911, 999, 112, 108.
      </div>
      <input inputMode="tel" placeholder="e.g. 112" value={val} onChange={(e) => setVal(e.target.value)}
        style={inputStyle({ width: 120 })} />
      <button onClick={() => val.trim() && onSave(val.trim())} style={primaryButton}>Save</button>
    </div>
  );
}

// ===========================================================================
// Phase: input
// ===========================================================================

function InputView(props: {
  description: string; setDescription: (s: string) => void;
  severity: number; setSeverity: (n: number) => void;
  durationHours: number; setDurationHours: (n: number) => void;
  ageBand: AgeBand; setAgeBand: (a: AgeBand) => void;
  consciousAndBreathing: boolean; setConsciousAndBreathing: (b: boolean) => void;
  manualMode: boolean; setManualMode: (b: boolean) => void;
  manualBodySystem: BodySystem | null; setManualBodySystem: (b: BodySystem | null) => void;
  liveFlags: RedFlag[];
  onBack: () => void; onSubmit: () => void;
  loader: ReturnType<typeof useModelLoader>;
}) {
  const {
    description, setDescription, severity, setSeverity,
    durationHours, setDurationHours, ageBand, setAgeBand,
    consciousAndBreathing, setConsciousAndBreathing,
    manualMode, setManualMode, manualBodySystem, setManualBodySystem,
    liveFlags, onBack, onSubmit, loader,
  } = props;

  const canSubmit = description.trim().length >= 3 && (!manualMode || manualBodySystem !== null);

  return (
    <section style={glassCard}>
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.amber,
          letterSpacing: '.14em', textTransform: 'uppercase',
        }}>STEP 1 · DESCRIBE</div>
        <h2 style={{
          fontSize: 26, fontWeight: 700, color: T.text, margin: '4px 0 0',
          fontFamily: DISPLAY, letterSpacing: '-0.02em', lineHeight: 1.2,
        }}>Tell us what's happening</h2>
      </div>
      <p style={sectionSub}>
        Describe in your own words. The on-device AI will pick the right area on its own —
        you can adjust later if needed.
      </p>

      {!manualMode && (
        <div style={{ marginTop: 14 }}>
          <ModelBanner state={loader.state} progress={loader.progress} error={loader.error}
            onLoad={loader.ensure} label="Language" />
        </div>
      )}

      <textarea
        autoFocus rows={5}
        placeholder="e.g. burned my hand on a hot pan about 10 minutes ago, the skin is red and starting to blister"
        value={description} onChange={(e) => setDescription(e.target.value)}
        style={{
          marginTop: 18, width: '100%', padding: '14px 16px',
          fontSize: 15, fontFamily: FONT, color: T.text,
          background: T.glassHi, border: `1px solid ${T.glassBorder}`,
          borderRadius: 14, resize: 'vertical', outline: 'none',
          lineHeight: 1.55,
        }}
      />

      {liveFlags.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 12, padding: '12px 14px',
            background: T.roseDim, border: '1px solid rgba(251,113,133,0.4)',
            borderRadius: 12, color: T.rose, fontSize: 14, fontWeight: 500,
          }}>
          <strong>This may need emergency care.</strong> Submitting will switch to emergency steps.
        </motion.div>
      )}

      <label style={{
        display: 'flex', gap: 10, alignItems: 'center', marginTop: 16,
        fontSize: 13, color: T.textMute, cursor: 'pointer', userSelect: 'none',
      }}>
        <input type="checkbox" checked={manualMode} onChange={(e) => setManualMode(e.target.checked)}
          style={{ accentColor: T.amber, width: 16, height: 16 }} />
        Skip the AI step and pick the area myself
      </label>

      {manualMode && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, color: T.textSoft, marginBottom: 10 }}>Pick the closest area:</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8,
          }}>
            {BODY_SYSTEMS.map((s) => {
              const active = manualBodySystem === s.id;
              return (
                <button key={s.id} onClick={() => setManualBodySystem(s.id)}
                  style={{
                    textAlign: 'left', padding: '12px 14px',
                    border: `1px solid ${active ? T.cyan : T.glassBorder}`,
                    background: active ? T.cyanDim : T.glassHi,
                    color: active ? T.cyan : T.text,
                    borderRadius: 12, cursor: 'pointer', fontFamily: FONT,
                    fontSize: 13, fontWeight: active ? 600 : 500,
                  }}>
                  <div style={{ fontFamily: DISPLAY }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: T.textSoft, marginTop: 3 }}>{s.hint}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Field label={`How bad is it right now?  (${severity}/10 · ${severityLabel(severity)})`}>
        <input type="range" min={1} max={10} value={severity}
          onChange={(e) => setSeverity(Number(e.target.value))}
          style={{ width: '100%', accentColor: T.amber }} />
        <Row><small style={{ color: T.textSoft }}>Mild</small><small style={{ color: T.textSoft }}>Severe</small></Row>
      </Field>

      <Field label="How long has this been going on?">
        <SegBar
          options={[
            { v: 1, label: '< 1 hour' },
            { v: 6, label: '< 6 hours' },
            { v: 24, label: '< 1 day' },
            { v: 72, label: '< 3 days' },
            { v: 999, label: 'Longer' },
          ]}
          value={durationHours} onChange={setDurationHours} />
      </Field>

      <Field label="Who is this for?">
        <SegBar
          options={[
            { v: 'infant', label: 'Infant' },
            { v: 'child', label: 'Child' },
            { v: 'adult', label: 'Adult' },
            { v: 'elderly', label: '65+' },
          ] as const}
          value={ageBand} onChange={(v) => setAgeBand(v as AgeBand)} />
      </Field>

      <Field label="Is the person conscious and breathing normally?">
        <SegBar
          options={[
            { v: 'yes', label: 'Yes' },
            { v: 'no',  label: 'No / Not sure' },
          ]}
          value={consciousAndBreathing ? 'yes' : 'no'}
          onChange={(v) => setConsciousAndBreathing(v === 'yes')} />
      </Field>

      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <button onClick={onBack} style={secondaryButton}>← Back</button>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
          onClick={onSubmit} style={primaryButton} disabled={!canSubmit}>
          Get my plan →
        </motion.button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22 }}>
      <label style={{
        display: 'block', fontSize: 14, fontWeight: 600, color: T.text,
        marginBottom: 10, fontFamily: DISPLAY,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>{children}</div>;
}

function SegBar<T extends string | number>({ options, value, onChange }: {
  options: readonly { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button key={String(o.v)} onClick={() => onChange(o.v)}
            style={{
              padding: '10px 16px', borderRadius: 999,
              border: `1px solid ${active ? T.cyan : T.glassBorder}`,
              background: active ? T.cyanDim : T.glassHi,
              color: active ? T.cyan : T.text,
              fontSize: 14, fontWeight: active ? 600 : 500,
              cursor: 'pointer', fontFamily: FONT, transition: 'all .15s',
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ===========================================================================
// Phase: analyzing
// ===========================================================================

function AnalyzingView({ label }: { label: string }) {
  return (
    <section style={{ ...glassCard, textAlign: 'center', padding: '80px 32px' }}>
      <div style={{
        width: 60, height: 60, margin: '0 auto 20px', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          border: `2px solid ${T.glassBorder}`, borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          border: `2px solid transparent`, borderTopColor: T.amber, borderRightColor: T.rose,
          borderRadius: '50%', animation: 'tend-spin 1.2s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 6,
          border: `2px solid transparent`, borderBottomColor: T.cyan,
          borderRadius: '50%', animation: 'tend-spin 1.8s linear infinite reverse',
        }} />
      </div>
      <div style={{
        fontSize: 18, color: T.text, fontWeight: 600,
        fontFamily: DISPLAY, letterSpacing: '-0.01em',
      }}>{label}</div>
      <div style={{ fontSize: 13, color: T.textSoft, marginTop: 8 }}>
        Everything runs on your device — nothing is uploaded.
      </div>
    </section>
  );
}

// ===========================================================================
// Phase: plan
// ===========================================================================

function PlanView({ protocol, routing, severity, ageBand, onRestart, onRepick }: {
  protocol: Protocol; routing: AiRouting | null;
  severity: number; ageBand: AgeBand;
  onRestart: () => void;
  onRepick: (bs: BodySystem) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const showParaphrase = routing && routing.parsed && routing.paraphrase.trim().length > 0;

  return (
    <section style={glassCard}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <Pill color={T.cyan} bg={T.cyanDim} border="rgba(34,211,238,0.3)">{protocol.bodySystem}</Pill>
        <Pill color={T.amber} bg={T.amberDim} border="rgba(251,191,36,0.3)">
          {severityLabel(severity)} · {severity}/10
        </Pill>
        <Pill color={T.textMute} bg={T.glassHi} border={T.glassBorder}>
          {ageBandLabel(ageBand)}
        </Pill>
      </div>

      <h2 style={{
        fontSize: 30, fontWeight: 700, color: T.text, margin: 0, lineHeight: 1.15,
        fontFamily: DISPLAY, letterSpacing: '-0.02em',
      }}>{protocol.title}</h2>
      <p style={{ fontSize: 16, color: T.textMute, lineHeight: 1.6, marginTop: 10 }}>
        {protocol.summary}
      </p>

      {showParaphrase && (
        <div style={{
          marginTop: 18, padding: '14px 16px',
          background: `linear-gradient(135deg, ${T.amberDim}, transparent)`,
          borderLeft: `3px solid ${T.amber}`, borderRadius: '4px 14px 14px 4px',
          fontSize: 14.5, color: T.text, lineHeight: 1.55,
        }}>
          <div style={{
            fontSize: 11, color: T.amber, fontWeight: 700,
            letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6,
          }}>
            What the assistant heard
          </div>
          {routing!.paraphrase}
        </div>
      )}

      <BlockList title="What to do" tone="ok" items={protocol.steps} ordered />
      <BlockList title="What to avoid" tone="warn" items={protocol.avoid} />
      <BlockList title="See a doctor if…" tone="danger" items={protocol.whenToEscalate} />

      <div style={{
        marginTop: 24, padding: '16px 18px',
        background: T.glassHi, border: `1px solid ${T.glassBorder}`,
        borderRadius: 14,
      }}>
        <div style={{ fontSize: 11, color: T.amber, fontWeight: 700,
          letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Recommended professional care
        </div>
        <div style={{ fontSize: 15, color: T.text, fontWeight: 500, fontFamily: DISPLAY }}>
          {protocol.specialty}
        </div>
      </div>

      <NearbyCare bodySystem={protocol.bodySystem} region="Ladakh" limit={4} />

      <div style={{
        marginTop: 20, padding: '14px 16px',
        background: T.glass, border: `1px dashed ${T.glassBorder}`, borderRadius: 14,
      }}>
        <button onClick={() => setShowPicker((s) => !s)} style={{
          ...linkButton, color: T.cyan, fontSize: 13, fontWeight: 600,
          fontFamily: DISPLAY,
        }}>
          {showPicker ? '− Hide options' : '+ Wrong area? Pick a different one'}
        </button>
        {showPicker && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {BODY_SYSTEMS.map((s) => {
              const active = s.id === protocol.bodySystem;
              return (
                <button key={s.id} onClick={() => onRepick(s.id)} style={{
                  padding: '8px 14px', borderRadius: 999,
                  border: `1px solid ${active ? T.cyan : T.glassBorder}`,
                  background: active ? T.cyanDim : T.glassHi,
                  color: active ? T.cyan : T.text,
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  cursor: 'pointer', fontFamily: FONT,
                }}>
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
          onClick={onRestart} style={primaryButton}>New consultation</motion.button>
        <button onClick={() => navigator.clipboard?.writeText(renderForClipboard(protocol))}
          style={secondaryButton}>Copy plan</button>
      </div>

      {protocol.sources.length > 0 && (
        <div style={{ marginTop: 20, fontSize: 12, color: T.textSoft }}>
          Based on: {protocol.sources.map((s) => s.title).join(' · ')}
        </div>
      )}
    </section>
  );
}

function BlockList({ title, items, tone, ordered }: {
  title: string; items: string[]; tone: 'ok' | 'warn' | 'danger'; ordered?: boolean;
}) {
  if (items.length === 0) return null;
  const palette = {
    ok:     { fg: T.emerald, bg: T.emeraldDim, border: 'rgba(52,211,153,0.3)' },
    warn:   { fg: T.amber,   bg: T.amberDim,   border: 'rgba(251,191,36,0.3)' },
    danger: { fg: T.rose,    bg: T.roseDim,    border: 'rgba(251,113,133,0.3)' },
  }[tone];

  const ListTag = ordered ? 'ol' : 'ul';

  return (
    <div style={{
      marginTop: 22, padding: '16px 18px',
      background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 14,
    }}>
      <h3 style={{
        fontSize: 12, fontWeight: 700, color: palette.fg,
        textTransform: 'uppercase', letterSpacing: '.12em', margin: 0,
      }}>{title}</h3>
      <ListTag style={{
        marginTop: 10, paddingLeft: 22, fontSize: 15, lineHeight: 1.7, color: T.text,
      }}>
        {items.map((item, i) => <li key={i} style={{ marginBottom: 6 }}>{item}</li>)}
      </ListTag>
    </div>
  );
}

function Pill({ children, color, bg, border }: {
  children: React.ReactNode; color: string; bg: string; border: string;
}) {
  return (
    <span style={{
      padding: '4px 12px', borderRadius: 999, background: bg,
      color, border: `1px solid ${border}`,
      fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
      letterSpacing: '.04em', fontFamily: DISPLAY,
    }}>{children}</span>
  );
}

function renderForClipboard(p: Protocol): string {
  return [
    p.title, p.summary, '',
    'What to do:',
    ...p.steps.map((s, i) => `${i + 1}. ${s}`), '',
    'What to avoid:',
    ...p.avoid.map((s) => `- ${s}`), '',
    'See a doctor if:',
    ...p.whenToEscalate.map((s) => `- ${s}`), '',
    `Recommended care: ${p.specialty}`, '',
    'This is general guidance and not a substitute for professional medical advice.',
  ].join('\n');
}

// ===========================================================================
// Phase: emergency
// ===========================================================================

function EmergencyView({ flags, emergencyNumber, onSaveNumber, onBack }: {
  flags: RedFlag[]; emergencyNumber: string;
  onSaveNumber: (n: string) => void; onBack: () => void;
}) {
  const [num, setNum] = useState(emergencyNumber);
  return (
    <section style={{
      ...glassCard,
      background: `linear-gradient(180deg, rgba(244,63,94,0.10) 0%, ${T.glass} 100%)`,
      border: `1px solid rgba(244,63,94,0.4)`,
      boxShadow: `0 0 60px -10px rgba(244,63,94,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`,
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '5px 14px', borderRadius: 999,
        background: T.roseStrong, color: '#fff',
        fontSize: 11, fontWeight: 700, letterSpacing: '.12em',
        marginBottom: 16, fontFamily: DISPLAY,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: '#fff',
          animation: 'tend-pulse 1.4s infinite',
        }} />
        SEEK EMERGENCY CARE NOW
      </div>

      <h2 style={{
        fontSize: 28, fontWeight: 700, color: T.rose, margin: 0, lineHeight: 1.2,
        fontFamily: DISPLAY, letterSpacing: '-0.02em',
      }}>
        Some of what you described needs urgent help.
      </h2>

      {emergencyNumber ? (
        <motion.a href={`tel:${emergencyNumber}`}
          whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            marginTop: 20, padding: '18px 22px',
            background: `linear-gradient(135deg, ${T.roseStrong}, #be123c)`,
            color: '#fff', borderRadius: 14,
            fontSize: 22, fontWeight: 700, textDecoration: 'none',
            fontFamily: DISPLAY, letterSpacing: '-0.01em',
            boxShadow: `0 12px 36px -8px ${T.roseStrong}`,
          }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"
                  stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          Call {emergencyNumber}
        </motion.a>
      ) : (
        <div style={{
          marginTop: 18, padding: '14px 16px',
          background: T.amberDim, border: '1px solid rgba(251,191,36,0.4)',
          borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 14, color: T.text, flex: '1 1 200px' }}>
            Set your emergency number to call directly:
          </span>
          <input inputMode="tel" placeholder="e.g. 112" value={num}
            onChange={(e) => setNum(e.target.value)} style={inputStyle({ width: 110 })} />
          <button onClick={() => num.trim() && onSaveNumber(num.trim())} style={primaryButton}>Save</button>
        </div>
      )}

      <ul style={{ marginTop: 24, paddingLeft: 22, fontSize: 15, lineHeight: 1.65, color: T.text }}>
        {flags.map((f) => (
          <li key={f.id} style={{ marginBottom: 12 }}>
            <strong style={{ color: T.rose }}>{f.label}.</strong>{' '}
            <span style={{ color: T.textMute }}>{f.reason}</span>
          </li>
        ))}
      </ul>

      <div style={{
        marginTop: 20, padding: '16px 18px',
        background: T.glassHi, border: `1px solid ${T.glassBorder}`, borderRadius: 14,
      }}>
        <h3 style={{
          fontSize: 11, fontWeight: 700, color: T.cyan,
          textTransform: 'uppercase', letterSpacing: '.12em', margin: 0,
        }}>While you wait for help</h3>
        <ul style={{ marginTop: 10, paddingLeft: 20, fontSize: 14, lineHeight: 1.65, color: T.text }}>
          <li>Keep the person still and reassured.</li>
          <li>If they are unconscious but breathing, place them in the recovery position on their side.</li>
          <li>If they have stopped breathing, begin CPR if trained — call out for someone with training nearby.</li>
          <li>For severe bleeding, press firmly on the wound with a clean cloth and do not let go.</li>
          <li>Do not give food, drink, or medication unless instructed by emergency services.</li>
        </ul>
      </div>

      <NearbyCare bodySystem="other" region="Ladakh" limit={3} />

      <button onClick={onBack} style={{ ...secondaryButton, marginTop: 20 }}>Back to start</button>
    </section>
  );
}

// ===========================================================================
// Shared styles
// ===========================================================================

const shell: React.CSSProperties = {
  minHeight: '100dvh', width: '100%',
  color: T.text, fontFamily: FONT,
  display: 'flex', flexDirection: 'column',
  position: 'relative',
};

const mainStyle: React.CSSProperties = {
  flex: 1, width: '100%', maxWidth: 880, margin: '0 auto',
  padding: '28px 22px 40px', position: 'relative', zIndex: 5,
};

const mainStyleWide: React.CSSProperties = {
  flex: 1, width: '100%', maxWidth: 1180, margin: '0 auto',
  padding: '32px 22px 24px', position: 'relative', zIndex: 5,
};

const glassCard: React.CSSProperties = {
  background: T.glass,
  border: `1px solid ${T.glassBorder}`,
  borderRadius: 22,
  padding: '26px',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 24px 80px -32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
};

const sectionSub: React.CSSProperties = {
  fontSize: 15, color: T.textMute, lineHeight: 1.6, marginTop: 8,
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
};

const linkButton: React.CSSProperties = {
  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
  fontFamily: FONT, display: 'inline-flex', alignItems: 'center',
};

const statusPill: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '5px 12px', background: T.emeraldDim,
  border: '1px solid rgba(52,211,153,0.3)',
  color: T.emerald, borderRadius: 999,
  fontSize: 11.5, fontWeight: 700,
  letterSpacing: '.08em', textTransform: 'uppercase',
};

function inputStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '11px 14px', borderRadius: 10,
    border: `1px solid ${T.glassBorder}`, background: T.glassHi,
    fontSize: 15, fontFamily: FONT, color: T.text,
    outline: 'none',
    ...extra,
  };
}

function GlobalStyles() {
  return (
    <style>{`
      @keyframes tend-spin { to { transform: rotate(360deg); } }
      @keyframes tend-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.6); }
      }
      body {
        background: ${T.bg0};
        color: ${T.text};
        font-family: ${FONT};
        -webkit-font-smoothing: antialiased;
      }
      button:focus-visible, input:focus-visible, textarea:focus-visible, a:focus-visible {
        outline: 2px solid ${T.amber};
        outline-offset: 2px;
      }
      button:disabled { opacity: .45; cursor: not-allowed; }
      details summary::-webkit-details-marker { display: none; }
      textarea::placeholder, input::placeholder { color: ${T.textFaint}; }
      /* range slider thumb */
      input[type="range"] { height: 24px; }
      ::selection { background: rgba(251,191,36,0.4); color: ${T.text}; }
      /* Marketing nav — hide anchor links on small screens (logo + CTA only) */
      @media (max-width: 880px) {
        .tend-nav-links { display: none !important; }
      }
      @media (max-width: 520px) {
        .tend-nav-saved { display: none !important; }
      }
      /* Anchor scroll offset under the sticky header */
      [id] { scroll-margin-top: 80px; }
    `}</style>
  );
}
