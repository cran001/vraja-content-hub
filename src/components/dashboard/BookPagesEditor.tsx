/* eslint-disable @next/next/no-img-element -- CMS previews use local blob URLs and uploaded asset URLs without an image proxy. */
"use client";
import { uploadKey } from '@/lib/uploadKey';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
import type { BookRow } from './BooksManager';

interface PageRow {
  id: string;
  book_id: string;
  page_number: number;
  title: string;
  body_text: string | null;
  public_id: string;
  image_url: string;
  thumbnail_url: string;
  is_active: boolean;
  created_at: string;
}

interface PendingPage {
  file: File;
  preview: string;
  title: string;
  text: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

interface BookPagesEditorProps {
  book: BookRow;
  onBack: () => void;
}

export default function BookPagesEditor({ book, onBack }: BookPagesEditorProps) {
  const { showToast } = useToast();

  const [pages, setPages]         = useState<PageRow[]>([]);
  const [loading, setLoading]     = useState(true);

  const [showDetails, setShowDetails]     = useState(false);
  const [titleEdit, setTitleEdit]         = useState(book.title);
  const [descEdit, setDescEdit]           = useState(book.description ?? '');
  const [savingDetails, setSavingDetails] = useState(false);

  const [pending, setPending] = useState<PendingPage[]>([]);
  const [uploading, setUploading] = useState(false);

  const [savingPageId, setSavingPageId]   = useState<string | null>(null);
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null);
  const [reordering, setReordering]       = useState(false);

  const authHeaders = { Authorization: `Bearer ${localStorage.getItem('authToken')}` };

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/book-pages?book_id=${book.id}`, { headers: authHeaders });
      if (res.ok) setPages((await res.json()).items);
    } catch {
      showToast('Failed to load pages.', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, showToast]);

  useEffect(() => { loadPages(); }, [loadPages]);

  // ── Book details ────────────────────────────────────
  const saveDetails = async () => {
    if (!titleEdit.trim()) { showToast('Title cannot be empty.', 'error'); return; }
    setSavingDetails(true);
    try {
      const res = await fetch('/api/admin/books', {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: book.id, title: titleEdit.trim(), description: descEdit.trim() }),
      });
      if (!res.ok) throw new Error();
      showToast('Book details saved.');
      setShowDetails(false);
    } catch {
      showToast('Failed to save details.', 'error');
    } finally {
      setSavingDetails(false);
    }
  };

  // ── Adding pages ────────────────────────────────────
  const addFiles = (files: FileList | File[]) => {
    const additions = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        title: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim(),
        text: '',
        status: 'pending' as const,
      }));
    setPending(prev => [...prev, ...additions]);
  };

  const updatePending = (index: number, patch: Partial<PendingPage>) => {
    setPending(prev => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const removePending = (index: number) => {
    setPending(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadPending = async () => {
    // Capture indexes up front — the pending array changes shape as statuses update
    const queue = pending
      .map((p, i) => ({ page: p, index: i }))
      .filter(({ page }) => page.status !== 'done');
    if (queue.length === 0) return;
    setUploading(true);
    let ok = 0;

    // Batches of 5, one request per page so titles travel with their image
    for (let i = 0; i < queue.length; i += 5) {
      const batch = queue.slice(i, i + 5);
      await Promise.all(batch.map(async ({ page: pf, index }) => {
        updatePending(index, { status: 'uploading' });
        try {
          const fd = new FormData();
          fd.append('book_id', book.id);
          fd.append('image_0', pf.file);
          fd.append('title_0', pf.title.trim());
          if (pf.text.trim()) fd.append('text_0', pf.text.trim());

          const res = await fetch('/api/admin/book-pages', {
            method: 'POST',
            headers: { ...authHeaders, 'Idempotency-Key':uploadKey(pf.file,fd) },
            body: fd,
          });
          if (!res.ok) throw new Error();
          ok += 1;
          updatePending(index, { status: 'done' });
        } catch {
          updatePending(index, { status: 'error' });
        }
      }));
    }

    setUploading(false);
    showToast(
      `${ok} / ${queue.length} page(s) uploaded!`,
      ok === queue.length ? 'success' : 'error'
    );

    setPending(prev => {
      prev.filter(p => p.status !== 'done').forEach(p => URL.revokeObjectURL(p.preview));
      return prev.filter(p => p.status !== 'done');
    });
    loadPages();
  };

  // ── Editing / reordering / deleting pages ───────────
  const patchPage = (id: string, patch: Partial<PageRow>) => {
    setPages(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
  };

  const savePage = async (page: PageRow) => {
    setSavingPageId(page.id);
    try {
      const res = await fetch('/api/admin/book-pages', {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: page.id, title: page.title, body_text: page.body_text ?? '' }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      patchPage(page.id, updated);
      showToast(`Page ${page.page_number} saved.`);
    } catch {
      showToast('Failed to save page.', 'error');
    } finally {
      setSavingPageId(null);
    }
  };

  const togglePageActive = async (page: PageRow) => {
    patchPage(page.id, { is_active: !page.is_active });
    try {
      const res = await fetch('/api/admin/book-pages', {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: page.id, is_active: !page.is_active }),
      });
      if (!res.ok) throw new Error();
    } catch {
      patchPage(page.id, { is_active: page.is_active });
      showToast('Failed to toggle page.', 'error');
    }
  };

  const deletePage = async (page: PageRow) => {
    if (!confirm(`Delete page ${page.page_number} ("${page.title}")?`)) return;
    setDeletingPageId(page.id);
    try {
      const res = await fetch(`/api/admin/book-pages?id=${page.id}&confirm=${page.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error();
      setPages(prev => prev.filter(p => p.id !== page.id));
      showToast('Page deleted.');
    } catch {
      showToast('Failed to delete page.', 'error');
    } finally {
      setDeletingPageId(null);
    }
  };

  const movePage = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;

    const reordered = [...pages];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    setReordering(true);
    try {
      const res = await fetch('/api/admin/book-pages', {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder: { book_id: book.id, ordered_ids: reordered.map(p => p.id) } }),
      });
      if (!res.ok) throw new Error();
      setPages((await res.json()).items);
    } catch {
      showToast('Failed to reorder pages.', 'error');
    } finally {
      setReordering(false);
    }
  };

  // ── Render ──────────────────────────────────────────
  return (
    <div>
      <div className="toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>← Books</button>
          <strong style={{ fontSize: '1.05rem' }}>{titleEdit || book.title}</strong>
          <span className="badge badge-wallpaper">{pages.length} pages</span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowDetails(v => !v)}>
          ✏️ Details
        </button>
      </div>

      {showDetails && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="card-title">Book details</h3>
          <div className="form-group" style={{ marginTop: '14px' }}>
            <label className="form-label" htmlFor="edit-title">Title</label>
            <input
              id="edit-title"
              className="form-input"
              value={titleEdit}
              onChange={e => setTitleEdit(e.target.value)}
              maxLength={255}
            />
          </div>
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" htmlFor="edit-desc">Description</label>
            <textarea
              id="edit-desc"
              className="form-textarea"
              value={descEdit}
              onChange={e => setDescEdit(e.target.value)}
              rows={3}
            />
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: '14px' }}
            onClick={saveDetails}
            disabled={savingDetails}
          >
            {savingDetails ? 'Saving…' : '💾 Save details'}
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="card-title">Add pages</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0 14px' }}>
          Each image becomes one page. Give every page a title (and optional text) before uploading —
          pages are appended in the order shown here.
        </p>

        <div
          className="drop-zone"
          onClick={() => document.getElementById('page-files-input')?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
          onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
          onDrop={e => {
            e.preventDefault();
            e.currentTarget.classList.remove('drag-over');
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
        >
          <div className="drop-zone-icon">📄</div>
          <div className="drop-zone-text">Drop page images here or click to choose</div>
          <div className="drop-zone-hint">You can select multiple images at once</div>
        </div>
        <input
          id="page-files-input"
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
        />

        {pending.length > 0 && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pending.map((pf, index) => (
              <div key={pf.preview} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <img
                  src={pf.preview}
                  alt={pf.title}
                  style={{ width: '72px', height: '54px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    className="form-input"
                    type="text"
                    value={pf.title}
                    onChange={e => updatePending(index, { title: e.target.value })}
                    placeholder="Page title"
                    maxLength={255}
                  />
                  <input
                    className="form-input"
                    type="text"
                    value={pf.text}
                    onChange={e => updatePending(index, { text: e.target.value })}
                    placeholder="Optional text shown with this page"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                  <span className={`preview-status ${pf.status}`}>
                    {pf.status === 'uploading' ? '⏳' : pf.status === 'done' ? '✅' : pf.status === 'error' ? '❌' : '•'}
                  </span>
                  {pf.status !== 'uploading' && pf.status !== 'done' && (
                    <button
                      type="button"
                      className="preview-remove"
                      onClick={() => removePending(index)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div>
              <button
                className="btn btn-primary"
                onClick={uploadPending}
                disabled={uploading || pending.every(p => p.status === 'done')}
              >
                {uploading ? 'Uploading…' : `⬆️ Upload ${pending.filter(p => p.status !== 'done').length} page(s)`}
              </button>
            </div>
          </div>
        )}
      </div>

      <h3 className="card-title" style={{ marginBottom: '14px' }}>Pages in this book</h3>

      {loading ? (
        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : pages.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📖</div>
            <p className="empty-text">No pages yet — add the first page above.</p>
          </div>
        </div>
      ) : (
        pages.map((page, index) => (
          <div key={page.id} className="page-row">
            <img className="page-thumb" src={page.thumbnail_url} alt={page.title} />

            <div className="page-row-fields">
              <input
                className="form-input"
                type="text"
                value={page.title}
                onChange={e => patchPage(page.id, { title: e.target.value })}
                maxLength={255}
              />
              <textarea
                className="form-textarea"
                value={page.body_text ?? ''}
                onChange={e => patchPage(page.id, { body_text: e.target.value })}
                placeholder="Optional text shown with this page"
                rows={2}
              />
            </div>

            <div className="page-row-actions">
              <span className="page-number-badge">PAGE {page.page_number}</span>
              <button
                className="btn btn-success btn-sm"
                onClick={() => savePage(page)}
                disabled={savingPageId === page.id}
              >
                {savingPageId === page.id ? '…' : '💾 Save'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => togglePageActive(page)}
                title={page.is_active ? 'Hide from app' : 'Show in app'}
              >
                {page.is_active ? '👁 Live' : '🚫 Hidden'}
              </button>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => movePage(index, -1)}
                  disabled={reordering || index === 0}
                >
                  ↑
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => movePage(index, 1)}
                  disabled={reordering || index === pages.length - 1}
                >
                  ↓
                </button>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => deletePage(page)}
                disabled={deletingPageId === page.id}
              >
                {deletingPageId === page.id ? '…' : '🗑'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
