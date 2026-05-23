// Tend — Protocol JSON schema + hand-rolled validator.
// No external dependency: keeps the bundle small and the validation
// auditable in our own repo (important for the safety review trail).

import type { BodySystem } from '../../engine/triageEngine';

export interface SourceRef {
  title: string;
  url?: string;
  accessedOn?: string;
}

export interface ProtocolJSON {
  id: string;
  title: string;
  bodySystem: BodySystem;
  summary: string;
  steps: string[];
  avoid: string[];
  whenToEscalate: string[];
  specialty: string;
  sources: SourceRef[];
  reviewedBy: string | null;
  reviewedOn: string | null;
  schemaVersion: number;
}

const BODY_SYSTEMS: ReadonlySet<BodySystem> = new Set([
  'bleeding', 'burns', 'breathing', 'pain', 'fever', 'bites', 'poisoning', 'other',
]);

const CURRENT_SCHEMA_VERSION = 1;

export class ProtocolValidationError extends Error {
  constructor(filename: string, field: string, detail: string) {
    super(`[protocol:${filename}] ${field}: ${detail}`);
    this.name = 'ProtocolValidationError';
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isNonEmptyStringArray(v: unknown): v is string[] {
  return isStringArray(v) && v.length > 0;
}

function isSourceRef(v: unknown): v is SourceRef {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (!isNonEmptyString(o.title)) return false;
  if (o.url !== undefined && typeof o.url !== 'string') return false;
  if (o.accessedOn !== undefined && typeof o.accessedOn !== 'string') return false;
  return true;
}

export function validateProtocol(filename: string, raw: unknown): ProtocolJSON {
  if (typeof raw !== 'object' || raw === null) {
    throw new ProtocolValidationError(filename, '<root>', 'must be an object');
  }
  const o = raw as Record<string, unknown>;

  if (!isNonEmptyString(o.id)) throw new ProtocolValidationError(filename, 'id', 'must be a non-empty string');
  if (!isNonEmptyString(o.title)) throw new ProtocolValidationError(filename, 'title', 'must be a non-empty string');
  if (typeof o.bodySystem !== 'string' || !BODY_SYSTEMS.has(o.bodySystem as BodySystem)) {
    throw new ProtocolValidationError(filename, 'bodySystem', `must be one of ${[...BODY_SYSTEMS].join(', ')}`);
  }
  if (!isNonEmptyString(o.summary)) throw new ProtocolValidationError(filename, 'summary', 'must be a non-empty string');
  if (!isNonEmptyStringArray(o.steps)) throw new ProtocolValidationError(filename, 'steps', 'must be a non-empty string[]');
  if (!isStringArray(o.avoid)) throw new ProtocolValidationError(filename, 'avoid', 'must be a string[]');
  if (!isNonEmptyStringArray(o.whenToEscalate)) {
    throw new ProtocolValidationError(filename, 'whenToEscalate', 'must be a non-empty string[]');
  }
  if (!isNonEmptyString(o.specialty)) throw new ProtocolValidationError(filename, 'specialty', 'must be a non-empty string');
  if (!Array.isArray(o.sources) || !o.sources.every(isSourceRef)) {
    throw new ProtocolValidationError(filename, 'sources', 'must be Array<{title, url?, accessedOn?}>');
  }
  if (o.reviewedBy !== null && typeof o.reviewedBy !== 'string') {
    throw new ProtocolValidationError(filename, 'reviewedBy', 'must be string or null');
  }
  if (o.reviewedOn !== null && typeof o.reviewedOn !== 'string') {
    throw new ProtocolValidationError(filename, 'reviewedOn', 'must be string (ISO date) or null');
  }
  if (typeof o.schemaVersion !== 'number' || o.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new ProtocolValidationError(filename, 'schemaVersion', `must equal ${CURRENT_SCHEMA_VERSION}`);
  }

  return o as unknown as ProtocolJSON;
}
