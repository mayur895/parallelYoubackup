// Tend — Review page (/#review).
// A reviewer-facing artifact that lists every protocol with its content,
// sources, and signoff status. Surfaces gap-report metrics at the top.
// Intentionally read-only — signoff is captured in JSON files by editing
// reviewedBy + reviewedOn and re-running the build.

import { useMemo, useState } from 'react';
import { PROTOCOLS } from '../content/protocols';
import { buildGapReport, type GapReport } from '../content/gapReport';
import type { Protocol, BodySystem } from '../engine/triageEngine';
import { BODY_SYSTEMS } from '../engine/triageEngine';

const T = {
  bg0: '#070b18',
  bg1: '#0f1426',
  bg2: '#161c33',
  glass: 'rgba(255,255,255,0.04)',
  glassBr: 'rgba(255,255,255,0.08)',
  text: '#e7ecf5',
  textSoft: 'rgba(231,236,245,0.62)',
  textDim: 'rgba(231,236,245,0.42)',
  amber: '#fbbf24',
  cyan: '#22d3ee',
  rose: '#fb7185',
  emerald: '#34d399',
  violet: '#a78bfa',
};

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const DISPLAY = "'Space Grotesk', 'Inter', sans-serif";

export function ReviewPage() {
  const report = useMemo<GapReport>(() => buildGapReport(PROTOCOLS), []);
  const [systemFilter, setSystemFilter] = useState<BodySystem | 'all'>('all');

  const protocolsToShow =
    systemFilter === 'all'
      ? PROTOCOLS
      : PROTOCOLS.filter((p) => p.bodySystem === systemFilter);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: T.bg0,
        color: T.text,
        fontFamily: FONT,
        padding: '32px 24px 96px',
      }}
    >
      <Header />
      <GapReportSection report={report} />
      <FilterBar
        report={report}
        systemFilter={systemFilter}
        onChange={setSystemFilter}
      />
      <ProtocolList protocols={protocolsToShow} />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header style={{ maxWidth: 960, margin: '0 auto 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 700, letterSpacing: -0.2 }}>
            Tend — Reviewer Dashboard
          </div>
          <div style={{ marginTop: 6, color: T.textSoft, fontSize: 14, maxWidth: 640 }}>
            Audit page for medical reviewers. Every protocol below is read-only here — signoff is
            captured by editing the JSON files (<code>reviewedBy</code>, <code>reviewedOn</code>) and
            rebuilding.
          </div>
        </div>
        <a
          href="#"
          style={{
            padding: '10px 16px',
            borderRadius: 999,
            background: T.glass,
            border: `1px solid ${T.glassBr}`,
            color: T.text,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ← Back to Tend
        </a>
      </div>
    </header>
  );
}

function GapReportSection({ report }: { report: GapReport }) {
  return (
    <section
      style={{
        maxWidth: 960,
        margin: '0 auto 32px',
        padding: 20,
        background: T.bg1,
        border: `1px solid ${T.glassBr}`,
        borderRadius: 16,
      }}
    >
      <SectionTitle>Coverage at a glance</SectionTitle>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginTop: 12,
        }}
      >
        <Stat label="Protocols" value={report.protocolCount.toString()} accent={T.cyan} />
        <Stat
          label="Reviewed"
          value={`${report.reviewStatus.reviewed} / ${report.protocolCount}`}
          accent={report.reviewStatus.reviewed === report.protocolCount ? T.emerald : T.amber}
        />
        <Stat
          label="Sources with URL"
          value={`${report.sources.withUrl} / ${report.sources.total}`}
          accent={report.sources.withoutUrl === 0 ? T.emerald : T.amber}
        />
        <Stat
          label="Thin categories"
          value={report.thinSystems.length.toString()}
          accent={report.thinSystems.length === 0 ? T.emerald : T.rose}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, color: T.textSoft, marginBottom: 8 }}>By body system</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {report.bySystem.map((b) => (
            <BodySystemBar key={b.id} entry={b} max={Math.max(...report.bySystem.map((x) => x.count))} />
          ))}
        </div>
      </div>

      {report.thinSystems.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: 'rgba(251,113,133,0.08)',
            border: `1px solid rgba(251,113,133,0.25)`,
            borderRadius: 10,
            fontSize: 13,
            color: T.text,
          }}
        >
          <strong style={{ color: T.rose }}>Coverage gap:</strong>{' '}
          {report.thinSystems.map((s) => s.label).join(', ')} — fewer than 3 protocols each. Consider
          authoring more, with sources, when reviewers identify common scenarios.
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: 16,
        background: T.bg2,
        border: `1px solid ${T.glassBr}`,
        borderRadius: 12,
      }}
    >
      <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: T.textSoft, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function BodySystemBar({ entry, max }: { entry: { id: string; label: string; count: number }; max: number }) {
  const pct = max === 0 ? 0 : (entry.count / max) * 100;
  const thin = entry.count < 3;
  return (
    <div style={{ padding: 10, background: T.bg2, borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: T.text }}>{entry.label}</span>
        <span style={{ color: thin ? T.rose : T.textSoft, fontWeight: 600 }}>{entry.count}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: thin ? T.rose : T.cyan,
            transition: 'width 200ms ease',
          }}
        />
      </div>
    </div>
  );
}

function FilterBar({
  report,
  systemFilter,
  onChange,
}: {
  report: GapReport;
  systemFilter: BodySystem | 'all';
  onChange: (v: BodySystem | 'all') => void;
}) {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: '0 auto 16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <FilterChip
        active={systemFilter === 'all'}
        onClick={() => onChange('all')}
        label={`All (${report.protocolCount})`}
      />
      {BODY_SYSTEMS.map((sys) => {
        const count = report.bySystem.find((b) => b.id === sys.id)?.count ?? 0;
        return (
          <FilterChip
            key={sys.id}
            active={systemFilter === sys.id}
            onClick={() => onChange(sys.id)}
            label={`${sys.label} (${count})`}
          />
        );
      })}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? T.cyan : T.glassBr}`,
        background: active ? 'rgba(34,211,238,0.12)' : T.glass,
        color: active ? T.cyan : T.text,
        fontSize: 12,
        fontFamily: FONT,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function ProtocolList({ protocols }: { protocols: Protocol[] }) {
  return (
    <section style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 12 }}>
      {protocols.map((p) => (
        <ProtocolCard key={p.id} protocol={p} />
      ))}
    </section>
  );
}

function ProtocolCard({ protocol }: { protocol: Protocol }) {
  const [open, setOpen] = useState(false);
  const reviewed = protocol.reviewedBy != null && protocol.reviewedBy.trim() !== '';
  const sourcesMissingUrl = protocol.sources.filter((s) => !s.url || s.url.trim() === '').length;

  return (
    <article
      style={{
        background: T.bg1,
        border: `1px solid ${T.glassBr}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <header
        onClick={() => setOpen((v) => !v)}
        style={{ padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}
      >
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge reviewed={reviewed} />
            <span style={{ fontSize: 11, color: T.textDim, fontFamily: 'ui-monospace, monospace' }}>
              {protocol.id}
            </span>
            <span style={{ fontSize: 11, color: T.textSoft }}>· {protocol.bodySystem}</span>
            {sourcesMissingUrl > 0 && (
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(251,191,36,0.12)',
                  color: T.amber,
                  border: '1px solid rgba(251,191,36,0.3)',
                }}
              >
                {sourcesMissingUrl} source{sourcesMissingUrl > 1 ? 's' : ''} need URL
              </span>
            )}
          </div>
          <h3 style={{ margin: '6px 0 4px', fontFamily: DISPLAY, fontSize: 18, fontWeight: 600 }}>
            {protocol.title}
          </h3>
          <p style={{ margin: 0, color: T.textSoft, fontSize: 13 }}>{protocol.summary}</p>
        </div>
        <button
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            border: `1px solid ${T.glassBr}`,
            background: T.glass,
            color: T.text,
            fontSize: 12,
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      </header>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${T.glassBr}` }}>
          <Block title="Steps (DO)" items={protocol.steps} accent={T.emerald} ordered />
          <Block title="Avoid (DON'T)" items={protocol.avoid} accent={T.rose} />
          <Block title="When to escalate" items={protocol.whenToEscalate} accent={T.amber} />

          <div style={{ marginTop: 14 }}>
            <Label>Specialty</Label>
            <div style={{ fontSize: 13, color: T.text }}>{protocol.specialty}</div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Label>Sources</Label>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: T.text }}>
              {protocol.sources.map((s, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: T.cyan, textDecoration: 'underline' }}
                    >
                      {s.title}
                    </a>
                  ) : (
                    <span>
                      {s.title}{' '}
                      <span style={{ color: T.amber, fontSize: 11 }}>(no URL)</span>
                    </span>
                  )}
                  {s.accessedOn && (
                    <span style={{ marginLeft: 6, color: T.textDim, fontSize: 11 }}>
                      accessed {s.accessedOn}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: T.textSoft }}>
            <Label>Review status</Label>
            {reviewed ? (
              <span>
                Reviewed by <strong style={{ color: T.text }}>{protocol.reviewedBy}</strong>
                {protocol.reviewedOn ? ` on ${protocol.reviewedOn}` : ''}
              </span>
            ) : (
              <span>
                Not yet reviewed. To sign off, edit{' '}
                <code>src/content/protocols/{protocol.id}.json</code> and set{' '}
                <code>reviewedBy</code> + <code>reviewedOn</code> (ISO date).
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function StatusBadge({ reviewed }: { reviewed: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 999,
        background: reviewed ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)',
        color: reviewed ? T.emerald : T.rose,
        border: `1px solid ${reviewed ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}`,
        fontWeight: 600,
      }}
    >
      {reviewed ? 'Reviewed' : 'Unreviewed'}
    </span>
  );
}

function Block({
  title,
  items,
  accent,
  ordered = false,
}: {
  title: string;
  items: string[];
  accent: string;
  ordered?: boolean;
}) {
  if (items.length === 0) return null;
  const ListTag = ordered ? 'ol' : 'ul';
  return (
    <div style={{ marginTop: 14 }}>
      <Label color={accent}>{title}</Label>
      <ListTag style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: T.text, lineHeight: 1.55 }}>
        {items.map((s, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {s}
          </li>
        ))}
      </ListTag>
    </div>
  );
}

function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        color: color ?? T.textSoft,
        marginBottom: 6,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 18, fontWeight: 600 }}>{children}</h2>
  );
}

function Footer() {
  return (
    <footer
      style={{
        maxWidth: 960,
        margin: '48px auto 0',
        textAlign: 'center',
        fontSize: 11,
        color: T.textDim,
      }}
    >
      Tend reviewer dashboard · read-only · sign off by editing{' '}
      <code>src/content/protocols/&lt;id&gt;.json</code>
    </footer>
  );
}
