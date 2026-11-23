export interface Profile {
  id: string; version: number; label: string; disclaimer: string;
  page: { size: string; margin_in: number };
  body: { font: string; size_pt: number; line_spacing: number; space_after_pt: number };
  headings: Record<string, { size_pt: number; bold: boolean }>;
}
export interface Check { id: string; label: string; status: "passed" | "failed"; detail: string }
export interface Report {
  status: string;
  profile: { id: string; label: string; version: number; disclaimer: string };
  summary: { checks_passed: number; checks_failed: number; warnings: number };
  applied: { label: string; detail: string }[];
  checks: Check[];
  issues: { severity: string; code: string; message: string }[];
  not_modified: { label: string; count: number }[];
}
export type FormatOutcome =
  | { ok: true; filename: string; report: Report; blob: Blob }
  | { ok: false; message: string; report?: Report };
