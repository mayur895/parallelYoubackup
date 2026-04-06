import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModelCategory } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';
import { initSDK } from '../runanywhere';
import {
  type JourneyState, type GeneratedCheckpoint, type CheckpointChoice, type Achievement,
  type CheckpointTemplate, type JourneyDecision,
  createInitialState, applyDecision, generateCheckpoint, computeAchievements,
  generateLifeStory, checkpointTemplateMap,
} from '../engine/journeyEngine';
import {
  initAudio, playClick, playXP, playMilestone, playTurningPoint,
  playReveal, playDecision, playAmbient, stopAmbient,
} from '../engine/soundEngine';

// ─── Persistence ─────────────────────────────────────────────────────────────

interface SavedJourney {
  id: string;
  date: string;
  category: string;
  scenario: string;
  pathTitle: string;
  pathType: 'A' | 'B';
  finalStats: { wealth: number; happiness: number; health: number; relationships: number; risk: number };
  xp: number;
  level: number;
  achievements: string[];
  lifeStory: string;
  decisions: { year: number; choice: string; outcome: string; impact?: Record<string, number> }[];
  // Replay fields (new journeys only)
  categoryId?: string;
  choiceIndices?: number[];
  financialScore?: number;
  happinessScore?: number;
  replayable?: boolean;
  forkedFrom?: string;
}

function loadSavedJourneys(): SavedJourney[] {
  try {
    return JSON.parse(localStorage.getItem('parallelYou_journeys') || '[]');
  } catch { return []; }
}

function saveJourney(journey: SavedJourney) {
  const all = loadSavedJourneys();
  all.unshift(journey);
  if (all.length > 20) all.length = 20;
  localStorage.setItem('parallelYou_journeys', JSON.stringify(all));
}

function loadPlayerStats(): { totalXP: number; totalJourneys: number; highestLevel: number } {
  try {
    return JSON.parse(localStorage.getItem('parallelYou_player') || '{"totalXP":0,"totalJourneys":0,"highestLevel":1}');
  } catch { return { totalXP: 0, totalJourneys: 0, highestLevel: 1 }; }
}

function savePlayerStats(xp: number, level: number) {
  const prev = loadPlayerStats();
  localStorage.setItem('parallelYou_player', JSON.stringify({
    totalXP: prev.totalXP + xp,
    totalJourneys: prev.totalJourneys + 1,
    highestLevel: Math.max(prev.highestLevel, level),
  }));
}

function generateShareText(
  scenario: string, pathTitle: string, pathType: 'A' | 'B',
  stats: { wealth: number; happiness: number; health: number; relationships: number },
  achievements: Achievement[], lifeStory: string, xp: number, level: number,
): string {
  const ach = achievements.map(a => `${a.emoji} ${a.label}`).join(', ');
  return `Parallel You - Life Simulator

Decision: "${scenario}"
Path: ${pathType === 'A' ? 'Safe' : 'Bold'} - ${pathTitle}

Final Stats:
  Wealth: ${stats.wealth}/100
  Happiness: ${stats.happiness}/100
  Health: ${stats.health}/100
  Relationships: ${stats.relationships}/100

${lifeStory}

Achievements: ${ach || 'None'}
XP: ${xp} | Level ${level}

Try it yourself: ${window.location.href}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'category' | 'scenario' | 'questions' | 'simulating' | 'reveal' | 'journey' | 'summary' | 'replay';

interface Category {
  id: string;
  emoji: string;
  label: string;
  tagline: string;
  color: string;
  questions: Question[];
}

interface Question {
  text: string;
  options: { label: string; emoji: string; value: string }[];
}

interface SimulationPath {
  title: string;
  emoji: string;
  year1: string;
  year5: string;
  year10: string;
  pros: string;
  cons: string;
  successRate: number;
  financialScore: number;
  happinessScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  keyInsight: string;
}

interface SimulationResults {
  paths: SimulationPath[];
  recommendation: { winner: 'A' | 'B'; reason: string; confidenceScore: number };
  hiddenCosts: { pathA: string; pathB: string };
}

// ─── Categories & Questions ──────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    id: 'career', emoji: '\u{1F680}', label: 'Career', tagline: 'Shape your professional destiny', color: 'from-violet-600 to-indigo-600',
    questions: [
      { text: 'How do you feel about risk in your career?', options: [
        { label: 'Play it safe', emoji: '\u{1F6E1}\u{FE0F}', value: 'risk_averse' }, { label: 'Calculated risks', emoji: '\u{1F3AF}', value: 'moderate' },
        { label: 'Go big or go home', emoji: '\u{1F525}', value: 'risk_taker' }, { label: 'Depends on stakes', emoji: '\u{1F914}', value: 'contextual' },
      ]},
      { text: 'What matters most to you at work?', options: [
        { label: 'Money & growth', emoji: '\u{1F4B0}', value: 'financial' }, { label: 'Purpose & impact', emoji: '\u{1F31F}', value: 'purpose' },
        { label: 'Freedom & flexibility', emoji: '\u{1F54A}\u{FE0F}', value: 'freedom' }, { label: 'Stability & security', emoji: '\u{1F3E0}', value: 'stability' },
      ]},
      { text: 'How do you handle setbacks?', options: [
        { label: 'Bounce back fast', emoji: '\u{26A1}', value: 'resilient' }, { label: 'Need time to recover', emoji: '\u{1F331}', value: 'slow_recovery' },
        { label: 'Learn and pivot', emoji: '\u{1F504}', value: 'adaptive' }, { label: 'Avoid them entirely', emoji: '\u{1F6E1}\u{FE0F}', value: 'avoidant' },
      ]},
      { text: 'Where do you see yourself in 5 years?', options: [
        { label: 'Leading a team', emoji: '\u{1F451}', value: 'leadership' }, { label: 'Deep expertise', emoji: '\u{1F9E0}', value: 'specialist' },
        { label: 'Running my thing', emoji: '\u{1F3D7}\u{FE0F}', value: 'entrepreneur' }, { label: 'Still exploring', emoji: '\u{1F30D}', value: 'exploring' },
      ]},
      { text: 'How satisfied are you with your current path?', options: [
        { label: 'Very happy', emoji: '\u{1F60A}', value: 'satisfied' }, { label: 'It\'s okay', emoji: '\u{1F610}', value: 'neutral' },
        { label: 'Restless', emoji: '\u{1F4AD}', value: 'restless' }, { label: 'Need a change', emoji: '\u{1F6A8}', value: 'urgent_change' },
      ]},
    ],
  },
  {
    id: 'life', emoji: '\u{1F30D}', label: 'Life Move', tagline: 'Relocate, travel, or stay rooted', color: 'from-emerald-600 to-teal-600',
    questions: [
      { text: 'How important is being close to family?', options: [
        { label: 'Everything', emoji: '\u{2764}\u{FE0F}', value: 'very_important' }, { label: 'Nice but not critical', emoji: '\u{1F44D}', value: 'moderate' },
        { label: 'I\'m independent', emoji: '\u{1F985}', value: 'independent' }, { label: 'It\'s complicated', emoji: '\u{1F615}', value: 'complicated' },
      ]},
      { text: 'How do you feel about the unknown?', options: [
        { label: 'Thrilling!', emoji: '\u{1F389}', value: 'excited' }, { label: 'Nervous but curious', emoji: '\u{1F60C}', value: 'cautious_curious' },
        { label: 'Prefer predictable', emoji: '\u{1F4CB}', value: 'predictable' }, { label: 'Terrifying', emoji: '\u{1F628}', value: 'anxious' },
      ]},
      { text: 'What\'s your financial safety net like?', options: [
        { label: '6+ months saved', emoji: '\u{1F3E6}', value: 'strong' }, { label: '2-5 months', emoji: '\u{1F4B5}', value: 'moderate' },
        { label: 'Living paycheck to paycheck', emoji: '\u{1F62C}', value: 'tight' }, { label: 'It\'s complicated', emoji: '\u{1F4CA}', value: 'variable' },
      ]},
      { text: 'How adaptable are you to new environments?', options: [
        { label: 'Chameleon mode', emoji: '\u{1F98E}', value: 'very_adaptable' }, { label: 'Takes me a while', emoji: '\u{1F422}', value: 'slow_adapter' },
        { label: 'I need my comfort zone', emoji: '\u{1F6CB}\u{FE0F}', value: 'comfort_seeker' }, { label: 'Depends on people', emoji: '\u{1F465}', value: 'social_dependent' },
      ]},
      { text: 'What are you hoping to gain?', options: [
        { label: 'Better opportunities', emoji: '\u{1F4C8}', value: 'opportunities' }, { label: 'Fresh start', emoji: '\u{1F331}', value: 'fresh_start' },
        { label: 'Adventure', emoji: '\u{26F0}\u{FE0F}', value: 'adventure' }, { label: 'Peace of mind', emoji: '\u{1F54A}\u{FE0F}', value: 'peace' },
      ]},
    ],
  },
  {
    id: 'education', emoji: '\u{1F393}', label: 'Education', tagline: 'Level up your knowledge', color: 'from-amber-600 to-orange-600',
    questions: [
      { text: 'Why pursue more education?', options: [
        { label: 'Career advancement', emoji: '\u{1F4BC}', value: 'career' }, { label: 'Passion for learning', emoji: '\u{1F4DA}', value: 'passion' },
        { label: 'Higher salary', emoji: '\u{1F4B0}', value: 'salary' }, { label: 'Not sure yet', emoji: '\u{1F937}', value: 'uncertain' },
      ]},
      { text: 'How do you learn best?', options: [
        { label: 'Structured classes', emoji: '\u{1F3EB}', value: 'structured' }, { label: 'Self-taught', emoji: '\u{1F4BB}', value: 'self_taught' },
        { label: 'Hands-on projects', emoji: '\u{1F528}', value: 'hands_on' }, { label: 'Mix of everything', emoji: '\u{1F500}', value: 'mixed' },
      ]},
      { text: 'How do you feel about debt?', options: [
        { label: 'Worth the investment', emoji: '\u{1F4B3}', value: 'acceptable' }, { label: 'Scary but necessary', emoji: '\u{1F630}', value: 'reluctant' },
        { label: 'Absolutely not', emoji: '\u{1F6AB}', value: 'no_debt' }, { label: 'Already have some', emoji: '\u{1F4C9}', value: 'existing_debt' },
      ]},
      { text: 'Time availability?', options: [
        { label: 'Full-time ready', emoji: '\u{23F0}', value: 'full_time' }, { label: 'Part-time only', emoji: '\u{1F319}', value: 'part_time' },
        { label: 'Weekends & evenings', emoji: '\u{1F303}', value: 'evenings' }, { label: 'Very limited', emoji: '\u{23F3}', value: 'limited' },
      ]},
      { text: 'How patient with long-term goals?', options: [
        { label: 'Very patient', emoji: '\u{1F9D8}', value: 'patient' }, { label: 'Want results soon', emoji: '\u{26A1}', value: 'impatient' },
        { label: 'Depends on the goal', emoji: '\u{1F3AF}', value: 'conditional' }, { label: 'I struggle', emoji: '\u{1F613}', value: 'low_patience' },
      ]},
    ],
  },
  {
    id: 'finance', emoji: '\u{1F4B8}', label: 'Finance', tagline: 'Invest, save, or spend wisely', color: 'from-green-600 to-emerald-600',
    questions: [
      { text: 'Relationship with money?', options: [
        { label: 'Save aggressively', emoji: '\u{1F3E6}', value: 'saver' }, { label: 'Balanced approach', emoji: '\u{2696}\u{FE0F}', value: 'balanced' },
        { label: 'Enjoy spending', emoji: '\u{1F6CD}\u{FE0F}', value: 'spender' }, { label: 'Stressed about it', emoji: '\u{1F62B}', value: 'stressed' },
      ]},
      { text: 'Financial risk tolerance?', options: [
        { label: 'Crypto-level', emoji: '\u{1F4C8}', value: 'high_risk' }, { label: 'Index funds', emoji: '\u{1F4CA}', value: 'moderate_risk' },
        { label: 'Savings account only', emoji: '\u{1F512}', value: 'low_risk' }, { label: 'What\'s an index fund?', emoji: '\u{1F914}', value: 'beginner' },
      ]},
      { text: 'Income stability?', options: [
        { label: 'Steady paycheck', emoji: '\u{1F4B5}', value: 'stable' }, { label: 'Freelance/variable', emoji: '\u{1F3A2}', value: 'variable' },
        { label: 'Multiple streams', emoji: '\u{1F4B0}', value: 'multiple' }, { label: 'Between jobs', emoji: '\u{1F50D}', value: 'searching' },
      ]},
      { text: 'Biggest financial goal?', options: [
        { label: 'Buy a home', emoji: '\u{1F3E0}', value: 'home' }, { label: 'Retire early', emoji: '\u{1F3D6}\u{FE0F}', value: 'retire' },
        { label: 'Build wealth', emoji: '\u{1F48E}', value: 'wealth' }, { label: 'Get out of debt', emoji: '\u{1F3C3}', value: 'debt_free' },
      ]},
      { text: 'How long can you wait?', options: [
        { label: '10+ years', emoji: '\u{1F9D3}', value: 'long_term' }, { label: '3-5 years', emoji: '\u{1F4C5}', value: 'medium_term' },
        { label: 'Need results now', emoji: '\u{26A1}', value: 'short_term' }, { label: 'Depends', emoji: '\u{1F4B2}', value: 'conditional' },
      ]},
    ],
  },
  {
    id: 'relationship', emoji: '\u{2764}\u{FE0F}', label: 'Relationships', tagline: 'Navigate life with others', color: 'from-pink-600 to-rose-600',
    questions: [
      { text: 'Top priority in relationships?', options: [
        { label: 'Trust & loyalty', emoji: '\u{1F91D}', value: 'trust' }, { label: 'Growth together', emoji: '\u{1F331}', value: 'growth' },
        { label: 'Fun & adventure', emoji: '\u{1F389}', value: 'fun' }, { label: 'Emotional support', emoji: '\u{1F917}', value: 'support' },
      ]},
      { text: 'How do you handle conflict?', options: [
        { label: 'Talk it out', emoji: '\u{1F4AC}', value: 'direct' }, { label: 'Need space first', emoji: '\u{1F30C}', value: 'space' },
        { label: 'Avoid if possible', emoji: '\u{1F648}', value: 'avoidant' }, { label: 'Depends on the issue', emoji: '\u{1F914}', value: 'contextual' },
      ]},
      { text: 'How much independence?', options: [
        { label: 'Lots of me-time', emoji: '\u{1F9D8}', value: 'high' }, { label: 'Healthy balance', emoji: '\u{2696}\u{FE0F}', value: 'balanced' },
        { label: 'Love togetherness', emoji: '\u{1F46B}', value: 'low' }, { label: 'Still figuring out', emoji: '\u{1F4AD}', value: 'uncertain' },
      ]},
      { text: 'Head or heart driven?', options: [
        { label: 'Pure logic', emoji: '\u{1F9E0}', value: 'logical' }, { label: 'Follow my heart', emoji: '\u{2764}\u{FE0F}', value: 'emotional' },
        { label: 'Balance of both', emoji: '\u{2696}\u{FE0F}', value: 'balanced' }, { label: 'Gut instinct', emoji: '\u{26A1}', value: 'instinct' },
      ]},
      { text: 'Biggest relationship fear?', options: [
        { label: 'Being stuck', emoji: '\u{1F512}', value: 'stagnation' }, { label: 'Being alone', emoji: '\u{1F30C}', value: 'loneliness' },
        { label: 'Getting hurt', emoji: '\u{1F494}', value: 'hurt' }, { label: 'Missing out', emoji: '\u{231B}', value: 'fomo' },
      ]},
    ],
  },
  {
    id: 'adventure', emoji: '\u{26A1}', label: 'Wild Card', tagline: 'The unexpected life choices', color: 'from-fuchsia-600 to-purple-600',
    questions: [
      { text: 'How spontaneous are you?', options: [
        { label: 'Plan everything', emoji: '\u{1F4CB}', value: 'planner' }, { label: 'Go with the flow', emoji: '\u{1F30A}', value: 'spontaneous' },
        { label: 'Organized chaos', emoji: '\u{1F300}', value: 'mixed' }, { label: 'Depends on mood', emoji: '\u{1F3B2}', value: 'mood_based' },
      ]},
      { text: 'What excites you most?', options: [
        { label: 'New experiences', emoji: '\u{1F30D}', value: 'novelty' }, { label: 'Building something', emoji: '\u{1F3D7}\u{FE0F}', value: 'creation' },
        { label: 'Mastering a skill', emoji: '\u{1F3AF}', value: 'mastery' }, { label: 'Connecting with people', emoji: '\u{1F465}', value: 'connection' },
      ]},
      { text: 'If this fails, backup plan?', options: [
        { label: 'Already have one', emoji: '\u{1F4DD}', value: 'prepared' }, { label: 'I\'ll figure it out', emoji: '\u{1F937}', value: 'wing_it' },
        { label: 'No backup, all in', emoji: '\u{1F525}', value: 'all_in' }, { label: 'That scares me', emoji: '\u{1F628}', value: 'scared' },
      ]},
      { text: 'Future self would thank you for?', options: [
        { label: 'Taking the leap', emoji: '\u{1F680}', value: 'courage' }, { label: 'Being patient', emoji: '\u{1F9D8}', value: 'patience' },
        { label: 'Choosing happiness', emoji: '\u{1F60A}', value: 'happiness' }, { label: 'Playing it smart', emoji: '\u{1F9E0}', value: 'wisdom' },
      ]},
      { text: 'How do you feel RIGHT NOW?', options: [
        { label: 'Excited and ready', emoji: '\u{1F4AA}', value: 'ready' }, { label: 'Nervous but hopeful', emoji: '\u{1F332}', value: 'hopeful' },
        { label: 'Overwhelmed', emoji: '\u{1F32A}\u{FE0F}', value: 'overwhelmed' }, { label: 'Just curious', emoji: '\u{1F440}', value: 'curious' },
      ]},
    ],
  },
];

// ─── Quick-Pick Scenario Examples ────────────────────────────────────────────

const SCENARIO_EXAMPLES: Record<string, { emoji: string; label: string; text: string }[]> = {
  career: [
    { emoji: '\u{1F4BC}', label: 'Quit & start a startup', text: 'Should I leave my stable job to start my own tech startup?' },
    { emoji: '\u{1F4B0}', label: 'Ask for a big raise', text: 'Should I ask for a 40% raise or start looking for a new job?' },
    { emoji: '\u{1F30D}', label: 'Remote vs office', text: 'Should I take a remote job with less pay or stay in-office with more pay?' },
    { emoji: '\u{1F504}', label: 'Career switch', text: 'Should I switch from engineering to product management?' },
  ],
  life: [
    { emoji: '\u{2708}\u{FE0F}', label: 'Move abroad', text: 'Should I move to another country for better opportunities?' },
    { emoji: '\u{1F3E0}', label: 'City vs hometown', text: 'Should I stay in my hometown near family or move to a big city?' },
    { emoji: '\u{1F697}', label: 'Minimalist life', text: 'Should I sell everything and travel the world for a year?' },
    { emoji: '\u{1F3D9}\u{FE0F}', label: 'New city fresh start', text: 'Should I move to a new city where I know nobody for a fresh start?' },
  ],
  education: [
    { emoji: '\u{1F393}', label: 'PhD or work', text: 'Should I pursue a PhD or join the industry with my masters degree?' },
    { emoji: '\u{1F4BB}', label: 'Bootcamp vs degree', text: 'Should I do a coding bootcamp or get a full computer science degree?' },
    { emoji: '\u{1F4DA}', label: 'MBA worth it?', text: 'Should I get an MBA or use that time and money to build a business?' },
    { emoji: '\u{1F310}', label: 'Study abroad', text: 'Should I study abroad for a semester or stay and do internships?' },
  ],
  finance: [
    { emoji: '\u{1F3E0}', label: 'Buy vs rent', text: 'Should I buy a house now or keep renting and investing in stocks?' },
    { emoji: '\u{1F4C8}', label: 'Invest aggressively', text: 'Should I put my savings into crypto and stocks or keep it in a savings account?' },
    { emoji: '\u{1F3D7}\u{FE0F}', label: 'Side business', text: 'Should I invest my savings into starting a side business?' },
    { emoji: '\u{1F4B3}', label: 'Pay off debt first', text: 'Should I aggressively pay off student loans or invest while making minimum payments?' },
  ],
  relationship: [
    { emoji: '\u{1F48D}', label: 'Long distance', text: 'Should I move for my partner or ask them to move for me?' },
    { emoji: '\u{1F465}', label: 'Toxic friendship', text: 'Should I cut off a longtime friend who has become toxic?' },
    { emoji: '\u{2764}\u{FE0F}', label: 'Settle down', text: 'Should I settle down now or stay single and focus on my goals?' },
    { emoji: '\u{1F46A}', label: 'Family pressure', text: 'Should I follow my family expectations or pursue what makes me happy?' },
  ],
  adventure: [
    { emoji: '\u{1F3A4}', label: 'Dream pursuit', text: 'Should I drop everything and pursue my dream of becoming a musician?' },
    { emoji: '\u{1F680}', label: 'Crazy bet', text: 'Should I invest my savings into building an app idea I am passionate about?' },
    { emoji: '\u{26F0}\u{FE0F}', label: 'Gap year', text: 'Should I take a gap year to travel and find myself?' },
    { emoji: '\u{1F3AE}', label: 'Passion project', text: 'Should I quit my job to work on my passion project full-time?' },
  ],
};

// ─── Simulating Messages ─────────────────────────────────────────────────────

const SIMULATING_MESSAGES = [
  'Analyzing your decision...',
  'Projecting possible futures...',
  'Simulating consequences...',
  'Comparing parallel timelines...',
  'Rendering your destiny...',
];

// ─── LLM Helper ──────────────────────────────────────────────────────────────

async function callLocalLLM(prompt: string, onToken?: (token: string) => void): Promise<string> {
  await initSDK();
  const { stream, result: resultPromise } = await TextGeneration.generateStream(prompt, { maxTokens: 200, temperature: 0.5 });
  let accumulated = '';
  for await (const token of stream) { accumulated += token; onToken?.(token); }
  await resultPromise;
  return accumulated;
}

function deriveScoresFromAnswers(answers: string[]) {
  let risk = 50, financial = 5, happiness = 5;
  for (const a of answers) {
    if (['risk_taker', 'all_in', 'spontaneous', 'high_risk', 'courage'].includes(a)) risk += 15;
    if (['risk_averse', 'avoidant', 'predictable', 'low_risk', 'planner', 'comfort_seeker'].includes(a)) risk -= 15;
    if (['financial', 'salary', 'saver', 'wealth', 'home', 'strong'].includes(a)) financial += 1;
    if (['spender', 'tight', 'stressed', 'searching'].includes(a)) financial -= 1;
    if (['purpose', 'freedom', 'fun', 'adventure', 'fresh_start', 'happiness', 'peace'].includes(a)) happiness += 1;
    if (['urgent_change', 'overwhelmed', 'anxious', 'stagnation'].includes(a)) happiness -= 1;
  }
  return { riskTolerance: Math.max(10, Math.min(90, risk)), financialBias: Math.max(1, Math.min(10, financial)), happinessBias: Math.max(1, Math.min(10, happiness)) };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ParticleField() {
  return (
    <div className="particle-field">
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} className="particle" style={{
          left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`, animationDuration: `${3 + Math.random() * 4}s`,
          width: `${2 + Math.random() * 4}px`, height: `${2 + Math.random() * 4}px`,
        }} />
      ))}
    </div>
  );
}

function XPBar({ xp, level }: { xp: number; level: number }) {
  const progress = (xp % 100) / 100 * 100;
  return (
    <div className="xp-bar-container">
      <div className="xp-bar-label"><span className="xp-level">LVL {level}</span><span className="xp-text">{xp} XP</span></div>
      <div className="xp-bar-track"><motion.div className="xp-bar-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }} /></div>
    </div>
  );
}

function ProgressSteps({ current, total }: { current: number; total: number }) {
  return (
    <div className="progress-steps">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`progress-step ${i < current ? 'completed' : ''} ${i === current ? 'active' : ''}`}>
          {i < current ? '\u2713' : i + 1}
        </div>
      ))}
    </div>
  );
}

// ─── Typewriter Text ─────────────────────────────────────────────────────────

function TypewriterText({ text, speed = 40, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const idxRef = useRef(0);
  useEffect(() => {
    setDisplayed('');
    idxRef.current = 0;
    const iv = setInterval(() => {
      idxRef.current++;
      setDisplayed(text.slice(0, idxRef.current));
      if (idxRef.current >= text.length) { clearInterval(iv); onDone?.(); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed, onDone]);
  return <span>{displayed}<span className="typewriter-cursor">|</span></span>;
}

// ─── Landing Typewriter ─────────────────────────────────────────────────────

function LandingTypewriter({ phrases, typeSpeed = 50, eraseSpeed = 30, pauseMs = 2000 }: {
  phrases: string[];
  typeSpeed?: number;
  eraseSpeed?: number;
  pauseMs?: number;
}) {
  const [displayed, setDisplayed] = useState('');
  const phraseRef = useRef(0);
  const charRef = useRef(0);
  const modeRef = useRef<'typing' | 'pausing' | 'erasing'>('typing');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const phrase = phrases[phraseRef.current];

      if (modeRef.current === 'typing') {
        charRef.current++;
        setDisplayed(phrase.slice(0, charRef.current));
        if (charRef.current >= phrase.length) {
          modeRef.current = 'pausing';
          timer = setTimeout(tick, pauseMs);
        } else {
          timer = setTimeout(tick, typeSpeed);
        }
      } else if (modeRef.current === 'pausing') {
        modeRef.current = 'erasing';
        timer = setTimeout(tick, eraseSpeed);
      } else {
        charRef.current--;
        setDisplayed(phrase.slice(0, charRef.current));
        if (charRef.current <= 0) {
          modeRef.current = 'typing';
          phraseRef.current = (phraseRef.current + 1) % phrases.length;
          timer = setTimeout(tick, typeSpeed);
        } else {
          timer = setTimeout(tick, eraseSpeed);
        }
      }
    }

    modeRef.current = 'typing';
    charRef.current = 0;
    phraseRef.current = 0;
    setDisplayed('');
    timer = setTimeout(tick, typeSpeed);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span className="landing-typewriter-text">
      {displayed}<span className="typewriter-cursor">|</span>
    </span>
  );
}

// ─── Parallel Timeline ──────────────────────────────────────────────────────

function ParallelTimeline({
  chosenDecisions,
  otherTemplates,
  chosenTitle,
  otherTitle,
  chosenEmoji,
  otherEmoji,
}: {
  chosenDecisions: JourneyDecision[];
  otherTemplates: CheckpointTemplate[];
  chosenTitle: string;
  otherTitle: string;
  chosenEmoji: string;
  otherEmoji: string;
}) {
  const yearLabels = ['Year 1', 'Year 3', 'Year 5', 'Year 7', 'Year 10'];

  return (
    <div className="parallel-timeline">
      <div className="parallel-timeline-lane chosen-lane">
        <div className="parallel-timeline-header">{chosenEmoji} Your Path: {chosenTitle}</div>
        <div className="parallel-timeline-track">
          {chosenDecisions.map((d, i) => (
            <motion.div key={i} className="parallel-timeline-node" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}>
              <div className="parallel-timeline-year">{yearLabels[i] || `Year ${d.year}`}</div>
              <div className="parallel-timeline-dot" />
              <div className="parallel-timeline-event">{d.choice}</div>
              <div className="parallel-timeline-impacts">
                {d.impact && Object.entries(d.impact).map(([key, val]) => (
                  <span key={key} className={`parallel-timeline-badge ${(val as number) > 0 ? 'positive' : (val as number) < 0 ? 'negative' : 'neutral'}`}>
                    {key === 'wealth' ? '\u{1F4B0}' : key === 'happiness' ? '\u{1F60A}' : '\u{1F3CB}'}{(val as number) > 0 ? '+' : ''}{val as number}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {otherTemplates.length > 0 && (
        <div className="parallel-timeline-lane other-lane">
          <div className="parallel-timeline-header">{otherEmoji} Alternate: {otherTitle}</div>
          <div className="parallel-timeline-track">
            {otherTemplates.map((t, i) => (
              <motion.div key={i} className="parallel-timeline-node" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.15 }}>
                <div className="parallel-timeline-year">{yearLabels[i] || `Year ${i + 1}`}</div>
                <div className="parallel-timeline-dot other-dot" />
                <div className="parallel-timeline-event">{t.title}</div>
                {t.choices[0] && (
                  <div className="parallel-timeline-impacts">
                    {Object.entries(t.choices[0].impact).map(([key, val]) => (
                      <span key={key} className={`parallel-timeline-badge ${val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral'}`}>
                        {key === 'wealth' ? '\u{1F4B0}' : key === 'happiness' ? '\u{1F60A}' : '\u{1F3CB}'}{val > 0 ? '+' : ''}{val}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ParallelYouTab() {
  const loader = useModelLoader(ModelCategory.Language);

  // Game state
  const [phase, setPhase] = useState<Phase>('intro');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [scenario, setScenario] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [customAnswer, setCustomAnswer] = useState('');
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulatingMsg, setSimulatingMsg] = useState('');
  const [streamSnippet, setStreamSnippet] = useState('');
  const [tokenProgress, setTokenProgress] = useState(0);
  const [chosenPath, setChosenPath] = useState<'A' | 'B' | null>(null);
  const [showXpPopup, setShowXpPopup] = useState(false);
  const [xpAmount, setXpAmount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [journeyConfidence, setJourneyConfidence] = useState('');
  const simulatingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runSimulationRef = useRef<((answers: string[]) => Promise<void>) | null>(null);

  // Journey engine state
  const [journeyState, setJourneyState] = useState<JourneyState | null>(null);
  const [journeyStep, setJourneyStep] = useState(0);
  const [currentCheckpoint, setCurrentCheckpoint] = useState<GeneratedCheckpoint | null>(null);
  const [showOutcome, setShowOutcome] = useState<string | null>(null);
  const [showMilestone, setShowMilestone] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Replay & fork state
  const [replayJourney, setReplayJourney] = useState<SavedJourney | null>(null);
  const [choiceIndices, setChoiceIndices] = useState<number[]>([]);
  const [savedScores, setSavedScores] = useState({ financial: 5, happiness: 5 });

  // Background LLM insight (runs during journey, shows at summary)
  const [bgInsight, setBgInsight] = useState<string | null>(null);
  const bgInsightRef = useRef(false);

  // Game feel state
  const [shaking, setShaking] = useState(false);
  const [darkTransition, setDarkTransition] = useState(false);
  const [playerName, setPlayerName] = useState<string>(() => localStorage.getItem('parallelYou_name') || '');

  // Persistence
  const [pastJourneys, setPastJourneys] = useState<SavedJourney[]>([]);
  const [playerStats, setPlayerStats] = useState(loadPlayerStats());
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');

  useEffect(() => { initSDK().catch(console.error); }, []);
  useEffect(() => { setPastJourneys(loadSavedJourneys()); }, []);

  // Cycle simulating messages
  useEffect(() => {
    if (phase === 'simulating') {
      let idx = 0;
      setSimulatingMsg(SIMULATING_MESSAGES[0]);
      simulatingRef.current = setInterval(() => { idx = (idx + 1) % SIMULATING_MESSAGES.length; setSimulatingMsg(SIMULATING_MESSAGES[idx]); }, 2000);
      return () => { if (simulatingRef.current) clearInterval(simulatingRef.current); };
    }
  }, [phase]);

  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
  }, []);

  const triggerDarkTransition = useCallback((duration = 800) => {
    setDarkTransition(true);
    setTimeout(() => setDarkTransition(false), duration);
  }, []);

  const addXP = useCallback((amount: number) => {
    setXpAmount(amount);
    setXp(prev => {
      const next = prev + amount;
      setLevel(Math.floor(next / 100) + 1);
      return next;
    });
    setShowXpPopup(true);
    playXP();
    setTimeout(() => setShowXpPopup(false), 1200);
  }, []);

  const handleCategorySelect = useCallback((cat: Category) => {
    setSelectedCategory(cat); playClick(); setTimeout(() => setPhase('scenario'), 800);
  }, []);

  const handleScenarioSubmit = useCallback(() => {
    if (!scenario.trim()) return; playDecision(); setCurrentQuestion(0); setAnswers([]); setTimeout(() => setPhase('questions'), 800);
  }, [scenario]);

  // Pre-load model during questions
  useEffect(() => { if (phase === 'questions' && loader.state === 'idle') loader.ensure().catch(() => {}); }, [phase, loader]);

  const runSimulation = useCallback(async (allAnswers: string[]) => {
    const ok = await loader.ensure();
    if (!ok) { setError('Failed to load AI model.'); setPhase('intro'); return; }

    const scores = deriveScoresFromAnswers(allAnswers);
    const prompt = `Decision: "${scenario}" (${selectedCategory?.label})\n\nReply ONLY with numbered answers, max 5 words each:\n1. Safe path name:\n2. Safe outcome:\n3. Bold path name:\n4. Bold outcome:\n5. Safe pros:\n6. Bold pros:\n7. Better choice (A or B):\n8. Why:`;

    try {
      let tokenCount = 0;
      setTokenProgress(0);
      const text = await callLocalLLM(prompt, () => {
        tokenCount++;
        setTokenProgress(tokenCount);
        if (tokenCount % 20 === 0) setSimulatingMsg(SIMULATING_MESSAGES[Math.min(Math.floor(tokenCount / 20), SIMULATING_MESSAGES.length - 1)]);
      });
      setTokenProgress(0);

      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      const ext = (num: number) => {
        const line = lines.find(l => l.match(new RegExp(`^${num}[\\.:\\)]`)));
        if (!line) return '';
        const after = line.replace(/^\d+[\.\:\)]\s*/, '');
        const ci = after.indexOf(':');
        return ci !== -1 ? after.slice(ci + 1).trim() : after.trim();
      };

      const safeSuccess = Math.max(40, 90 - scores.riskTolerance);
      const boldSuccess = Math.min(80, 20 + scores.riskTolerance);

      const parsed: SimulationResults = {
        paths: [
          { title: ext(1) || 'The Safe Path', emoji: '\u{1F6E1}\u{FE0F}', year1: ext(2) || 'Steady progress', year5: 'Solid foundation, steady growth', year10: 'Established and comfortable', pros: ext(5) || 'Stability, predictability', cons: 'Limited upside, slower growth', successRate: safeSuccess, financialScore: Math.min(10, scores.financialBias + 2), happinessScore: Math.max(1, scores.happinessBias - 1), riskLevel: 'Low', keyInsight: ext(5) || 'Consistency compounds' },
          { title: ext(3) || 'The Bold Path', emoji: '\u{1F525}', year1: ext(4) || 'High volatility', year5: 'Major breakthrough or pivot', year10: 'Unique expertise or big success', pros: ext(6) || 'Growth, independence', cons: 'Uncertainty, stress', successRate: boldSuccess, financialScore: Math.max(1, scores.financialBias - 1), happinessScore: Math.min(10, scores.happinessBias + 2), riskLevel: scores.riskTolerance > 60 ? 'Medium' : 'High', keyInsight: ext(6) || 'Risk brings opportunity' },
        ],
        recommendation: { winner: ext(7).toUpperCase().includes('B') ? 'B' : 'A', reason: ext(8) || 'Both paths have unique value', confidenceScore: Math.min(95, 50 + Math.abs(safeSuccess - boldSuccess)) },
        hiddenCosts: { pathA: 'Opportunity cost of playing it safe', pathB: 'Emotional toll of constant uncertainty' },
      };

      stopAmbient(); setResults(parsed); playReveal(); triggerShake(); setPhase('reveal');
    } catch (err) { setError(err instanceof Error ? err.message : 'Simulation failed'); setPhase('intro'); }
  }, [loader, scenario, selectedCategory]);

  runSimulationRef.current = runSimulation;

  const handleAnswer = useCallback((value: string) => {
    const newAnswers = [...answers, value]; setAnswers(newAnswers);
    setCustomAnswer('');
    playClick();
    if (selectedCategory && currentQuestion < selectedCategory.questions.length - 1) {
      setTimeout(() => setCurrentQuestion(prev => prev + 1), 300);
    } else {
      // Dark transition into simulation
      triggerDarkTransition(1000);
      setTimeout(() => { playAmbient(); setPhase('simulating'); runSimulationRef.current?.(newAnswers); }, 1000);
    }
  }, [answers, currentQuestion, selectedCategory, triggerDarkTransition]);

  const goBackQuestion = useCallback(() => {
    setCustomAnswer('');
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
      setAnswers(prev => prev.slice(0, -1));
    } else {
      setPhase('scenario');
    }
  }, [currentQuestion]);

  // ─── Journey Handlers (NEW ENGINE) ────────────────────────────────────────

  const handlePathChoice = useCallback((path: 'A' | 'B') => {
    setChosenPath(path); playDecision(); triggerShake();
    const pathData = results?.paths[path === 'A' ? 0 : 1];
    const fScore = pathData?.financialScore ?? 5;
    const hScore = pathData?.happinessScore ?? 5;
    setSavedScores({ financial: fScore, happiness: hScore });
    setChoiceIndices([]);
    const initial = createInitialState(path, fScore, hScore);
    setJourneyState(initial);
    setJourneyStep(0);
    setShowOutcome(null); setShowMilestone(null); setBgInsight(null);

    // Generate first checkpoint
    const key = `${selectedCategory?.id}-${path === 'A' ? 'safe' : 'bold'}`;
    const templates = checkpointTemplateMap[key] || checkpointTemplateMap['career-safe'];
    const cp = generateCheckpoint(templates[0], initial, scenario, pathData?.title || 'Your Path');
    setCurrentCheckpoint(cp);
    setPhase('journey');

    // Background LLM: generate a personalized insight while user plays
    if (!bgInsightRef.current) {
      bgInsightRef.current = true;
      const bgPrompt = `In 2 sentences, give personal advice for someone who chose the ${path === 'A' ? 'safe' : 'bold'} path on: "${scenario}"`;
      callLocalLLM(bgPrompt).then(text => {
        setBgInsight(text.trim().slice(0, 200));
        bgInsightRef.current = false;
      }).catch(() => { bgInsightRef.current = false; });
    }
  }, [selectedCategory, results, scenario]);

  const handleJourneyChoice = useCallback((choice: CheckpointChoice) => {
    if (!journeyState || !currentCheckpoint) return;
    // Track choice index for replay
    const cIdx = Math.max(0, currentCheckpoint.choices.indexOf(choice));
    setChoiceIndices(prev => [...prev, cIdx]);
    // Sound based on context
    if (currentCheckpoint.turningPoint) { playTurningPoint(); triggerShake(); }
    else if (choice.milestone) { playMilestone(); }
    else { playClick(); }
    setJourneyConfidence('');

    const decision = { year: currentCheckpoint.year, choice: choice.label, impact: choice.impact, outcome: choice.outcome };
    const newState = applyDecision(journeyState, decision, choice.milestone);
    setJourneyState(newState);

    // Show milestone toast
    if (choice.milestone) {
      setShowMilestone(choice.milestone);
      setTimeout(() => setShowMilestone(null), 2500);
    }

    // Show outcome, then advance
    setShowOutcome(choice.outcome);
    setTimeout(() => {
      setShowOutcome(null);
      const key = `${selectedCategory?.id}-${chosenPath === 'A' ? 'safe' : 'bold'}`;
      const templates = checkpointTemplateMap[key] || checkpointTemplateMap['career-safe'];
      const nextStep = journeyStep + 1;

      const activePathTitle = results?.paths[chosenPath === 'A' ? 0 : 1]?.title || replayJourney?.pathTitle || 'Your Path';

      if (nextStep < templates.length) {
        setJourneyStep(nextStep);
        const cp = generateCheckpoint(templates[nextStep], newState, scenario, activePathTitle);
        setCurrentCheckpoint(cp);
      } else {
        // Journey complete — award XP based on journey count
        playReveal();
        const journeyNumber = pastJourneys.length + 1;
        addXP(100 * journeyNumber);
        const earned = computeAchievements(newState, chosenPath || 'A');
        setAchievements(earned);

        // Save to localStorage
        const story = generateLifeStory(newState, scenario, activePathTitle, selectedCategory?.label || 'Life');
        const saved: SavedJourney = {
          id: Date.now().toString(36),
          date: new Date().toLocaleDateString(),
          category: selectedCategory?.label || 'Unknown',
          scenario,
          pathTitle: activePathTitle,
          pathType: chosenPath || 'A',
          finalStats: { ...newState.stats },
          xp,
          level,
          achievements: earned.map(a => a.label),
          lifeStory: story,
          decisions: newState.decisions.map(d => ({ year: d.year, choice: d.choice, outcome: d.outcome, impact: d.impact as Record<string, number> })),
          categoryId: selectedCategory?.id || 'career',
          choiceIndices: [...choiceIndices, cIdx],
          financialScore: savedScores.financial,
          happinessScore: savedScores.happiness,
          replayable: true,
          forkedFrom: replayJourney?.id,
        };
        saveJourney(saved);
        savePlayerStats(xp, level);
        setPastJourneys(loadSavedJourneys());
        setPlayerStats(loadPlayerStats());

        setPhase('summary');
      }
    }, 2200);
  }, [journeyState, currentCheckpoint, journeyStep, selectedCategory, chosenPath, results, scenario, addXP, pastJourneys, choiceIndices, savedScores, replayJourney]);

  const handleShare = useCallback(() => {
    if (!journeyState || !results || !chosenPath) return;
    const pathData = results.paths[chosenPath === 'A' ? 0 : 1];
    const story = generateLifeStory(journeyState, scenario, pathData.title, selectedCategory?.label || 'Life');
    const text = generateShareText(scenario, pathData.title, chosenPath, journeyState.stats, achievements, story, xp, level);
    navigator.clipboard.writeText(text).then(() => {
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2500);
    }).catch(() => {});
  }, [journeyState, results, chosenPath, scenario, selectedCategory, achievements, xp, level]);

  // ─── Replay & Fork ──────────────────────────────────────────────────────────

  const reconstructAndFork = useCallback((journey: SavedJourney, forkAtIndex: number) => {
    const cat = CATEGORIES.find(c => c.id === journey.categoryId) || CATEGORIES[0];
    setSelectedCategory(cat);
    setScenario(journey.scenario);
    setChosenPath(journey.pathType);
    setSavedScores({ financial: journey.financialScore ?? 5, happiness: journey.happinessScore ?? 5 });

    const templateKey = `${journey.categoryId}-${journey.pathType === 'A' ? 'safe' : 'bold'}`;
    const templates = checkpointTemplateMap[templateKey] || checkpointTemplateMap['career-safe'];

    let state = createInitialState(journey.pathType, journey.financialScore ?? 5, journey.happinessScore ?? 5);

    // Replay decisions up to the fork point
    for (let i = 0; i < forkAtIndex; i++) {
      const cp = generateCheckpoint(templates[i], state, journey.scenario, journey.pathTitle);
      const cIdx = journey.choiceIndices?.[i] ?? 0;
      const selectedChoice = cp.choices[cIdx];
      const decision = { year: cp.year, choice: selectedChoice.label, impact: selectedChoice.impact, outcome: selectedChoice.outcome };
      state = applyDecision(state, decision, selectedChoice.milestone);
    }

    setJourneyState(state);
    setJourneyStep(forkAtIndex);
    setChoiceIndices(journey.choiceIndices?.slice(0, forkAtIndex) || []);
    setShowOutcome(null); setShowMilestone(null);

    // Generate the fork-point checkpoint
    const forkCp = generateCheckpoint(templates[forkAtIndex], state, journey.scenario, journey.pathTitle);
    setCurrentCheckpoint(forkCp);
    setReplayJourney(journey);

    initAudio(); playClick();
    setPhase('journey');
  }, []);

  const restart = useCallback(() => {
    setPhase('intro'); setSelectedCategory(null); setScenario(''); setCurrentQuestion(0);
    setAnswers([]); setResults(null); setError(null); setChosenPath(null);
    setJourneyState(null); setJourneyStep(0); setCurrentCheckpoint(null);
    setShowOutcome(null); setShowMilestone(null); setAchievements([]);
    setStreak(0); setJourneyConfidence(''); setReplayJourney(null);
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`game-container ${shaking ? 'shake' : ''}`}>
      <ParticleField />
      <ModelBanner state={loader.state} progress={loader.progress} error={loader.error} onLoad={loader.ensure} label="Local LLM" />

      {/* Dark transition overlay */}
      <AnimatePresence>
        {darkTransition && <motion.div className="dark-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} />}
      </AnimatePresence>

      {phase !== 'intro' && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="game-hud">
          <div className="hud-row">
            <div className="hud-left">
              <span className="hud-name">{playerName || 'Traveler'}</span>
              <span className="hud-level-badge">LVL {level}</span>
            </div>
            <div className="hud-center">
              <XPBar xp={xp} level={level} />
            </div>
            <div className="hud-right">
              {phase === 'journey' && journeyState && (
                <div className="hud-mini-stats">
                  <span style={{color:'#4ade80'}}>{journeyState.stats.wealth}</span>
                  <span style={{color:'#fbbf24'}}>{journeyState.stats.happiness}</span>
                  <span style={{color:'#22d3ee'}}>{journeyState.stats.health}</span>
                </div>
              )}
            </div>
          </div>
          <AnimatePresence>
            {showXpPopup && <motion.div className="xp-popup" initial={{ opacity: 0, y: 0, scale: 0.5 }} animate={{ opacity: 1, y: -20, scale: 1 }} exit={{ opacity: 0, y: -60, scale: 0.5 }}>+{xpAmount} XP</motion.div>}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Milestone Toast */}
      <AnimatePresence>
        {showMilestone && (
          <motion.div className="milestone-toast" initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}>
            {'\u{1F3C5}'} Milestone: {showMilestone}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="game-error" onClick={() => setError(null)}>{error} (tap to dismiss)</motion.div>}
      </AnimatePresence>

      <div className="game-content">
        <AnimatePresence mode="wait">

          {/* ── INTRO ─────────────────────────────────────────────────── */}
          {phase === 'intro' && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="phase-intro">
              <div className="intro-brand">
                <span className="intro-brand-icon">{'\u{1F30C}'}</span>
                <span className="intro-brand-text">Parallel You</span>
              </div>

              <div className="intro-hero-typewriter">
                <LandingTypewriter phrases={['What if you chose differently?', 'The better version of you is waiting.', 'Explore the life you never lived.']} />
              </div>

              {/* Player name */}
              <div className="name-input-wrapper">
                <label className="name-label">What's your name, traveler?</label>
                <input className="name-input" value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Enter your name..." maxLength={20} />
              </div>

              {/* Player stats */}
              {playerStats.totalJourneys > 0 && (
                <div className="intro-player-stats">
                  <span>{'\u{1F3C6}'} {playerStats.totalXP} Total XP</span>
                  <span>{'\u{1F30C}'} {playerStats.totalJourneys} Journeys</span>
                  <span>{'\u{26A1}'} Level {playerStats.highestLevel}</span>
                </div>
              )}

              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => {
                if (playerName.trim()) localStorage.setItem('parallelYou_name', playerName.trim());
                initAudio(); playClick(); setPhase('category');
              }} className="btn-game-primary btn-start-journey"><span className="btn-game-glow" />Start Your Journey</motion.button>

              {/* Past journeys */}
              {pastJourneys.length > 0 && (
                <div className="past-journeys">
                  <div className="past-journeys-title">Past Journeys</div>
                  {pastJourneys.slice(0, 3).map(j => (
                    <div key={j.id} className="past-journey-card">
                      <div className="pj-header">
                        <span className="pj-path">{j.pathType === 'A' ? '\u{1F6E1}\u{FE0F}' : '\u{1F525}'} {j.pathTitle}</span>
                        <span className="pj-date">{j.date}</span>
                      </div>
                      <div className="pj-scenario">{j.scenario}</div>
                      <div className="pj-stats">
                        <span>{'\u{1F4B0}'}{j.finalStats.wealth}</span>
                        <span>{'\u{1F60A}'}{j.finalStats.happiness}</span>
                        <span>{'\u{1F49A}'}{j.finalStats.health}</span>
                        <span>{'\u{1F3C6}'}{j.xp} XP</span>
                      </div>
                      {j.replayable && (
                        <button className="pj-replay-btn" onClick={() => { setReplayJourney(j); setPhase('replay'); }}>
                          {'\u{1F500}'} Fork Journey
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="intro-hint">Powered by on-device AI — no data leaves your browser</div>
            </motion.div>
          )}

          {/* ── REPLAY / FORK ────────────────────────────────────────── */}
          {phase === 'replay' && replayJourney && (
            <motion.div key="replay" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="phase-replay">
              <h2 className="phase-title">Choose Your Fork Point</h2>
              <p className="phase-subtitle">Tap a decision to change it and replay from there</p>
              <div className="replay-journey-info">
                <span>{replayJourney.pathType === 'A' ? '\u{1F6E1}\u{FE0F}' : '\u{1F525}'} {replayJourney.pathTitle}</span>
                <span className="replay-scenario">{replayJourney.scenario}</span>
              </div>
              <div className="replay-timeline">
                {replayJourney.decisions.map((d, i) => (
                  <motion.div key={i} className="replay-node" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                    <div className="replay-node-left">
                      <div className="replay-node-year">Year {d.year}</div>
                      <div className="replay-node-dot" />
                    </div>
                    <div className="replay-node-info">
                      <div className="replay-node-choice">{d.choice}</div>
                      <div className="replay-node-outcome">{d.outcome}</div>
                    </div>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="replay-fork-btn" onClick={() => reconstructAndFork(replayJourney, i)}>
                      Fork Here
                    </motion.button>
                  </motion.div>
                ))}
              </div>
              <button onClick={() => { setReplayJourney(null); setPhase('intro'); }} className="btn-game-back">{'\u2190'} Back</button>
            </motion.div>
          )}

          {/* ── CATEGORY ──────────────────────────────────────────────── */}
          {phase === 'category' && (
            <motion.div key="category" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="phase-category">
              <h2 className="phase-title">Choose Your Domain</h2>
              <p className="phase-subtitle">What area of life are you wrestling with?</p>
              <div className="category-grid">
                {CATEGORIES.map((cat, i) => (
                  <motion.button key={cat.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} whileHover={{ scale: 1.04, y: -4 }} whileTap={{ scale: 0.97 }} onClick={() => handleCategorySelect(cat)} className="category-card">
                    <div className={`category-card-bg bg-gradient-to-br ${cat.color}`} />
                    <div className="category-card-content">
                      <span className="category-emoji">{cat.emoji}</span>
                      <span className="category-label">{cat.label}</span>
                      <span className="category-tagline">{cat.tagline}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── SCENARIO ──────────────────────────────────────────────── */}
          {phase === 'scenario' && selectedCategory && (
            <motion.div key="scenario" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="phase-scenario">
              <div className="scenario-header"><span className="scenario-category-badge">{selectedCategory.emoji} {selectedCategory.label}</span></div>
              <h2 className="phase-title">Describe Your Crossroads</h2>
              <p className="phase-subtitle">What decision is keeping you up at night?</p>

              {/* Examples ABOVE textarea */}
              <div className="scenario-examples">
                <div className="scenario-examples-label">Try one:</div>
                <div className="scenario-examples-grid">
                  {(SCENARIO_EXAMPLES[selectedCategory.id] || []).map((ex, i) => (
                    <motion.button key={i} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setScenario(ex.text)} className={`scenario-example-btn ${scenario === ex.text ? 'scenario-example-active' : ''}`}>
                      <span className="scenario-example-emoji">{ex.emoji}</span>
                      <span className="scenario-example-text">{ex.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="scenario-input-wrapper">
                <textarea value={scenario} onChange={(e) => setScenario(e.target.value)} placeholder="Or type your own decision..." className="scenario-input" autoFocus />
                <div className="scenario-char-count">{scenario.length}/200</div>
              </div>

              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleScenarioSubmit} disabled={!scenario.trim()} className="btn-game-primary">Lock It In</motion.button>
              <button onClick={() => setPhase('category')} className="btn-game-back">{'\u2190'} Back</button>
            </motion.div>
          )}

          {/* ── QUESTIONS ─────────────────────────────────────────────── */}
          {phase === 'questions' && selectedCategory && (
            <motion.div key="questions" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="phase-questions">
              <ProgressSteps current={currentQuestion} total={selectedCategory.questions.length} />
              <div className="question-counter">
                Question {currentQuestion + 1} of {selectedCategory.questions.length}
              </div>

              {/* Previously answered summary */}
              {answers.length > 0 && (
                <div className="answers-summary">
                  {answers.map((a, i) => {
                    const q = selectedCategory.questions[i];
                    const opt = q.options.find(o => o.value === a);
                    return <span key={i} className="answer-chip">{opt ? `${opt.emoji} ${opt.label}` : `\u{270D}\u{FE0F} ${a}`}</span>;
                  })}
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.div key={currentQuestion} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} className="question-card">
                  <h3 className="question-text">{selectedCategory.questions[currentQuestion].text}</h3>
                  <div className="question-options">
                    {selectedCategory.questions[currentQuestion].options.map((opt, i) => (
                      <motion.button key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} whileHover={{ scale: 1.03, x: 8 }} whileTap={{ scale: 0.97 }} onClick={() => handleAnswer(opt.value)} className="option-btn">
                        <span className="option-emoji">{opt.emoji}</span><span className="option-label">{opt.label}</span><span className="option-arrow">{'\u203A'}</span>
                      </motion.button>
                    ))}
                  </div>
                  <div className="custom-answer-section">
                    <div className="custom-answer-divider"><span>or share your own thought</span></div>
                    <div className="custom-answer-row">
                      <input
                        className="custom-answer-input"
                        value={customAnswer}
                        onChange={e => setCustomAnswer(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && customAnswer.trim()) handleAnswer(customAnswer.trim()); }}
                        placeholder="Type your own answer..."
                        maxLength={120}
                      />
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { if (customAnswer.trim()) handleAnswer(customAnswer.trim()); }}
                        disabled={!customAnswer.trim()}
                        className="custom-answer-submit"
                      >{'\u2192'}</motion.button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
              <button onClick={goBackQuestion} className="btn-game-back">{'\u2190'} {currentQuestion > 0 ? 'Previous Question' : 'Back to Scenario'}</button>
            </motion.div>
          )}

          {/* ── SIMULATING ────────────────────────────────────────────── */}
          {phase === 'simulating' && (
            <motion.div key="simulating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="phase-simulating">
              <div className="sim-portal glitch">
                <div className="sim-ring sim-ring-1" /><div className="sim-ring sim-ring-2" /><div className="sim-ring sim-ring-3" />
                <div className="sim-core">{'\u{1F30C}'}</div>
              </div>
              <motion.p key={simulatingMsg} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sim-message">{simulatingMsg}</motion.p>
              {/* Branching animation */}
              <div className="sim-branches">
                <div className="sim-branch sim-branch-a" /><div className="sim-branch sim-branch-b" />
                <span className="sim-branch-label sim-branch-label-a">Safe</span><span className="sim-branch-label sim-branch-label-b">Bold</span>
              </div>
              {tokenProgress > 0 && (
                <div className="sim-progress-section">
                  <div className="sim-token-bar-track"><motion.div className="sim-token-bar-fill" animate={{ width: `${Math.min(100, (tokenProgress / 200) * 100)}%` }} transition={{ duration: 0.3 }} /></div>
                  <div className="sim-token-count">{tokenProgress} / ~200 tokens</div>
                </div>
              )}
              {tokenProgress === 0 && (
                <div className="sim-waiting">{loader.state === 'loading' ? `Loading AI model... ${Math.round((loader.progress || 0) * 100)}%` : 'Preparing quantum simulation...'}</div>
              )}
              {streamSnippet && <div className="sim-stream-preview">{streamSnippet}</div>}
              <div className="sim-dots"><span className="sim-dot" /><span className="sim-dot" /><span className="sim-dot" /></div>
            </motion.div>
          )}

          {/* ── REVEAL ────────────────────────────────────────────────── */}
          {phase === 'reveal' && results && (
            <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="phase-reveal">
              <motion.h2 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="reveal-title"><TypewriterText text={`${playerName || 'Traveler'}, Two Timelines Diverge`} speed={60} /></motion.h2>
              <p className="reveal-subtitle">Your decision: <em>{scenario}</em></p>

              <div className="paths-container">
                {results.paths.map((path, index) => {
                  const pathLetter = index === 0 ? 'A' : 'B';
                  const isRec = results.recommendation.winner === pathLetter;
                  return (
                    <motion.div key={index} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + index * 0.3 }} className={`path-card ${isRec ? 'path-recommended' : ''}`}>
                      {isRec && <div className="path-badge">AI PICK</div>}
                      <div className="path-header">
                        <span className="path-emoji">{path.emoji}</span>
                        <div><div className="path-letter">Path {pathLetter}</div><h3 className="path-title">{path.title}</h3></div>
                      </div>

                      {/* Identity statement */}
                      <div className="reveal-identity">
                        <div className="reveal-identity-text">
                          {index === 0 ? 'You become someone who values stability and builds on certainty' : 'You become a risk-taker who bets on themselves'}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="stats-grid">
                        <div className="stat-item"><div className="stat-value stat-success">{path.successRate}%</div><div className="stat-label">Success</div></div>
                        <div className="stat-item"><div className={`stat-value ${path.riskLevel === 'Low' ? 'stat-low' : path.riskLevel === 'High' ? 'stat-high' : 'stat-med'}`}>{path.riskLevel}</div><div className="stat-label">Risk</div></div>
                        <div className="stat-item"><div className="stat-value">{path.financialScore}/10</div><div className="stat-label">Finance</div></div>
                        <div className="stat-item"><div className="stat-value">{path.happinessScore}/10</div><div className="stat-label">Joy</div></div>
                      </div>

                      {/* Tradeoffs */}
                      <div className="reveal-tradeoff">
                        <div className="reveal-gained"><span className="reveal-tradeoff-label">You gain</span>{path.pros}</div>
                        <div className="reveal-sacrificed"><span className="reveal-tradeoff-label">You sacrifice</span>{path.cons}</div>
                      </div>

                      {/* Timeline */}
                      <div className="timeline">
                        {[{ y: 'Year 1', t: path.year1 }, { y: 'Year 5', t: path.year5 }, { y: 'Year 10', t: path.year10 }].map((item, ti) => (
                          <div key={ti} className="timeline-item"><div className="timeline-dot" /><div className="timeline-content"><span className="timeline-year">{item.y}</span><span className="timeline-text">{item.t}</span></div></div>
                        ))}
                      </div>

                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handlePathChoice(pathLetter)} className={`btn-choose-path ${isRec ? 'btn-choose-recommended' : ''}`}>
                        Choose This Path {'\u2192'}
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>

              {/* AI Confidence */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="ai-rec">
                <div className="ai-rec-label">{'\u{1F3AF}'} AI Confidence</div>
                <div className="ai-rec-bar-track"><motion.div className="ai-rec-bar-fill" initial={{ width: 0 }} animate={{ width: `${results.recommendation.confidenceScore}%` }} transition={{ delay: 1.3, duration: 1 }} /></div>
                <div className="ai-rec-score">{results.recommendation.confidenceScore}%</div>
                <p className="ai-rec-reason">{results.recommendation.reason}</p>
              </motion.div>

              {/* Back / Redo */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button onClick={() => { setResults(null); setCurrentQuestion(0); setAnswers([]); setPhase('questions'); }} className="btn-game-back">{'\u2190'} Redo Quiz</button>
                <button onClick={() => { setResults(null); setPhase('scenario'); }} className="btn-game-back">{'\u2190'} Change Scenario</button>
              </motion.div>
            </motion.div>
          )}

          {/* ── JOURNEY (Dynamic Engine) ──────────────────────────────── */}
          {phase === 'journey' && journeyState && currentCheckpoint && (
            <motion.div key="journey" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="phase-journey">
              {/* Header */}
              <div className="journey-header">
                <div className="journey-path-badge">
                  {chosenPath === 'A' ? '\u{1F6E1}\u{FE0F}' : '\u{1F525}'} {results?.paths[chosenPath === 'A' ? 0 : 1].title}
                </div>
                <div className="journey-year-indicator">Year {currentCheckpoint.year} of 10</div>
              </div>

              {/* Timeline Progress */}
              <div className="journey-timeline-bar">
                {[1, 3, 5, 7, 10].map((yr, i) => (
                  <div key={yr} className={`journey-timeline-dot ${i < journeyStep ? 'jt-done' : ''} ${i === journeyStep ? 'jt-current' : ''}`}>
                    <span className="jt-year">Year {yr}</span>
                  </div>
                ))}
              </div>

              {/* 5 Live Stats */}
              <div className="journey-stats">
                {([
                    { label: 'Wealth', value: journeyState.stats.wealth, emoji: '\u{1F4B0}' },
                    { label: 'Happiness', value: journeyState.stats.happiness, emoji: '\u{1F60A}' },
                    { label: 'Health', value: journeyState.stats.health, emoji: '\u{1F49A}' },
                    { label: 'Relations', value: journeyState.stats.relationships, emoji: '\u{1F465}' },
                    { label: 'Risk', value: journeyState.stats.risk, emoji: '\u{26A0}\u{FE0F}' },
                  ]).map(bar => (
                  <div key={bar.label} className="jstat">
                    <div className="jstat-bar" style={{ '--val': `${bar.value}%` } as React.CSSProperties}>
                      <div className={`jstat-fill jstat-${bar.label.toLowerCase()}`} />
                    </div>
                    <span className="jstat-label">{bar.emoji} {bar.value}</span>
                  </div>
                ))}
              </div>

              {/* Outcome popup */}
              <AnimatePresence>
                {showOutcome && (
                  <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20 }} className="journey-outcome">
                    {'\u2728'} {showOutcome}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Checkpoint card */}
              {!showOutcome && (
                <AnimatePresence mode="wait">
                  <motion.div key={journeyStep} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className={`journey-card ${currentCheckpoint.turningPoint ? 'turning-point' : ''}`}>

                    {/* Narrative Bridge */}
                    {currentCheckpoint.narrativeBridge && (
                      <div className="journey-bridge">
                        {journeyState.decisions.length > 0 && (
                          <div className="journey-bridge-prev">Previously...</div>
                        )}
                        <div className="journey-bridge-text">{currentCheckpoint.narrativeBridge}</div>
                      </div>
                    )}

                    {/* Turning point badge */}
                    {currentCheckpoint.turningPoint && (
                      <div className="turning-point-badge">{'\u{26A0}\u{FE0F}'} TURNING POINT</div>
                    )}

                    <h3 className="journey-card-title">{currentCheckpoint.title}</h3>
                    <p className="journey-card-scenario">{currentCheckpoint.scenario}</p>

                    {/* Confidence input — bonus XP for explaining your reasoning */}
                    <div className="journey-confidence">
                      <input
                        type="text"
                        value={journeyConfidence}
                        onChange={(e) => setJourneyConfidence(e.target.value)}
                        placeholder="Why this choice? (optional, +10 XP bonus)"
                        className="journey-confidence-input"
                      />
                      {journeyConfidence.trim().length > 10 && (
                        <span className="confidence-bonus">+10 XP bonus!</span>
                      )}
                    </div>

                    <div className="journey-options">
                      {currentCheckpoint.choices.map((opt, i) => (
                        <motion.button key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }} whileHover={{ scale: 1.02, x: 6 }} whileTap={{ scale: 0.98 }} onClick={() => handleJourneyChoice(opt)} className={`journey-option-btn ${Object.values(opt.impact).reduce((a, b) => a + (b as number), 0) > 0 ? 'jo-positive' : Object.values(opt.impact).reduce((a, b) => a + (b as number), 0) < 0 ? 'jo-negative' : ''}`}>
                          <span className="journey-opt-emoji">{opt.emoji}</span>
                          <div className="journey-opt-content">
                            <span className="journey-opt-label">{opt.label}</span>
                            {opt.milestone && <span className="journey-opt-milestone">{'\u{1F3C5}'} {opt.milestone}</span>}
                          </div>
                          <div className="journey-opt-effects">
                            {Object.entries(opt.impact).filter(([, v]) => v !== 0).slice(0, 3).map(([k, v]) => (
                              <span key={k} className={(v as number) > 0 ? 'je-pos' : 'je-neg'}>
                                {(v as number) > 0 ? '+' : ''}{v}
                              </span>
                            ))}
                          </div>
                        </motion.button>
                      ))}
                    </div>


                    {currentCheckpoint.turningPoint && (
                      <div className="turning-point-warning">This decision will define the rest of your journey. No going back.</div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </motion.div>
          )}

          {/* ── SUMMARY (Life Report) ─────────────────────────────────── */}
          {phase === 'summary' && results && chosenPath && journeyState && (
            <motion.div key="summary" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="phase-summary">
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.8 }} className="summary-icon">{'\u{1F3C6}'}</motion.div>
              <h2 className="summary-title">Journey Complete</h2>
              <p className="summary-path">{chosenPath === 'A' ? '\u{1F6E1}\u{FE0F}' : '\u{1F525}'} {results.paths[chosenPath === 'A' ? 0 : 1].title}</p>

              {/* Life Story */}
              <div className="summary-life-story">
                {generateLifeStory(journeyState, scenario, results.paths[chosenPath === 'A' ? 0 : 1].title, selectedCategory?.label || 'Life')}
              </div>

              {/* Final Stats */}
              <div className="summary-stats-grid">
                {([
                    { label: 'Wealth', value: journeyState.stats.wealth, emoji: '\u{1F4B0}' },
                    { label: 'Happiness', value: journeyState.stats.happiness, emoji: '\u{1F60A}' },
                    { label: 'Health', value: journeyState.stats.health, emoji: '\u{1F49A}' },
                    { label: 'Relations', value: journeyState.stats.relationships, emoji: '\u{1F465}' },
                    { label: 'Risk', value: journeyState.stats.risk, emoji: '\u{26A0}\u{FE0F}' },
                  ]).map(bar => (
                  <div key={bar.label} className="summary-stat">
                    <div className="summary-stat-value">{bar.value}</div>
                    <div className="summary-stat-label">{bar.emoji} {bar.label}</div>
                  </div>
                ))}
              </div>

              {/* Stat Evolution */}
              {journeyState.statHistory.length > 1 && (
                <div className="summary-stat-evolution">
                  <div className="summary-log-title">Stat Evolution</div>
                  {journeyState.statHistory.map((snap, i) => (
                    <div key={i} className="stat-evolution-row">
                      <span className="stat-evo-year">{i === 0 ? 'Start' : `Year ${[1, 3, 5, 7, 10][i - 1] || '?'}`}</span>
                      <div className="stat-evo-bars">
                        {[
                          { key: 'wealth', val: snap.wealth, cls: 'evo-wealth' },
                          { key: 'happy', val: snap.happiness, cls: 'evo-happiness' },
                          { key: 'health', val: snap.health, cls: 'evo-health' },
                        ].map(b => (
                          <div key={b.key} className="stat-evo-bar">
                            <div className="stat-evo-track"><div className={`stat-evo-fill ${b.cls}`} style={{ width: `${b.val}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Parallel Timeline */}
              {selectedCategory && results && chosenPath && (
                <ParallelTimeline
                  chosenDecisions={journeyState.decisions}
                  otherTemplates={checkpointTemplateMap[`${selectedCategory.id}-${chosenPath === 'A' ? 'bold' : 'safe'}`] || []}
                  chosenTitle={results.paths[chosenPath === 'A' ? 0 : 1].title}
                  otherTitle={results.paths[chosenPath === 'A' ? 1 : 0].title}
                  chosenEmoji={chosenPath === 'A' ? '\u{1F6E1}\u{FE0F}' : '\u{1F525}'}
                  otherEmoji={chosenPath === 'A' ? '\u{1F525}' : '\u{1F6E1}\u{FE0F}'}
                />
              )}

              {/* Journey Log */}
              <div className="summary-log">
                <h4 className="summary-log-title">Your Journey</h4>
                {journeyState.decisions.map((entry, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.12 }} className="summary-log-entry">
                    <div className="slog-year">Year {entry.year}</div>
                    <div className="slog-choice">{entry.choice}</div>
                    <div className="slog-outcome">{entry.outcome}</div>
                  </motion.div>
                ))}
              </div>

              {/* Alternate Reality */}
              {results && (
                <div className="summary-whatif">
                  <div className="summary-whatif-title">{'\u{1F30C}'} The Road Not Taken</div>
                  <p className="summary-whatif-path">In another universe, you chose <strong>{results.paths[chosenPath === 'A' ? 1 : 0].title}</strong></p>
                  <div className="summary-whatif-timeline">
                    <div className="summary-whatif-year"><strong>Year 1:</strong> {results.paths[chosenPath === 'A' ? 1 : 0].year1}</div>
                    <div className="summary-whatif-year"><strong>Year 5:</strong> {results.paths[chosenPath === 'A' ? 1 : 0].year5}</div>
                    <div className="summary-whatif-year"><strong>Year 10:</strong> {results.paths[chosenPath === 'A' ? 1 : 0].year10}</div>
                  </div>
                </div>
              )}

              {/* Achievements */}
              {achievements.length > 0 && (
                <div className="summary-achievements">
                  <div className="summary-achievements-title">{'\u{1F3C5}'} Achievements Unlocked</div>
                  <div className="achievements-grid">
                    {achievements.map(a => (
                      <motion.div key={a.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="achievement-badge">
                        <span className="achievement-emoji">{a.emoji}</span>
                        <span>{a.label}<span className="achievement-desc">{a.description}</span></span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* XP */}
              <div className="summary-xp">
                <div className="summary-xp-badge">{'\u{1F3C6}'} {xp} XP Earned</div>
                <div className="summary-level">Level {level} Decision Maker</div>
              </div>

              {/* Background AI Insight */}
              {bgInsight && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="summary-ai-insight">
                  <div className="ai-insight-label">{'\u{1F9E0}'} AI Insight (generated while you played)</div>
                  <p className="ai-insight-text">{bgInsight}</p>
                </motion.div>
              )}

              <div className="summary-actions">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={restart} className="btn-game-primary">{'\u{1F504}'} New Simulation</motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleShare} className="btn-game-secondary">
                  {shareStatus === 'copied' ? '\u{2705} Copied!' : '\u{1F4CB} Share Journey'}
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setPhase('reveal')} className="btn-game-back">{'\u2190'} Review Paths</motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
