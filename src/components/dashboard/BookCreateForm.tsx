"use client";

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';

interface BookCreateFormProps {
  onCreated: () => void;
}

export default function BookCreateForm({ onCreated }: BookCreateFormProps) {
  const { showToast } = useToast();

  const [title, setTitle]         = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover]         = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);

  const handleCoverChange = (file: File | null) => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCover(file);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please give the book a title.', 'error');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      if (description.trim()) fd.append('description', description.trim());
      if (cover) fd.append('cover', cover);

      const res = await fetch('/api/admin/books', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to create book.');
      }

      showToast('Book created! Open it from the library to add pages.');
      onCreated();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create book.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit} style={{ maxWidth: '640px' }}>
      <h3 className="card-title">New Book</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0 20px' }}>
        A book is a set of pages — each page has an image, a title and optional text.
        Create the book first, then add its pages from the Books Library.
      </p>

      <div className="form-group">
        <label className="form-label" htmlFor="book-title">Title *</label>
        <input
          id="book-title"
          className="form-input"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Krishna&apos;s Childhood Pastimes"
          maxLength={255}
        />
      </div>

      <div className="form-group" style={{ marginTop: '16px' }}>
        <label className="form-label" htmlFor="book-description">Description</label>
        <textarea
          id="book-description"
          className="form-textarea"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="A short summary shown under the book in the app library"
          rows={3}
        />
      </div>

      <div className="form-group" style={{ marginTop: '16px' }}>
        <span className="form-label">Cover image (optional)</span>
        <div
          className="drop-zone"
          onClick={() => document.getElementById('book-cover-input')?.click()}
        >
          {coverPreview ? (
            <img
              src={coverPreview}
              alt="Cover preview"
              style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }}
            />
          ) : (
            <>
              <div className="drop-zone-icon">🖼️</div>
              <div className="drop-zone-text">Click to choose a cover image</div>
              <div className="drop-zone-hint">JPG or PNG — shown as the book thumbnail in the app</div>
            </>
          )}
        </div>
        <input
          id="book-cover-input"
          type="file"
          accept="image/*"
          hidden
          onChange={e => handleCoverChange(e.target.files?.[0] ?? null)}
        />
        {cover && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: '8px' }}
            onClick={() => handleCoverChange(null)}
          >
            ✕ Remove cover
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Creating…' : '➕ Create Book'}
        </button>
      </div>
    </form>
  );
}
