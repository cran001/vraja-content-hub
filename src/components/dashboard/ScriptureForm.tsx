"use client";

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import {
  SCRIPTURE_CATEGORIES,
  slugifyScriptureId,
  validateScripture,
} from '@/lib/scriptures';
import type { ScriptureRowUi } from './ScripturesManager';

interface ScriptureFormProps {
  scripture: ScriptureRowUi | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function ScriptureForm({ scripture, onSaved, onCancel }: ScriptureFormProps) {
  const { showToast } = useToast();
  const isEdit = Boolean(scripture);

  const [title, setTitle]             = useState(scripture?.title ?? '');
  const [titleHi, setTitleHi]         = useState(scripture?.title_hi ?? '');
  const [id, setId]                   = useState(scripture?.id ?? '');
  const [idTouched, setIdTouched]     = useState(isEdit);
  const [description, setDescription] = useState(scripture?.description ?? '');
  const [category, setCategory]       = useState(scripture?.category ?? '');
  const [colorHex, setColorHex]       = useState(scripture?.color_hex ?? '');
  const [refPrefix, setRefPrefix]     = useState(scripture?.ref_prefix ?? '');
  const [hasCantos, setHasCantos]     = useState(scripture?.has_cantos === true);
  const [declared, setDeclared]       = useState(
    scripture?.declared_verse_count === null || scripture?.declared_verse_count === undefined
      ? ''
      : String(scripture.declared_verse_count),
  );
  const [sortOrder, setSortOrder]     = useState(String(scripture?.sort_order ?? 0));
  const [isActive, setIsActive]       = useState(scripture ? scripture.is_active !== false : true);
  const [errors, setErrors]           = useState<string[]>([]);
  const [saving, setSaving]           = useState(false);

  // Until the editor types their own, the id follows the title.
  const effectiveId = idTouched && id ? id : slugifyScriptureId(title);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validated = validateScripture({
      id: effectiveId,
      title,
      titleHi,
      description,
      category,
      colorHex,
      refPrefix,
      hasCantos,
      declaredVerseCount: declared,
      sortOrder,
      isActive,
    });
    if (!validated.ok) {
      setErrors(validated.errors);
      showToast(validated.errors[0], 'error');
      return;
    }
    setErrors([]);

    setSaving(true);
    try {
      const res = await fetch('/api/admin/scriptures', {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validated.value),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data?.errors)) setErrors(data.errors);
        throw new Error(data?.message ?? 'Failed to save the scripture.');
      }
      showToast(isEdit ? 'Scripture updated.' : 'Scripture created — now upload its verses.');
      onSaved();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save the scripture.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit} style={{ maxWidth: '760px' }}>
      <div className="toolbar" style={{ marginBottom: '4px' }}>
        <h3 className="card-title" style={{ marginBottom: 0 }}>
          {isEdit ? `Edit ${scripture?.title}` : 'New Scripture'}
        </h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
          ← Back to catalogue
        </button>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0 20px' }}>
        This is the catalogue entry only. Upload the text itself from{' '}
        <strong>Verses</strong> — a scripture with no verses stays out of the app&apos;s catalogue.
      </p>

      {errors.length > 0 && (
        <div
          className="card"
          style={{ borderColor: 'rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.08)', marginBottom: '18px' }}
        >
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: 'var(--danger)' }}>
            {errors.map((message, index) => <li key={index}>{message}</li>)}
          </ul>
        </div>
      )}

      <div className="grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="scripture-title">Title *</label>
          <input
            id="scripture-title"
            className="form-input"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Nṛsiṁha Tāpanī Upaniṣad"
            maxLength={255}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="scripture-title-hi">Hindi title</label>
          <input
            id="scripture-title-hi"
            className="form-input"
            type="text"
            value={titleHi}
            onChange={e => setTitleHi(e.target.value)}
            maxLength={255}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginTop: '16px' }}>
        <label className="form-label" htmlFor="scripture-id">Id (slug) *</label>
        <input
          id="scripture-id"
          className="form-input"
          type="text"
          value={effectiveId}
          onChange={e => { setId(e.target.value); setIdTouched(true); }}
          placeholder="nrsimha_tapani"
          disabled={isEdit}
          maxLength={100}
        />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {isEdit
            ? 'The id cannot change: installed copies on devices are stored under it.'
            : 'Lowercase letters, digits and underscores. Chosen once — devices store the downloaded text under this id.'}
        </span>
      </div>

      <div className="form-group" style={{ marginTop: '16px' }}>
        <label className="form-label" htmlFor="scripture-description">Description</label>
        <textarea
          id="scripture-description"
          className="form-textarea"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="A short summary shown in the library sheet"
          rows={3}
        />
      </div>

      <div className="grid-3" style={{ marginTop: '16px' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="scripture-category">Category</label>
          <input
            id="scripture-category"
            className="form-input"
            type="text"
            list="scripture-categories"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="Upanishad"
            maxLength={100}
          />
          <datalist id="scripture-categories">
            {SCRIPTURE_CATEGORIES.map(name => <option key={name} value={name} />)}
          </datalist>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="scripture-ref-prefix">Reference prefix</label>
          <input
            id="scripture-ref-prefix"
            className="form-input"
            type="text"
            value={refPrefix}
            onChange={e => setRefPrefix(e.target.value)}
            placeholder="NT"
            maxLength={16}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Verse refs read &ldquo;{(refPrefix || 'NT')} {hasCantos ? '1.2.3' : '2.3'}&rdquo;.
          </span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="scripture-colour">Accent colour</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="scripture-colour"
              className="form-input"
              type="text"
              value={colorHex}
              onChange={e => setColorHex(e.target.value)}
              placeholder="#7C6AF7"
              maxLength={9}
            />
            <input
              type="color"
              aria-label="Pick accent colour"
              value={/^#[0-9A-Fa-f]{6}$/.test(colorHex) ? colorHex : '#7c6af7'}
              onChange={e => setColorHex(e.target.value.toUpperCase())}
              style={{ width: '44px', padding: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent' }}
            />
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: '16px' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="scripture-declared">Declared verse count</label>
          <input
            id="scripture-declared"
            className="form-input"
            type="number"
            min={0}
            value={declared}
            onChange={e => setDeclared(e.target.value)}
            placeholder="e.g. 700"
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            What the source text should contain. Compared against the verses actually stored so a
            truncated upload is obvious.
          </span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="scripture-sort">Sort order</label>
          <input
            id="scripture-sort"
            className="form-input"
            type="number"
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Lower sorts first in the app&apos;s catalogue sheet.
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '26px', flexWrap: 'wrap', marginTop: '20px' }}>
        <div className="toggle-wrap" onClick={() => setHasCantos(!hasCantos)} role="presentation">
          <div className={`toggle ${hasCantos ? 'on' : ''}`} />
          <span className="toggle-label">Has cantos (Bhāgavatam-style 3-part refs)</span>
        </div>
        <div className="toggle-wrap" onClick={() => setIsActive(!isActive)} role="presentation">
          <div className={`toggle ${isActive ? 'on' : ''}`} />
          <span className="toggle-label">{isActive ? 'Offered in the app' : 'Hidden'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : isEdit ? '💾 Save' : '➕ Create Scripture'}
        </button>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
