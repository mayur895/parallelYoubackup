// Tend — Gap report.
// Pure functions that summarise the state of the protocol library.
// Used by the /review page to surface coverage holes, citation gaps,
// and reviewer-signoff progress.

import type { Protocol, BodySystem } from '../engine/triageEngine';
import { BODY_SYSTEMS } from '../engine/triageEngine';

export interface BodySystemCount {
  id: BodySystem;
  label: string;
  count: number;
}

export interface ReviewStatusCount {
  unreviewed: number;
  reviewed: number;
}

export interface SourceCount {
  total: number;
  withUrl: number;
  withoutUrl: number;
}

export interface GapReport {
  protocolCount: number;
  bySystem: BodySystemCount[];
  thinSystems: BodySystemCount[]; // systems with fewer than THIN_THRESHOLD
  reviewStatus: ReviewStatusCount;
  sources: SourceCount;
  protocolsMissingUrls: { id: string; title: string; missingCount: number }[];
}

const THIN_THRESHOLD = 3;

export function buildGapReport(protocols: Protocol[]): GapReport {
  const bySystem: BodySystemCount[] = BODY_SYSTEMS.map((sys) => ({
    id: sys.id,
    label: sys.label,
    count: protocols.filter((p) => p.bodySystem === sys.id).length,
  }));

  const thinSystems = bySystem.filter((b) => b.count < THIN_THRESHOLD);

  let unreviewed = 0;
  let reviewed = 0;
  let totalSources = 0;
  let sourcesWithUrl = 0;
  const protocolsMissingUrls: GapReport['protocolsMissingUrls'] = [];

  for (const p of protocols) {
    const isReviewed = p.reviewedBy != null && p.reviewedBy.trim() !== '';
    if (isReviewed) reviewed++;
    else unreviewed++;

    const missingInThis = p.sources.filter((s) => !s.url || s.url.trim() === '').length;
    if (missingInThis > 0) {
      protocolsMissingUrls.push({
        id: p.id,
        title: p.title,
        missingCount: missingInThis,
      });
    }
    totalSources += p.sources.length;
    sourcesWithUrl += p.sources.filter((s) => s.url && s.url.trim() !== '').length;
  }

  return {
    protocolCount: protocols.length,
    bySystem,
    thinSystems,
    reviewStatus: { unreviewed, reviewed },
    sources: {
      total: totalSources,
      withUrl: sourcesWithUrl,
      withoutUrl: totalSources - sourcesWithUrl,
    },
    protocolsMissingUrls,
  };
}
