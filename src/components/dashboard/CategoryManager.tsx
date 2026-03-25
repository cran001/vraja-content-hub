"use client";

import { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';

interface Category { id: string; name: string; parent_id: string | null; level: number; slug: string; }

interface CategoryManagerProps {
  categories: Category[];
  onCategoriesChange: () => void;
}

export default function CategoryManager({ categories, onCategoriesChange }: CategoryManagerProps) {
  const { showToast } = useToast();
  const [newName, setNewName]       = useState('');
  const [parentId, setParentId]     = useState('');
  const [isAdding, setIsAdding]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : '';

  const handleAdd = async () => {
    if (!newName.trim()) { showToast('Name is required.', 'error'); return; }
    setIsAdding(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim(), parent_id: parentId || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      showToast('Category created!');
      setNewName(''); setParentId('');
      onCategoriesChange();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setIsAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category and all its children?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/categories?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      showToast('Category deleted.', 'info');
      onCategoriesChange();
    } catch { showToast('Delete failed.', 'error'); }
    finally { setDeletingId(null); }
  };

  const levelPrefix = (level: number) => '└─ '.repeat(level);
  const levelColors = ['var(--accent)','var(--accent-2)','var(--success)','var(--text-secondary)'];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'24px', alignItems:'start' }}>
      {/* Tree */}
      <div>
        <h3 className="card-title">Category Tree</h3>
        {categories.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🗂️</div><p className="empty-text">No categories yet</p></div>
        ) : (
          <div className="cat-tree">
            {categories.map(cat => (
              <div key={cat.id} className={`cat-node cat-level-${Math.min(cat.level, 3)}`}>
                <div className="cat-node-label">
                  <span style={{ color: levelColors[Math.min(cat.level, 3)], fontSize:'0.8rem' }}>{levelPrefix(cat.level)}</span>
                  <span>{cat.name}</span>
                  <span style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>/{cat.slug}</span>
                </div>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(cat.id)}
                  disabled={deletingId === cat.id}
                >
                  {deletingId === cat.id ? <span className="spinner" /> : '✕'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add form */}
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        <h3 className="card-title">Add Category</h3>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Festivals" />
        </div>
        <div className="form-group">
          <label className="form-label">Parent (leave empty for root)</label>
          <select className="form-select" value={parentId} onChange={e=>setParentId(e.target.value)}>
            <option value="">— Root level —</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{'\u00a0'.repeat(c.level * 2)}{c.name}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleAdd} disabled={isAdding} style={{ justifyContent:'center' }}>
          {isAdding ? <><span className="spinner" /> Adding…</> : '+ Add Category'}
        </button>
      </div>
    </div>
  );
}
