"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';

interface ContentItem {
  id: string; name: string; title: string | null;
  content_type: string; thumbnail_url: string; original_url: string;
  visible_date: string | null; expires_on: string | null;
  is_sponsor: boolean; is_active: boolean; created_at: string;
  category_name: string | null;
}

const TYPE_OPTS = [
  { value: '', label: 'All Types' },
  { value: 'wallpaper', label: '🖼️ Wallpaper' },
  { value: 'darshan',   label: '🌅 Darshan'   },
  { value: 'event',     label: '📅 Event'      },
  { value: 'sponsor',   label: '💼 Sponsor'    },
];

const BADGE: Record<string, string> = {
  wallpaper: 'badge-wallpaper',
  darshan:   'badge-darshan',
  event:     'badge-event',
  sponsor:   'badge-sponsor',
};

export default function GalleryTab() {
  const { showToast } = useToast();
  const [items,      setItems]      = useState<ContentItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('');
  const [page,       setPage]       = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : '';

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '48' });
      if (filter) params.set('content_type', filter);
      const res = await fetch(`/api/admin/wallpapers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setItems(data.items ?? []);
    } catch { showToast('Failed to load gallery.', 'error'); }
    finally { setLoading(false); }
  }, [filter, page, token]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item from Cloudinary and the database?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/wallpapers?id=${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      showToast('Deleted.', 'info');
      fetchItems();
    } catch { showToast('Delete failed.', 'error'); }
    finally { setDeletingId(null); }
  };

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'20px', flexWrap:'wrap' }}>
        {TYPE_OPTS.map(o => (
          <button
            key={o.value}
            className={`btn btn-sm ${filter === o.value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setFilter(o.value); setPage(1); }}
          >
            {o.label}
          </button>
        ))}
        <button className="btn btn-sm btn-secondary" style={{ marginLeft:'auto' }} onClick={fetchItems}>🔄 Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px' }}><span className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🖼️</div><p className="empty-text">No content found</p></div>
      ) : (
        <div className="grid-4">
          {items.map(item => (
            <div key={item.id} className="img-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbnail_url} alt={item.name} />
              <div className="img-card-body">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', gap:'4px' }}>
                  <div className="img-card-name" style={{ flex:1 }}>{item.title || item.name}</div>
                  <span className={`badge ${BADGE[item.content_type] || 'badge-wallpaper'}`}>{item.content_type}</span>
                </div>
                {item.category_name && <div className="img-card-meta" style={{ marginTop:'4px' }}>📂 {item.category_name}</div>}
                {item.visible_date && <div className="img-card-meta">📅 {item.visible_date}</div>}
                <div className="img-card-actions" style={{ marginTop:'10px' }}>
                  <a href={item.original_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">View</a>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    style={{ marginLeft:'auto' }}
                  >
                    {deletingId === item.id ? <span className="spinner" /> : '✕'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div style={{ display:'flex', justifyContent:'center', gap:'10px', marginTop:'28px' }}>
        <button className="btn btn-sm btn-secondary" disabled={page === 1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
        <span style={{ alignSelf:'center', fontSize:'0.85rem', color:'var(--text-secondary)' }}>Page {page}</span>
        <button className="btn btn-sm btn-secondary" disabled={items.length < 48} onClick={()=>setPage(p=>p+1)}>Next →</button>
      </div>
    </div>
  );
}
