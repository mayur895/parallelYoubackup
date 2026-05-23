import { useEffect, useState } from 'react';
import { TendTab } from './components/TendTab';
import { ReviewPage } from './components/ReviewPage';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DownloadAllModels } from './components/DownloadAllModels';

function getRoute(): 'tend' | 'review' {
  if (typeof window === 'undefined') return 'tend';
  return window.location.hash === '#review' ? 'review' : 'tend';
}

export function App() {
  const [route, setRoute] = useState<'tend' | 'review'>(getRoute);

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (route === 'review') {
    return <ReviewPage />;
  }

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
