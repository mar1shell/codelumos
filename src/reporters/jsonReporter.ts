import type { AuditReport } from '../types.js';

/** Serialise the full report to JSON. Schema is stable across patch versions. */
export function renderJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}
