import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SimulationPath {
  title: string;
  year1: string;
  year5: string;
  year10: string;
  pros: string;
  cons: string;
  successRate: number;
  financialScore: number;
  happinessScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  timeInvestment: string;
  regretRisk: number;
  keyInsight: string;
}

interface SimulationResults {
  paths: SimulationPath[];
  recommendation: {
    winner: 'A' | 'B';
    reason: string;
    confidenceScore: number;
  };
  hiddenCosts: {
    pathA: string;
    pathB: string;
  };
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    },
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export function ParallelYouTab() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamText, setStreamText] = useState('');

  const generateSimulation = useCallback(async () => {
    if (!input.trim()) {
      setError('Please enter a decision or life choice');
      return;
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      setError('Please set your VITE_GEMINI_API_KEY in the .env file and restart the server.');
      return;
    }

    setSimulating(true);
    setError(null);
    setResults(null);
    setStreamText('Thinking...');

    const systemPrompt = `You are an advanced life decision analyzer. Your responses must be structured, data-driven, and realistic. Always reply in the exact numbered format requested.`;

    const prompt = `Analyze this life decision: "${input}"

Reply with numbered answers only (max 12 words per answer):

PATH A (Safe/Conservative):
1. Path A name:
2. Year 1 outcome:
3. Year 5 outcome:
4. Year 10 outcome:
5. Main pros:
6. Main cons:
7. Success rate (0-100):
8. Financial score (0-10):
9. Happiness score (0-10):
10. Risk level (Low/Medium/High):
11. Time investment needed:
12. Regret probability (0-100):
13. Key insight:

PATH B (Risky/Bold):
14. Path B name:
15. Year 1 outcome:
16. Year 5 outcome:
17. Year 10 outcome:
18. Main pros:
19. Main cons:
20. Success rate (0-100):
21. Financial score (0-10):
22. Happiness score (0-10):
23. Risk level (Low/Medium/High):
24. Time investment needed:
25. Regret probability (0-100):
26. Key insight:

OVERALL:
27. Better choice (A or B):
28. Why (one sentence):
29. Confidence (0-100):
30. Hidden cost Path A:
31. Hidden cost Path B:`;

    try {
      const text = await callGemini(prompt, systemPrompt);
      setStreamText('');

      console.log('=== RAW GEMINI RESPONSE ===');
      console.log(text);
      console.log('===========================');

      const lines = text.split('\n').map(l => l.trim()).filter(l => l);

      const extractAnswer = (questionNum: number): string => {
        const line = lines.find(l =>
          l.match(new RegExp(`^${questionNum}[\\.:\\)]`))
        );
        if (!line) return '';
        // Remove the number and label, get the value after the last colon
        const afterNum = line.replace(/^\d+[\.\:\)]\s*/, '');
        // If there's a colon (e.g. "Path A name: Steady Corporate Career"), grab after it
        const colonIdx = afterNum.indexOf(':');
        if (colonIdx !== -1) {
          return afterNum.slice(colonIdx + 1).trim();
        }
        return afterNum.trim();
      };

      const extractNumber = (questionNum: number, defaultVal: number): number => {
        const answer = extractAnswer(questionNum);
        const num = parseInt(answer.replace(/\D/g, ''));
        return isNaN(num) ? defaultVal : Math.max(0, Math.min(100, num));
      };

      const extractScore = (questionNum: number, defaultVal: number): number => {
        const answer = extractAnswer(questionNum);
        const num = parseInt(answer.replace(/\D/g, ''));
        return isNaN(num) ? defaultVal : Math.max(0, Math.min(10, num));
      };

      const extractRisk = (questionNum: number): 'Low' | 'Medium' | 'High' => {
        const answer = extractAnswer(questionNum).toLowerCase();
        if (answer.includes('low')) return 'Low';
        if (answer.includes('high')) return 'High';
        return 'Medium';
      };

      const parsed: SimulationResults = {
        paths: [
          {
            title: '🛡️ ' + (extractAnswer(1) || 'Safe Path'),
            year1: extractAnswer(2) || 'Steady progress, stable foundation building',
            year5: extractAnswer(3) || 'Secure position, moderate advancement achieved',
            year10: extractAnswer(4) || 'Established career, comfortable lifestyle maintained',
            pros: extractAnswer(5) || 'Stability, predictability, low stress',
            cons: extractAnswer(6) || 'Limited upside, slower growth',
            successRate: extractNumber(7, 75),
            financialScore: extractScore(8, 7),
            happinessScore: extractScore(9, 7),
            riskLevel: extractRisk(10),
            timeInvestment: extractAnswer(11) || 'Moderate, sustainable pace',
            regretRisk: extractNumber(12, 30),
            keyInsight: extractAnswer(13) || 'Consistency compounds over time',
          },
          {
            title: '🚀 ' + (extractAnswer(14) || 'Risky Path'),
            year1: extractAnswer(15) || 'High volatility, rapid skill acquisition',
            year5: extractAnswer(16) || 'Major breakthrough or valuable pivot',
            year10: extractAnswer(17) || 'Significant success or unique expertise',
            pros: extractAnswer(18) || 'High potential, independence, rapid growth',
            cons: extractAnswer(19) || 'Uncertainty, stress, financial instability',
            successRate: extractNumber(20, 45),
            financialScore: extractScore(21, 5),
            happinessScore: extractScore(22, 6),
            riskLevel: extractRisk(23),
            timeInvestment: extractAnswer(24) || 'High, demanding commitment required',
            regretRisk: extractNumber(25, 50),
            keyInsight: extractAnswer(26) || 'Risk brings opportunity and learning',
          },
        ],
        recommendation: {
          winner: (extractAnswer(27).toUpperCase().includes('B') ? 'B' : 'A') as 'A' | 'B',
          reason: extractAnswer(28) || 'Both paths offer unique value propositions',
          confidenceScore: extractNumber(29, 65),
        },
        hiddenCosts: {
          pathA: extractAnswer(30) || 'Opportunity cost of playing it safe',
          pathB: extractAnswer(31) || 'Emotional toll of constant uncertainty',
        },
      };

      console.log('=== PARSED RESULT ===', parsed);
      setResults(parsed);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate simulation';
      setError(errorMsg);
      setStreamText('');
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  }, [input]);

  const reset = useCallback(() => {
    setResults(null);
    setError(null);
    setInput('');
    setStreamText('');
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRiskColor = (risk: string) => {
    if (risk === 'Low') return 'text-green-400';
    if (risk === 'Medium') return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10"
      >
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-purple-400 to-blue-500 text-transparent bg-clip-text">
          Parallel You 🌌
        </h1>
        <p className="text-gray-400 mt-2">
          Advanced AI-powered decision analysis with predictive metrics
        </p>
      </motion.div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="max-w-2xl mx-auto mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-200"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="max-w-2xl mx-auto mb-10"
      >
        <div className="bg-white/5 backdrop-blur-lg p-4 rounded-2xl border border-white/10 shadow-xl">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`What if I chose a different path in life...

Examples:
• Should I stay at my job or start my own business?
• Should I move abroad or stay in my hometown?
• Should I pursue higher education or start working?`}
            className="w-full p-4 rounded-xl bg-transparent border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500 min-h-[120px] resize-none"
            disabled={simulating}
          />
          <button
            onClick={generateSimulation}
            disabled={simulating || !input.trim()}
            className="mt-4 w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl font-semibold transition transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {simulating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {streamText || 'Analyzing your future...'}
              </span>
            ) : (
              '🧠 Run Advanced Analysis'
            )}
          </button>
        </div>
      </motion.div>

      {/* Quick Examples */}
      <AnimatePresence>
        {!results && !simulating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-2xl mx-auto mb-10"
          >
            <h3 className="text-center text-sm text-gray-400 mb-4">Quick Examples:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { emoji: '💼', label: 'Career', prompt: 'Should I stay at my stable corporate job or quit and start my own business?' },
                { emoji: '🏠', label: 'Housing', prompt: 'Should I buy a house now or keep renting and invest in stocks?' },
                { emoji: '🌍', label: 'Travel', prompt: 'Should I move abroad for better opportunities or stay close to family?' },
                { emoji: '🎓', label: 'Education', prompt: "Should I pursue a PhD or join the tech industry with a master's degree?" },
              ].map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(ex.prompt)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-xl p-3 transition text-center"
                >
                  <div className="text-2xl mb-1">{ex.emoji}</div>
                  <div className="text-xs text-gray-400">{ex.label}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {results && (
          <div className="max-w-7xl mx-auto">
            {/* Decision Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <p className="text-gray-400 mb-2">Your decision:</p>
              <p className="text-xl font-semibold text-purple-400 mb-4">{input}</p>
            </motion.div>

            {/* AI Recommendation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 mb-8"
            >
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-2">🎯 AI Recommendation</h3>
                <p className="text-3xl font-bold text-purple-400 mb-2">
                  Path {results.recommendation.winner}
                </p>
                <p className="text-gray-300 mb-3">{results.recommendation.reason}</p>
                <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
                  <span className="text-sm text-gray-400">Confidence:</span>
                  <span className="text-lg font-bold text-purple-400">{results.recommendation.confidenceScore}%</span>
                </div>
              </div>
            </motion.div>

            {/* Path Comparison */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {results.paths.map((path, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + index * 0.2 }}
                  className={`bg-white/5 backdrop-blur-xl p-6 rounded-2xl border ${
                    results.recommendation.winner === (index === 0 ? 'A' : 'B')
                      ? 'border-purple-500/50 shadow-lg shadow-purple-500/20'
                      : 'border-white/10'
                  } hover:scale-[1.02] transition-transform`}
                >
                  {/* Header */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-2xl font-bold text-purple-400">{path.title}</h2>
                      {results.recommendation.winner === (index === 0 ? 'A' : 'B') && (
                        <span className="bg-purple-500 text-white text-xs px-3 py-1 rounded-full font-bold">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 italic">{path.keyInsight}</div>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-3 mb-6">
                    <div className="bg-white/5 p-3 rounded-xl">
                      <div className="text-xs text-gray-400 mb-1">YEAR 1</div>
                      <p className="text-sm">{path.year1}</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl">
                      <div className="text-xs text-gray-400 mb-1">YEAR 5</div>
                      <p className="text-sm">{path.year5}</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl">
                      <div className="text-xs text-gray-400 mb-1">YEAR 10</div>
                      <p className="text-sm">{path.year10}</p>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/5 p-3 rounded-xl text-center">
                      <div className="text-xs text-gray-400 mb-1">Success Rate</div>
                      <div className={`text-2xl font-bold ${getScoreColor(path.successRate / 10)}`}>
                        {path.successRate}%
                      </div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl text-center">
                      <div className="text-xs text-gray-400 mb-1">Risk Level</div>
                      <div className={`text-lg font-bold ${getRiskColor(path.riskLevel)}`}>
                        {path.riskLevel}
                      </div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl text-center">
                      <div className="text-xs text-gray-400 mb-1">Financial</div>
                      <div className={`text-2xl font-bold ${getScoreColor(path.financialScore)}`}>
                        {path.financialScore}/10
                      </div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl text-center">
                      <div className="text-xs text-gray-400 mb-1">Happiness</div>
                      <div className={`text-2xl font-bold ${getScoreColor(path.happinessScore)}`}>
                        {path.happinessScore}/10
                      </div>
                    </div>
                  </div>

                  {/* Additional Metrics */}
                  <div className="space-y-2 mb-6 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Time Investment:</span>
                      <span className="font-semibold">{path.timeInvestment}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Regret Risk:</span>
                      <span className={`font-semibold ${path.regretRisk > 60 ? 'text-red-400' : path.regretRisk > 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {path.regretRisk}%
                      </span>
                    </div>
                  </div>

                  {/* Pros & Cons */}
                  <div className="space-y-2 text-sm border-t border-white/10 pt-4">
                    <div className="flex items-start gap-2">
                      <span className="text-green-400 font-bold">✓</span>
                      <div>
                        <div className="text-green-400 font-semibold mb-1">Pros</div>
                        <p className="text-gray-300">{path.pros}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-red-400 font-bold">✗</span>
                      <div>
                        <div className="text-red-400 font-semibold mb-1">Cons</div>
                        <p className="text-gray-300">{path.cons}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Hidden Costs */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="bg-orange-600/10 border border-orange-500/30 rounded-2xl p-6 mb-8"
            >
              <h3 className="text-xl font-bold mb-4 text-orange-400">⚠️ Hidden Costs</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-400 mb-1">Path A:</div>
                  <p className="text-sm">{results.hiddenCosts.pathA}</p>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-400 mb-1">Path B:</div>
                  <p className="text-sm">{results.hiddenCosts.pathB}</p>
                </div>
              </div>
            </motion.div>

            {/* Reset Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center"
            >
              <button
                onClick={reset}
                className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 px-8 py-3 rounded-xl transition"
              >
                ← Analyze Another Decision
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
