import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProfiles, formatBytes, formatDocument, health, localCheck } from "./api";
import type { FormatOutcome, Profile, Report } from "./types";

type Server = "checking" | "waking" | "ready" | "down";

function useServer() {
  const [state, setState] = useState<Server>("checking");
  const [maxMb, setMaxMb] = useState(10);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const run = useRef(0);

  const connect = useCallback(async () => {
    const id = ++run.current;
    setState("checking");
    const started = Date.now();
    while (id === run.current && Date.now() - started < 120_000) {
      try {
        const h = await health();
        if (id !== run.current) return;
        setMaxMb(h.max_upload_mb);
        setProfiles(await fetchProfiles());
        setState("ready");
        return;
      } catch {
        if (id !== run.current) return;
        setState("waking"); // free hosting sleeps when idle; keep trying
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
    if (id === run.current) setState("down");
  }, []);

  useEffect(() => { connect(); return () => { run.current++; }; }, [connect]);
  return { state, maxMb, profiles, retry: connect };
}

const STATUS_TEXT: Record<Server, string> = {
  checking: "Connecting to the formatting server…",
  waking: "The formatting server is waking up. This can take up to a minute.",
  ready: "Formatting server ready",
  down: "The formatting server is not responding.",
};

export default function App() {
  const { state, maxMb, profiles, retry } = useServer();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<FormatOutcome | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const profile = profiles[0];

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  function choose(f: File | null) {
    setOutcome(null);
    setUrl(null);
    setFile(f);
    setFileError(f ? localCheck(f, maxMb) : null);
  }

  async function run() {
    if (!file || fileError || !profile) return;
    setBusy(true);
    setOutcome(null);
    setUrl(null);
    const result = await formatDocument(file, profile.id);
    setOutcome(result);
    if (result.ok) setUrl(URL.createObjectURL(result.blob));
    setBusy(false);
    setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const canRun = !!file && !fileError && state === "ready" && !busy;
  const validation = !file ? "No file selected" : fileError ? "Not accepted" : "Looks like a .docx, ready to format";

  return (
    <>
      <header className="top">
        <a className="mark" href="/">PaperAlign</a>
        <p className={"server " + state} role="status" aria-live="polite">
          <span className="dot" aria-hidden="true" />{STATUS_TEXT[state]}
          {state === "down" && <button className="link" onClick={retry}>Try again</button>}
        </p>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1>Format your Word paper without retyping a word.</h1>
            <p className="lede">PaperAlign applies a clean academic layout to a copy of your .docx, then reopens the result and checks that your text, tables, images and links are all still there. You download an ordinary, editable Word file.</p>
            <p className="note">The layout is a general-purpose one, not an official journal or conference standard.</p>
          </div>

          <div className="card" id="format">
            <h2>Upload your paper</h2>
            <div
              className={"drop" + (drag ? " over" : "") + (file ? " has-file" : "")}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) choose(f); }}
            >
              <p className="drop-title">{file ? file.name : "Drag a .docx file here"}</p>
              <p className="drop-sub">{file ? formatBytes(file.size) : `Up to ${maxMb} MB. Word Documents (.docx) only.`}</p>
              <input ref={input} id="file" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
              <button type="button" className="btn ghost" onClick={() => input.current?.click()}>{file ? "Choose a different file" : "Browse files"}</button>
            </div>
            <p className={"validation" + (fileError ? " bad" : file ? " good" : "")} role="status">{fileError ?? validation}</p>

            <dl className="profile-line">
              <dt>Layout</dt>
              <dd>{profile ? `${profile.label} (v${profile.version})` : "Loads when the server is ready"}</dd>
            </dl>

            <button className="btn primary" disabled={!canRun} onClick={run}>{busy ? "Formatting and checking…" : "Format my paper"}</button>
            {busy && <p className="working" role="status">Your file is being formatted and verified on the server. Larger papers can take a few seconds.</p>}
          </div>
        </section>

        <section id="result" aria-live="polite">
          {outcome && !outcome.ok && (
            <div className="card error" role="alert">
              <h2>Your paper was not formatted</h2>
              <p>{outcome.message}</p>
              <p className="muted">No file is offered for download when processing or verification fails.</p>
              {outcome.report && <ReportView report={outcome.report} />}
            </div>
          )}
          {outcome && outcome.ok && url && (
            <div className="card success">
              <h2>Formatted and verified</h2>
              <p>Every check below was run on the generated file. The summary lists what was changed and what was left alone.</p>
              <a className="btn primary" href={url} download={outcome.filename}>Download {outcome.filename}</a>
              <ReportView report={outcome.report} />
            </div>
          )}
        </section>

        {profile && <ProfileSheet profile={profile} />}

        <section className="how">
          <h2>How it works</h2>
          <ol>
            <li><strong>Upload.</strong> Your file is checked for being a real, unprotected .docx.</li>
            <li><strong>Format.</strong> The profile is applied to a copy. Wording, order, citations and tables stay as they are.</li>
            <li><strong>Verify.</strong> The copy is reopened. We compare text and structure with your original and read the formatting back.</li>
            <li><strong>Report.</strong> You see what was applied, what passed, and anything we could not safely handle.</li>
            <li><strong>Download.</strong> The button only appears when verification succeeds.</li>
          </ol>
        </section>

        <section className="limits">
          <h2>What to know</h2>
          <ul>
            <li>Only styled paragraphs are changed. Plain paragraphs are never turned into headings by guesswork.</li>
            <li>Tables, lists, captions, headers, footers, footnotes, text boxes and equations are kept but not reformatted.</li>
            <li>Changing to A4 can leave a wide table or image beyond the margin. Check those after opening the file.</li>
            <li>Files are deleted when processing finishes, are not used to train anything and are not sent to AI services. There are no accounts.</li>
          </ul>
        </section>
      </main>
      <footer><p>PaperAlign is an early version. Always review the formatted file in Word before you submit it.</p></footer>
    </>
  );
}

function ProfileSheet({ profile }: { profile: Profile }) {
  const b = profile.body;
  const rows: [string, string][] = [
    ["Page", `${profile.page.size}, ${profile.page.margin_in} in margins on all sides`],
    ["Body text", `${b.font}, ${b.size_pt} pt, ${b.line_spacing} line spacing, ${b.space_after_pt} pt after each paragraph`],
    ...Object.entries(profile.headings).map(([k, h]): [string, string] => [k + " style", `${b.font}, ${h.size_pt} pt${h.bold ? ", bold" : ""}`]),
  ];
  return (
    <section className="sheet">
      <h2>{profile.label}</h2>
      <p className="muted">{profile.disclaimer}</p>
      <dl>{rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl>
    </section>
  );
}

function ReportView({ report }: { report: Report }) {
  const warns = report.issues.filter((i) => i.severity !== "error");
  return (
    <div className="report">
      <p className="tally"><strong>{report.summary.checks_passed}</strong> checks passed, <strong>{report.summary.checks_failed}</strong> failed, <strong>{report.issues.length}</strong> to review.</p>
      <h3>Settings applied</h3>
      <ul className="plain">{report.applied.map((a) => (<li key={a.label}><strong>{a.label}.</strong> {a.detail}</li>))}</ul>
      <h3>Checks on the generated file</h3>
      <ul className="checks">{report.checks.map((c) => (
        <li key={c.id} className={c.status}>
          <span className="badge">{c.status === "passed" ? "Passed" : "Failed"}</span>
          <span><span className="check-label">{c.label}</span>{c.detail && <span className="muted"> {c.detail}</span>}</span>
        </li>
      ))}</ul>
      {warns.length > 0 && (<><h3>To review in Word</h3><ul className="plain">{warns.map((w, i) => <li key={w.code + i}>{w.message}</li>)}</ul></>)}
      <h3>Left unchanged</h3>
      <ul className="plain">{report.not_modified.filter((n) => n.count > 0).map((n) => (<li key={n.label}>{n.label}: {n.count}</li>))}</ul>
      <p className="muted small">{report.profile.disclaimer} This report does not claim compliance with any journal's rules.</p>
    </div>
  );
}
