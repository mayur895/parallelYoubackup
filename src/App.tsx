import { TendTab } from './components/TendTab';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DownloadAllModels } from './components/DownloadAllModels';

export function App() {
  return (
    <>
      {/* Global offline toast — always visible regardless of phase */}
      <OfflineIndicator />

      {/* Prefetch the on-device model so the app works without any network */}
      <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 500 }}>
        <DownloadAllModels />
      </div>

      <TendTab />
    </>
  );
}
