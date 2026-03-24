import { ParallelYouTab } from './components/ParallelYouTab';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DownloadAllModels } from './components/DownloadAllModels';

export function App() {
  return (
    <>
      {/* Global offline toast — always visible regardless of active tab */}
      <OfflineIndicator />

      {/* Download All Models button — fixed top-right corner */}
      <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 500 }}>
        <DownloadAllModels />
      </div>

      <ParallelYouTab />
    </>
  );
}

