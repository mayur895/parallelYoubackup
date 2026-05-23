// ============================================================================
// Tend — Triage Engine
//
// Pure, deterministic. The LLM never decides medical content. Its role is
// limited to:
//   1. Routing free-text symptom descriptions to a body system (analyze())
//   2. Paraphrasing the user's words back to them on the plan screen
//
// All protocols, escalation criteria, and red-flag detection live here as
// authored data. The engine is the source of truth.
//
// References (paraphrased general first-aid guidance; not a substitute for
// professional advice): WHO basic first-aid, Red Cross, St John Ambulance,
// NHS self-help pages.
// ============================================================================

export type BodySystem =
  | 'bleeding'
  | 'burns'
  | 'breathing'
  | 'pain'
  | 'fever'
  | 'bites'
  | 'poisoning'
  | 'other';

export type AgeBand = 'infant' | 'child' | 'adult' | 'elderly';

export interface TriageInput {
  bodySystem: BodySystem;
  severity: number; // 1..10
  durationHours: number; // 0 means "less than an hour", 999 means "longer than a week"
  ageBand: AgeBand;
  consciousAndBreathing: boolean; // user-reported
  description: string;
}

export interface SourceRef {
  title: string;
  url?: string;
  accessedOn?: string;
}

export interface Protocol {
  id: string;
  title: string;
  bodySystem: BodySystem;
  summary: string;
  steps: string[]; // ordered DO list
  avoid: string[]; // DON'T list
  whenToEscalate: string[];
  specialty: string; // recommended professional follow-up
  sources: SourceRef[];
  /** Medical reviewer who signed off on the content. Null until reviewed. */
  reviewedBy: string | null;
  /** ISO date string of the last review. Null until reviewed. */
  reviewedOn: string | null;
}

export interface RedFlag {
  id: string;
  label: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Body system catalog (for UI tile selection)
// ---------------------------------------------------------------------------

export const BODY_SYSTEMS: { id: BodySystem; label: string; hint: string }[] = [
  { id: 'bleeding',  label: 'Bleeding & Wounds',     hint: 'Cuts, scrapes, nosebleeds' },
  { id: 'burns',     label: 'Burns',                 hint: 'Heat, scald, sunburn' },
  { id: 'breathing', label: 'Breathing & Chest',     hint: 'Cough, shortness of breath' },
  { id: 'pain',      label: 'Pain & Injury',         hint: 'Sprains, headache, body pain' },
  { id: 'fever',     label: 'Fever & Infection',     hint: 'High temperature, chills' },
  { id: 'bites',     label: 'Bites & Stings',        hint: 'Insect, animal, rash' },
  { id: 'poisoning', label: 'Poisoning & Ingestion', hint: 'Swallowed something harmful' },
  { id: 'other',     label: 'Something Else',        hint: 'Nausea, dizziness, unsure' },
];

// ---------------------------------------------------------------------------
// Red-flag scanner — runs deterministically on the symptom description.
// If anything here matches, the UI must jump to the EMERGENCY screen.
// ---------------------------------------------------------------------------

interface RedFlagRule {
  id: string;
  label: string;
  reason: string;
  patterns: RegExp[];
}

const RED_FLAG_RULES: RedFlagRule[] = [
  {
    id: 'cardiac',
    label: 'Possible heart attack',
    reason: 'Chest pain combined with sweating, arm/jaw pain, or shortness of breath needs emergency care now.',
    patterns: [
      /chest\s*pain.*(sweat|arm|jaw|breath|nausea)/i,
      /(crushing|squeezing|pressure).*chest/i,
    ],
  },
  {
    id: 'stroke',
    label: 'Possible stroke (FAST signs)',
    reason: 'Face droop, slurred speech, sudden weakness on one side, or sudden confusion needs emergency care now.',
    patterns: [
      /face\s*droop|slurred\s*speech|one\s*side\s*(weak|numb)/i,
      /sudden(ly)?\s*(weak|numb|confus|can'?t\s*speak)/i,
    ],
  },
  {
    id: 'airway',
    label: 'Airway / breathing emergency',
    reason: 'Choking, severe shortness of breath, or blue lips needs emergency care now.',
    patterns: [
      /can'?t\s*breathe|cannot\s*breathe|not\s*breathing/i,
      /choking|throat\s*closing|blue\s*(lip|face)/i,
    ],
  },
  {
    id: 'anaphylaxis',
    label: 'Possible anaphylaxis',
    reason: 'Swelling of throat/face with rash or trouble breathing after a sting, food, or medicine is a life-threatening allergic reaction.',
    patterns: [
      /(throat|tongue|face|lip).*swell|swell.*(throat|tongue|lip)/i,
      /hives.*(breath|throat)|breath.*hives/i,
    ],
  },
  {
    id: 'unresponsive',
    label: 'Unresponsive person',
    reason: 'Anyone who will not wake, is having a seizure, or has collapsed needs emergency care now.',
    patterns: [
      /unconscious|won'?t\s*wake|will\s*not\s*wake|passed\s*out|collapsed/i,
      /seizure|fit(ting)?|convuls/i,
    ],
  },
  {
    id: 'severe-bleed',
    label: 'Severe / uncontrolled bleeding',
    reason: 'Bleeding that will not stop with firm pressure for 10 minutes needs emergency care now.',
    patterns: [
      /(spurting|gushing|won'?t\s*stop|can'?t\s*stop).*(blood|bleed)/i,
      /bleeding\s*heavily|heavy\s*bleeding|severe\s*bleed/i,
    ],
  },
  {
    id: 'head-injury',
    label: 'Serious head injury',
    reason: 'Head injury with vomiting, confusion, unequal pupils, or loss of consciousness needs emergency care now.',
    patterns: [
      /head.*(injur|hit|trauma).*(vomit|confus|unconscious|pupil)/i,
      /(vomit|confus|unconscious).*head.*(injur|hit|trauma)/i,
    ],
  },
  {
    id: 'self-harm',
    label: 'Crisis support needed',
    reason: 'If you or someone near you is thinking about self-harm, please reach a crisis line or local emergency services now.',
    patterns: [
      /suicid|kill\s*myself|end\s*my\s*life|self[-\s]*harm/i,
    ],
  },
  {
    id: 'poisoning-severe',
    label: 'Severe poisoning',
    reason: 'Swallowing chemicals, medicines in overdose, or unknown substances needs emergency / poison control now.',
    patterns: [
      /(swallow|drank|took).*(bleach|poison|chemical|overdose|pills)/i,
      /overdos/i,
    ],
  },
];

export function detectRedFlags(text: string, triage?: Partial<TriageInput>): RedFlag[] {
  const flags: RedFlag[] = [];
  const haystack = text || '';

  for (const rule of RED_FLAG_RULES) {
    if (rule.patterns.some((p) => p.test(haystack))) {
      flags.push({ id: rule.id, label: rule.label, reason: rule.reason });
    }
  }

  // Triage-derived flags
  if (triage?.consciousAndBreathing === false) {
    flags.push({
      id: 'unresponsive-triage',
      label: 'Person is not conscious / not breathing normally',
      reason: 'Treat as a life-threatening emergency. Call for help and begin basic life support if trained.',
    });
  }

  if (triage?.severity != null && triage.severity >= 9 && triage.bodySystem !== 'other') {
    flags.push({
      id: 'severity-extreme',
      label: 'Severity reported as extreme',
      reason: 'A 9/10 or 10/10 symptom warrants immediate professional evaluation.',
    });
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Protocol library — hand-authored, conservative, deterministic.
// Indexed by body system. Severity refines the choice within a system.
//
// Source of truth: src/content/protocols/*.json (one file per protocol).
// The loader validates each file against schema.ts at module-load time
// and asserts unique IDs. To add a protocol, drop a JSON file in that
// directory — no code changes here.
// ---------------------------------------------------------------------------

import { PROTOCOLS } from '../content/protocols';
export { PROTOCOLS };

// ---------------------------------------------------------------------------
// Protocol selector
// ---------------------------------------------------------------------------

export function pickProtocol(input: TriageInput): Protocol {
  const candidates = PROTOCOLS.filter((p) => p.bodySystem === input.bodySystem);

  if (candidates.length === 0) {
    return PROTOCOLS.find((p) => p.id === 'nausea-vomiting')!;
  }

  // Simple, transparent ranking: prefer a protocol whose title hints match
  // the description, otherwise return the first protocol for that body system.
  const desc = (input.description || '').toLowerCase();
  const ranked = [...candidates].sort((a, b) => {
    const scoreA = scoreMatch(a, desc);
    const scoreB = scoreMatch(b, desc);
    return scoreB - scoreA;
  });
  return ranked[0];
}

function scoreMatch(p: Protocol, desc: string): number {
  if (!desc) return 0;
  const tokens = p.title.toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 3);
  return tokens.reduce((acc, t) => acc + (desc.includes(t) ? 1 : 0), 0);
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export function severityLabel(severity: number): 'mild' | 'moderate' | 'severe' {
  if (severity <= 3) return 'mild';
  if (severity <= 6) return 'moderate';
  return 'severe';
}

export function ageBandLabel(age: AgeBand): string {
  switch (age) {
    case 'infant':  return 'Infant (under 1 year)';
    case 'child':   return 'Child (1–12 years)';
    case 'adult':   return 'Adult (13–64 years)';
    case 'elderly': return 'Older adult (65+)';
  }
}

export const PROTOCOL_COUNT = PROTOCOLS.length;

// ---------------------------------------------------------------------------
// LLM routing — structured output
//
// The LLM does ONE job: take free-text symptoms and return a small JSON
// object identifying the body system + a paraphrase. It never names a
// protocol or gives medical advice. The deterministic engine picks the
// protocol afterwards.
// ---------------------------------------------------------------------------

export interface AiRouting {
  bodySystem: BodySystem;
  paraphrase: string;
  /** True if the LLM thinks this might be urgent. Engine treats as a hint only. */
  urgent: boolean;
  /** True if parsing succeeded; false if we had to fall back to defaults. */
  parsed: boolean;
}

const VALID_BODY_SYSTEMS = new Set<string>(BODY_SYSTEMS.map((s) => s.id));

/**
 * Build a compact, few-shot prompt that asks for a single JSON object.
 * Designed to be reliable even with small models (~350M parameters).
 */
export function buildRoutingPrompt(description: string): string {
  const safeInput = description.replace(/"/g, "'").slice(0, 500);
  return [
    'You are a triage assistant. Read the user description and reply with ONE JSON object on a single line.',
    '',
    'The JSON object must have exactly these keys:',
    '  "bodySystem": one of "bleeding", "burns", "breathing", "pain", "fever", "bites", "poisoning", "other"',
    '  "paraphrase": one short sentence (max 20 words) restating what the person said, in plain English',
    '  "urgent": true if you think this needs urgent professional care, otherwise false',
    '',
    'Do NOT diagnose. Do NOT prescribe. Do NOT add any text outside the JSON object.',
    '',
    'Description: "I cut my finger while chopping onions and it is bleeding a bit"',
    'Reply: {"bodySystem":"bleeding","paraphrase":"You cut your finger while chopping onions and it is bleeding lightly.","urgent":false}',
    '',
    'Description: "high temperature for two days, feeling shivery and tired"',
    'Reply: {"bodySystem":"fever","paraphrase":"You have had a high temperature for two days with chills and tiredness.","urgent":false}',
    '',
    'Description: "sudden severe chest pain spreading to my left arm, sweating"',
    'Reply: {"bodySystem":"pain","paraphrase":"You have sudden severe chest pain spreading to your left arm with sweating.","urgent":true}',
    '',
    `Description: "${safeInput}"`,
    'Reply:',
  ].join('\n');
}

/**
 * Parse the LLM's response into an AiRouting object.
 * Forgiving: extracts the first {...} block, validates fields, falls back
 * to safe defaults on any error.
 */
export function parseRouting(raw: string, fallbackDescription: string): AiRouting {
  const fallback: AiRouting = {
    bodySystem: 'other',
    paraphrase: fallbackDescription.slice(0, 160),
    urgent: false,
    parsed: false,
  };

  if (!raw) return fallback;

  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return fallback;

  const slice = raw.slice(first, last + 1);

  try {
    const obj = JSON.parse(slice) as Record<string, unknown>;
    const bs = typeof obj.bodySystem === 'string' && VALID_BODY_SYSTEMS.has(obj.bodySystem)
      ? (obj.bodySystem as BodySystem)
      : 'other';
    const paraphrase = typeof obj.paraphrase === 'string' && obj.paraphrase.trim().length > 0
      ? obj.paraphrase.trim().slice(0, 240)
      : fallback.paraphrase;
    const urgent = obj.urgent === true;
    return { bodySystem: bs, paraphrase, urgent, parsed: true };
  } catch {
    return fallback;
  }
}

