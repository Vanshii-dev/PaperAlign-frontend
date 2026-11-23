import type { FormatOutcome, Profile } from "./types";

const DEV_DEFAULT = import.meta.env.DEV ? "http://localhost:8000" : "";
export const API = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEV_DEFAULT).replace(/\/$/, "");

export function formatBytes(n: number): string {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

/** Quick checks before upload. The server repeats and enforces all of them. */
export function localCheck(file: { name: string; size: number }, maxMb: number): string | null {
  if (!file.name.toLowerCase().endsWith(".docx")) return "Only .docx files are supported. Save your paper as a Word Document (.docx) first.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > maxMb * 1024 * 1024) return `This file is ${formatBytes(file.size)}. The limit is ${maxMb} MB.`;
  return null;
}

export function b64ToBlob(b64: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

export async function health(timeoutMs = 8000): Promise<{ max_upload_mb: number }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${API}/api/health`, { signal: ctl.signal });
    if (!r.ok) throw new Error("health " + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchProfiles(): Promise<Profile[]> {
  const r = await fetch(`${API}/api/profiles`);
  if (!r.ok) throw new Error("profiles " + r.status);
  return (await r.json()).profiles;
}

export async function formatDocument(file: File, profileId: string, signal?: AbortSignal): Promise<FormatOutcome> {
  const form = new FormData();
  form.append("file", file);
  form.append("profile_id", profileId);
  let r: Response;
  try {
    r = await fetch(`${API}/api/format`, { method: "POST", body: form, signal });
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection and try again." };
  }
  let j: any = null;
  try { j = await r.json(); } catch { /* non-JSON error page */ }
  if (r.ok && j?.status === "success" && j.docx_base64) {
    return { ok: true, filename: j.filename, report: j.report, blob: b64ToBlob(j.docx_base64) };
  }
  return { ok: false, message: j?.message ?? `The server returned an error (${r.status}).`, report: j?.report };
}
