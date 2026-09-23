"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { DAILY_VERSE_THEMES } from '@/lib/dailyVerses';

interface ScriptureOption {
  id: string;
  title: string;
  is_active: boolean;
  verse_count: number;
}

interface DailyVerseRow {
  id: string;
  scripture_id: string;
  scripture_title: string;
  canto: number | null;
  chapter: number;
  verse: number;
  theme: string;
  reflection: string;
  translation_override: string | null;
  translation_locale: string;
  locale: string;
  display_date: string | null;
  priority: number;
  is_active: boolean;
}

interface FormState {
  scriptureId: string;
  canto: string;
  chapter: string;
  verse: string;
  theme: string;
  reflection: string;
  translationOverride: string;
  translationLocale: string;
  locale: string;
  displayDate: string;
  priority: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  scriptureId: '', canto: '', chapter: '', verse: '', theme: 'Trust', reflection: '',
  translationOverride: '', translationLocale: 'en', locale: 'en', displayDate: '', priority: '0', isActive: false,
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('authToken')}`,
  'Content-Type': 'application/json',
});

export default function DailyVersesManager() {
  const { showToast } = useToast();
  const [items, setItems] = useState<DailyVerseRow[]>([]);
  const [scriptures, setScriptures] = useState<ScriptureOption[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dailyRes, scriptureRes] = await Promise.all([
        fetch('/api/admin/daily-verses', { headers: authHeaders() }),
        fetch('/api/admin/scriptures', { headers: authHeaders() }),
      ]);
      if (!dailyRes.ok || !scriptureRes.ok) throw new Error('Unable to load daily verses.');
      const daily = await dailyRes.json();
      const scriptureData = await scriptureRes.json();
      setItems(daily.items);
      setScriptures(scriptureData.items);
      setForm(current => current.scriptureId || scriptureData.items.length === 0
        ? current
        : { ...current, scriptureId: scriptureData.items[0].id });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load daily verses.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setEditingId(null);
    setForm({ ...emptyForm, scriptureId: scriptures[0]?.id ?? '' });
  };

  const edit = (item: DailyVerseRow) => {
    setEditingId(item.id);
    setForm({
      scriptureId: item.scripture_id,
      canto: item.canto?.toString() ?? '',
      chapter: item.chapter.toString(),
      verse: item.verse.toString(),
      theme: item.theme,
      reflection: item.reflection,
      translationOverride: item.translation_override ?? '',
      translationLocale: item.translation_locale ?? 'en',
      locale: item.locale,
      displayDate: item.display_date ?? '',
      priority: item.priority.toString(),
      isActive: item.is_active,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/daily-verses', {
        method: editingId ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ id: editingId ?? undefined, ...form }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? 'Unable to save daily verse.');
      showToast(editingId ? 'Daily verse updated.' : 'Daily verse added.');
      reset();
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save daily verse.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item: DailyVerseRow) => {
    try {
      const res = await fetch('/api/admin/daily-verses', {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
      });
      if (!res.ok) throw new Error();
      setItems(current => current.map(row => row.id === item.id
        ? { ...row, is_active: !row.is_active }
        : row));
    } catch {
      showToast('Unable to update daily verse visibility.', 'error');
    }
  };

  const remove = async (item: DailyVerseRow) => {
    if (!confirm(`Delete ${item.scripture_title} ${item.chapter}.${item.verse} from the daily pool?`)) return;
    try {
      const res = await fetch(`/api/admin/daily-verses?id=${item.id}&confirm=${item.id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      setItems(current => current.filter(row => row.id !== item.id));
      showToast('Daily verse deleted.');
    } catch {
      showToast('Unable to delete daily verse.', 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <form className="card" onSubmit={save} style={{ display: 'grid', gap: '14px' }}>
        <h3>{editingId ? 'Edit daily verse' : 'Add a daily verse'}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          Select a verified scripture verse, then add a separate original practical reflection. Review sources and translation permissions in Publishing.
          Leave the date empty to place it in the deterministic rotation pool.
        </p>

        <label className="form-group">
          <span>Scripture</span>
          <select value={form.scriptureId} onChange={e => update('scriptureId', e.target.value)} required>
            <option value="">Select scripture</option>
            {scriptures.filter(item => item.verse_count > 0).map(item => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
        </label>

        <div className="grid-3">
          <label className="form-group"><span>Canto (optional)</span><input type="number" min="1" value={form.canto} onChange={e => update('canto', e.target.value)} /></label>
          <label className="form-group"><span>Chapter</span><input type="number" min="1" value={form.chapter} onChange={e => update('chapter', e.target.value)} required /></label>
          <label className="form-group"><span>Verse</span><input type="number" min="1" value={form.verse} onChange={e => update('verse', e.target.value)} required /></label>
        </div>

        <div className="grid-3">
          <label className="form-group">
            <span>Theme</span>
            <select value={form.theme} onChange={e => update('theme', e.target.value)}>
              {DAILY_VERSE_THEMES.map(theme => <option key={theme}>{theme}</option>)}
            </select>
          </label>
          <label className="form-group"><span>Locale</span><input value={form.locale} onChange={e => update('locale', e.target.value)} placeholder="en" required /></label>
          <label className="form-group"><span>Scheduled date</span><input type="date" value={form.displayDate} onChange={e => update('displayDate', e.target.value)} /></label>
        </div>

        <label className="form-group">
          <span>Practical reflection</span>
          <textarea rows={4} minLength={12} value={form.reflection} onChange={e => update('reflection', e.target.value)} required />
        </label>
        <label className="form-group">
          <span>Public-domain translation override (optional)</span>
          <textarea rows={3} value={form.translationOverride} onChange={e => update('translationOverride', e.target.value)} />
          <span>Override translation language (en or hi)</span><input value={form.translationLocale} onChange={e => update('translationLocale', e.target.value)} />
        </label>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="form-group" style={{ minWidth: '140px' }}>
            <span>Priority</span>
            <input type="number" min="0" max="100" value={form.priority} onChange={e => update('priority', e.target.value)} />
          </label>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="checkbox" checked={form.isActive} onChange={e => update('isActive', e.target.checked)} /> Published
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" disabled={saving || !form.scriptureId}>{saving ? 'Saving…' : 'Save daily verse'}</button>
          {editingId && <button className="btn btn-secondary" type="button" onClick={reset}>Cancel</button>}
        </div>
      </form>

      {loading ? (
        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : items.length === 0 ? (
        <div className="card empty-state"><p className="empty-text">No daily verses curated yet.</p></div>
      ) : (
        <div className="grid-3">
          {items.map(item => (
            <article className="card" key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <strong>{item.scripture_title} {item.canto ? `${item.canto}.` : ''}{item.chapter}.{item.verse}</strong>
                <div className="img-card-meta">{item.display_date || 'Rotation pool'} · {item.locale}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span className="badge badge-event">{item.theme}</span>
                <span className={`badge ${item.is_active ? 'badge-sponsor' : 'badge-darshan'}`}>{item.is_active ? 'Live' : 'Hidden'}</span>
                <span className="badge badge-wallpaper">Priority {item.priority}</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>{item.reflection}</p>
              <div className="img-card-actions" style={{ marginTop: 'auto' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => edit(item)}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => toggle(item)}>{item.is_active ? 'Hide' : 'Show'}</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(item)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
