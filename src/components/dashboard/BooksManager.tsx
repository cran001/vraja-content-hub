/* eslint-disable @next/next/no-img-element -- CMS previews use local blob URLs and uploaded asset URLs without an image proxy. */
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
import BookPagesEditor from './BookPagesEditor';

export interface BookRow {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  sort_order: number;
  is_active: boolean;
  page_count: number;
  created_at: string;
  updated_at: string;
}

interface BooksManagerProps {
  onAddNew: () => void;
}

export default function BooksManager({ onAddNew }: BooksManagerProps) {
  const { showToast } = useToast();

  const [books, setBooks]       = useState<BookRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookRow | null>(null);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/books', {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (res.ok) setBooks((await res.json()).items);
    } catch {
      showToast('Failed to load books.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  const toggleActive = async (book: BookRow) => {
    setTogglingId(book.id);
    const next = !book.is_active;
    setBooks(prev => prev.map(b => (b.id === book.id ? { ...b, is_active: next } : b)));
    try {
      const res = await fetch('/api/admin/books', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: book.id, is_active: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setBooks(prev => prev.map(b => (b.id === book.id ? { ...b, is_active: book.is_active } : b)));
      showToast('Failed to update book.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (book: BookRow) => {
    if (!confirm(`Delete "${book.title}" only if it has no pages and is not a story? Archive books that still have content.`)) return;
    setDeletingId(book.id);
    try {
      const res = await fetch(`/api/admin/books?id=${book.id}&confirm=${book.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (!res.ok) throw new Error();
      setBooks(prev => prev.filter(b => b.id !== book.id));
      showToast('Book deleted.');
    } catch {
      showToast('Failed to delete book.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (selectedBook) {
    return (
      <BookPagesEditor
        book={selectedBook}
        onBack={() => { setSelectedBook(null); loadBooks(); }}
      />
    );
  }

  return (
    <div>
      <div className="toolbar">
        <span className="toolbar-count">
          {books.length} book{books.length === 1 ? '' : 's'} in the library
        </span>
        <button className="btn btn-primary" onClick={onAddNew}>➕ Add New Book</button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : books.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <p className="empty-text">No books yet — create the first story book.</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={onAddNew}>
              ➕ Add New Book
            </button>
          </div>
        </div>
      ) : (
        <div className="grid-3">
          {books.map(book => (
            <div key={book.id} className="img-card">
              {book.cover_url ? (
                <img src={book.cover_url} alt={book.title} />
              ) : (
                <div className="book-cover-placeholder">📖</div>
              )}
              <div className="img-card-body">
                <div className="img-card-name" title={book.title}>{book.title}</div>
                <div className="img-card-meta">
                  <span className="badge badge-wallpaper">{book.page_count} pages</span>
                  <span className={`badge ${book.is_active ? 'badge-sponsor' : 'badge-darshan'}`}>
                    {book.is_active ? 'Live' : 'Hidden'}
                  </span>
                </div>
                <div className="img-card-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => setSelectedBook(book)}>
                    📄 Pages
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => toggleActive(book)}
                    disabled={togglingId === book.id}
                  >
                    {book.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(book)}
                    disabled={deletingId === book.id}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
