// Tend — Protocol loader.
// Eagerly loads every src/content/protocols/*.json at build time,
// validates each against the schema, and asserts unique IDs.
// A validation failure throws at module-load time so it surfaces
// immediately in dev and fails the production build.

import type { Protocol } from '../../engine/triageEngine';
import { validateProtocol, type ProtocolJSON } from './schema';

const modules = import.meta.glob<{ default: unknown }>('./*.json', { eager: true });

function loadAll(): Protocol[] {
  const seen = new Map<string, string>();
  const out: Protocol[] = [];

  for (const [path, mod] of Object.entries(modules)) {
    const filename = path.replace(/^\.\//, '');
    const parsed: ProtocolJSON = validateProtocol(filename, mod.default);

    if (seen.has(parsed.id)) {
      throw new Error(
        `[protocol] duplicate id "${parsed.id}" in ${filename} (already used by ${seen.get(parsed.id)})`,
      );
    }
    seen.set(parsed.id, filename);

    out.push({
      id: parsed.id,
      title: parsed.title,
      bodySystem: parsed.bodySystem,
      summary: parsed.summary,
      steps: parsed.steps,
      avoid: parsed.avoid,
      whenToEscalate: parsed.whenToEscalate,
      specialty: parsed.specialty,
      sources: parsed.sources,
      reviewedBy: parsed.reviewedBy,
      reviewedOn: parsed.reviewedOn,
    });
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export const PROTOCOLS: Protocol[] = loadAll();
