"use client";

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { validateVerses, type WordForWord } from '@/lib/scriptures';
import type { ScriptureRowUi } from './ScripturesManager';

interface VerseRowUi {
  id: string;
  canto: number | null;
  chapter: number;
  verse: number;
  chapter_title: string | null;
  sanskrit: string;
  iast: string;
  translation: string;
  purport: string | null;
  word_for_word: WordForWord[] | null;
  puranic_story: Record<string, unknown> | null;
  image_prompt: string | null;
}

interface ScriptureVersesEditorProps {
  scripture: ScriptureRowUi;
  onBack: () => void;
}

const PAGE_SIZE = 50;

interface Report {
  ok: boolean;
  count: number;
  chapters: number;
  cantos: number;
  firstRef: string;
  lastRef: string;
  errors: string[];
}

const refOf = (verse: { canto: number | null; chapter: number; verse: number }) =>
  verse.canto ? `${verse.canto}.${verse.chapter}.${verse.verse}` : `${verse.chapter}.${verse.verse}`;

export default function ScriptureVersesEditor({ scripture, onBack }: ScriptureVersesEditorProps) {
  const { showToast } = useToast();

  const [verses, setVerses]     = useState<VerseRowUi[]>([]);
  const [total, setTotal]       = useState(scripture.verse_count);
  const [version, setVersion]   = useState(scripture.version);
  const [reviewedCorrection, setReviewedCorrection] = useState(false);
  const [offset, setOffset]     = useState(0);
  const [loading, setLoading]   = useState(true);

  const [json, setJson]         = useState('');
  const [mode, setMode]         = useState<'replace' | 'append'>('replace');
  const [report, setReport]     = useState<Report | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dependencyPreview,setDependencyPreview]=useState<{key:string;report:Record<string,unknown>}|null>(null);
  const [dependencyError,setDependencyError]=useState<unknown>(null);
  const previewKey=JSON.stringify([json,mode,version]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId]         = useState<string | null>(null);

  const load = useCallback(async (nextOffset: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/scripture-verses?scripture_id=${scripture.id}&limit=${PAGE_SIZE}&offset=${nextOffset}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVerses(data.items);
      setTotal(data.verse_count);
      setVersion(data.scripture.version);
      setOffset(nextOffset);
    } catch {
      showToast('Failed to load verses.', 'error');
    } finally {
      setLoading(false);
    }
  }, [scripture.id, showToast]);

  useEffect(() => { load(0); }, [load]);

  /** Runs the API's own validator in the browser and summarises what would be uploaded. */
  const runValidation = (text: string): Report | null => {
    if (!text.trim()) { setReport(null); return null; }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      const next: Report = {
        ok: false, count: 0, chapters: 0, cantos: 0, firstRef: '', lastRef: '',
        errors: [`Not valid JSON: ${error instanceof Error ? error.message : 'parse failed'}`],
      };
      setReport(next);
      return next;
    }

    const validated = validateVerses(parsed, { hasCantos: scripture.has_cantos === true });
    if (!validated.ok) {
      const next: Report = {
        ok: false, count: 0, chapters: 0, cantos: 0, firstRef: '', lastRef: '',
        errors: validated.errors,
      };
      setReport(next);
      return next;
    }

    const list = validated.value;
    const next: Report = {
      ok: true,
      count: list.length,
      chapters: new Set(list.map(v => `${v.canto ?? 0}.${v.chapter}`)).size,
      cantos: new Set(list.map(v => v.canto).filter(c => c !== null)).size,
      firstRef: refOf(list[0]),
      lastRef: refOf(list[list.length - 1]),
      errors: [],
    };
    setReport(next);
    return next;
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setJson(text);
    runValidation(text);
  };

  const handleUpload = async () => {
    const validation = report?.ok ? report : runValidation(json);
    if (!validation) { showToast('Paste the text as JSON first.', 'error'); return; }
    if (!validation.ok) { showToast(validation.errors[0], 'error'); return; }
    if(dependencyPreview?.key!==previewKey){showToast('Preview references and dependencies before importing.','error');return;}

    if (mode === 'replace' && total > 0 && !confirm(
      `Apply ${validation.count} incoming verse(s) to ${total} stored references? Matching IDs and daily selections are preserved. Absent references shown in the preview will be retained.`,
    )) return;

    setUploading(true);
    try {
      const res = await fetch('/api/admin/scripture-verses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scripture_id: scripture.id, mode, verses: JSON.parse(json), expected_version: version, removed_resolution: 'retain', reviewed_correction: reviewedCorrection }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (Array.isArray(data?.errors)) {
          setReport({ ok: false, count: 0, chapters: 0, cantos: 0, firstRef: '', lastRef: '', errors: data.errors });
        }
        throw new Error(data?.message ?? 'Upload failed.');
      }
      showToast(data.message ?? 'Verses uploaded.');
      setJson('');
      setReport(null);
      setDependencyPreview(null);
      await load(0);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const previewImport=async()=>{
    const validation=runValidation(json);if(!validation?.ok)return;
    setUploading(true);
    try{
      const res=await fetch('/api/admin/scripture-verses',{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('authToken')}`,'Content-Type':'application/json'},body:JSON.stringify({scripture_id:scripture.id,mode,verses:JSON.parse(json),expected_version:version,preview:true})});
      const data=await res.json();if(!res.ok)throw new Error(data.message);
      setDependencyPreview({key:previewKey,report:data});setDependencyError(null);
    }catch(error){showToast(String(error),'error');}finally{setUploading(false);}
  };

  const deleteVerse = async (verse: VerseRowUi) => {
    if (!confirm(`Delete verse ${refOf(verse)}?`)) return;
    setBusyId(verse.id);
    try {
      const res = await fetch(`/api/admin/scripture-verses?id=${verse.id}&confirm=${verse.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      const data=await res.json();
      if (!res.ok) {setDependencyError(data.details??data);throw new Error(data.message);}
      showToast('Verse deleted.');
      await load(offset);
    } catch(error) {
      showToast(error instanceof Error?error.message:'Failed to delete the verse.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const saveVerse = async (verse: VerseRowUi, patch: Partial<VerseRowUi>) => {
    setBusyId(verse.id);
    try {
      const res = await fetch('/api/admin/scripture-verses', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...verse, ...patch, expected_version: version, reviewed_correction: reviewedCorrection }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? 'Failed to save the verse.');
      setVerses(prev => prev.map(v => (v.id === verse.id ? { ...v, ...patch } : v)));
      if (data?.version) setVersion(data.version);
      showToast(`Verse ${refOf({ ...verse, ...patch })} saved.`);
      setExpandedId(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save the verse.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const declared = scripture.declared_verse_count;
  const mismatch = declared !== null && declared > 0 && declared !== total;

  return (
    <div>
      <div className="toolbar">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>← Catalogue</button>
          <span style={{ marginLeft: '12px', fontWeight: 600 }}>{scripture.title}</span>
          <span className="toolbar-count" style={{ marginLeft: '10px', fontFamily: 'monospace' }}>
            {scripture.id}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-wallpaper">{total} stored</span>
          {declared !== null && (
            <span className={`badge ${mismatch ? 'badge-darshan' : 'badge-sponsor'}`}>
              {declared} declared{mismatch ? '' : ' ✓'}
            </span>
          )}
          <span className="badge badge-event">v{version}</span>

        </div>
      </div>

      {mismatch && (
        <p style={{ fontSize: '0.84rem', color: 'var(--warning)', margin: '-8px 0 18px' }}>
          {total} of {declared} declared verses are stored
          {total < declared ? ' — the upload may be truncated.' : ' — more than declared.'}
        </p>
      )}

      {/* ── Upload ───────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="card-title">Upload text</h3>
        <label style={{display:'block',marginBottom:12}}><input type="checkbox" checked={reviewedCorrection} onChange={e=>setReviewedCorrection(e.target.checked)} /> I have reviewed this correction and its source. Required when changing published text.</label>
        <p>Matching references keep their IDs and daily selections. References absent from this file are retained. To remove a verse, review its dependencies and delete it individually.</p>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
          A JSON array of verses, or <code>{'{ "verses": [ … ] }'}</code>. Each verse takes{' '}
          <code>chapter</code>, <code>verse</code>
          {scripture.has_cantos ? <>, <code>canto</code></> : null}, <code>sanskrit</code>,{' '}
          <code>iast</code>, <code>translation</code>, and optionally <code>purport</code>,{' '}
          <code>chapter_title</code>, <code>word_for_word</code>, <code>puranic_story</code>,{' '}
          <code>image_prompt</code>. Public-domain texts only.
        </p>

        <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {([['replace', 'Replace the whole text'], ['append', 'Append to what is stored']] as const).map(
            ([value, label]) => (
              <label key={value} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.87rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="upload-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                {label}
              </label>
            ),
          )}
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            📄 Choose a .json file
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={e => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>
          A request body is capped near 4.5 MB — upload a large text canto by canto with{' '}
          <strong>append</strong>.
        </p>

        <textarea
          className="form-textarea"
          value={json}
          onChange={e => { setJson(e.target.value); setReport(null); }}
          onBlur={e => runValidation(e.target.value)}
          placeholder='[{ "chapter": 1, "verse": 1, "sanskrit": "…", "iast": "…", "translation": "…" }]'
          rows={8}
          style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
          spellCheck={false}
        />

        {report && (
          <div
            className="card"
            style={{
              marginTop: '14px',
              borderColor: report.ok ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)',
              background: report.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
            }}
          >
            {report.ok ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--success)', margin: 0 }}>
                {report.count} verse(s) across {report.chapters} chapter(s)
                {report.cantos > 0 ? ` and ${report.cantos} canto(s)` : ''} — {report.firstRef} to{' '}
                {report.lastRef}. Numbers are positive and unique.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: 'var(--danger)' }}>
                {report.errors.map((message, index) => <li key={index}>{message}</li>)}
              </ul>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => runValidation(json)}
            disabled={!json.trim()}
          >
            ✔ Validate
          </button>
          <button className="btn btn-secondary" type="button" disabled={uploading||!json.trim()} onClick={()=>void previewImport()}>Preview references and dependencies</button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleUpload}
            disabled={uploading || !json.trim() || report?.ok === false || dependencyPreview?.key!==previewKey}
          >
            {uploading ? <><span className="spinner" /> Uploading…</> : `⬆️ Upload (${mode})`}
          </button>
        </div>
        {dependencyPreview?.key===previewKey&&<><h4>Absent references and affected daily selections / quotes</h4><p>These references will be retained. Their editorial selections will remain linked.</p><pre className="editorial-json">{JSON.stringify(dependencyPreview.report,null,2)}</pre></>}
        {dependencyError!=null&&<pre className="editorial-json" role="alert">{JSON.stringify(dependencyError,null,2)}</pre>}
      </div>

      {/* ── Stored verses ────────────────────────────────── */}
      {loading ? (
        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : verses.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📜</div>
            <p className="empty-text">No verses stored yet — upload the text above.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <span className="toolbar-count">
              Showing {offset + 1}–{Math.min(offset + verses.length, total)} of {total}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
              >
                ← Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => load(offset + PAGE_SIZE)}
                disabled={offset + verses.length >= total}
              >
                Next →
              </button>
            </div>
          </div>

          {verses.map(verse => (
            <VerseCard
              key={verse.id}
              verse={verse}
              prefix={scripture.ref_prefix}
              expanded={expandedId === verse.id}
              busy={busyId === verse.id}
              onToggle={() => setExpandedId(expandedId === verse.id ? null : verse.id)}
              onSave={patch => saveVerse(verse, patch)}
              onDelete={() => deleteVerse(verse)}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

interface VerseCardProps {
  verse: VerseRowUi;
  prefix: string | null;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onSave: (patch: Partial<VerseRowUi>) => void;
  onDelete: () => void;
}

function VerseCard({ verse, prefix, expanded, busy, onToggle, onSave, onDelete }: VerseCardProps) {
  const [sanskrit, setSanskrit]   = useState(verse.sanskrit ?? '');
  const [iast, setIast]           = useState(verse.iast ?? '');
  const [translation, setTranslation] = useState(verse.translation ?? '');
  const [purport, setPurport]     = useState(verse.purport ?? '');
  const [chapterTitle, setChapterTitle] = useState(verse.chapter_title ?? '');

  const ref = `${prefix ? `${prefix} ` : ''}${refOf(verse)}`;

  if (!expanded) {
    return (
      <div className="page-row" style={{ gridTemplateColumns: '86px 1fr auto' }}>
        <div className="page-number-badge" style={{ paddingTop: '4px' }}>{ref}</div>
        <div style={{ minWidth: 0 }}>
          {verse.chapter_title && (
            <div className="img-card-meta" style={{ marginBottom: '4px' }}>{verse.chapter_title}</div>
          )}
          <div style={{ fontSize: '0.9rem', marginBottom: '4px' }}>{verse.sanskrit || '—'}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {verse.translation || <em>no translation</em>}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {verse.purport && <span className="badge badge-event">purport</span>}
            {verse.word_for_word && verse.word_for_word.length > 0 && (
              <span className="badge badge-wallpaper">{verse.word_for_word.length} words</span>
            )}
            {verse.puranic_story && <span className="badge badge-sponsor">story</span>}
            {verse.image_prompt && <span className="badge badge-darshan">image prompt</span>}
          </div>
        </div>
        <div className="page-row-actions">
          <button className="btn btn-secondary btn-sm" onClick={onToggle}>✏️ Edit</button>
          <button className="btn btn-danger btn-sm" onClick={onDelete} disabled={busy}>🗑</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      <div className="toolbar" style={{ marginBottom: '12px' }}>
        <span style={{ fontWeight: 600 }}>{ref}</span>
        <button className="btn btn-secondary btn-sm" onClick={onToggle}>Collapse</button>
      </div>

      <div className="form-group">
        <label className="form-label">Chapter title</label>
        <input className="form-input" value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} maxLength={255} />
      </div>
      <div className="form-group" style={{ marginTop: '12px' }}>
        <label className="form-label">Sanskrit (Devanāgarī)</label>
        <textarea className="form-textarea" value={sanskrit} onChange={e => setSanskrit(e.target.value)} rows={3} />
      </div>
      <div className="form-group" style={{ marginTop: '12px' }}>
        <label className="form-label">IAST</label>
        <textarea className="form-textarea" value={iast} onChange={e => setIast(e.target.value)} rows={3} />
      </div>
      <div className="form-group" style={{ marginTop: '12px' }}>
        <label className="form-label">Translation</label>
        <textarea className="form-textarea" value={translation} onChange={e => setTranslation(e.target.value)} rows={3} />
      </div>
      <div className="form-group" style={{ marginTop: '12px' }}>
        <label className="form-label">Purport / commentary</label>
        <textarea className="form-textarea" value={purport} onChange={e => setPurport(e.target.value)} rows={5} />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={() => onSave({
            sanskrit,
            iast,
            translation,
            purport: purport.trim() ? purport : null,
            chapter_title: chapterTitle.trim() ? chapterTitle : null,
          })}
        >
          {busy ? <><span className="spinner" /> Saving…</> : '💾 Save verse'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onToggle} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
