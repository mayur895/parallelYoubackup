import { useState, useCallback } from 'react';
import { ModelManager } from '@runanywhere/web';
import { EventBus } from '@runanywhere/web';
import { initSDK } from '../runanywhere';

interface DownloadStatus {
  id: string;
  name: string;
  progress: number; // 0–1
  status: 'pending' | 'downloading' | 'done' | 'error';
  error?: string;
}

const MODEL_LIST = [
  { id: 'lfm2-350m-q4_k_m', name: 'LFM2 350M · Language model', size: '~250 MB' },
];

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const DISPLAY = "'Space Grotesk', 'Inter', sans-serif";

export function DownloadAllModels() {
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<DownloadStatus[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const updateStatus = (id: string, patch: Partial<DownloadStatus>) =>
    setStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );

  const startDownload = useCallback(async () => {
    setOpen(true);
    setRunning(true);
    setDone(false);
    setStatuses(MODEL_LIST.map((m) => ({
      id: m.id, name: m.name, progress: 0, status: 'pending',
    })));

    await initSDK();

    for (const model of MODEL_LIST) {
      const models = ModelManager.getModels();
      const found = models.find((m) => m.id === model.id);
      if (found && (found.status === 'downloaded' || found.status === 'loaded')) {
        updateStatus(model.id, { status: 'done', progress: 1 });
        continue;
      }
      updateStatus(model.id, { status: 'downloading', progress: 0 });
      const unsub = EventBus.shared.on('model.downloadProgress', (evt: any) => {
        if (evt.modelId === model.id) updateStatus(model.id, { progress: evt.progress ?? 0 });
      });
      try {
        await ModelManager.downloadModel(model.id);
        updateStatus(model.id, { status: 'done', progress: 1 });
      } catch (err) {
        updateStatus(model.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Download failed',
        });
      } finally { unsub(); }
    }

    setRunning(false);
    setDone(true);
  }, []);

  const allDone = statuses.length > 0 && statuses.every((s) => s.status === 'done');

  return (
    <>
      <button
        onClick={startDownload}
        disabled={running}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 1rem', borderRadius: '0.75rem',
          border: `1px solid ${allDone ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.12)'}`,
          background: allDone
            ? 'rgba(52,211,153,0.12)'
            : 'rgba(255,255,255,0.06)',
          color: allDone ? '#34d399' : running ? '#94a3b8' : '#f1f5f9',
          fontSize: '0.8rem',
          fontWeight: 700,
          cursor: running ? 'not-allowed' : 'pointer',
          fontFamily: DISPLAY,
          letterSpacing: '-0.01em',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
          transition: 'all 0.15s',
        }}
      >
        {allDone ? '✓ Offline ready' : running ? 'Downloading…' : 'Prepare offline use'}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(7,11,24,0.7)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={(e) => { if (!running && e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            style={{
              width: '100%', maxWidth: '500px',
              background: 'linear-gradient(180deg, rgba(15,20,38,0.95), rgba(7,11,24,0.95))',
              border: '1px solid rgba(255,255,255,0.08)',
              borderTop: '1px solid rgba(251,191,36,0.4)',
              borderRadius: '22px 22px 0 0',
              padding: '24px',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
              fontFamily: FONT,
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#fbbf24',
                  letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4,
                }}>Offline pack</div>
                <h2 style={{
                  fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9',
                  fontFamily: DISPLAY, letterSpacing: '-0.01em',
                }}>
                  Prepare Tend for offline use
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.55, marginTop: 6 }}>
                  {done
                    ? 'Cached on this device. Tend will work without internet from now on.'
                    : 'A one-time download into private browser storage. About 250 MB.'}
                </p>
              </div>
              {!running && (
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '0.5rem', color: '#cbd5e1',
                    padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.85rem',
                    fontFamily: DISPLAY,
                  }}
                >
                  Close
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {MODEL_LIST.map((model) => {
                const st = statuses.find((s) => s.id === model.id);
                const pct = Math.round((st?.progress ?? 0) * 100);
                return (
                  <div
                    key={model.id}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '0.875rem',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#f1f5f9', fontWeight: 600, fontFamily: DISPLAY }}>
                        {model.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{model.size}</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%', borderRadius: '999px', width: `${pct}%`,
                          background: st?.status === 'done'
                            ? 'linear-gradient(90deg, #34d399, #10b981)'
                            : st?.status === 'error'
                            ? '#fb7185'
                            : 'linear-gradient(90deg, #fbbf24, #f43f5e)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <div style={{
                      marginTop: '0.4rem', fontSize: '0.72rem',
                      color: st?.status === 'error' ? '#fb7185' : '#94a3b8',
                    }}>
                      {st?.status === 'done' && 'Cached on device'}
                      {st?.status === 'error' && st.error}
                      {st?.status === 'downloading' && `${pct}%`}
                      {st?.status === 'pending' && 'Waiting…'}
                      {!st && model.size}
                    </div>
                  </div>
                );
              })}
            </div>

            {done && (
              <button
                onClick={() => setOpen(false)}
                style={{
                  marginTop: '1.25rem', width: '100%', padding: '0.85rem',
                  borderRadius: '0.75rem', border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b, #f43f5e)',
                  color: '#fff', fontWeight: 700, cursor: 'pointer',
                  fontSize: '1rem', fontFamily: DISPLAY, letterSpacing: '-0.01em',
                  boxShadow: '0 12px 32px -10px #f59e0b',
                }}
              >
                Ready to use offline
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
