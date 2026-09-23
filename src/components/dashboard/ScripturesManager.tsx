"use client";

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import ScriptureForm from './ScriptureForm';
import ScriptureVersesEditor from './ScriptureVersesEditor';

/** A `scriptures` row joined with its live verse count, as the admin API returns it. */
export interface ScriptureRowUi {
  id: string;
  title: string;
  title_hi: string | null;
  description: string | null;
  category: string | null;
  color_hex: string | null;
  version: number;
  ref_prefix: string | null;
  has_cantos: boolean;
  declared_verse_count: number | null;
  sort_order: number;
  is_active: boolean;
  verse_count: number;
  verses_updated_at: string | null;
}

export default function ScripturesManager() {
  const { showToast } = useToast();

  const [items, setItems]     = useState<ScriptureRowUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ScriptureRowUi | null | 'new'>(null);
  const [versesFor, setVersesFor] = useState<ScriptureRowUi | null>(null);
  const [busyId, setBusyId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scriptures', {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (!res.ok) throw new Error();
      setItems((await res.json()).items);
    } catch {
      showToast('Failed to load the scripture catalogue.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (scripture: ScriptureRowUi) => {
    setBusyId(scripture.id);
    const next = !scripture.is_active;
    setItems(prev => prev.map(s => (s.id === scripture.id ? { ...s, is_active: next } : s)));
    try {
      const res = await fetch('/api/admin/scriptures', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: scripture.id, is_active: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems(prev => prev.map(s => (s.id === scripture.id ? { ...s, is_active: scripture.is_active } : s)));
      showToast('Failed to update the scripture.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (scripture: ScriptureRowUi) => {
    if (!confirm(
      `Delete "${scripture.title}" only if it is empty and has never been distributed? Archive existing texts to preserve references.`,
    )) return;
    setBusyId(scripture.id);
    try {
      const res = await fetch(`/api/admin/scriptures?id=${scripture.id}&confirm=${scripture.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (!res.ok) throw new Error();
      setItems(prev => prev.filter(s => s.id !== scripture.id));
      showToast('Scripture deleted.');
    } catch {
      showToast('Failed to delete the scripture.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (versesFor) {
    return (
      <ScriptureVersesEditor
        scripture={versesFor}
        onBack={() => { setVersesFor(null); load(); }}
      />
    );
  }

  if (editing) {
    return (
      <ScriptureForm
        scripture={editing === 'new' ? null : editing}
        onSaved={() => { setEditing(null); load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const offered = items.filter(s => s.is_active && s.verse_count > 0).length;

  return (
    <div>
      <div className="toolbar">
        <span className="toolbar-count">
          {items.length} scripture{items.length === 1 ? '' : 's'} · {offered} offered to the app
        </span>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>➕ Add Scripture</button>
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '-8px 0 20px' }}>
        Use verified sources with permission to distribute each translation and commentary.
        Record the evidence in Publishing; missing rights information remains unknown.
      </p>

      {loading ? (
        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📜</div>
            <p className="empty-text">No scriptures yet — add a catalogue entry, then upload its text.</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setEditing('new')}>
              ➕ Add Scripture
            </button>
          </div>
        </div>
      ) : (
        <div className="grid-3">
          {items.map(scripture => {
            const declared = scripture.declared_verse_count;
            const mismatch = declared !== null && declared > 0 && declared !== scripture.verse_count;
            return (
              <div key={scripture.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span
                    style={{
                      width: '10px', height: '38px', borderRadius: '99px', flexShrink: 0,
                      background: scripture.color_hex || 'var(--accent)',
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div className="img-card-name" title={scripture.title}>{scripture.title}</div>
                    <div className="img-card-meta" style={{ fontFamily: 'monospace' }}>{scripture.id}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {scripture.category && <span className="badge badge-event">{scripture.category}</span>}
                  <span className={`badge ${scripture.verse_count > 0 ? 'badge-wallpaper' : 'badge-darshan'}`}>
                    {scripture.verse_count} verse{scripture.verse_count === 1 ? '' : 's'}
                  </span>
                  {declared !== null && (
                    <span className={`badge ${mismatch ? 'badge-darshan' : 'badge-sponsor'}`}>
                      {mismatch ? `declared ${declared}` : `${declared} declared ✓`}
                    </span>
                  )}
                  <span className="badge badge-event">v{scripture.version}</span>
                  {scripture.has_cantos && <span className="badge badge-wallpaper">cantos</span>}
                  <span className={`badge ${scripture.is_active ? 'badge-sponsor' : 'badge-darshan'}`}>
                    {scripture.is_active ? 'Live' : 'Hidden'}
                  </span>
                </div>

                {scripture.verse_count === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>
                    No verses uploaded — withheld from the app&apos;s catalogue.
                  </p>
                ) : mismatch ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>
                    {scripture.verse_count} of {declared} declared verses stored
                    {scripture.verse_count < declared ? ' — the upload may be truncated.' : '.'}
                  </p>
                ) : null}

                <div className="img-card-actions" style={{ marginTop: 'auto' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setVersesFor(scripture)}>
                    📜 Verses
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(scripture)}>
                    ✏️ Edit
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => toggleActive(scripture)}
                    disabled={busyId === scripture.id}
                  >
                    {scripture.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(scripture)}
                    disabled={busyId === scripture.id}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
