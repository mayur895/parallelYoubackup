import { useState, useEffect } from 'react';

type NetworkStatus = 'online' | 'offline';

export function OfflineIndicator() {
  const [status, setStatus] = useState<NetworkStatus>(
    navigator.onLine ? 'online' : 'offline'
  );
  const [visible, setVisible] = useState(!navigator.onLine);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;

    const handleOnline = () => {
      setStatus('online');
      setVisible(true);
      // Show the "back online" badge briefly then hide
      hideTimer = setTimeout(() => setVisible(false), 3000);
    };

    const handleOffline = () => {
      setStatus('offline');
      setVisible(true);
      // Keep visible while offline
      clearTimeout(hideTimer);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  const isOnline = status === 'online';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1.25rem',
          borderRadius: '999px',
          border: `1px solid ${isOnline ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          background: isOnline
            ? 'rgba(21,128,61,0.25)'
            : 'rgba(153,27,27,0.35)',
          backdropFilter: 'blur(12px)',
          color: '#fff',
          fontSize: '0.85rem',
          fontWeight: 600,
          boxShadow: `0 4px 24px ${isOnline ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.25)'}`,
          transition: 'all 0.3s ease',
        }}
      >
        {/* Pulse dot */}
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isOnline ? '#22c55e' : '#ef4444',
            display: 'inline-block',
            animation: isOnline ? 'none' : 'pulse-dot 1.5s infinite',
          }}
        />
        {isOnline ? '✓ Back Online' : '⚡ Offline Mode — AI runs locally'}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
