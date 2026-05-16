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

export interface Protocol {
  id: string;
  title: string;
  bodySystem: BodySystem;
  summary: string;
  steps: string[]; // ordered DO list
  avoid: string[]; // DON'T list
  whenToEscalate: string[];
  specialty: string; // recommended professional follow-up
  references: string[];
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
// ---------------------------------------------------------------------------

const PROTOCOLS: Protocol[] = [
  {
    id: 'bleeding-minor',
    title: 'Minor cut, scrape, or graze',
    bodySystem: 'bleeding',
    summary: 'Small wounds with light bleeding usually heal well with cleaning and pressure.',
    steps: [
      'Wash your hands with clean water and soap if available.',
      'Rinse the wound under clean running water for at least 1 minute to remove dirt.',
      'Pat dry with a clean cloth. Do not rub.',
      'Apply firm, steady pressure with a clean cloth or gauze until bleeding stops (usually 5–10 minutes).',
      'Cover with a clean dressing or adhesive bandage.',
      'Change the dressing once a day or whenever it becomes wet or dirty.',
    ],
    avoid: [
      'Do not apply turmeric, ash, toothpaste, or other home pastes inside the wound.',
      'Do not remove a deeply embedded object — press around it instead.',
      'Do not blow on the wound.',
    ],
    whenToEscalate: [
      'Bleeding does not stop after 10 minutes of firm pressure.',
      'The cut is deeper than 0.5 cm, gapes open, or you can see fat / muscle / bone.',
      'The wound is from a dirty or rusty object and you have not had a tetanus shot in 5+ years.',
      'Redness, swelling, warmth, pus, or fever appears in the next 1–2 days (signs of infection).',
    ],
    specialty: 'General physician or nearest urgent care clinic.',
    references: ['WHO basic first aid', 'Red Cross — wound care'],
  },

  {
    id: 'nosebleed',
    title: 'Nosebleed',
    bodySystem: 'bleeding',
    summary: 'Most nosebleeds come from the front of the nose and stop with simple pressure.',
    steps: [
      'Sit upright and lean slightly forward (not backward).',
      'Pinch the soft part of the nose, just below the bony bridge, firmly closed.',
      'Hold for 10 full minutes without checking.',
      'Breathe through the mouth. Spit out blood that reaches the mouth.',
      'After 10 minutes, release slowly. If bleeding continues, repeat once for another 10 minutes.',
    ],
    avoid: [
      'Do not tilt the head back — blood running down the throat can cause vomiting.',
      'Do not pack the nose with cotton or tissue.',
      'Avoid blowing the nose or strenuous activity for 24 hours.',
    ],
    whenToEscalate: [
      'Bleeding has not stopped after 20 minutes of continuous pressure.',
      'The nosebleed followed a strong blow to the head or face.',
      'The person is on blood-thinning medication.',
      'Frequent, repeated nosebleeds over several weeks.',
    ],
    specialty: 'General physician or ENT specialist for repeated nosebleeds.',
    references: ['NHS — nosebleeds'],
  },

  {
    id: 'burns-thermal-minor',
    title: 'Minor thermal burn (1st degree / small 2nd degree)',
    bodySystem: 'burns',
    summary: 'Small, superficial burns are red, painful, and may blister. They usually heal at home.',
    steps: [
      'Move away from the heat source immediately.',
      'Cool the burn under cool (not ice-cold) running water for 20 minutes.',
      'Remove jewellery, watches, and tight clothing near the burn before swelling starts.',
      'Cover loosely with cling film (plastic wrap) or a clean, non-fluffy cloth.',
      'A simple pain reliever such as paracetamol can be used by adults at the labelled dose.',
    ],
    avoid: [
      'Do not apply butter, oil, toothpaste, ice, or ash to a burn.',
      'Do not burst blisters.',
      'Do not use sticky bandages that adhere to the wound.',
    ],
    whenToEscalate: [
      'Burn is larger than the size of the person\'s palm.',
      'Burn is on the face, hands, feet, genitals, or across a joint.',
      'Burn looks white, leathery, or charred (deep burn).',
      'Burn is from a chemical, electrical source, or from inhalation of hot smoke.',
      'Burn is on a child, infant, or elderly person.',
    ],
    specialty: 'Burn unit or emergency department for any of the above; otherwise general physician.',
    references: ['Red Cross — burns', 'WHO — burn first aid'],
  },

  {
    id: 'fever-adult',
    title: 'Fever in an adult',
    bodySystem: 'fever',
    summary: 'A temperature above 37.8°C / 100°F is a sign your body is fighting an infection.',
    steps: [
      'Rest and drink small sips of water frequently to stay hydrated.',
      'Wear light clothing and keep the room comfortably cool.',
      'A cool (not cold) damp cloth on the forehead can ease discomfort.',
      'If needed, a labelled adult dose of paracetamol can be taken every 4–6 hours, not exceeding the daily maximum.',
      'Check the temperature every 4 hours and write it down.',
    ],
    avoid: [
      'Do not bundle up in heavy blankets — this can raise core temperature further.',
      'Do not give aspirin to anyone under 18.',
      'Do not combine multiple paracetamol-containing products.',
      'Avoid alcohol while feverish.',
    ],
    whenToEscalate: [
      'Temperature above 39.4°C / 103°F that does not come down with medication.',
      'Fever lasting more than 3 days.',
      'Fever with stiff neck, severe headache, rash that does not fade under pressure, confusion, or difficulty breathing.',
      'Fever in someone who is pregnant, immunocompromised, or has a chronic illness.',
    ],
    specialty: 'General physician; emergency department for any escalation sign.',
    references: ['NHS — fever in adults'],
  },

  {
    id: 'sprain-strain',
    title: 'Sprain or strain (ankle, wrist, knee)',
    bodySystem: 'pain',
    summary: 'A sprain is an over-stretched ligament; a strain is an over-stretched muscle. Both respond to early R.I.C.E.',
    steps: [
      'Rest the joint and avoid putting weight on it for the first 24–48 hours.',
      'Ice the area for 15–20 minutes every 2–3 hours, using a cloth between ice and skin.',
      'Compress with an elastic bandage — firm but not so tight it tingles.',
      'Elevate the limb above heart level when sitting or lying down.',
      'After 48 hours, begin gentle, pain-free movement.',
    ],
    avoid: [
      'Do not apply heat in the first 48 hours.',
      'Do not massage vigorously over the injury.',
      'Do not return to sport or heavy activity until pain-free and the joint feels stable.',
    ],
    whenToEscalate: [
      'You cannot put any weight on the joint, or it gives way.',
      'There is an obvious deformity or you heard a snap or pop at the moment of injury.',
      'Significant swelling, bruising, or numbness in the limb.',
      'No improvement after 3–5 days of rest.',
    ],
    specialty: 'Orthopaedic clinic or physiotherapist for persistent pain.',
    references: ['NHS — sprains and strains'],
  },

  {
    id: 'headache-tension',
    title: 'Tension-type headache',
    bodySystem: 'pain',
    summary: 'A dull, band-like pressure around the head, often related to stress, posture, dehydration, or eye strain.',
    steps: [
      'Drink a full glass of water — mild dehydration is a common trigger.',
      'Move to a quiet, dimly lit room and rest for 15–30 minutes.',
      'Apply a cool cloth to the forehead or a warm compress to the neck and shoulders.',
      'Gentle neck and shoulder stretches can release tension.',
      'A labelled adult dose of paracetamol or ibuprofen may help if no contraindication.',
    ],
    avoid: [
      'Avoid using painkillers more than 2–3 days a week to prevent rebound headaches.',
      'Limit screen time and caffeine.',
    ],
    whenToEscalate: [
      'The worst headache of your life, or a sudden "thunderclap" onset.',
      'Headache with fever, stiff neck, rash, confusion, weakness, vision change, or after a head injury.',
      'Headache that wakes you from sleep or steadily worsens over days.',
      'Headache during pregnancy with vision changes or severe swelling.',
    ],
    specialty: 'General physician; emergency department for any escalation sign.',
    references: ['NHS — headaches'],
  },

  {
    id: 'bite-insect',
    title: 'Insect bite or sting (non-severe)',
    bodySystem: 'bites',
    summary: 'Most insect bites cause local redness, itch, and swelling that settle in a few days.',
    steps: [
      'If a sting is visible (e.g. honey bee), scrape it out sideways with a card edge — do not squeeze with tweezers.',
      'Wash the area with clean water and soap.',
      'Apply a cool compress for 10 minutes to reduce swelling and itch.',
      'Keep the bitten limb elevated if possible.',
      'Avoid scratching to prevent secondary infection.',
    ],
    avoid: [
      'Do not apply mud, saliva, or unknown herbal pastes — risk of infection.',
      'Do not break blisters.',
    ],
    whenToEscalate: [
      'Swelling of the face, lips, tongue, or trouble breathing — this is an emergency.',
      'A widespread rash, dizziness, or fainting after the bite.',
      'A snake, scorpion, or unknown wild animal bite.',
      'Redness spreading outward over hours, pus, or fever (infection).',
    ],
    specialty: 'General physician; emergency department for any escalation sign.',
    references: ['WHO — bites and stings'],
  },

  {
    id: 'nausea-vomiting',
    title: 'Mild nausea or short-lived vomiting',
    bodySystem: 'other',
    summary: 'Most short episodes of nausea or vomiting (under 24 hours) settle with rest and small sips of fluid.',
    steps: [
      'Stop solid food for a few hours. Sit upright and rest.',
      'Sip small amounts of clear fluid (water, oral rehydration solution) every 10–15 minutes.',
      'Once vomiting has settled for 4–6 hours, try bland foods: dry toast, plain rice, banana, plain crackers.',
      'Rest in a cool, quiet room. Avoid strong smells.',
    ],
    avoid: [
      'Do not drink large amounts at once — this often triggers more vomiting.',
      'Avoid dairy, fatty foods, alcohol, caffeine, and spicy food for 24 hours.',
    ],
    whenToEscalate: [
      'Cannot keep any fluid down for more than 8 hours.',
      'Signs of dehydration: very dark urine, dizziness on standing, dry mouth, sunken eyes.',
      'Vomit contains blood or looks like coffee grounds.',
      'Severe abdominal pain, high fever, or vomiting after a head injury.',
      'In infants, children, pregnant people, or elderly — seek care early.',
    ],
    specialty: 'General physician; emergency department for any escalation sign.',
    references: ['NHS — nausea and vomiting'],
  },

  {
    id: 'bleeding-deep-cut',
    title: 'Deep cut with steady bleeding',
    bodySystem: 'bleeding',
    summary: 'A deeper wound where you can see fat or muscle, or where bleeding has not slowed after a few minutes of pressure.',
    steps: [
      'Lie or sit the person down and raise the wounded part above heart level if possible.',
      'Press firmly on the wound with the cleanest cloth or dressing you have.',
      'Maintain steady pressure for 15 full minutes without lifting the cloth to peek.',
      'If blood soaks through, add another layer on top — do not remove the first.',
      'Keep pressure on while you arrange transport to a clinic or hospital.',
    ],
    avoid: [
      'Do not apply tourniquets unless trained and bleeding is life-threatening from a limb.',
      'Do not remove embedded objects — press around them.',
      'Do not give food or drink in case stitches or surgery are needed.',
    ],
    whenToEscalate: [
      'Almost always — deep cuts usually need cleaning, possibly stitches, and a tetanus check.',
      'Immediately if bleeding spurts, soaks through repeated dressings, or the person feels faint, cold, or clammy.',
    ],
    specialty: 'Urgent care or emergency department.',
    references: ['Red Cross — severe bleeding'],
  },

  {
    id: 'burn-sunburn',
    title: 'Mild sunburn',
    bodySystem: 'burns',
    summary: 'Red, warm, tender skin without blisters that develops a few hours after sun exposure.',
    steps: [
      'Get out of the sun and into a cool, shaded place.',
      'Cool the skin with a cool shower or a damp cloth for 10–15 minutes.',
      'Drink extra water — sunburn dehydrates.',
      'Apply a fragrance-free moisturiser or pure aloe vera gel.',
      'Wear loose, soft clothing over the area and avoid further sun until healed.',
    ],
    avoid: [
      'Do not pop blisters or peel flaking skin.',
      'Do not apply ice directly to the skin, or greasy ointments that trap heat.',
      'Do not use products containing alcohol (they sting and dry the skin further).',
    ],
    whenToEscalate: [
      'Large blistered area, especially on the face, hands, or genitals.',
      'Fever, chills, severe pain, headache, or confusion (possible heatstroke or sun poisoning).',
      'Sunburn on an infant or young child.',
    ],
    specialty: 'General physician; emergency department for any escalation sign.',
    references: ['NHS — sunburn'],
  },

  {
    id: 'cough-cold',
    title: 'Common cold or mild cough',
    bodySystem: 'breathing',
    summary: 'A runny nose, sneeze, mild sore throat, and dry cough lasting a few days. Usually viral; rest is the main treatment.',
    steps: [
      'Rest as much as you can. Sleep is your body\'s strongest tool.',
      'Drink warm fluids: water, broth, herbal tea with honey (not for children under 1 year).',
      'Use a saline spray or warm steam inhalation to ease nasal stuffiness.',
      'A simple adult dose of paracetamol or ibuprofen can ease aches and low fever.',
      'Cover your mouth when you cough or sneeze and wash hands often to protect others.',
    ],
    avoid: [
      'Antibiotics do nothing for viral colds — do not request them.',
      'Avoid cough syrups in children under 6 unless a doctor has prescribed them.',
      'Avoid smoking and second-hand smoke, which worsen the cough.',
    ],
    whenToEscalate: [
      'Cough lasting more than 3 weeks.',
      'Difficulty breathing, wheezing, chest pain, or coughing up blood.',
      'High fever above 39°C / 102°F that does not settle.',
      'Symptoms in an infant under 3 months, the elderly, or someone with a chronic chest condition.',
    ],
    specialty: 'General physician.',
    references: ['NHS — common cold'],
  },

  {
    id: 'sore-throat',
    title: 'Mild sore throat',
    bodySystem: 'breathing',
    summary: 'A scratchy or painful throat that hurts when swallowing — most often viral and clears within a week.',
    steps: [
      'Gargle with warm salt water (1/2 teaspoon salt in a glass of warm water) several times a day.',
      'Sip warm fluids — water, broth, tea with honey for adults and children over 1 year.',
      'Suck on a throat lozenge or a piece of hard candy (not for young children).',
      'Rest your voice. Avoid shouting or whispering for long periods.',
      'An adult dose of paracetamol or ibuprofen can ease pain.',
    ],
    avoid: [
      'Avoid smoke, alcohol, and very dry indoor air.',
      'Do not share cups or utensils with others.',
    ],
    whenToEscalate: [
      'Drooling, severe pain on one side, or inability to swallow saliva.',
      'White patches on the tonsils with high fever — may need antibiotics.',
      'Throat pain lasting more than 7 days, or returning often.',
      'Trouble breathing, swelling of the neck or tongue — emergency.',
    ],
    specialty: 'General physician.',
    references: ['NHS — sore throat'],
  },

  {
    id: 'back-pain-acute',
    title: 'Sudden lower back pain (muscle strain)',
    bodySystem: 'pain',
    summary: 'Most acute lower back pain is a muscle or ligament strain and improves within 2 weeks with gentle movement.',
    steps: [
      'Keep gently moving — short, slow walks help. Avoid total bed rest beyond 1–2 days.',
      'Apply a warm compress or take a warm shower to relax tight muscles.',
      'Lie on your back with a pillow under your knees, or on your side with a pillow between your knees, when resting.',
      'An adult dose of ibuprofen or paracetamol can reduce pain.',
      'Once pain eases, begin gentle stretches and core exercises.',
    ],
    avoid: [
      'Do not lift heavy objects or twist suddenly.',
      'Do not lie flat on your back without support under the knees.',
      'Do not use heat on the very first day if there is swelling or bruising — use cold instead.',
    ],
    whenToEscalate: [
      'Numbness, tingling, or weakness in one or both legs.',
      'Loss of control of the bladder or bowels — emergency.',
      'Severe pain after a fall or strong impact.',
      'Pain with fever, unexplained weight loss, or pain that wakes you at night.',
      'No improvement after 2 weeks of self-care.',
    ],
    specialty: 'General physician or physiotherapist; emergency department for any escalation sign.',
    references: ['NHS — back pain'],
  },

  {
    id: 'abdominal-pain-mild',
    title: 'Mild stomach pain or cramps',
    bodySystem: 'pain',
    summary: 'Generalised, crampy stomach pain that comes and goes — often related to gas, indigestion, or a mild stomach bug.',
    steps: [
      'Sit or lie down comfortably and rest the abdomen.',
      'Sip small amounts of plain water or weak warm tea.',
      'Apply a warm cloth or hot water bottle (wrapped in a towel) to the belly.',
      'Try a simple bland diet for the next 24 hours — rice, banana, toast, plain yoghurt.',
      'Pass wind or have a bowel movement if you can — both often relieve gas pain.',
    ],
    avoid: [
      'Avoid spicy, fatty, very rich, or fried food until pain settles.',
      'Avoid alcohol, caffeine, and large meals.',
      'Do not take strong painkillers like ibuprofen on an empty, irritated stomach.',
    ],
    whenToEscalate: [
      'Severe, constant pain in one specific area (especially the lower right side).',
      'Pain with vomiting blood, black stools, or fainting.',
      'Pain with high fever, a rigid hard belly, or pain on releasing pressure.',
      'In pregnancy — any new significant abdominal pain.',
      'Pain that wakes you from sleep or lasts more than 24 hours without easing.',
    ],
    specialty: 'General physician; emergency department for any escalation sign.',
    references: ['NHS — stomach ache'],
  },

  {
    id: 'toothache',
    title: 'Toothache',
    bodySystem: 'pain',
    summary: 'A dental ache usually points to decay, an abscess, or gum irritation. Self-care eases pain until you can reach a dentist.',
    steps: [
      'Rinse the mouth with warm salt water (1/2 teaspoon salt in a glass of warm water).',
      'Use dental floss gently to remove any trapped food between teeth.',
      'Apply a cold compress to the cheek over the painful area for 15 minutes at a time.',
      'An adult dose of paracetamol or ibuprofen can ease pain. Avoid placing tablets directly on the gum.',
      'Eat soft, room-temperature foods. Avoid very hot, very cold, or sugary food.',
    ],
    avoid: [
      'Do not place aspirin against the gum — it burns the tissue.',
      'Do not chew on the painful side.',
      'Avoid clove-oil "cures" applied undiluted directly to the gum.',
    ],
    whenToEscalate: [
      'Swelling of the face, jaw, or neck.',
      'Difficulty opening the mouth, swallowing, or breathing — emergency.',
      'Fever along with toothache.',
      'Pain lasting more than 2 days.',
    ],
    specialty: 'Dentist; emergency department for facial swelling or breathing trouble.',
    references: ['NHS — toothache'],
  },

  {
    id: 'earache',
    title: 'Earache',
    bodySystem: 'pain',
    summary: 'Ear pain in adults is often due to a cold, jaw tension, or wax. In children, ear infections are common after a cold.',
    steps: [
      'Apply a warm cloth or warm water bottle (wrapped) to the outside of the ear for 15 minutes.',
      'Sit upright — lying flat can worsen pressure pain.',
      'A simple adult dose of paracetamol or ibuprofen can ease pain.',
      'For young children, follow the dose on the children\'s paracetamol or ibuprofen label by age and weight.',
      'Keep the ear dry — do not get water in it while bathing.',
    ],
    avoid: [
      'Do not put cotton buds, oil, or anything else inside the ear canal.',
      'Do not fly or scuba dive with an unresolved earache.',
    ],
    whenToEscalate: [
      'Discharge of pus or blood from the ear.',
      'Severe pain, swelling behind the ear, or a high fever.',
      'Hearing loss that does not return after a few days.',
      'Earache in a child under 2, or any child who is unusually drowsy or unwell.',
    ],
    specialty: 'General physician or ENT specialist.',
    references: ['NHS — earache'],
  },

  {
    id: 'fever-child',
    title: 'Fever in a child',
    bodySystem: 'fever',
    summary: 'Most childhood fevers come from common viral infections and pass in a few days. Comfort and hydration matter more than the exact temperature.',
    steps: [
      'Offer small, frequent sips of water, milk (for nursing infants), or oral rehydration solution.',
      'Dress in light clothing — one extra layer than what a comfortable adult would wear in the same room.',
      'Keep the room cool but not cold. A fan on low can help.',
      'A weight-based dose of children\'s paracetamol or ibuprofen (over 3 months) can be given if the child is uncomfortable.',
      'Check on the child overnight and write down temperatures and times.',
    ],
    avoid: [
      'Never give aspirin to anyone under 18.',
      'Do not sponge with cold water or alcohol — both can cause shivering and shock.',
      'Do not bundle a feverish child in thick blankets.',
      'Do not combine multiple paracetamol-containing products.',
    ],
    whenToEscalate: [
      'Any infant under 3 months with a temperature of 38°C / 100.4°F or higher.',
      'A child of any age with a stiff neck, severe headache, a rash that does not fade under glass pressure, or persistent vomiting.',
      'A child who is very drowsy, unusually still, or hard to wake.',
      'A fever lasting more than 3 days or repeatedly returning.',
      'A child with difficulty breathing, dehydration signs, or a seizure.',
    ],
    specialty: 'Paediatrician or emergency department for any escalation sign.',
    references: ['NHS — fever in children', 'WHO — paediatric fever'],
  },

  {
    id: 'tick-bite',
    title: 'Tick bite',
    bodySystem: 'bites',
    summary: 'Most tick bites are harmless, but some carry infections. Removing the tick quickly and completely is the most important step.',
    steps: [
      'Use fine-tipped tweezers and grip the tick as close to the skin as possible.',
      'Pull steadily and straight upward without twisting or jerking.',
      'After removal, clean the area with soap and water or an antiseptic.',
      'Wash your hands.',
      'Write down the date and where on the body the bite was — useful if symptoms appear later.',
    ],
    avoid: [
      'Do not burn the tick, smother it in petroleum jelly, or squeeze its body.',
      'Do not panic if the mouthparts stay behind — they can be left to work out on their own like a splinter.',
    ],
    whenToEscalate: [
      'A circular, expanding red rash around the bite over the next 3–30 days.',
      'Flu-like symptoms: fever, chills, headache, joint or muscle aches in the weeks after the bite.',
      'The tick was attached for longer than 24 hours.',
      'You live in or travelled to an area known for tick-borne disease.',
    ],
    specialty: 'General physician — mention the tick bite so they can consider testing or antibiotics.',
    references: ['NHS — tick bites', 'CDC — tickborne diseases'],
  },

  {
    id: 'food-poisoning',
    title: 'Suspected food poisoning',
    bodySystem: 'poisoning',
    summary: 'Sudden vomiting, diarrhoea, or cramps within hours of eating suspicious food. Usually settles in 1–2 days with rest and fluids.',
    steps: [
      'Rest and stay near a bathroom for the first day.',
      'Sip small amounts of water or oral rehydration solution every 10–15 minutes.',
      'Once vomiting eases, return to bland foods slowly: dry toast, rice, banana, plain crackers.',
      'Wash your hands thoroughly after each bathroom visit to avoid spreading the bug.',
      'If others ate the same food, warn them.',
    ],
    avoid: [
      'Avoid dairy, fatty food, caffeine, and alcohol for at least 48 hours.',
      'Do not take anti-diarrhoea medicine for bloody diarrhoea or high fever — the body is trying to clear the infection.',
      'Do not prepare food for others until 48 hours symptom-free.',
    ],
    whenToEscalate: [
      'Blood in vomit or stool.',
      'Signs of dehydration: very dark urine, dizziness, dry mouth, sunken eyes, no urination for 8+ hours.',
      'High fever, severe abdominal pain, or symptoms lasting more than 3 days.',
      'Food poisoning in pregnancy, infancy, old age, or with chronic illness — call a doctor early.',
    ],
    specialty: 'General physician; emergency department for any escalation sign.',
    references: ['NHS — food poisoning'],
  },

  {
    id: 'dehydration',
    title: 'Mild dehydration',
    bodySystem: 'other',
    summary: 'Thirst, dry mouth, headache, dark urine, and tiredness after illness, heat, or low fluid intake. Catching it early is straightforward.',
    steps: [
      'Move to a cool, shaded place if you have been in the heat.',
      'Sip oral rehydration solution (or 1 litre water + 6 teaspoons sugar + 1/2 teaspoon salt) slowly over the next hour.',
      'For a small child, offer a teaspoon every 1–2 minutes if they will not drink larger amounts.',
      'Remove extra layers and loosen tight clothing.',
      'Rest for an hour and watch for improvement — urine should become pale yellow.',
    ],
    avoid: [
      'Avoid sugary fizzy drinks alone — they can worsen diarrhoea.',
      'Avoid alcohol and caffeine.',
      'Do not gulp large amounts at once if nauseous — small sips are better.',
    ],
    whenToEscalate: [
      'Confusion, fainting, very fast heartbeat, or seizures.',
      'Sunken eyes, very dry mouth, no tears, or no urine for 8+ hours.',
      'Dehydration in an infant, elderly person, or pregnant person.',
      'No improvement after an hour of careful rehydration.',
    ],
    specialty: 'General physician; emergency department for any escalation sign.',
    references: ['WHO — oral rehydration'],
  },

  {
    id: 'fainting-recovered',
    title: 'Brief fainting (person now recovered)',
    bodySystem: 'other',
    summary: 'A short loss of consciousness lasting under a minute, often caused by low blood pressure, heat, hunger, or pain. The person should still be checked.',
    steps: [
      'Help them lie down and raise their legs about 30 cm above heart level for a few minutes.',
      'Loosen any tight clothing around the neck and waist.',
      'Make sure they are breathing normally and the airway is clear.',
      'Once they feel better, give them small sips of water and a light snack if they are hungry.',
      'They should rest and avoid driving for the next 24 hours.',
    ],
    avoid: [
      'Do not give them anything to eat or drink until they are fully alert and able to swallow.',
      'Do not let them stand up suddenly.',
      'Do not ignore the episode just because they have recovered.',
    ],
    whenToEscalate: [
      'Always seek medical advice after a first faint, especially if over 40, pregnant, or with heart conditions.',
      'Fainting while exercising, lying down, or that came on suddenly without warning — emergency.',
      'Faint with chest pain, shortness of breath, palpitations, or convulsions — emergency.',
      'Repeat fainting episodes.',
    ],
    specialty: 'General physician; emergency department for any escalation sign.',
    references: ['NHS — fainting'],
  },

  {
    id: 'mild-allergic-skin',
    title: 'Mild allergic skin reaction (hives, itchy rash)',
    bodySystem: 'other',
    summary: 'Raised, itchy bumps or red blotches that come on within minutes to hours of contact with a trigger.',
    steps: [
      'Move away from any obvious trigger (new food, plant, soap, fabric, medication).',
      'Wash the skin with cool water and mild soap if a contact substance is suspected.',
      'Apply a cool, damp cloth to the rash for 10 minutes to ease itching.',
      'An over-the-counter oral antihistamine, at the labelled dose, can reduce itching and hives.',
      'Wear loose cotton clothing and keep the area cool and dry.',
    ],
    avoid: [
      'Do not scratch — broken skin can become infected.',
      'Do not apply heat or hot water to itchy skin.',
      'Avoid the suspected trigger until you can identify it safely.',
    ],
    whenToEscalate: [
      'Swelling of the face, lips, tongue, or trouble breathing — this is anaphylaxis, an emergency.',
      'Hives covering most of the body, dizziness, or fainting.',
      'Rash with fever, joint pain, or that bruises or blisters.',
      'Rash lasting more than 6 weeks.',
    ],
    specialty: 'General physician or allergist; emergency department for any escalation sign.',
    references: ['NHS — hives', 'NHS — allergies'],
  },

  {
    id: 'panic-attack',
    title: 'Panic attack',
    bodySystem: 'other',
    summary: 'A sudden surge of intense fear with pounding heart, fast breathing, tingling, sweating, and a sense of unreality. Frightening but not dangerous.',
    steps: [
      'Find a safe place to sit. Acknowledge what is happening: "this is a panic attack and it will pass."',
      'Slow the breath: inhale through the nose for 4 seconds, hold for 2, exhale through the mouth for 6 seconds. Repeat for 2–3 minutes.',
      'Ground yourself: name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste.',
      'Sip cool water slowly.',
      'Once the wave passes, rest and eat something simple. Tell someone you trust.',
    ],
    avoid: [
      'Do not fight or run — panic peaks within 10 minutes and naturally fades.',
      'Avoid breathing into a paper bag — this is no longer recommended.',
      'Avoid caffeine, alcohol, and nicotine after an attack — they raise the risk of another.',
    ],
    whenToEscalate: [
      'If chest pain spreads to the arm or jaw, or breathing does not return to normal within 20 minutes — treat as a possible heart attack and seek emergency care.',
      'Recurring panic attacks that disrupt daily life — speak to a doctor about treatment options.',
      'Thoughts of self-harm during or after an attack — reach a crisis line or emergency services.',
    ],
    specialty: 'General physician or mental health professional.',
    references: ['NHS — panic disorder', 'WHO — mental health first aid'],
  },
];

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

