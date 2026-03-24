// ============================================================
// Journey State Engine — game-like life simulator
// ============================================================

// ----- Types -----

export type Tone = 'rising' | 'falling' | 'unstable' | 'balanced';

export interface JourneyStats {
  wealth: number;        // 0-100
  happiness: number;     // 0-100
  health: number;        // 0-100
  relationships: number; // 0-100
  risk: number;          // 0-100
}

export interface JourneyDecision {
  year: number;
  choice: string;
  impact: Partial<JourneyStats>;
  outcome: string;
}

export interface JourneyState {
  stats: JourneyStats;
  decisions: JourneyDecision[];
  milestones: string[];
  tone: Tone;
  statHistory: JourneyStats[]; // snapshot after each decision for timeline viz
}

export interface CheckpointChoice {
  label: string;
  emoji: string;
  impact: Partial<JourneyStats>;
  outcome: string;
  milestone?: string;
}

export interface CheckpointTemplate {
  year: number;
  title: string;
  base: string;
  variations: {
    lowWealth?: string;
    highWealth?: string;
    lowHappiness?: string;
    highHappiness?: string;
    highRisk?: string;
    lowHealth?: string;
    lowRelationships?: string;
    highRelationships?: string;
  };
  choices: CheckpointChoice[];
  turningPoint?: boolean;
}

export interface GeneratedCheckpoint {
  year: number;
  title: string;
  scenario: string;
  choices: CheckpointChoice[];
  turningPoint: boolean;
  narrativeBridge: string | null;
}

export interface Achievement {
  id: string;
  emoji: string;
  label: string;
  description: string;
}

// ----- Utility helpers -----

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function sumImpact(impact: Partial<JourneyStats>): number {
  let total = 0;
  if (impact.wealth !== undefined) total += impact.wealth;
  if (impact.happiness !== undefined) total += impact.happiness;
  if (impact.health !== undefined) total += impact.health;
  if (impact.relationships !== undefined) total += impact.relationships;
  // risk is intentionally excluded from net-positive/negative sum
  return total;
}

function hasLargeSwings(impact: Partial<JourneyStats>): boolean {
  const vals = [
    impact.wealth,
    impact.happiness,
    impact.health,
    impact.relationships,
    impact.risk,
  ].filter((v): v is number => v !== undefined);
  const hasPositive = vals.some((v) => v >= 10);
  const hasNegative = vals.some((v) => v <= -10);
  return hasPositive && hasNegative;
}

// ----- Core functions -----

export function createInitialState(
  path: 'A' | 'B',
  financialScore: number,
  happinessScore: number,
): JourneyState {
  const base: JourneyStats =
    path === 'A'
      ? { wealth: 50, happiness: 45, health: 70, relationships: 65, risk: 25 }
      : { wealth: 30, happiness: 55, health: 60, relationships: 45, risk: 70 };

  base.wealth = clamp(base.wealth + financialScore * 5);
  base.happiness = clamp(base.happiness + happinessScore * 5);

  return {
    stats: base,
    decisions: [],
    milestones: [],
    tone: 'balanced',
    statHistory: [],
  };
}

export function recalculateTone(state: JourneyState): Tone {
  const recent = state.decisions.slice(-3);
  if (recent.length === 0) return 'balanced';

  let netSum = 0;
  let swingDetected = false;

  for (const d of recent) {
    netSum += sumImpact(d.impact);
    if (hasLargeSwings(d.impact)) swingDetected = true;
  }

  if (swingDetected) return 'unstable';
  if (netSum > 5) return 'rising';
  if (netSum < -5) return 'falling';
  return 'balanced';
}

export function applyDecision(
  state: JourneyState,
  decision: JourneyDecision,
  milestone?: string,
): JourneyState {
  const newStats: JourneyStats = { ...state.stats };
  const impact = decision.impact;
  if (impact.wealth !== undefined) newStats.wealth = clamp(newStats.wealth + impact.wealth);
  if (impact.happiness !== undefined) newStats.happiness = clamp(newStats.happiness + impact.happiness);
  if (impact.health !== undefined) newStats.health = clamp(newStats.health + impact.health);
  if (impact.relationships !== undefined) newStats.relationships = clamp(newStats.relationships + impact.relationships);
  if (impact.risk !== undefined) newStats.risk = clamp(newStats.risk + impact.risk);

  const newDecisions = [...state.decisions, decision];
  const newMilestones = milestone
    ? [...state.milestones, milestone]
    : [...state.milestones];
  const newStatHistory = [...state.statHistory, { ...newStats }];

  const draft: JourneyState = {
    stats: newStats,
    decisions: newDecisions,
    milestones: newMilestones,
    tone: state.tone,
    statHistory: newStatHistory,
  };
  draft.tone = recalculateTone(draft);
  return draft;
}

export function buildNarrativeBridge(state: JourneyState): string {
  const { tone, stats } = state;

  if (tone === 'falling' && stats.wealth < 30)
    return 'Your finances are crumbling. Every day feels like a test of willpower...';
  if (tone === 'falling' && stats.happiness < 30)
    return 'The weight of your choices is heavy. Joy feels distant...';
  if (tone === 'rising' && stats.wealth > 70)
    return 'Success breeds success. Your bank account reflects years of smart moves...';
  if (tone === 'rising' && stats.happiness > 70)
    return 'Life feels full. Your choices have led to genuine contentment...';
  if (tone === 'unstable')
    return "It's been a rollercoaster. Some days you question everything, other days it all makes sense...";
  if (stats.relationships < 25)
    return 'You\'ve been so focused on your path that the people around you have started to drift away...';
  if (stats.health < 30)
    return 'Your body is paying the price for years of neglect. Something has to change...';
  if (stats.risk > 80)
    return "You're living on the edge. One wrong move and everything could unravel...";

  if (tone === 'rising') return 'Momentum is building...';
  if (tone === 'falling') return 'Things have been tough...';
  if (tone === 'balanced') return 'Life has settled into a rhythm...';
  return 'Nothing is predictable anymore...';
}

export function generateCheckpoint(
  template: CheckpointTemplate,
  state: JourneyState,
  scenario: string,
  pathTitle: string,
): GeneratedCheckpoint {
  // Pick scenario text from variations
  let scenarioText = template.base;
  const s = state.stats;
  if (s.wealth < 30 && template.variations.lowWealth) scenarioText = template.variations.lowWealth;
  else if (s.wealth > 70 && template.variations.highWealth) scenarioText = template.variations.highWealth;
  else if (s.happiness < 30 && template.variations.lowHappiness) scenarioText = template.variations.lowHappiness;
  else if (s.happiness > 70 && template.variations.highHappiness) scenarioText = template.variations.highHappiness;
  else if (s.risk > 70 && template.variations.highRisk) scenarioText = template.variations.highRisk;
  else if (s.health < 30 && template.variations.lowHealth) scenarioText = template.variations.lowHealth;
  else if (s.relationships < 30 && template.variations.lowRelationships) scenarioText = template.variations.lowRelationships;
  else if (s.relationships > 70 && template.variations.highRelationships) scenarioText = template.variations.highRelationships;

  const context = `On your ${pathTitle} path, ${template.year} years into your decision to ${scenario}...`;
  const fullScenario = `${context} ${scenarioText}`;

  const narrativeBridge =
    state.decisions.length > 0 ? buildNarrativeBridge(state) : null;

  const isTurningPoint = !!template.turningPoint;
  const title = isTurningPoint
    ? `TURNING POINT: ${template.title}`
    : template.title;

  return {
    year: template.year,
    title,
    scenario: fullScenario,
    choices: template.choices,
    turningPoint: isTurningPoint,
    narrativeBridge,
  };
}

export function buildPersonalizedContext(
  state: JourneyState,
  year: number,
  scenario: string,
  pathTitle: string,
): string {
  const s = state.stats;

  if (year === 1) {
    return `A year into your decision to ${scenario}, walking the ${pathTitle} path...`;
  }
  if (year === 3) {
    return `Three years since you ${scenario}. Your ${pathTitle} journey is taking shape...`;
  }
  if (year === 5) {
    const feel =
      state.tone === 'rising'
        ? 'vindicated'
        : state.tone === 'falling'
          ? 'questionable'
          : 'complex';
    return `Halfway through the decade. Your choice to ${scenario} feels ${feel}...`;
  }
  if (year === 7) {
    const statEntries: [string, number][] = [
      ['wealth', s.wealth],
      ['happiness', s.happiness],
      ['health', s.health],
      ['relationships', s.relationships],
    ];
    const sorted = [...statEntries].sort((a, b) => b[1] - a[1]);
    const highest = sorted[0][0];
    const lowest = sorted[sorted.length - 1][0];
    const comment =
      highest === lowest
        ? `Your stats are remarkably even`
        : `Your ${highest} leads the way while ${lowest} lags behind`;
    return `Seven years of ${pathTitle} living. ${comment}...`;
  }
  if (year === 10) {
    return `A decade has passed since you ${scenario}. Looking back...`;
  }
  return `Year ${year} on the ${pathTitle} path...`;
}

export function computeAchievements(
  state: JourneyState,
  chosenPath: 'A' | 'B',
): Achievement[] {
  const achievements: Achievement[] = [];
  const s = state.stats;
  const d = state.decisions;

  // Survivor — always
  achievements.push({
    id: 'survivor',
    emoji: '\u{1F3C6}',
    label: 'Survivor',
    description: 'Completed the journey.',
  });

  // Burned the Boats
  if (chosenPath === 'B' && s.risk > 70) {
    achievements.push({
      id: 'burned_the_boats',
      emoji: '\u{1F525}',
      label: 'Burned the Boats',
      description: 'Chose the bold path and kept the risk high throughout.',
    });
  }

  // Silent Builder
  if (
    chosenPath === 'A' &&
    s.wealth > 40 &&
    s.happiness > 40 &&
    s.health > 40 &&
    s.relationships > 40 &&
    s.risk > 40
  ) {
    // Note: risk > 40 is unusual for safe path but spec says "all stats"
    // Re-read spec: "all stats > 40 at end" — that literally means every stat
    achievements.push({
      id: 'silent_builder',
      emoji: '\u{1F9F1}',
      label: 'Silent Builder',
      description: 'Took the safe path and kept every stat above 40.',
    });
  }

  // Chaos Walker — 3+ decisions with impact values of +/-15 or more
  const chaosCount = d.filter((dec) => {
    const vals = Object.values(dec.impact) as number[];
    return vals.some((v) => Math.abs(v) >= 15);
  }).length;
  if (chaosCount >= 3) {
    achievements.push({
      id: 'chaos_walker',
      emoji: '\u{1F32A}\u{FE0F}',
      label: 'Chaos Walker',
      description: 'Made 3 or more high-impact decisions.',
    });
  }

  // Heart Over Head — happiness > wealth AND 3+ choices that boosted happiness
  const happinessBoosts = d.filter(
    (dec) => dec.impact.happiness !== undefined && dec.impact.happiness > 0,
  ).length;
  if (s.happiness > s.wealth && happinessBoosts >= 3) {
    achievements.push({
      id: 'heart_over_head',
      emoji: '\u{2764}\u{FE0F}',
      label: 'Heart Over Head',
      description: 'Prioritized happiness over wealth.',
    });
  }

  // Iron Will — health > 60 despite at least one decision that decreased it
  const healthDecreased = d.some(
    (dec) => dec.impact.health !== undefined && dec.impact.health < 0,
  );
  if (s.health > 60 && healthDecreased) {
    achievements.push({
      id: 'iron_will',
      emoji: '\u{1F6E1}\u{FE0F}',
      label: 'Iron Will',
      description: 'Maintained strong health despite setbacks.',
    });
  }

  // The Pivot — a turning point decision that reversed the tone
  if (state.statHistory.length >= 2) {
    for (let i = 1; i < state.statHistory.length; i++) {
      // Approximate tone before and after this decision
      const before: JourneyState = {
        ...state,
        decisions: state.decisions.slice(0, i),
        statHistory: state.statHistory.slice(0, i),
      };
      const after: JourneyState = {
        ...state,
        decisions: state.decisions.slice(0, i + 1),
        statHistory: state.statHistory.slice(0, i + 1),
      };
      const toneBefore = recalculateTone(before);
      const toneAfter = recalculateTone(after);
      if (
        (toneBefore === 'falling' && toneAfter === 'rising') ||
        (toneBefore === 'rising' && toneAfter === 'falling')
      ) {
        achievements.push({
          id: 'the_pivot',
          emoji: '\u{1F500}',
          label: 'The Pivot',
          description: 'A turning point decision that completely reversed your trajectory.',
        });
        break;
      }
    }
  }

  // Balanced Life — all stats between 35-65
  if (
    s.wealth >= 35 && s.wealth <= 65 &&
    s.happiness >= 35 && s.happiness <= 65 &&
    s.health >= 35 && s.health <= 65 &&
    s.relationships >= 35 && s.relationships <= 65 &&
    s.risk >= 35 && s.risk <= 65
  ) {
    achievements.push({
      id: 'balanced_life',
      emoji: '\u{2696}\u{FE0F}',
      label: 'Balanced Life',
      description: 'Ended with all stats in perfect balance.',
    });
  }

  // Wealthy Beyond Measure
  if (s.wealth > 85) {
    achievements.push({
      id: 'wealthy_beyond_measure',
      emoji: '\u{1F48E}',
      label: 'Wealthy Beyond Measure',
      description: 'Achieved extraordinary wealth.',
    });
  }

  // Joy Seeker
  if (s.happiness > 85) {
    achievements.push({
      id: 'joy_seeker',
      emoji: '\u{2600}\u{FE0F}',
      label: 'Joy Seeker',
      description: 'Found extraordinary happiness.',
    });
  }

  return achievements;
}

export function generateLifeStory(
  state: JourneyState,
  scenario: string,
  pathTitle: string,
  categoryLabel: string,
): string {
  const s = state.stats;
  const d = state.decisions;

  const opening = `When you chose to ${scenario}, you stepped onto the ${pathTitle} path.`;

  // Find turning point or biggest stat change
  let middle = '';
  const turningPointIdx = d.findIndex(
    (dec) =>
      Object.values(dec.impact).some(
        (v) => typeof v === 'number' && Math.abs(v) >= 15,
      ),
  );
  if (turningPointIdx !== -1) {
    const tp = d[turningPointIdx];
    middle = `The turning point came in Year ${tp.year} when you ${tp.choice}. It changed everything.`;
  } else if (d.length > 0) {
    // Biggest absolute total impact
    let biggest = d[0];
    let biggestSum = 0;
    for (const dec of d) {
      const total = Object.values(dec.impact).reduce(
        (acc: number, v) => acc + Math.abs(typeof v === 'number' ? v : 0),
        0,
      );
      if (total > biggestSum) {
        biggestSum = total;
        biggest = dec;
      }
    }
    middle = `A defining moment came in Year ${biggest.year} when you ${biggest.choice}. It shaped everything that followed.`;
  }

  // Stats comment
  const statEntries: [string, number][] = [
    ['wealth', s.wealth],
    ['happiness', s.happiness],
    ['health', s.health],
    ['relationships', s.relationships],
  ];
  const sorted = [...statEntries].sort((a, b) => b[1] - a[1]);
  const highest = sorted[0][0];
  const lowest = sorted[sorted.length - 1][0];
  const statsComment = `Your ${highest} thrived, though ${lowest} paid the price.`;

  // Closing
  let closing: string;
  switch (state.tone) {
    case 'rising':
      closing = 'In the end, your bold moves paid off.';
      break;
    case 'falling':
      closing = "It wasn't easy, but you gained wisdom money can't buy.";
      break;
    case 'balanced':
      closing = 'You found a rhythm that worked for you.';
      break;
    case 'unstable':
      closing = "It was never boring \u2014 and that's exactly how you wanted it.";
      break;
  }

  return [opening, middle, statsComment, closing].filter(Boolean).join(' ');
}

export function generateStatBars(state: JourneyState): string[] {
  const s = state.stats;
  const statNames: [string, number][] = [
    ['Wealth', s.wealth],
    ['Happiness', s.happiness],
    ['Health', s.health],
    ['Relationships', s.relationships],
    ['Risk', s.risk],
  ];

  const filled = '\u2588';
  const empty = '\u2591';

  return statNames.map(([name, value]) => {
    const blocks = Math.round((value / 100) * 10);
    const bar = filled.repeat(blocks) + empty.repeat(10 - blocks);
    const padded = name.padEnd(14);
    return `${padded}${bar}  ${value}`;
  });
}

// ============================================================
// Checkpoint Templates
// ============================================================

// --- Career Safe ---
export const careerSafeTemplates: CheckpointTemplate[] = [
  {
    year: 1,
    title: 'First Review',
    base: 'Your first annual review is here. Your manager is impressed but there are two paths forward: lead a high-profile project or invest in further training.',
    variations: {
      lowWealth: 'Money is tight and a promotion bonus could really help right now.',
      lowHappiness: 'Work has felt like a grind. You need something to reignite the spark.',
    },
    choices: [
      {
        label: 'Lead the project',
        emoji: '\u{1F680}',
        impact: { wealth: 10, happiness: 5, health: -5, relationships: -5, risk: 10 },
        outcome: 'You took the lead and delivered under pressure, earning respect across the team.',
        milestone: 'Led first major project',
      },
      {
        label: 'Take the training',
        emoji: '\u{1F4DA}',
        impact: { wealth: -5, happiness: 5, health: 5, relationships: 5, risk: -5 },
        outcome: 'You invested in yourself. The skills will pay dividends down the line.',
      },
      {
        label: 'Ask for both',
        emoji: '\u{1F3AF}',
        impact: { wealth: 5, happiness: -5, health: -10, relationships: 0, risk: 5 },
        outcome: 'You took on a heavy load trying to do it all. Ambitious, but exhausting.',
      },
    ],
  },
  {
    year: 3,
    title: 'Promotion Dilemma',
    base: 'A promotion is on the table, but it requires relocating to another city. Your life here is comfortable.',
    variations: {
      lowWealth: 'Finances make relocation tempting. The salary bump could change everything.',
      highHappiness: "You're happy but the promotion could disrupt that peace you've built.",
      lowRelationships: 'With few ties here, maybe a fresh start is exactly what you need.',
    },
    choices: [
      {
        label: 'Relocate for the promotion',
        emoji: '\u{2708}\u{FE0F}',
        impact: { wealth: 15, happiness: -5, health: 0, relationships: -10, risk: 10 },
        outcome: 'The move was tough on your personal life, but the career leap was undeniable.',
        milestone: 'Relocated for career',
      },
      {
        label: 'Stay and negotiate',
        emoji: '\u{1F91D}',
        impact: { wealth: 5, happiness: 5, health: 5, relationships: 5, risk: -5 },
        outcome: 'You negotiated well and found a middle ground that kept everyone happy.',
      },
      {
        label: 'Propose remote arrangement',
        emoji: '\u{1F4BB}',
        impact: { wealth: 8, happiness: 10, health: 5, relationships: 0, risk: 5 },
        outcome: 'Remote work gave you flexibility. A modern solution to an old dilemma.',
      },
    ],
  },
  {
    year: 5,
    title: 'Industry Disruption',
    base: 'Your entire industry is being disrupted by new technology. The skills you built may become obsolete within years.',
    variations: {
      lowWealth: 'With savings running thin, you cannot afford to fall behind.',
      highRisk: 'You already feel exposed. This disruption adds another layer of uncertainty.',
      lowHealth: 'The stress of constant change is taking a physical toll.',
    },
    turningPoint: true,
    choices: [
      {
        label: 'Upskill aggressively',
        emoji: '\u{26A1}',
        impact: { wealth: -10, happiness: -5, health: -10, relationships: -10, risk: -15 },
        outcome: 'Months of grueling study paid off. You emerged on the cutting edge.',
        milestone: 'Survived industry disruption',
      },
      {
        label: 'Ride it out',
        emoji: '\u{1F30A}',
        impact: { wealth: 5, happiness: 10, health: 5, relationships: 5, risk: 20 },
        outcome: 'You kept your routine and hoped for the best. Time will tell if that was wise.',
      },
    ],
  },
  {
    year: 7,
    title: 'Burnout Warning',
    base: 'Seven years in and the cracks are showing. You wake up dreading Monday mornings. Something has to give.',
    variations: {
      lowHealth: 'Your body is screaming for rest. Headaches, insomnia, the works.',
      highWealth: 'Money is good but at what cost? Your health and happiness are slipping.',
      lowHappiness: 'Joy has become a distant memory. Even successes feel hollow.',
    },
    choices: [
      {
        label: 'Take a sabbatical',
        emoji: '\u{1F3D6}\u{FE0F}',
        impact: { wealth: -10, happiness: 15, health: 15, relationships: 10, risk: 5 },
        outcome: 'Three months away from work healed something deep inside you.',
        milestone: 'Took a life-changing break',
      },
      {
        label: 'Push through',
        emoji: '\u{1F4AA}',
        impact: { wealth: 10, happiness: -10, health: -15, relationships: -5, risk: 5 },
        outcome: 'You gritted your teeth and kept going. The paycheck grew but so did the emptiness.',
      },
      {
        label: 'Set firm boundaries',
        emoji: '\u{1F6E1}\u{FE0F}',
        impact: { wealth: 0, happiness: 10, health: 10, relationships: 5, risk: 0 },
        outcome: 'No more late nights, no more weekend emails. The boundary felt scary but right.',
      },
    ],
  },
  {
    year: 10,
    title: 'Legacy',
    base: 'A decade in your career. You have experience, reputation, and choices. What mark do you want to leave?',
    variations: {
      highWealth: 'Financial security gives you the freedom to think about legacy over survival.',
      lowRelationships: 'You climbed the ladder but look around and wonder who is there to share it with.',
    },
    choices: [
      {
        label: 'Become a mentor',
        emoji: '\u{1F9D1}\u200D\u{1F3EB}',
        impact: { wealth: -5, happiness: 10, health: 5, relationships: 15, risk: -10 },
        outcome: 'Guiding the next generation gave your career new meaning.',
      },
      {
        label: 'Chase the C-suite',
        emoji: '\u{1F451}',
        impact: { wealth: 15, happiness: -5, health: -10, relationships: -10, risk: 10 },
        outcome: 'The corner office came with power and loneliness in equal measure.',
        milestone: 'Reached the top',
      },
      {
        label: 'Start consulting',
        emoji: '\u{1F4BC}',
        impact: { wealth: 10, happiness: 5, health: 5, relationships: 0, risk: 10 },
        outcome: 'Going independent was terrifying and liberating. You are your own boss now.',
        milestone: 'Became independent consultant',
      },
    ],
  },
];

// --- Career Bold ---
export const careerBoldTemplates: CheckpointTemplate[] = [
  {
    year: 1,
    title: 'Rough Start',
    base: 'The bold path is bumpy. Revenue is thin, doubters are loud, and every day tests your conviction.',
    variations: {
      lowWealth: 'Your savings are evaporating faster than planned. Pressure is mounting.',
      lowHappiness: 'The loneliness of the entrepreneur life is hitting hard.',
    },
    choices: [
      {
        label: 'Stay the course',
        emoji: '\u{1F9ED}',
        impact: { wealth: -5, happiness: -5, health: -5, relationships: -5, risk: 10 },
        outcome: 'Grit carried you through. No breakthroughs yet, but you survived.',
      },
      {
        label: 'Start a side gig',
        emoji: '\u{1F4B0}',
        impact: { wealth: 10, happiness: 0, health: -10, relationships: -5, risk: -5 },
        outcome: 'The side income stabilized finances but split your focus.',
      },
      {
        label: 'Pivot your approach',
        emoji: '\u{1F504}',
        impact: { wealth: 0, happiness: 5, health: 0, relationships: 5, risk: 5 },
        outcome: 'A fresh angle breathed new life into your venture.',
        milestone: 'First major pivot',
      },
    ],
  },
  {
    year: 3,
    title: 'First Big Win',
    base: 'Against the odds, something clicked. A major client, a viral moment, or just relentless grinding finally paid off.',
    variations: {
      highRisk: 'The win feels fragile. One wrong move and it could all evaporate.',
      highWealth: 'Money is flowing but so is the pressure to maintain momentum.',
    },
    choices: [
      {
        label: 'Go all in',
        emoji: '\u{1F525}',
        impact: { wealth: 15, happiness: 5, health: -10, relationships: -10, risk: 15 },
        outcome: 'You bet everything on momentum. The growth was explosive.',
        milestone: 'Went all in on growth',
      },
      {
        label: 'Scale carefully',
        emoji: '\u{1F4C8}',
        impact: { wealth: 10, happiness: 5, health: 0, relationships: 0, risk: -5 },
        outcome: 'Measured growth kept things sustainable. Slower but steadier.',
      },
      {
        label: 'Bring in a partner',
        emoji: '\u{1F91D}',
        impact: { wealth: 5, happiness: 0, health: 5, relationships: 10, risk: -5 },
        outcome: 'Sharing the burden made the journey less lonely and more resilient.',
      },
    ],
  },
  {
    year: 5,
    title: 'The Acquisition Offer',
    base: 'A major player wants to buy you out. The number is life-changing. But this is your baby.',
    variations: {
      lowWealth: 'The money would solve every financial problem you have ever had.',
      highHappiness: 'You love what you do. Can a check really replace that feeling?',
    },
    turningPoint: true,
    choices: [
      {
        label: 'Sell everything',
        emoji: '\u{1F4B5}',
        impact: { wealth: 25, happiness: -10, health: 5, relationships: 5, risk: -20 },
        outcome: 'You cashed out. The relief was immense but so was the void that followed.',
        milestone: 'Sold the company',
      },
      {
        label: 'Reject and double down',
        emoji: '\u{1F525}',
        impact: { wealth: -10, happiness: 15, health: -10, relationships: -5, risk: 20 },
        outcome: 'You turned down the money. Your conviction has never been stronger.',
        milestone: 'Rejected acquisition offer',
      },
    ],
  },
  {
    year: 7,
    title: 'Copycat Problem',
    base: 'Imitators are everywhere. What made you special is being commoditized. You need a new edge.',
    variations: {
      highWealth: 'At least resources are not the problem. The question is strategy.',
      lowHappiness: 'The creative joy is fading as you fight to stay relevant.',
    },
    choices: [
      {
        label: 'Innovate radically',
        emoji: '\u{1F4A1}',
        impact: { wealth: -5, happiness: 10, health: -5, relationships: 0, risk: 15 },
        outcome: 'A wild new direction that shocked the market. Risky but exciting.',
        milestone: 'Radical innovation phase',
      },
      {
        label: 'Build a moat',
        emoji: '\u{1F3F0}',
        impact: { wealth: 10, happiness: 0, health: 0, relationships: 5, risk: -10 },
        outcome: 'You focused on defensibility. Patents, brand, network effects.',
      },
      {
        label: 'Collaborate with competitors',
        emoji: '\u{1F310}',
        impact: { wealth: 5, happiness: 5, health: 5, relationships: 10, risk: -5 },
        outcome: 'Turning rivals into allies opened doors nobody expected.',
      },
    ],
  },
  {
    year: 10,
    title: 'Empire',
    base: 'A decade of bold choices led here. You built something real. The question now is: what next?',
    variations: {
      highWealth: 'Money is no longer a concern. Purpose is the new currency.',
      lowHealth: 'You built an empire but your body is showing the cost.',
    },
    choices: [
      {
        label: 'Keep building',
        emoji: '\u{1F3D7}\u{FE0F}',
        impact: { wealth: 10, happiness: 0, health: -10, relationships: -5, risk: 10 },
        outcome: 'The machine keeps growing. You cannot imagine stopping now.',
      },
      {
        label: 'Pass the torch',
        emoji: '\u{1F3C6}',
        impact: { wealth: 0, happiness: 10, health: 10, relationships: 10, risk: -15 },
        outcome: 'Handing over the reins was harder than building. But it freed your soul.',
        milestone: 'Passed the torch',
      },
      {
        label: 'Start something new',
        emoji: '\u{1F31F}',
        impact: { wealth: -5, happiness: 15, health: -5, relationships: 0, risk: 15 },
        outcome: 'Once an entrepreneur, always an entrepreneur. The next chapter begins.',
        milestone: 'Serial entrepreneur',
      },
    ],
  },
];

// --- Life Safe ---
export const lifeSafeTemplates: CheckpointTemplate[] = [
  {
    year: 1,
    title: 'Settling In',
    base: 'A year into your new life path. Routines are forming and comfort is setting in. But is comfort enough?',
    variations: {
      lowHappiness: 'The safe path feels stale already. You crave something more.',
      lowWealth: 'Budget constraints are limiting your options for enjoying life.',
    },
    choices: [
      {
        label: 'Plan a big trip',
        emoji: '\u{2708}\u{FE0F}',
        impact: { wealth: -10, happiness: 15, health: 5, relationships: 5, risk: 5 },
        outcome: 'The trip opened your eyes to new possibilities and recharged your spirit.',
        milestone: 'Life-changing trip',
      },
      {
        label: 'Stay focused on stability',
        emoji: '\u{1F3E0}',
        impact: { wealth: 10, happiness: -5, health: 5, relationships: 5, risk: -10 },
        outcome: 'You built a solid foundation. Boring perhaps, but unshakeable.',
      },
      {
        label: 'Weekend adventures',
        emoji: '\u{26F0}\u{FE0F}',
        impact: { wealth: -5, happiness: 10, health: 10, relationships: 10, risk: 0 },
        outcome: 'Small adventures kept life interesting without blowing the budget.',
      },
    ],
  },
  {
    year: 3,
    title: 'Community Roots',
    base: 'Your social circle is growing. The question of putting down roots — literally — is on the table.',
    variations: {
      lowWealth: 'Homeownership feels like a distant dream at these prices.',
      highHappiness: 'Life is good where you are. Why risk changing it?',
      lowRelationships: 'Maybe a shared space could help you build deeper connections.',
    },
    choices: [
      {
        label: 'Buy property together',
        emoji: '\u{1F3E1}',
        impact: { wealth: -10, happiness: 5, health: 0, relationships: 10, risk: 10 },
        outcome: 'Homeownership with a partner was a massive commitment that brought you closer.',
        milestone: 'Became a homeowner',
      },
      {
        label: 'Keep renting, stay flexible',
        emoji: '\u{1F511}',
        impact: { wealth: 5, happiness: 5, health: 0, relationships: 0, risk: -5 },
        outcome: 'Flexibility had its perks. No maintenance headaches, no anchor.',
      },
      {
        label: 'Buy on your own',
        emoji: '\u{1F3D8}\u{FE0F}',
        impact: { wealth: -10, happiness: 0, health: 0, relationships: -5, risk: 5 },
        outcome: 'Solo homeownership was empowering but stretched your budget thin.',
      },
    ],
  },
  {
    year: 5,
    title: 'Life Crossroads',
    base: 'An opportunity arises to move to a completely new city for a fresh start. Everything you have built is here.',
    variations: {
      lowHappiness: 'Maybe a change of scenery is exactly what the doctor ordered.',
      highRisk: 'Another big change? Your life already feels precarious enough.',
    },
    turningPoint: true,
    choices: [
      {
        label: 'Take the leap to the new city',
        emoji: '\u{1F30D}',
        impact: { wealth: -5, happiness: 10, health: 5, relationships: -15, risk: 20 },
        outcome: 'You left everything behind for a fresh start. Terrifying and exhilarating.',
        milestone: 'Started fresh in a new city',
      },
      {
        label: 'Stay rooted where you are',
        emoji: '\u{1F333}',
        impact: { wealth: 5, happiness: 5, health: 5, relationships: 15, risk: -15 },
        outcome: 'You chose depth over breadth. The roots grew even deeper.',
      },
    ],
  },
  {
    year: 7,
    title: 'Relationship Shift',
    base: 'A key relationship in your life is evolving. Things unsaid are piling up and the dynamic needs attention.',
    variations: {
      lowRelationships: 'Isolation has crept in. This conversation could save a bond worth keeping.',
      lowHappiness: 'Your unhappiness is affecting everyone around you.',
      lowHealth: 'Stress from relationship tension is manifesting physically.',
    },
    choices: [
      {
        label: 'Have the hard conversation',
        emoji: '\u{1F4AC}',
        impact: { wealth: 0, happiness: 5, health: 5, relationships: 15, risk: 5 },
        outcome: 'The conversation was painful but it cleared the air and strengthened the bond.',
        milestone: 'Faced a difficult truth',
      },
      {
        label: 'Give space and time',
        emoji: '\u{1F54A}\u{FE0F}',
        impact: { wealth: 0, happiness: -5, health: 0, relationships: -5, risk: -5 },
        outcome: 'Space helped temporarily but the underlying issues remained.',
      },
      {
        label: 'Seek professional help',
        emoji: '\u{1F9E0}',
        impact: { wealth: -5, happiness: 10, health: 10, relationships: 10, risk: 0 },
        outcome: 'Counseling gave you tools you never knew you needed.',
      },
    ],
  },
  {
    year: 10,
    title: 'Looking Back',
    base: 'A decade of life. You stand at a vantage point looking over the terrain of your choices.',
    variations: {
      highHappiness: 'From up here, the view is pretty beautiful.',
      lowHappiness: 'The view is mixed. Regret and gratitude in equal measure.',
    },
    choices: [
      {
        label: 'Embrace what you have',
        emoji: '\u{1F64F}',
        impact: { wealth: 0, happiness: 15, health: 5, relationships: 10, risk: -10 },
        outcome: 'Gratitude transformed your perspective. What you have is enough.',
      },
      {
        label: 'One more adventure',
        emoji: '\u{1F30B}',
        impact: { wealth: -10, happiness: 10, health: -5, relationships: -5, risk: 15 },
        outcome: 'One last leap. Because playing it safe forever was never really living.',
        milestone: 'One final adventure',
      },
      {
        label: 'Give back to community',
        emoji: '\u{1F49B}',
        impact: { wealth: -5, happiness: 10, health: 5, relationships: 15, risk: -5 },
        outcome: 'Volunteering and mentoring gave your decade of experience true purpose.',
      },
    ],
  },
];

// --- Life Bold ---
export const lifeBoldTemplates: CheckpointTemplate[] = [
  {
    year: 1,
    title: 'Culture Shock',
    base: 'The bold life choice has thrown you into unfamiliar territory. Every day is a lesson in adaptation.',
    variations: {
      lowHappiness: 'The excitement has faded. Homesickness and doubt are creeping in.',
      lowRelationships: 'You are surrounded by strangers. Building a support network is urgent.',
    },
    choices: [
      {
        label: 'Push through the discomfort',
        emoji: '\u{1F4AA}',
        impact: { wealth: 0, happiness: -5, health: -5, relationships: 0, risk: 5 },
        outcome: 'Growth is uncomfortable. You leaned in and the discomfort became strength.',
      },
      {
        label: 'Build a local community',
        emoji: '\u{1F465}',
        impact: { wealth: -5, happiness: 10, health: 5, relationships: 15, risk: -5 },
        outcome: 'Finding your tribe in a new place changed everything.',
        milestone: 'Built community from scratch',
      },
      {
        label: 'Stay connected to old life',
        emoji: '\u{1F4F1}',
        impact: { wealth: -5, happiness: 5, health: 0, relationships: 10, risk: -5 },
        outcome: 'Video calls and visits kept the old bonds alive while you built new ones.',
      },
    ],
  },
  {
    year: 3,
    title: 'Unexpected Opportunity',
    base: 'Something you never planned for has appeared. An opportunity that could amplify your bold choice or derail it entirely.',
    variations: {
      highRisk: 'More risk on top of risk. Your gut says yes but your brain hesitates.',
      lowWealth: 'The opportunity requires money you do not have.',
    },
    choices: [
      {
        label: 'Say yes immediately',
        emoji: '\u{2705}',
        impact: { wealth: 10, happiness: 10, health: -5, relationships: -5, risk: 15 },
        outcome: 'Jumping in headfirst paid off. Fortune favors the bold.',
        milestone: 'Seized unexpected opportunity',
      },
      {
        label: 'Ask for time to decide',
        emoji: '\u{23F3}',
        impact: { wealth: 0, happiness: 0, health: 5, relationships: 5, risk: -5 },
        outcome: 'Taking time revealed details you would have missed. A measured decision.',
      },
      {
        label: 'Pass on it',
        emoji: '\u{274C}',
        impact: { wealth: 0, happiness: -5, health: 5, relationships: 5, risk: -10 },
        outcome: 'You let it go. Sometimes the boldest move is knowing when to say no.',
      },
    ],
  },
  {
    year: 5,
    title: 'Home Calling',
    base: 'The call of home is strong. Family needs you, old friends miss you. But going back feels like giving up.',
    variations: {
      lowRelationships: 'The loneliness is becoming unbearable. Home sounds like heaven.',
      highHappiness: 'You are thriving here. Going back would mean sacrificing real joy.',
    },
    turningPoint: true,
    choices: [
      {
        label: 'Go back home',
        emoji: '\u{1F3E0}',
        impact: { wealth: -5, happiness: -5, health: 5, relationships: 25, risk: -20 },
        outcome: 'Coming home was not defeat. It was choosing love over ambition.',
        milestone: 'Returned home',
      },
      {
        label: 'Bring them to you',
        emoji: '\u{2708}\u{FE0F}',
        impact: { wealth: -15, happiness: 15, health: 0, relationships: 15, risk: 5 },
        outcome: 'Flying family out and building bridges between worlds. Expensive but priceless.',
        milestone: 'United two worlds',
      },
    ],
  },
  {
    year: 7,
    title: 'Identity Crisis',
    base: 'Who are you now? The person who left home and the person you have become feel like different people.',
    variations: {
      lowHappiness: 'The identity confusion is making you deeply unhappy.',
      highHappiness: 'You are happy but unsure if this version of you is authentic.',
    },
    choices: [
      {
        label: 'Embrace the new you',
        emoji: '\u{1F98B}',
        impact: { wealth: 0, happiness: 10, health: 5, relationships: -5, risk: 5 },
        outcome: 'You accepted the transformation. The old you would be proud of who you became.',
        milestone: 'Embraced transformation',
      },
      {
        label: 'Reconnect with your roots',
        emoji: '\u{1F331}',
        impact: { wealth: -5, happiness: 5, health: 5, relationships: 10, risk: -5 },
        outcome: 'Revisiting where you came from grounded you. Identity is not either/or.',
      },
      {
        label: 'Reinvent completely',
        emoji: '\u{1F525}',
        impact: { wealth: -5, happiness: 5, health: -5, relationships: -10, risk: 15 },
        outcome: 'You shed another skin. Reinvention is becoming your signature move.',
        milestone: 'Complete reinvention',
      },
    ],
  },
  {
    year: 10,
    title: 'View From Here',
    base: 'A decade of bold living. The view from here is unlike anything the safe path could have offered.',
    variations: {
      highHappiness: 'Every risk was worth it. The happiness is real and earned.',
      lowHealth: 'The adventures took a toll. Your body carries the map of every bold choice.',
    },
    choices: [
      {
        label: 'Write it all down',
        emoji: '\u{1F4D6}',
        impact: { wealth: 5, happiness: 10, health: 5, relationships: 5, risk: -5 },
        outcome: 'Your story deserves to be told. The memoir writes itself.',
        milestone: 'Documented the journey',
      },
      {
        label: 'Keep exploring',
        emoji: '\u{1F30D}',
        impact: { wealth: -10, happiness: 10, health: -5, relationships: -5, risk: 15 },
        outcome: 'Why stop now? The horizon keeps calling and you keep answering.',
      },
      {
        label: 'Build a home base',
        emoji: '\u{1F3E1}',
        impact: { wealth: -5, happiness: 10, health: 10, relationships: 15, risk: -15 },
        outcome: 'After a decade of movement, stillness became the ultimate adventure.',
        milestone: 'Finally put down roots',
      },
    ],
  },
];

// --- Education Safe ---
export const educationSafeTemplates: CheckpointTemplate[] = [
  {
    year: 1,
    title: 'First Semester',
    base: 'The traditional education path begins. Lectures, exams, and the promise of credentials.',
    variations: {
      lowHappiness: 'Classes feel monotonous. You wonder if this was the right call.',
      lowWealth: 'Tuition costs weigh heavy. Every semester is a financial calculation.',
    },
    choices: [
      {
        label: 'Stick with the curriculum',
        emoji: '\u{1F4CB}',
        impact: { wealth: -5, happiness: -5, health: 0, relationships: 5, risk: -10 },
        outcome: 'You followed the path. Reliable, predictable, and solid foundational knowledge.',
      },
      {
        label: 'Explore electives and interests',
        emoji: '\u{1F3A8}',
        impact: { wealth: -5, happiness: 10, health: 5, relationships: 5, risk: 5 },
        outcome: 'Electives opened doors you did not know existed. Curiosity as a compass.',
      },
      {
        label: 'Join a study group',
        emoji: '\u{1F46B}',
        impact: { wealth: 0, happiness: 5, health: 0, relationships: 10, risk: 0 },
        outcome: 'Study groups built friendships that would last longer than any textbook.',
      },
    ],
  },
  {
    year: 3,
    title: 'Midpoint Doubt',
    base: 'Halfway through your studies. Doubt creeps in about whether this field is right for you.',
    variations: {
      lowHappiness: 'Every morning you question why you are doing this.',
      highWealth: 'At least finances are not a concern. But money cannot buy passion.',
    },
    choices: [
      {
        label: 'Specialize deeper',
        emoji: '\u{1F52C}',
        impact: { wealth: -5, happiness: 0, health: -5, relationships: -5, risk: 5 },
        outcome: 'Going deeper into your niche gave you expertise that set you apart.',
        milestone: 'Found your specialization',
      },
      {
        label: 'Switch focus area',
        emoji: '\u{1F504}',
        impact: { wealth: -10, happiness: 10, health: 0, relationships: 0, risk: 10 },
        outcome: 'The switch cost you time but reignited your passion.',
      },
      {
        label: 'Take an internship break',
        emoji: '\u{1F4BC}',
        impact: { wealth: 10, happiness: 5, health: 0, relationships: 5, risk: 5 },
        outcome: 'Real-world experience showed you what the classroom could not.',
        milestone: 'Real-world internship',
      },
    ],
  },
  {
    year: 5,
    title: 'Graduation Day',
    base: 'Cap and gown. You made it. But the real question is: what comes next?',
    variations: {
      lowWealth: 'Student debt looms. The next move needs to be financially smart.',
      highHappiness: 'You loved the journey. The thought of leaving academia feels sad.',
    },
    turningPoint: true,
    choices: [
      {
        label: 'Continue to graduate school',
        emoji: '\u{1F393}',
        impact: { wealth: -15, happiness: 5, health: -5, relationships: -10, risk: 10 },
        outcome: 'More years of study. The ivory tower became your home.',
        milestone: 'Entered graduate school',
      },
      {
        label: 'Enter the workforce',
        emoji: '\u{1F4BC}',
        impact: { wealth: 20, happiness: 0, health: 0, relationships: 5, risk: -10 },
        outcome: 'The paycheck felt surreal after years of student life.',
        milestone: 'First real job',
      },
    ],
  },
  {
    year: 7,
    title: 'Theory vs Practice',
    base: 'Years of education meet the messy reality of the working world. Your expertise is valuable, but how to deploy it?',
    variations: {
      lowWealth: 'Financial pressure makes the highest-paying option very tempting.',
      highHappiness: 'You want work that maintains the joy you have found.',
    },
    choices: [
      {
        label: 'Climb the corporate ladder',
        emoji: '\u{1F4C8}',
        impact: { wealth: 15, happiness: -5, health: -5, relationships: -5, risk: 5 },
        outcome: 'Corporate life rewarded your credentials handsomely.',
      },
      {
        label: 'Teach and mentor others',
        emoji: '\u{1F9D1}\u200D\u{1F3EB}',
        impact: { wealth: -5, happiness: 15, health: 5, relationships: 10, risk: -5 },
        outcome: 'Teaching gave your knowledge purpose beyond personal gain.',
        milestone: 'Became an educator',
      },
      {
        label: 'Freelance with your expertise',
        emoji: '\u{1F4BB}',
        impact: { wealth: 10, happiness: 10, health: 0, relationships: 0, risk: 10 },
        outcome: 'Freelancing combined freedom with expertise. The best of both worlds.',
      },
    ],
  },
  {
    year: 10,
    title: 'Expert Status',
    base: 'A decade of learning and applying. You are now recognized as an expert in your field.',
    variations: {
      highWealth: 'Your expertise commands premium rates. The education investment paid off.',
      lowHappiness: 'Expertise without passion is a gilded cage.',
    },
    choices: [
      {
        label: 'Publish your research',
        emoji: '\u{1F4DA}',
        impact: { wealth: -5, happiness: 10, health: 0, relationships: 5, risk: 0 },
        outcome: 'Your published work became a reference in the field. Legacy in ink.',
        milestone: 'Published researcher',
      },
      {
        label: 'Pivot to a new field',
        emoji: '\u{1F500}',
        impact: { wealth: -10, happiness: 10, health: 5, relationships: 0, risk: 15 },
        outcome: 'Starting over in a new field with a decade of transferable skills.',
        milestone: 'Field pivot',
      },
      {
        label: 'Start your own academy',
        emoji: '\u{1F3EB}',
        impact: { wealth: 5, happiness: 10, health: -5, relationships: 10, risk: 10 },
        outcome: 'Your academy became a beacon for the next generation of learners.',
        milestone: 'Founded an academy',
      },
    ],
  },
];

// --- Education Bold ---
export const educationBoldTemplates: CheckpointTemplate[] = [
  {
    year: 1,
    title: 'Dropout Doubts',
    base: 'You walked away from traditional education. The world does not hand out pity or patience to those without credentials.',
    variations: {
      lowWealth: 'Without a degree, even entry-level doors are harder to open.',
      lowHappiness: 'Freedom sounded great in theory. In practice, it is terrifying.',
    },
    choices: [
      {
        label: 'Prove everyone wrong',
        emoji: '\u{1F525}',
        impact: { wealth: 0, happiness: 5, health: -10, relationships: -5, risk: 15 },
        outcome: 'Fueled by doubt, you worked harder than anyone with a diploma.',
        milestone: 'Defied expectations',
      },
      {
        label: 'Seek mentors and guides',
        emoji: '\u{1F9D9}',
        impact: { wealth: -5, happiness: 5, health: 5, relationships: 10, risk: -5 },
        outcome: 'Finding the right mentors replaced the classroom with something better.',
      },
      {
        label: 'Build a portfolio of work',
        emoji: '\u{1F4C2}',
        impact: { wealth: 5, happiness: 5, health: 0, relationships: 0, risk: 0 },
        outcome: 'Work speaks louder than credentials. Your portfolio became your resume.',
      },
    ],
  },
  {
    year: 3,
    title: 'Self-Made Progress',
    base: 'Three years of self-directed learning. You have skills that no classroom teaches, and gaps that no one warns you about.',
    variations: {
      highRisk: 'The unconventional path has left you exposed. One failure could set you way back.',
      lowRelationships: 'Working alone has its costs. The network you never built is sorely missed.',
    },
    choices: [
      {
        label: 'Launch your own project',
        emoji: '\u{1F680}',
        impact: { wealth: 5, happiness: 10, health: -5, relationships: -5, risk: 15 },
        outcome: 'Your project became proof that formal education is not the only path.',
        milestone: 'Launched flagship project',
      },
      {
        label: 'Seek outside funding',
        emoji: '\u{1F4B0}',
        impact: { wealth: 15, happiness: 0, health: 0, relationships: 5, risk: 10 },
        outcome: 'Investors saw potential in your unconventional background.',
      },
      {
        label: 'Partner with someone credentialed',
        emoji: '\u{1F91D}',
        impact: { wealth: 5, happiness: 5, health: 5, relationships: 10, risk: -5 },
        outcome: 'The partnership combined street smarts with book smarts perfectly.',
      },
    ],
  },
  {
    year: 5,
    title: 'Make or Break',
    base: 'Five years in. The self-taught path has been incredible and grueling. A crossroads: keep going your way or return to a traditional path?',
    variations: {
      lowWealth: 'The financial pressure to get a real degree is immense.',
      highHappiness: 'You love your unconventional life. Going back feels like surrender.',
    },
    turningPoint: true,
    choices: [
      {
        label: 'Double down on your way',
        emoji: '\u{1F525}',
        impact: { wealth: -5, happiness: 15, health: -10, relationships: -10, risk: 25 },
        outcome: 'You bet on yourself one more time. The conviction burned brighter than ever.',
        milestone: 'Doubled down on self-education',
      },
      {
        label: 'Return to traditional path',
        emoji: '\u{1F393}',
        impact: { wealth: -15, happiness: -5, health: 5, relationships: 10, risk: -20 },
        outcome: 'Going back was humbling but your real-world experience made you the best student in class.',
        milestone: 'Returned to formal education',
      },
    ],
  },
  {
    year: 7,
    title: 'Recognition',
    base: 'Your unconventional path is getting noticed. Industry publications, speaking invitations, and a growing reputation.',
    variations: {
      highWealth: 'Success and money validate every uncomfortable choice you made.',
      lowHappiness: 'Recognition without inner peace feels hollow.',
    },
    choices: [
      {
        label: 'Scale your impact',
        emoji: '\u{1F4C8}',
        impact: { wealth: 10, happiness: 5, health: -10, relationships: 0, risk: 10 },
        outcome: 'Scaling up brought more eyes, more pressure, and more opportunity.',
        milestone: 'Scaled to national impact',
      },
      {
        label: 'Stay niche and deep',
        emoji: '\u{1F48E}',
        impact: { wealth: 0, happiness: 10, health: 5, relationships: 5, risk: -5 },
        outcome: 'Depth over breadth. Being the best at one thing was deeply satisfying.',
      },
      {
        label: 'Go public with your story',
        emoji: '\u{1F4E2}',
        impact: { wealth: 10, happiness: 5, health: 0, relationships: -5, risk: 10 },
        outcome: 'Your story inspired thousands and drew both admirers and critics.',
        milestone: 'Public figure',
      },
    ],
  },
  {
    year: 10,
    title: 'Redefining Success',
    base: 'A decade of defying convention. You have redefined what education and success mean on your own terms.',
    variations: {
      highWealth: 'The dropout who became wealthy. The irony is not lost on you.',
      lowHealth: 'The hustle took years off your body. Was it worth it?',
    },
    choices: [
      {
        label: 'Build an institution',
        emoji: '\u{1F3EB}',
        impact: { wealth: -5, happiness: 10, health: -5, relationships: 10, risk: 5 },
        outcome: 'Your alternative institution became a model for self-directed learning.',
        milestone: 'Built an educational institution',
      },
      {
        label: 'Retire young',
        emoji: '\u{1F3D6}\u{FE0F}',
        impact: { wealth: -10, happiness: 15, health: 15, relationships: 10, risk: -15 },
        outcome: 'You earned your rest. The beach and a good book were well deserved.',
        milestone: 'Early retirement',
      },
      {
        label: 'Keep disrupting',
        emoji: '\u{26A1}',
        impact: { wealth: 5, happiness: 5, health: -10, relationships: -5, risk: 15 },
        outcome: 'Disruption is in your DNA. Standing still was never an option.',
      },
    ],
  },
];

// --- Finance Safe ---
export const financeSafeTemplates: CheckpointTemplate[] = [
  {
    year: 1,
    title: 'Budget Discipline',
    base: 'Your first year of disciplined financial planning. Every dollar has a purpose, but willpower is tested daily.',
    variations: {
      lowHappiness: 'Budgeting feels like deprivation. Where is the fun in saving every cent?',
      lowWealth: 'Starting from zero makes every small win feel monumental.',
    },
    choices: [
      {
        label: 'Automate savings',
        emoji: '\u{1F916}',
        impact: { wealth: 10, happiness: -5, health: 0, relationships: 0, risk: -10 },
        outcome: 'Automation removed temptation. Money grew while you barely noticed.',
      },
      {
        label: 'Treat yourself occasionally',
        emoji: '\u{1F381}',
        impact: { wealth: -5, happiness: 10, health: 5, relationships: 5, risk: 0 },
        outcome: 'Small treats kept you sane on the long road to financial health.',
      },
      {
        label: 'Build emergency fund first',
        emoji: '\u{1F6E1}\u{FE0F}',
        impact: { wealth: 5, happiness: 0, health: 5, relationships: 0, risk: -15 },
        outcome: 'Six months of expenses saved. The peace of mind was worth every sacrifice.',
        milestone: 'Emergency fund built',
      },
    ],
  },
  {
    year: 3,
    title: 'Market Dip',
    base: 'Markets are down. Your portfolio has lost value. Every instinct says panic.',
    variations: {
      lowWealth: 'Losses you cannot afford. The temptation to cash out is overwhelming.',
      highRisk: 'Your already risky position just got riskier. This is a stress test.',
    },
    choices: [
      {
        label: 'Hold steady',
        emoji: '\u{1F9D8}',
        impact: { wealth: 5, happiness: -5, health: -5, relationships: 0, risk: 0 },
        outcome: 'You white-knuckled through the dip. Patience rewarded the disciplined.',
      },
      {
        label: 'Buy the dip',
        emoji: '\u{1F4C9}',
        impact: { wealth: 15, happiness: 0, health: -5, relationships: 0, risk: 15 },
        outcome: 'Buying when others panicked was terrifying. It was also brilliant.',
        milestone: 'Bought the market dip',
      },
      {
        label: 'Cash out and protect',
        emoji: '\u{1F4B5}',
        impact: { wealth: -10, happiness: 5, health: 5, relationships: 0, risk: -15 },
        outcome: 'You locked in losses but gained peace of mind. Sometimes that is the real return.',
      },
    ],
  },
  {
    year: 5,
    title: 'Big Purchase',
    base: 'You have saved enough for a major purchase. A house would build equity. Investing could build more wealth.',
    variations: {
      lowWealth: 'This decision could define your financial trajectory for the next decade.',
      highWealth: 'With healthy savings, either option feels viable. A good problem to have.',
    },
    turningPoint: true,
    choices: [
      {
        label: 'Buy the house',
        emoji: '\u{1F3E0}',
        impact: { wealth: -15, happiness: 10, health: 5, relationships: 10, risk: 10 },
        outcome: 'Homeownership brought stability and a sense of arrival. Your own walls, your own rules.',
        milestone: 'Bought first home',
      },
      {
        label: 'Keep investing',
        emoji: '\u{1F4C8}',
        impact: { wealth: 20, happiness: -5, health: 0, relationships: -5, risk: 15 },
        outcome: 'The portfolio grew aggressively. Renting felt lighter, your net worth heavier.',
        milestone: 'Chose investments over property',
      },
    ],
  },
  {
    year: 7,
    title: 'Lifestyle Creep',
    base: 'Your income has grown and so have your expenses. The line between comfort and excess is blurring.',
    variations: {
      highWealth: 'Money is flowing freely. The temptation to upgrade everything is constant.',
      lowHappiness: 'Maybe spending more on enjoyment would help the emptiness.',
      lowHealth: 'Some of that money could go toward better food, gym, and self-care.',
    },
    choices: [
      {
        label: 'Maintain strict discipline',
        emoji: '\u{1F4CF}',
        impact: { wealth: 10, happiness: -10, health: 0, relationships: -5, risk: -5 },
        outcome: 'Discipline kept your finances bulletproof, but life felt joyless.',
      },
      {
        label: 'Upgrade your lifestyle',
        emoji: '\u{2B50}',
        impact: { wealth: -10, happiness: 10, health: 5, relationships: 5, risk: 5 },
        outcome: 'Better food, better home, better experiences. Money is a tool, not a trophy.',
      },
      {
        label: 'Invest in experiences',
        emoji: '\u{1F30D}',
        impact: { wealth: -5, happiness: 15, health: 5, relationships: 10, risk: 0 },
        outcome: 'Travel, classes, and dinners with friends. Experiences over things.',
        milestone: 'Prioritized experience over accumulation',
      },
    ],
  },
  {
    year: 10,
    title: 'Compounding',
    base: 'A decade of financial discipline. Compound interest has turned patience into real, tangible wealth.',
    variations: {
      highWealth: 'The numbers are impressive. You have options most people dream about.',
      lowHappiness: 'Wealthy on paper, but the question of what it was all for lingers.',
    },
    choices: [
      {
        label: 'Harvest the rewards',
        emoji: '\u{1F33E}',
        impact: { wealth: -5, happiness: 15, health: 5, relationships: 5, risk: -10 },
        outcome: 'You finally let yourself enjoy the fruits of a decade of discipline.',
      },
      {
        label: 'Reinvest for more growth',
        emoji: '\u{1F4C8}',
        impact: { wealth: 15, happiness: -5, health: 0, relationships: -5, risk: 10 },
        outcome: 'The compounding machine keeps running. Wealth builds upon wealth.',
      },
      {
        label: 'Philanthropic giving',
        emoji: '\u{1F49B}',
        impact: { wealth: -10, happiness: 15, health: 5, relationships: 15, risk: -10 },
        outcome: 'Giving back was the most fulfilling investment you ever made.',
        milestone: 'Became a philanthropist',
      },
    ],
  },
];

// --- Finance Bold ---
export const financeBoldTemplates: CheckpointTemplate[] = [
  {
    year: 1,
    title: 'First Loss',
    base: 'The aggressive financial strategy took its first hit. A significant loss tests your conviction.',
    variations: {
      lowWealth: 'You cannot afford many more losses like this one.',
      highRisk: 'The risk exposure is uncomfortable. One more bad trade could be devastating.',
    },
    choices: [
      {
        label: 'Cut losses and regroup',
        emoji: '\u{2702}\u{FE0F}',
        impact: { wealth: -5, happiness: -5, health: 5, relationships: 0, risk: -10 },
        outcome: 'You accepted the loss and preserved capital for the next opportunity.',
      },
      {
        label: 'Double down',
        emoji: '\u{1F3B2}',
        impact: { wealth: 10, happiness: 5, health: -10, relationships: -5, risk: 15 },
        outcome: 'You doubled your position. The recovery made you whole and then some.',
        milestone: 'Doubled down on first loss',
      },
      {
        label: 'Diversify immediately',
        emoji: '\u{1F4CA}',
        impact: { wealth: 0, happiness: 0, health: 5, relationships: 0, risk: -10 },
        outcome: 'Spreading risk across assets gave you the stability to weather future storms.',
      },
    ],
  },
  {
    year: 3,
    title: 'Windfall',
    base: 'An unexpected windfall arrives. A trade paid off massively, an inheritance came through, or a side bet won big.',
    variations: {
      lowWealth: 'This money could change your entire financial picture overnight.',
      highHappiness: 'Things are going well. This windfall is the cherry on top.',
    },
    choices: [
      {
        label: 'Reinvest everything',
        emoji: '\u{1F4B0}',
        impact: { wealth: 15, happiness: 0, health: 0, relationships: -5, risk: 15 },
        outcome: 'All back in the game. Your portfolio is now substantial.',
        milestone: 'Reinvested a windfall',
      },
      {
        label: 'Cash some out to enjoy',
        emoji: '\u{1F389}',
        impact: { wealth: 5, happiness: 15, health: 5, relationships: 10, risk: -5 },
        outcome: 'You took some off the table. A nice dinner, a trip, and a gift for someone you love.',
      },
      {
        label: 'Start a side business',
        emoji: '\u{1F3EA}',
        impact: { wealth: 5, happiness: 10, health: -5, relationships: 0, risk: 10 },
        outcome: 'The windfall became seed money. Your first business was born.',
        milestone: 'Launched a business',
      },
    ],
  },
  {
    year: 5,
    title: 'All In Moment',
    base: 'A once-in-a-lifetime opportunity. The potential reward is enormous but it requires betting nearly everything you have.',
    variations: {
      highWealth: 'You have a lot to lose. But the upside could set you up for life.',
      lowWealth: 'With little to lose, the gamble feels almost rational.',
    },
    turningPoint: true,
    choices: [
      {
        label: 'Bet everything',
        emoji: '\u{1F3B0}',
        impact: { wealth: 25, happiness: -5, health: -15, relationships: -10, risk: 25 },
        outcome: 'You went all in. The win was legendary. The stress was indescribable.',
        milestone: 'The biggest bet of your life',
      },
      {
        label: 'Spread the risk',
        emoji: '\u{1F6E1}\u{FE0F}',
        impact: { wealth: 10, happiness: 5, health: 5, relationships: 5, risk: -10 },
        outcome: 'You took a measured position. The returns were good, not life-changing.',
      },
    ],
  },
  {
    year: 7,
    title: 'Wealth Guilt',
    base: 'Your aggressive approach has paid off handsomely. But seeing others struggle stirs something uncomfortable inside.',
    variations: {
      highWealth: 'The gap between your wealth and others around you is growing visible.',
      lowHappiness: 'Money did not buy happiness after all. Now what?',
      lowRelationships: 'Old friends treat you differently. Money changed the dynamic.',
    },
    choices: [
      {
        label: 'Give generously',
        emoji: '\u{1F49D}',
        impact: { wealth: -10, happiness: 15, health: 5, relationships: 15, risk: -5 },
        outcome: 'Generosity healed something. The money felt lighter when shared.',
        milestone: 'Major philanthropic contribution',
      },
      {
        label: 'Enjoy without guilt',
        emoji: '\u{1F37E}',
        impact: { wealth: 0, happiness: 10, health: 5, relationships: -5, risk: 0 },
        outcome: 'You earned this. Guilt is not a productive emotion. You chose to live fully.',
      },
      {
        label: 'Create jobs and opportunities',
        emoji: '\u{1F3ED}',
        impact: { wealth: -5, happiness: 10, health: -5, relationships: 10, risk: 10 },
        outcome: 'Your wealth became a job engine. Impact through enterprise.',
        milestone: 'Created employment for others',
      },
    ],
  },
  {
    year: 10,
    title: 'Financial Freedom',
    base: 'A decade of bold financial moves. You have achieved what most spend a lifetime chasing: true financial freedom.',
    variations: {
      highWealth: 'The number is beyond what you imagined when you started.',
      lowHealth: 'Financially free but physically depleted. Wealth without health is a cruel irony.',
    },
    choices: [
      {
        label: 'Retire and enjoy life',
        emoji: '\u{1F3D6}\u{FE0F}',
        impact: { wealth: -5, happiness: 15, health: 15, relationships: 10, risk: -15 },
        outcome: 'You stepped away from the game. Peace at last.',
        milestone: 'Achieved financial independence and retired',
      },
      {
        label: 'Build a financial empire',
        emoji: '\u{1F3F0}',
        impact: { wealth: 15, happiness: 0, health: -10, relationships: -10, risk: 15 },
        outcome: 'Freedom was just the beginning. Now you are building something generational.',
        milestone: 'Built a financial empire',
      },
      {
        label: 'Fund others\' dreams',
        emoji: '\u{1F31F}',
        impact: { wealth: -10, happiness: 15, health: 5, relationships: 15, risk: 0 },
        outcome: 'Becoming an angel investor gave your wealth purpose beyond yourself.',
        milestone: 'Became an angel investor',
      },
    ],
  },
];

// --- Relationship Safe ---
export const relationshipSafeTemplates: CheckpointTemplate[] = [
  {
    year: 1,
    title: 'Setting Boundaries',
    base: 'A new chapter in your relationship. Setting healthy boundaries is the first challenge.',
    variations: {
      lowRelationships: 'Past relationship patterns make boundaries feel dangerous.',
      lowHappiness: 'You are not sure what healthy even looks like right now.',
    },
    choices: [
      {
        label: 'Set firm boundaries',
        emoji: '\u{1F6D1}',
        impact: { wealth: 0, happiness: 5, health: 10, relationships: 5, risk: 5 },
        outcome: 'Clear boundaries created safety. Your partner respected the honesty.',
      },
      {
        label: 'Stay flexible and adaptive',
        emoji: '\u{1F33F}',
        impact: { wealth: 0, happiness: 5, health: 0, relationships: 10, risk: -5 },
        outcome: 'Flexibility kept the peace, though sometimes at the expense of your needs.',
      },
      {
        label: 'Open communication first',
        emoji: '\u{1F4AC}',
        impact: { wealth: 0, happiness: 10, health: 5, relationships: 10, risk: 0 },
        outcome: 'Radical openness from day one built a foundation of trust.',
        milestone: 'Established open communication',
      },
    ],
  },
  {
    year: 3,
    title: 'Comfort Zone',
    base: 'Three years of steady partnership. Comfort has settled in. Some call it stability. Others call it a rut.',
    variations: {
      lowHappiness: 'The routine feels suffocating. Something needs to change.',
      highHappiness: 'You are happy but wonder if comfort is the enemy of growth.',
    },
    choices: [
      {
        label: 'Spice things up together',
        emoji: '\u{1F308}',
        impact: { wealth: -5, happiness: 10, health: 5, relationships: 10, risk: 5 },
        outcome: 'New experiences together reignited the spark. Adventure as couples therapy.',
      },
      {
        label: 'Deepen the routine',
        emoji: '\u{2615}',
        impact: { wealth: 5, happiness: 5, health: 5, relationships: 5, risk: -5 },
        outcome: 'There is beauty in the mundane. Sunday mornings became sacred.',
      },
      {
        label: 'Pursue independent hobbies',
        emoji: '\u{1F3A8}',
        impact: { wealth: -5, happiness: 10, health: 10, relationships: -5, risk: 0 },
        outcome: 'Individual growth made you more interesting to each other.',
      },
    ],
  },
  {
    year: 5,
    title: 'Life Plans Diverge',
    base: 'A fundamental disagreement about the future. Kids, career moves, or lifestyle — you want different things.',
    variations: {
      lowRelationships: 'The relationship is already strained. This disagreement could break it.',
      highHappiness: 'Everything is great except this one massive incompatibility.',
    },
    turningPoint: true,
    choices: [
      {
        label: 'Compromise and meet halfway',
        emoji: '\u{1F91D}',
        impact: { wealth: -5, happiness: -5, health: 5, relationships: 15, risk: -10 },
        outcome: 'Neither got exactly what they wanted. Both got something better: a stronger bond.',
        milestone: 'Made a life-altering compromise',
      },
      {
        label: 'Stand firm on your vision',
        emoji: '\u{1F9D7}',
        impact: { wealth: 5, happiness: 10, health: -5, relationships: -20, risk: 15 },
        outcome: 'You held your ground. It cost the relationship dearly but preserved your authenticity.',
      },
    ],
  },
  {
    year: 7,
    title: 'External Pressure',
    base: 'Outside forces are testing the relationship. Family opinions, career stress, or financial strain.',
    variations: {
      lowWealth: 'Financial stress is the number one relationship killer. You are living that statistic.',
      lowHealth: 'Health problems add weight to an already burdened partnership.',
      lowRelationships: 'Every external pressure amplifies the internal cracks.',
    },
    choices: [
      {
        label: 'Shield the relationship',
        emoji: '\u{1F6E1}\u{FE0F}',
        impact: { wealth: 0, happiness: 5, health: -5, relationships: 10, risk: 5 },
        outcome: 'You put the relationship in a protective bubble. The outside world could wait.',
      },
      {
        label: 'Adapt together',
        emoji: '\u{1F3CB}\u{FE0F}',
        impact: { wealth: 5, happiness: 5, health: 5, relationships: 10, risk: 0 },
        outcome: 'Facing challenges as a team made you both stronger.',
        milestone: 'Weathered a storm together',
      },
      {
        label: 'Seek professional counsel',
        emoji: '\u{1F9E0}',
        impact: { wealth: -5, happiness: 10, health: 10, relationships: 10, risk: -5 },
        outcome: 'A therapist gave you tools and perspective that saved the relationship.',
      },
    ],
  },
  {
    year: 10,
    title: 'What We Built',
    base: 'A decade together. You look at what you have built and wonder at the journey.',
    variations: {
      highRelationships: 'The bond is deep and real. Ten years of effort created something beautiful.',
      lowRelationships: 'Ten years and you wonder if you are together out of love or habit.',
    },
    choices: [
      {
        label: 'Celebrate together',
        emoji: '\u{1F389}',
        impact: { wealth: -5, happiness: 15, health: 5, relationships: 15, risk: -5 },
        outcome: 'A celebration of a decade of partnership. Tears, laughter, and gratitude.',
        milestone: 'Celebrated a decade of love',
      },
      {
        label: 'Renew your commitment',
        emoji: '\u{1F48D}',
        impact: { wealth: -10, happiness: 10, health: 5, relationships: 10, risk: 0 },
        outcome: 'A renewal of vows or promises. Starting the next decade intentionally.',
      },
      {
        label: 'Evolve independently',
        emoji: '\u{1F98B}',
        impact: { wealth: 5, happiness: 5, health: 5, relationships: -10, risk: 10 },
        outcome: 'You chose growth over comfort. The relationship evolved into something new.',
      },
    ],
  },
];

// --- Relationship Bold ---
export const relationshipBoldTemplates: CheckpointTemplate[] = [
  {
    year: 1,
    title: 'All Cards on Table',
    base: 'The bold relationship path starts with radical vulnerability. You are laying everything bare from the start.',
    variations: {
      lowRelationships: 'Trust issues make this openness feel like jumping off a cliff.',
      lowHappiness: 'Vulnerability when you are already fragile takes extraordinary courage.',
    },
    choices: [
      {
        label: 'Radical honesty from day one',
        emoji: '\u{1F4A3}',
        impact: { wealth: 0, happiness: 5, health: 5, relationships: 10, risk: 10 },
        outcome: 'Complete honesty was shocking at first. Then it became the greatest gift.',
        milestone: 'Practiced radical honesty',
      },
      {
        label: 'Reveal slowly and carefully',
        emoji: '\u{1F3AD}',
        impact: { wealth: 0, happiness: 5, health: 5, relationships: 5, risk: -5 },
        outcome: 'Patience in revealing yourself built trust layer by layer.',
      },
      {
        label: 'Grand romantic gesture',
        emoji: '\u{1F490}',
        impact: { wealth: -10, happiness: 10, health: 0, relationships: 15, risk: 10 },
        outcome: 'The gesture was over the top and unforgettable. It set the tone for everything.',
        milestone: 'Legendary romantic gesture',
      },
    ],
  },
  {
    year: 3,
    title: 'Growing Apart or Together',
    base: 'Three years of intensity. The initial fire is evolving into something else. The question is: what?',
    variations: {
      lowRelationships: 'Distance has crept in. The bold start did not guarantee a bold middle.',
      highHappiness: 'Joy is abundant but growth requires facing uncomfortable truths.',
    },
    choices: [
      {
        label: 'Confront the issues head-on',
        emoji: '\u{26A1}',
        impact: { wealth: 0, happiness: -5, health: -5, relationships: 15, risk: 10 },
        outcome: 'The confrontation was explosive. What emerged from the ashes was real.',
      },
      {
        label: 'Practice patience and presence',
        emoji: '\u{1F9D8}',
        impact: { wealth: 0, happiness: 5, health: 10, relationships: 5, risk: -5 },
        outcome: 'Patience was the hardest bold move yet. Silence spoke volumes.',
      },
      {
        label: 'Make a drastic change together',
        emoji: '\u{1F30D}',
        impact: { wealth: -10, happiness: 10, health: 0, relationships: 10, risk: 15 },
        outcome: 'A shared drastic move — a trip, a move, a project — bonded you differently.',
        milestone: 'Made a drastic change for love',
      },
    ],
  },
  {
    year: 5,
    title: 'The Ultimatum',
    base: 'A moment of truth. One of you needs a definitive answer about the future. This is the make-or-break conversation.',
    variations: {
      lowRelationships: 'The relationship is hanging by a thread. This is the last chance.',
      highHappiness: 'Everything is great except the one unresolved question.',
    },
    turningPoint: true,
    choices: [
      {
        label: 'All in on commitment',
        emoji: '\u{1F48D}',
        impact: { wealth: -10, happiness: 15, health: 5, relationships: 25, risk: -15 },
        outcome: 'You committed fully. The weight of uncertainty lifted. Love won.',
        milestone: 'Made the ultimate commitment',
      },
      {
        label: 'Choose freedom first',
        emoji: '\u{1F54A}\u{FE0F}',
        impact: { wealth: 5, happiness: -5, health: 5, relationships: -20, risk: 15 },
        outcome: 'Freedom was more important than security. It cost you deeply but felt honest.',
        milestone: 'Chose freedom over security',
      },
    ],
  },
  {
    year: 7,
    title: 'Reinvention',
    base: 'Seven years of bold relating. You are both different people now. The relationship needs to evolve or die.',
    variations: {
      lowHappiness: 'Unhappiness in a relationship is contagious. Something must shift.',
      highRelationships: 'The bond is strong but stagnation threatens even the best relationships.',
    },
    choices: [
      {
        label: 'Transform together',
        emoji: '\u{1F525}',
        impact: { wealth: -5, happiness: 10, health: 5, relationships: 10, risk: 5 },
        outcome: 'Mutual transformation was the boldest experiment yet. You both emerged renewed.',
        milestone: 'Transformed together',
      },
      {
        label: 'Accept and appreciate differences',
        emoji: '\u{1F33C}',
        impact: { wealth: 0, happiness: 10, health: 5, relationships: 5, risk: -5 },
        outcome: 'Acceptance of differences was a quiet revolution. Peace replaced judgment.',
      },
      {
        label: 'Open a new chapter',
        emoji: '\u{1F4D6}',
        impact: { wealth: -5, happiness: 5, health: 0, relationships: -5, risk: 10 },
        outcome: 'A new chapter meant new rules, new boundaries, and new possibilities.',
      },
    ],
  },
  {
    year: 10,
    title: 'Love Story',
    base: 'A decade of bold love. Your story is not ordinary. It is messy, passionate, and undeniably yours.',
    variations: {
      highRelationships: 'The love story is one for the ages. Messy, real, and deeply beautiful.',
      lowRelationships: 'The story took unexpected turns. But every chapter had meaning.',
    },
    choices: [
      {
        label: 'Legendary bond',
        emoji: '\u{1F48E}',
        impact: { wealth: 0, happiness: 15, health: 5, relationships: 15, risk: -5 },
        outcome: 'Your love story became legendary. Not because it was perfect, but because it was real.',
        milestone: 'Built a legendary love story',
      },
      {
        label: 'Amicable evolution',
        emoji: '\u{1F331}',
        impact: { wealth: 5, happiness: 5, health: 5, relationships: -5, risk: -5 },
        outcome: 'You evolved past the relationship but kept the love. A mature, beautiful ending.',
      },
      {
        label: 'Surprising twist',
        emoji: '\u{1F300}',
        impact: { wealth: -5, happiness: 10, health: 0, relationships: 5, risk: 15 },
        outcome: 'A completely unexpected turn. Nobody saw it coming, least of all you.',
        milestone: 'Plot twist in the love story',
      },
    ],
  },
];

// --- Adventure Safe ---
export const adventureSafeTemplates: CheckpointTemplate[] = [
  {
    year: 1,
    title: 'Small Steps',
    base: 'Your adventure begins with preparation. Others rush in, but you believe in doing it right.',
    variations: {
      lowHappiness: 'Planning is not as exciting as doing. Impatience is growing.',
      lowWealth: 'Budget limitations mean every step must be carefully calculated.',
    },
    choices: [
      {
        label: 'Follow a careful plan',
        emoji: '\u{1F4DD}',
        impact: { wealth: 5, happiness: -5, health: 5, relationships: 0, risk: -10 },
        outcome: 'The plan was meticulous. Every contingency accounted for. Safe and smart.',
      },
      {
        label: 'Start spontaneously',
        emoji: '\u{26A1}',
        impact: { wealth: -5, happiness: 10, health: 0, relationships: 5, risk: 10 },
        outcome: 'Throwing away the plan felt incredible. Some of the best moments are unscripted.',
        milestone: 'Embraced spontaneity',
      },
      {
        label: 'Research phase',
        emoji: '\u{1F50D}',
        impact: { wealth: 0, happiness: 0, health: 5, relationships: 0, risk: -5 },
        outcome: 'Deep research revealed hidden opportunities others would have missed.',
      },
    ],
  },
  {
    year: 3,
    title: 'Unexpected Door',
    base: 'A door appears that was not on your map. An opportunity that could alter the entire trajectory of your adventure.',
    variations: {
      highRisk: 'Another unknown? Your tolerance for surprise is wearing thin.',
      lowWealth: 'The opportunity costs money you are not sure you can spare.',
    },
    choices: [
      {
        label: 'Walk through the door',
        emoji: '\u{1F6AA}',
        impact: { wealth: -5, happiness: 10, health: 0, relationships: 0, risk: 10 },
        outcome: 'Behind the door was something you never could have planned for. Wonderful.',
        milestone: 'Walked through the unexpected door',
      },
      {
        label: 'Peek first, then decide',
        emoji: '\u{1F440}',
        impact: { wealth: 0, happiness: 5, health: 5, relationships: 0, risk: 0 },
        outcome: 'Caution and curiosity. You gathered intel before committing. Smart.',
      },
      {
        label: 'Create your own door',
        emoji: '\u{1F528}',
        impact: { wealth: -5, happiness: 5, health: -5, relationships: 5, risk: 5 },
        outcome: 'Why use someone else\'s door? You carved your own path. That is your style.',
      },
    ],
  },
  {
    year: 5,
    title: 'Identity Crossroads',
    base: 'The adventure has changed you. You barely recognize who you were before. Do you complete the transformation or return to familiar ground?',
    variations: {
      lowHappiness: 'The transformation has not brought the happiness you expected.',
      highHappiness: 'You love who you are becoming. Going back seems impossible.',
    },
    turningPoint: true,
    choices: [
      {
        label: 'Full transformation',
        emoji: '\u{1F98B}',
        impact: { wealth: -10, happiness: 15, health: 5, relationships: -15, risk: 20 },
        outcome: 'You completed the metamorphosis. The old you is gone. Something magnificent emerged.',
        milestone: 'Complete personal transformation',
      },
      {
        label: 'Return to your roots',
        emoji: '\u{1F333}',
        impact: { wealth: 5, happiness: 5, health: 10, relationships: 15, risk: -20 },
        outcome: 'You brought the lessons home. Changed but grounded. The best of both worlds.',
      },
    ],
  },
  {
    year: 7,
    title: 'The Reputation',
    base: 'Your careful adventure has earned you a reputation. People know your name, your story, your approach.',
    variations: {
      highWealth: 'Success followed your careful approach. People want your method.',
      lowRelationships: 'Famous but lonely. The reputation came at a social cost.',
    },
    choices: [
      {
        label: 'Leverage the reputation',
        emoji: '\u{1F4E2}',
        impact: { wealth: 10, happiness: 5, health: 0, relationships: -5, risk: 5 },
        outcome: 'Your name opened doors. Speaking gigs, partnerships, and influence.',
      },
      {
        label: 'Stay humble and grounded',
        emoji: '\u{1F64F}',
        impact: { wealth: 0, happiness: 10, health: 5, relationships: 10, risk: -5 },
        outcome: 'Humility in the face of recognition. People respected you even more.',
        milestone: 'Stayed humble despite fame',
      },
      {
        label: 'Pivot to something new',
        emoji: '\u{1F500}',
        impact: { wealth: -5, happiness: 10, health: 0, relationships: 0, risk: 10 },
        outcome: 'You left your reputation behind and started fresh. Bold move for a safe player.',
      },
    ],
  },
  {
    year: 10,
    title: 'Living Legend',
    base: 'A decade of measured adventure. Your story is one of wisdom, patience, and well-timed courage.',
    variations: {
      highHappiness: 'The careful path led to deep, lasting fulfillment.',
      lowHappiness: 'Ten years of caution and the nagging feeling you played it too safe.',
    },
    choices: [
      {
        label: 'Write the book',
        emoji: '\u{1F4D6}',
        impact: { wealth: 10, happiness: 10, health: 5, relationships: 5, risk: -5 },
        outcome: 'Your story in print. A bestseller that inspired careful adventurers everywhere.',
        milestone: 'Published your adventure story',
      },
      {
        label: 'The next great adventure',
        emoji: '\u{1F30B}',
        impact: { wealth: -10, happiness: 15, health: -5, relationships: -5, risk: 15 },
        outcome: 'One more. Just one more. The call of adventure never truly fades.',
      },
      {
        label: 'Settle into wisdom',
        emoji: '\u{1F9D8}',
        impact: { wealth: 5, happiness: 10, health: 10, relationships: 10, risk: -15 },
        outcome: 'Settling down with a decade of stories. The greatest adventure was the journey itself.',
        milestone: 'Found peace in wisdom',
      },
    ],
  },
];

// --- Adventure Bold ---
export const adventureBoldTemplates: CheckpointTemplate[] = [
  {
    year: 1,
    title: 'Leap of Faith',
    base: 'You jumped without looking. The ground is nowhere in sight and the wind is rushing past your ears.',
    variations: {
      lowWealth: 'No safety net. Financially or otherwise. This is the real deal.',
      lowHappiness: 'The leap was supposed to feel liberating. Instead it feels terrifying.',
    },
    choices: [
      {
        label: 'Eyes closed, full send',
        emoji: '\u{1F680}',
        impact: { wealth: -5, happiness: 10, health: -5, relationships: -5, risk: 15 },
        outcome: 'Pure faith. No plan. No backup. Just you and the unknown.',
        milestone: 'Full send into the unknown',
      },
      {
        label: 'Calculated risk assessment',
        emoji: '\u{1F9EE}',
        impact: { wealth: 0, happiness: 5, health: 5, relationships: 0, risk: -5 },
        outcome: 'Even in freefall, you found a way to calculate. Pragmatic adventurer.',
      },
      {
        label: 'Ask the universe for a sign',
        emoji: '\u{2728}',
        impact: { wealth: 0, happiness: 5, health: 0, relationships: 5, risk: 5 },
        outcome: 'The sign came. Whether it was real or self-fulfilling, it gave you direction.',
      },
    ],
  },
  {
    year: 3,
    title: 'Plot Twist',
    base: 'Nothing went according to plan — because there was no plan. A wild development changes everything.',
    variations: {
      highRisk: 'Another twist on top of maximum risk. You are living in a thriller novel.',
      lowHealth: 'The physical toll of non-stop adventure is becoming dangerous.',
    },
    choices: [
      {
        label: 'Embrace the chaos',
        emoji: '\u{1F32A}\u{FE0F}',
        impact: { wealth: 5, happiness: 10, health: -10, relationships: -5, risk: 15 },
        outcome: 'Chaos became your comfort zone. Normal people would never understand.',
        milestone: 'Thrived in chaos',
      },
      {
        label: 'Find the pattern',
        emoji: '\u{1F9E9}',
        impact: { wealth: 5, happiness: 5, health: 5, relationships: 5, risk: -5 },
        outcome: 'Even in chaos there is order. You found the rhythm hidden in the noise.',
      },
      {
        label: 'Make your own rules',
        emoji: '\u{1F451}',
        impact: { wealth: 0, happiness: 10, health: 0, relationships: 0, risk: 10 },
        outcome: 'Rules are for other people. You wrote your own playbook.',
        milestone: 'Wrote your own rules',
      },
    ],
  },
  {
    year: 5,
    title: 'Point of No Return',
    base: 'You have gone so far that returning to normal life seems impossible. The bridge behind you is burning whether you lit it or not.',
    variations: {
      lowRelationships: 'The people you left behind are just memories now.',
      highHappiness: 'You have never felt more alive. Why would you ever go back?',
    },
    turningPoint: true,
    choices: [
      {
        label: 'Burn all bridges',
        emoji: '\u{1F525}',
        impact: { wealth: -10, happiness: 15, health: -10, relationships: -20, risk: 25 },
        outcome: 'No retreat. No surrender. You are fully committed to the uncharted path.',
        milestone: 'Burned every bridge',
      },
      {
        label: 'Keep one exit open',
        emoji: '\u{1F6AA}',
        impact: { wealth: 5, happiness: 5, health: 5, relationships: 10, risk: -10 },
        outcome: 'One thread to the old world remained. A lifeline for just in case.',
      },
    ],
  },
  {
    year: 7,
    title: 'The Peak',
    base: 'Seven years of bold adventure brought you to a peak. The view is breathtaking. What now?',
    variations: {
      highWealth: 'The adventure paid off in unexpected financial ways.',
      lowHealth: 'You reached the peak but your body is breaking down.',
    },
    choices: [
      {
        label: 'Enjoy the view',
        emoji: '\u{1F305}',
        impact: { wealth: 0, happiness: 15, health: 10, relationships: 5, risk: -10 },
        outcome: 'You paused. Breathed. Took it all in. Sometimes the best move is to stand still.',
        milestone: 'Enjoyed the peak moment',
      },
      {
        label: 'Climb even higher',
        emoji: '\u{26F0}\u{FE0F}',
        impact: { wealth: -5, happiness: 5, health: -15, relationships: -10, risk: 15 },
        outcome: 'Higher peaks exist. Rest is for the summit. Onward and upward.',
      },
      {
        label: 'Help others reach this height',
        emoji: '\u{1F91D}',
        impact: { wealth: -5, happiness: 10, health: 5, relationships: 15, risk: -5 },
        outcome: 'Reaching back to pull others up gave the view its deepest meaning.',
        milestone: 'Became a guide for others',
      },
    ],
  },
  {
    year: 10,
    title: 'Uncharted',
    base: 'A decade of bold exploration. You have been where few dare to go. What territory remains?',
    variations: {
      highHappiness: 'Joy is your compass and it has never steered you wrong.',
      lowHealth: 'The adventure log is written on your body. Scars, wear, and stories.',
    },
    choices: [
      {
        label: 'Create an entirely new world',
        emoji: '\u{1F30C}',
        impact: { wealth: -5, happiness: 15, health: -5, relationships: 5, risk: 15 },
        outcome: 'Why explore existing worlds? You started building your own.',
        milestone: 'Created something entirely new',
      },
      {
        label: 'Rest at last',
        emoji: '\u{1F54C}',
        impact: { wealth: 5, happiness: 10, health: 15, relationships: 10, risk: -15 },
        outcome: 'The adventurer finally rests. Not from defeat but from deep, earned satisfaction.',
        milestone: 'Found ultimate peace',
      },
      {
        label: 'Eternal explorer',
        emoji: '\u{1F30D}',
        impact: { wealth: -10, happiness: 10, health: -10, relationships: -5, risk: 15 },
        outcome: 'There is no finish line for someone like you. The journey is the destination.',
      },
    ],
  },
];

// ----- Master template map -----

export const checkpointTemplateMap: Record<string, CheckpointTemplate[]> = {
  'career-safe': careerSafeTemplates,
  'career-bold': careerBoldTemplates,
  'life-safe': lifeSafeTemplates,
  'life-bold': lifeBoldTemplates,
  'education-safe': educationSafeTemplates,
  'education-bold': educationBoldTemplates,
  'finance-safe': financeSafeTemplates,
  'finance-bold': financeBoldTemplates,
  'relationship-safe': relationshipSafeTemplates,
  'relationship-bold': relationshipBoldTemplates,
  'adventure-safe': adventureSafeTemplates,
  'adventure-bold': adventureBoldTemplates,
};
