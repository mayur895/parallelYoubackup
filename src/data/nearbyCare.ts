// ============================================================================
// Tend — Pre-bundled care directory
//
// Ships with the app so it works offline. The current build focuses on
// Ladakh (UT, India) as a showcase region for high-altitude remote use.
// Add more regions here as needed — the Plan screen filters by region +
// body system relevance.
//
// Note: facility names below are public-knowledge institutions. Phone
// numbers are official emergency / public-information numbers where
// possible; do not invent individual doctor names.
// ============================================================================

import type { BodySystem } from '../engine/triageEngine';

export type FacilityType =
  | 'district-hospital'
  | 'sub-district-hospital'
  | 'community-health-center'
  | 'primary-health-center'
  | 'ambulance'
  | 'helpline';

export interface CareFacility {
  id: string;
  name: string;
  type: FacilityType;
  region: string;          // 'Ladakh'
  district: string;        // 'Leh' | 'Kargil'
  town: string;            // 'Leh', 'Diskit', etc.
  services: BodySystem[] | 'all';
  phone: string;
  /** Short human-readable location hint, e.g. "Town center", "Nubra Valley" */
  distanceHint: string;
  notes?: string;
}

export const LADAKH_CARE: CareFacility[] = [
  {
    id: 'ambulance-108',
    name: 'National Ambulance — 108',
    type: 'ambulance',
    region: 'Ladakh',
    district: 'All',
    town: 'Anywhere',
    services: 'all',
    phone: '108',
    distanceHint: 'Available across Ladakh',
    notes: 'Free 24/7 emergency ambulance. Connects to the nearest facility.',
  },
  {
    id: 'snm-leh',
    name: 'Sonam Norboo Memorial (SNM) Hospital',
    type: 'district-hospital',
    region: 'Ladakh',
    district: 'Leh',
    town: 'Leh',
    services: 'all',
    phone: '01982-252012',
    distanceHint: 'Leh town centre',
    notes: 'Largest hospital in Ladakh. 24×7 emergency, surgery, OB-GYN, paediatrics.',
  },
  {
    id: 'dh-kargil',
    name: 'District Hospital, Kargil',
    type: 'district-hospital',
    region: 'Ladakh',
    district: 'Kargil',
    town: 'Kargil',
    services: 'all',
    phone: '01985-232212',
    distanceHint: 'Kargil town',
    notes: 'Main district hospital serving Kargil and surrounding villages.',
  },
  {
    id: 'chc-diskit',
    name: 'Community Health Centre, Diskit',
    type: 'community-health-center',
    region: 'Ladakh',
    district: 'Leh',
    town: 'Diskit',
    services: ['bleeding', 'burns', 'pain', 'fever', 'bites', 'other'],
    phone: '108',
    distanceHint: 'Nubra Valley',
    notes: 'Primary care for Nubra. Refers serious cases to SNM Leh.',
  },
  {
    id: 'chc-khaltsi',
    name: 'Community Health Centre, Khaltsi',
    type: 'community-health-center',
    region: 'Ladakh',
    district: 'Leh',
    town: 'Khaltsi',
    services: ['bleeding', 'burns', 'pain', 'fever', 'bites', 'other'],
    phone: '108',
    distanceHint: 'Sham Valley, on Srinagar–Leh highway',
  },
  {
    id: 'chc-nyoma',
    name: 'Community Health Centre, Nyoma',
    type: 'community-health-center',
    region: 'Ladakh',
    district: 'Leh',
    town: 'Nyoma',
    services: ['bleeding', 'burns', 'pain', 'fever', 'other'],
    phone: '108',
    distanceHint: 'Changthang region (Pangong / Hanle area)',
    notes: 'Closest facility for the eastern high-altitude plateau.',
  },
  {
    id: 'phc-tangtse',
    name: 'Primary Health Centre, Tangtse',
    type: 'primary-health-center',
    region: 'Ladakh',
    district: 'Leh',
    town: 'Tangtse',
    services: ['bleeding', 'burns', 'pain', 'fever', 'other'],
    phone: '108',
    distanceHint: 'On the route to Pangong Tso',
  },
  {
    id: 'phc-drass',
    name: 'Primary Health Centre, Drass',
    type: 'primary-health-center',
    region: 'Ladakh',
    district: 'Kargil',
    town: 'Drass',
    services: ['bleeding', 'burns', 'pain', 'fever', 'breathing', 'other'],
    phone: '108',
    distanceHint: 'On Srinagar–Leh highway, before Zoji La',
    notes: 'Often the first facility for travellers entering Ladakh from Srinagar.',
  },
  {
    id: 'phc-sumur',
    name: 'Primary Health Centre, Sumur',
    type: 'primary-health-center',
    region: 'Ladakh',
    district: 'Leh',
    town: 'Sumur',
    services: ['bleeding', 'burns', 'pain', 'fever', 'other'],
    phone: '108',
    distanceHint: 'Nubra Valley, north of Diskit',
  },
  {
    id: 'mountaineering-helpline',
    name: 'AMS / Altitude Sickness Helpline (J&K UT)',
    type: 'helpline',
    region: 'Ladakh',
    district: 'All',
    town: 'Anywhere',
    services: ['breathing', 'pain', 'other'],
    phone: '104',
    distanceHint: 'Phone-based triage',
    notes: 'For altitude-related illness advice. Free public health helpline.',
  },
];

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

export function facilitiesForSystem(
  facilities: CareFacility[],
  system: BodySystem,
): CareFacility[] {
  return facilities.filter((f) => f.services === 'all' || f.services.includes(system));
}

export function rankFacilities(facilities: CareFacility[]): CareFacility[] {
  // Show the most capable / always-available options first.
  const order: FacilityType[] = [
    'ambulance',
    'district-hospital',
    'sub-district-hospital',
    'community-health-center',
    'primary-health-center',
    'helpline',
  ];
  return [...facilities].sort(
    (a, b) => order.indexOf(a.type) - order.indexOf(b.type),
  );
}

export function facilityTypeLabel(type: FacilityType): string {
  switch (type) {
    case 'district-hospital':      return 'District hospital';
    case 'sub-district-hospital':  return 'Sub-district hospital';
    case 'community-health-center': return 'Community Health Centre';
    case 'primary-health-center':  return 'Primary Health Centre';
    case 'ambulance':              return 'Ambulance';
    case 'helpline':               return 'Helpline';
  }
}
