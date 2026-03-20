import { useState, useEffect } from 'react';
import { initSDK, getAccelerationMode } from './runanywhere';
import { ParallelYouTab } from './components/ParallelYouTab';
import { ChatTab } from './components/ChatTab';
import { VisionTab } from './components/VisionTab';
import { VoiceTab } from './components/VoiceTab';
import { ToolsTab } from './components/ToolsTab';

type Tab = 'parallel' | 'chat' | 'vision' | 'voice' | 'tools';

export function App() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('parallel');

  useEffect(() => {
    initSDK()
      .then(() => setSdkReady(true))
      .catch((err) => setSdkError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (sdkError) {
    return (
      <div className="app-loading">
        <h2>SDK Error</h2>
        <p className="error-text">{sdkError}</p>
      </div>
    );
  }

  if (!sdkReady) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <h2>Loading RunAnywhere SDK...</h2>
        <p>Initializing on-device AI engine</p>
      </div>
    );
  }

  const accel = getAccelerationMode();

  return (
    <div className="app">
      <header className="app-header">
        <h1>RunAnywhere AI</h1>
        {accel && <span className="badge">{accel === 'webgpu' ? 'WebGPU' : 'CPU'}</span>}
      </header>

      <nav className="tab-bar">
        <button className={activeTab === 'parallel' ? 'active' : ''} onClick={() => setActiveTab('parallel')}>
          🔮 ParallelYou
        </button>
        <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>
          💬 Chat
        </button>
        <button className={activeTab === 'vision' ? 'active' : ''} onClick={() => setActiveTab('vision')}>
          📷 Vision
        </button>
        <button className={activeTab === 'voice' ? 'active' : ''} onClick={() => setActiveTab('voice')}>
          🎙️ Voice
        </button>
        <button className={activeTab === 'tools' ? 'active' : ''} onClick={() => setActiveTab('tools')}>
          🔧 Tools
        </button>
      </nav>

      <main className="tab-content">
        {activeTab === 'parallel' && <ParallelYouTab />}
        {activeTab === 'chat' && <ChatTab />}
        {activeTab === 'vision' && <VisionTab />}
        {activeTab === 'voice' && <VoiceTab />}
        {activeTab === 'tools' && <ToolsTab />}
      </main>
    </div>
  );
}
