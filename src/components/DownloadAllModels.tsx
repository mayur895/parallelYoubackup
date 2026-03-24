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
  { id: 'lfm2-350m-q4_k_m', name: 'LFM2 350M — Chat LLM', size: '~250 MB' },
];

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

    // Init statuses
    setStatuses(
      MODEL_LIST.map((m) => ({
        id: m.id,
        name: m.name,
        progress: 0,
        status: 'pending',
      }))
    );

    // Make sure SDK is initialized
    await initSDK();

    for (const model of MODEL_LIST) {
      // Check if already downloaded
      const models = ModelManager.getModels();
      const found = models.find((m) => m.id === model.id);
      if (found && (found.status === 'downloaded' || found.status === 'loaded')) {
        updateStatus(model.id, { status: 'done', progress: 1 });
        continue;
      }

      updateStatus(model.id, { status: 'downloading', progress: 0 });

      const unsub = EventBus.shared.on('model.downloadProgress', (evt: any) => {
        if (evt.modelId === model.id) {
          updateStatus(model.id, { progress: evt.progress ?? 0 });
        }
      });

      try {
        await ModelManager.downloadModel(model.id);
        updateStatus(model.id, { status: 'done', progress: 1 });
      } catch (err) {
        updateStatus(model.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Download failed',
        });
      } finally {
        unsub();
      }
    }

    setRunning(false);
    setDone(true);
  }, []);

  const allDone = statuses.length > 0 && statuses.every((s) => s.status === 'done');

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={startDownload}
        disabled={running}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1.4rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(124, 58, 237, 0.5)',
          background: running
            ? 'rgba(124, 58, 237, 0.15)'
            : 'rgba(124, 58, 237, 0.25)',
          color: '#c4b5fd',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: running ? 'not-allowed' : 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s',
        }}
      >
        {allDone ? '✅ All Models Cached' : running ? '⬇️ Downloading...' : '⬇️ Download All Models'}
      </button>

      {/* Drawer */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => {
            if (!running && e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '1.5rem 1.5rem 0 0',
              padding: '2rem',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.25rem' }}>
                  📦 Download All Models
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                  {done ? 'All done! Models are cached locally — works offline forever.' : 'Cached in browser storage (OPFS). One-time download needed.'}
                </p>
              </div>
              {!running && (
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '0.5rem', color: '#9ca3af', padding: '0.4rem 0.8rem', cursor: 'pointer' }}
                >
                  ✕
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
                      borderRadius: '0.75rem',
                      padding: '0.75rem 1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 500 }}>{model.name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{model.size}</span>
                    </div>

                    {/* Progress bar */}
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          borderRadius: '999px',
                          width: `${pct}%`,
                          background: st?.status === 'done'
                            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                            : st?.status === 'error'
                            ? '#ef4444'
                            : 'linear-gradient(90deg, #7c3aed, #2563eb)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>

                    <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: st?.status === 'error' ? '#f87171' : '#6b7280' }}>
                      {st?.status === 'done' && '✓ Cached'}
                      {st?.status === 'error' && `⚠ ${st.error}`}
                      {st?.status === 'downloading' && `${pct}%`}
                      {st?.status === 'pending' && 'Waiting...'}
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
                  marginTop: '1.5rem',
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: 'linear-gradient(90deg, #7c3aed, #2563eb)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                🚀 Ready — Use App Offline
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
