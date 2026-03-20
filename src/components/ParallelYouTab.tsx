import { useState, useCallback } from 'react';
import { ModelCategory } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';

interface DecisionMetrics {
  career: number;
  finance: number;
  stress: number;
  regret: number;
  discipline_required: number;
}

interface Probability {
  success: string;
  failure: string;
}

interface OptionResult {
  timeline: string[];
  outcome: string;
  metrics: DecisionMetrics;
  probability: Probability;
}

interface DecisionEngine {
  winner: 'A' | 'B';
  confidence_score: string;
  key_driver: string;
  hidden_cost: string;
  long_term_multiplier: string;
}

interface BehaviorModel {
  pattern_detected: string;
  future_identity_shift: string;
}

interface FutureEcho {
  A: string;
  B: string;
}

interface SimulationResult {
  simulation_id: string;
  optionA: OptionResult;
  optionB: OptionResult;
  decision_engine: DecisionEngine;
  behavior_model: BehaviorModel;
  future_echo: FutureEcho;
  insight: string;
}

export function ParallelYouTab() {
  const llmLoader = useModelLoader(ModelCategory.Language);
  const [state, setState] = useState('');
  const [goal, setGoal] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (!state.trim() || !goal.trim() || !optionA.trim() || !optionB.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (llmLoader.state !== 'ready') {
      const ok = await llmLoader.ensure();
      if (!ok) return;
    }

    setAnalyzing(true);
    setError(null);
    setResult(null);

    const systemPrompt = `You are a decision analyzer. Answer concisely and directly.`;

    // Instead of trying to get perfect JSON, let's generate it step by step
    const prompt = `Analyze this decision:

Situation: ${state}
Goal: ${goal}
Option A: ${optionA}
Option B: ${optionB}

Answer these questions briefly:

1. Option A - Year 1 outcome (max 8 words):
2. Option A - Year 2 outcome (max 8 words):
3. Option A - Year 3 outcome (max 8 words):
4. Option A - Final result:
5. Option A - Career score 0-10:
6. Option A - Finance score 0-10:
7. Option A - Stress score 0-10:
8. Option A - Success probability %:

9. Option B - Year 1 outcome (max 8 words):
10. Option B - Year 2 outcome (max 8 words):
11. Option B - Year 3 outcome (max 8 words):
12. Option B - Final result:
13. Option B - Career score 0-10:
14. Option B - Finance score 0-10:
15. Option B - Stress score 0-10:
16. Option B - Success probability %:

17. Which is better (A or B)?:
18. Why (one sentence)?:
19. One brutal insight (max 10 words):`;

    try {
      const response = await TextGeneration.generate(prompt, {
        maxTokens: 800,
        temperature: 0.7,
        systemPrompt,
      });

      const text = response.text.trim();
      
      console.log('=== RAW RESPONSE ===');
      console.log(text);
      console.log('===================');
      
      // Parse the Q&A format into JSON
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      
      const extractAnswer = (questionNum: number): string => {
        const line = lines.find(l => l.startsWith(`${questionNum}.`));
        if (!line) return '';
        const match = line.match(/^\d+\.\s*(?:.*?:)?\s*(.+)$/);
        return match ? match[1].trim() : '';
      };
      
      const extractNumber = (questionNum: number): number => {
        const answer = extractAnswer(questionNum);
        const num = parseInt(answer.replace(/\D/g, ''));
        return isNaN(num) ? 5 : Math.max(0, Math.min(10, num));
      };
      
      const extractPercent = (questionNum: number): string => {
        const answer = extractAnswer(questionNum);
        const match = answer.match(/(\d+)/);
        return match ? `${match[1]}%` : '50%';
      };
      
      // Build the result object
      const aSuccess = parseInt(extractPercent(8).replace('%', ''));
      const bSuccess = parseInt(extractPercent(16).replace('%', ''));
      
      const winner = extractAnswer(17).toUpperCase().includes('B') ? 'B' : 'A';
      
      const parsed: SimulationResult = {
        simulation_id: 'sim-' + Date.now(),
        optionA: {
          timeline: [
            `Year 1: ${extractAnswer(1)}`,
            `Year 2: ${extractAnswer(2)}`,
            `Year 3: ${extractAnswer(3)}`
          ],
          outcome: extractAnswer(4) || 'Outcome depends on execution',
          metrics: {
            career: extractNumber(5),
            finance: extractNumber(6),
            stress: extractNumber(7),
            regret: Math.max(0, 10 - extractNumber(5)),
            discipline_required: 7
          },
          probability: {
            success: extractPercent(8),
            failure: `${100 - aSuccess}%`
          }
        },
        optionB: {
          timeline: [
            `Year 1: ${extractAnswer(9)}`,
            `Year 2: ${extractAnswer(10)}`,
            `Year 3: ${extractAnswer(11)}`
          ],
          outcome: extractAnswer(12) || 'Outcome depends on execution',
          metrics: {
            career: extractNumber(13),
            finance: extractNumber(14),
            stress: extractNumber(15),
            regret: Math.max(0, 10 - extractNumber(13)),
            discipline_required: 6
          },
          probability: {
            success: extractPercent(16),
            failure: `${100 - bSuccess}%`
          }
        },
        decision_engine: {
          winner: winner as 'A' | 'B',
          confidence_score: Math.abs(aSuccess - bSuccess) > 20 ? '80%' : '65%',
          key_driver: extractAnswer(18) || 'Multiple factors influence outcome',
          hidden_cost: winner === 'A' ? 'Less financial upside potential' : 'Higher uncertainty and stress',
          long_term_multiplier: 'Consistency compounds over time'
        },
        behavior_model: {
          pattern_detected: 'Balanced',
          future_identity_shift: winner === 'A' ? 'Gradual, stable growth' : 'Rapid transformation with volatility'
        },
        future_echo: {
          A: 'I chose stability and it paid off steadily',
          B: 'I took the risk and learned invaluable lessons'
        },
        insight: extractAnswer(19) || 'Every choice has trade-offs'
      };
      
      console.log('=== PARSED RESULT ===');
      console.log(parsed);
      console.log('====================');
      
      setResult(parsed);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to analyze decision';
      setError(errorMsg);
      console.error('=== ERROR ===');
      console.error(err);
      console.error('=============');
    } finally {
      setAnalyzing(false);
    }
  }, [state, goal, optionA, optionB, llmLoader]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const getMetricColor = (value: number) => {
    if (value >= 7) return '#22C55E';
    if (value >= 4) return '#F59E0B';
    return '#EF4444';
  };

  if (result) {
    return (
      <div className="tab-panel parallel-panel">
        <div className="parallel-header">
          <h2>🔮 ParallelYou-X</h2>
          <p className="parallel-subtitle">Decision Intelligence Report</p>
          <span className="sim-id">Simulation ID: {result.simulation_id}</span>
        </div>

        <div className="results-scroll">
          {/* Insight Banner */}
          <div className="insight-banner">
            <span className="insight-icon">⚡</span>
            <p className="insight-text">{result.insight}</p>
          </div>

          {/* Decision Engine */}
          <div className="engine-card">
            <h3>🎯 Decision Engine</h3>
            <div className="engine-grid">
              <div className="engine-item">
                <span className="engine-label">Recommended</span>
                <span className="engine-value winner">Option {result.decision_engine.winner}</span>
              </div>
              <div className="engine-item">
                <span className="engine-label">Confidence</span>
                <span className="engine-value">{result.decision_engine.confidence_score}</span>
              </div>
            </div>
            <div className="engine-insights">
              <div className="engine-insight">
                <strong>Key Driver:</strong>
                <p>{result.decision_engine.key_driver}</p>
              </div>
              <div className="engine-insight">
                <strong>Hidden Cost:</strong>
                <p>{result.decision_engine.hidden_cost}</p>
              </div>
              <div className="engine-insight">
                <strong>Time Multiplier:</strong>
                <p>{result.decision_engine.long_term_multiplier}</p>
              </div>
            </div>
          </div>

          {/* Options Comparison */}
          <div className="options-grid">
            {/* Option A */}
            <div className="option-card">
              <div className="option-header">
                <h3>Option A</h3>
                {result.decision_engine.winner === 'A' && (
                  <span className="winner-badge">✓ Winner</span>
                )}
              </div>
              <p className="option-desc">{optionA}</p>

              <div className="timeline-section">
                <h4>3-Year Timeline</h4>
                {result.optionA.timeline.map((point, i) => (
                  <div key={i} className="timeline-item">
                    <span className="timeline-num">{i + 1}</span>
                    <p>{point}</p>
                  </div>
                ))}
              </div>

              <div className="outcome-box">
                <strong>Final Outcome</strong>
                <p>{result.optionA.outcome}</p>
              </div>

              <div className="metrics-grid">
                <div className="metric-item">
                  <span className="metric-label">Career Growth</span>
                  <div className="metric-bar">
                    <div 
                      className="metric-fill" 
                      style={{ 
                        width: `${result.optionA.metrics.career * 10}%`,
                        backgroundColor: getMetricColor(result.optionA.metrics.career)
                      }}
                    />
                  </div>
                  <span className="metric-value">{result.optionA.metrics.career}/10</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Financial Gain</span>
                  <div className="metric-bar">
                    <div 
                      className="metric-fill" 
                      style={{ 
                        width: `${result.optionA.metrics.finance * 10}%`,
                        backgroundColor: getMetricColor(result.optionA.metrics.finance)
                      }}
                    />
                  </div>
                  <span className="metric-value">{result.optionA.metrics.finance}/10</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Stress Level</span>
                  <div className="metric-bar">
                    <div 
                      className="metric-fill" 
                      style={{ 
                        width: `${result.optionA.metrics.stress * 10}%`,
                        backgroundColor: getMetricColor(10 - result.optionA.metrics.stress)
                      }}
                    />
                  </div>
                  <span className="metric-value">{result.optionA.metrics.stress}/10</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Future Regret</span>
                  <div className="metric-bar">
                    <div 
                      className="metric-fill" 
                      style={{ 
                        width: `${result.optionA.metrics.regret * 10}%`,
                        backgroundColor: getMetricColor(10 - result.optionA.metrics.regret)
                      }}
                    />
                  </div>
                  <span className="metric-value">{result.optionA.metrics.regret}/10</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Discipline Needed</span>
                  <div className="metric-bar">
                    <div 
                      className="metric-fill" 
                      style={{ 
                        width: `${result.optionA.metrics.discipline_required * 10}%`,
                        backgroundColor: '#94A3B8'
                      }}
                    />
                  </div>
                  <span className="metric-value">{result.optionA.metrics.discipline_required}/10</span>
                </div>
              </div>

              <div className="probability-box">
                <div className="prob-item success">
                  <span className="prob-label">Success</span>
                  <span className="prob-value">{result.optionA.probability.success}</span>
                </div>
                <div className="prob-item failure">
                  <span className="prob-label">Failure</span>
                  <span className="prob-value">{result.optionA.probability.failure}</span>
                </div>
              </div>

              <div className="future-echo-box">
                <strong>🔮 Future You Says:</strong>
                <p>{result.future_echo.A}</p>
              </div>
            </div>

            {/* Option B */}
            <div className="option-card">
              <div className="option-header">
                <h3>Option B</h3>
                {result.decision_engine.winner === 'B' && (
                  <span className="winner-badge">✓ Winner</span>
                )}
              </div>
              <p className="option-desc">{optionB}</p>

              <div className="timeline-section">
                <h4>3-Year Timeline</h4>
                {result.optionB.timeline.map((point, i) => (
                  <div key={i} className="timeline-item">
                    <span className="timeline-num">{i + 1}</span>
                    <p>{point}</p>
                  </div>
                ))}
              </div>

              <div className="outcome-box">
                <strong>Final Outcome</strong>
                <p>{result.optionB.outcome}</p>
              </div>

              <div className="metrics-grid">
                <div className="metric-item">
                  <span className="metric-label">Career Growth</span>
                  <div className="metric-bar">
                    <div 
                      className="metric-fill" 
                      style={{ 
                        width: `${result.optionB.metrics.career * 10}%`,
                        backgroundColor: getMetricColor(result.optionB.metrics.career)
                      }}
                    />
                  </div>
                  <span className="metric-value">{result.optionB.metrics.career}/10</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Financial Gain</span>
                  <div className="metric-bar">
                    <div 
                      className="metric-fill" 
                      style={{ 
                        width: `${result.optionB.metrics.finance * 10}%`,
                        backgroundColor: getMetricColor(result.optionB.metrics.finance)
                      }}
                    />
                  </div>
                  <span className="metric-value">{result.optionB.metrics.finance}/10</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Stress Level</span>
                  <div className="metric-bar">
                    <div 
                      className="metric-fill" 
                      style={{ 
                        width: `${result.optionB.metrics.stress * 10}%`,
                        backgroundColor: getMetricColor(10 - result.optionB.metrics.stress)
                      }}
                    />
                  </div>
                  <span className="metric-value">{result.optionB.metrics.stress}/10</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Future Regret</span>
                  <div className="metric-bar">
                    <div 
                      className="metric-fill" 
                      style={{ 
                        width: `${result.optionB.metrics.regret * 10}%`,
                        backgroundColor: getMetricColor(10 - result.optionB.metrics.regret)
                      }}
                    />
                  </div>
                  <span className="metric-value">{result.optionB.metrics.regret}/10</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Discipline Needed</span>
                  <div className="metric-bar">
                    <div 
                      className="metric-fill" 
                      style={{ 
                        width: `${result.optionB.metrics.discipline_required * 10}%`,
                        backgroundColor: '#94A3B8'
                      }}
                    />
                  </div>
                  <span className="metric-value">{result.optionB.metrics.discipline_required}/10</span>
                </div>
              </div>

              <div className="probability-box">
                <div className="prob-item success">
                  <span className="prob-label">Success</span>
                  <span className="prob-value">{result.optionB.probability.success}</span>
                </div>
                <div className="prob-item failure">
                  <span className="prob-label">Failure</span>
                  <span className="prob-value">{result.optionB.probability.failure}</span>
                </div>
              </div>

              <div className="future-echo-box">
                <strong>🔮 Future You Says:</strong>
                <p>{result.future_echo.B}</p>
              </div>
            </div>
          </div>

          {/* Behavior Model */}
          <div className="behavior-card">
            <h3>🧠 Behavioral Analysis</h3>
            <div className="behavior-grid">
              <div className="behavior-item">
                <strong>Pattern Detected:</strong>
                <p>{result.behavior_model.pattern_detected}</p>
              </div>
              <div className="behavior-item">
                <strong>Identity Shift:</strong>
                <p>{result.behavior_model.future_identity_shift}</p>
              </div>
            </div>
          </div>

          <button className="btn btn-primary btn-lg" onClick={reset}>
            ← Analyze Another Decision
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-panel parallel-panel">
      <ModelBanner
        state={llmLoader.state}
        progress={llmLoader.progress}
        error={llmLoader.error}
        onLoad={llmLoader.ensure}
        label="LLM"
      />

      <div className="parallel-header">
        <h2>🔮 ParallelYou-X</h2>
        <p className="parallel-subtitle">High-Performance Decision Intelligence Engine</p>
        <p className="parallel-desc">
          Simulate realistic futures using behavioral modeling and probabilistic reasoning
        </p>
      </div>

      {error && (
        <div className="error-box">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      <div className="input-form">
        <div className="input-group">
          <label>Current Situation</label>
          <textarea
            placeholder="e.g., I'm 25, software engineer at startup, $80k/year, $20k saved"
            value={state}
            onChange={(e) => setState(e.target.value)}
            rows={3}
            disabled={analyzing}
          />
        </div>

        <div className="input-group">
          <label>Your Goal</label>
          <input
            type="text"
            placeholder="e.g., Financial independence by 35"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={analyzing}
          />
        </div>

        <div className="options-input">
          <div className="input-group">
            <label>Option A</label>
            <textarea
              placeholder="e.g., Stay at job, work toward promotion, save 40% income"
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              rows={3}
              disabled={analyzing}
            />
          </div>

          <div className="input-group">
            <label>Option B</label>
            <textarea
              placeholder="e.g., Quit and start SaaS company, bootstrap with savings"
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              rows={3}
              disabled={analyzing}
            />
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg"
          onClick={analyze}
          disabled={analyzing || !state.trim() || !goal.trim() || !optionA.trim() || !optionB.trim()}
        >
          {analyzing ? '⚡ Computing Futures...' : '🔮 Run Simulation'}
        </button>

        <div className="examples">
          <h4>Quick Examples</h4>
          <div className="examples-list">
            <button
              className="example-btn"
              onClick={() => {
                setState("28 years old, product manager, remote work, $90k salary, $50k saved, single");
                setGoal('Maximize life experiences and career growth');
                setOptionA('Stay in current city, focus on promotions, build career steadily');
                setOptionB('Move to Bali, go nomad, freelance for 2 years while traveling');
              }}
            >
              <span>🌏</span>
              <div>
                <strong>Career vs Travel</strong>
                <p>Stability or adventure?</p>
              </div>
            </button>

            <button
              className="example-btn"
              onClick={() => {
                setState("32, married, $150k combined income, renting $2k/month apartment");
                setGoal('Build wealth and long-term financial security');
                setOptionA('Buy house with 20% down payment ($80k), monthly mortgage $3200');
                setOptionB('Keep renting, invest $80k in index funds, DCA monthly');
              }}
            >
              <span>🏠</span>
              <div>
                <strong>Buy vs Rent</strong>
                <p>Home ownership or flexibility?</p>
              </div>
            </button>

            <button
              className="example-btn"
              onClick={() => {
                setState("23, just graduated CS, two job offers on table");
                setGoal('Maximize career trajectory and earnings potential');
                setOptionA('Google: $130k salary, stable, great benefits, structured growth');
                setOptionB('Y Combinator startup: $95k + 1% equity, chaos, high learning');
              }}
            >
              <span>💼</span>
              <div>
                <strong>Big Tech vs Startup</strong>
                <p>Safety or upside?</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
