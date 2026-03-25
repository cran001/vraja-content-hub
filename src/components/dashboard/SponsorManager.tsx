"use client";

import { useState, useRef, ChangeEvent, useEffect, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';

interface Sponsor {
  id: string; name: string; title: string | null;
  thumbnail_url: string; original_url: string;
  is_active: boolean; created_at: string;
}

export default function SponsorManager() {
  const { showToast } = useToast();
  const inputRef      = useRef<HTMLInputElement>(null);
  const [sponsors,    setSponsors]   = useState<Sponsor[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [file,        setFile]       = useState<File | null>(null);
  const [preview,     setPreview]    = useState('');
  const [name,        setName]       = useState('');
  const [uploading,   setUploading]  = useState(false);
  const [togglingId,  setTogglingId] = useState<string | null>(null);
  const [deletingId,  setDeletingId] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : '';

  const fetchSponsors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/wallpapers?content_type=sponsor', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSponsors(data.items ?? []);
    } catch { showToast('Failed to load sponsors.', 'error'); }
    finally { setLoading(false); }
  }, [token, showToast]);

  useEffect(() => { fetchSponsors(); }, [fetchSponsors]);

  const handleFile = (fl: FileList | null) => {
    if (!fl || fl.length === 0) return;
    setFile(fl[0]); setPreview(URL.createObjectURL(fl[0]));
  };

  const handleUpload = async () => {
    if (!file) { showToast('Select an image.', 'error'); return; }
    if (!name.trim()) { showToast('Enter a sponsor name.', 'error'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('image_0', file);
    fd.append('name', name.trim());
    fd.append('content_type', 'sponsor');
    fd.append('is_sponsor', 'true');
    try {
      const res = await fetch('/api/admin/wallpapers', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) throw new Error();
      showToast('Sponsor uploaded!');
      setFile(null); setPreview(''); setName('');
      fetchSponsors();
    } catch { showToast('Upload failed.', 'error'); }
    finally { setUploading(false); }
  };

  const handleToggle = async (s: Sponsor) => {
    setTogglingId(s.id);
    try {
      const res = await fetch('/api/admin/wallpapers', {
        method: 'PUT',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ id: s.id, is_active: !s.is_active }),
      });
      if (!res.ok) throw new Error();
      showToast(`Sponsor ${!s.is_active ? 'activated' : 'deactivated'}.`, 'info');
      fetchSponsors();
    } catch { showToast('Toggle failed.', 'error'); }
    finally { setTogglingId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sponsor banner?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/wallpapers?id=${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      showToast('Sponsor deleted.', 'info');
      fetchSponsors();
    } catch { showToast('Delete failed.', 'error'); }
    finally { setDeletingId(null); }
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'24px', alignItems:'start' }}>
      {/* Sponsor grid */}
      <div>
        <h3 className="card-title">Active Sponsor Banners</h3>
        {loading ? (
          <div style={{ textAlign:'center', padding:'40px' }}><span className="spinner" /></div>
        ) : sponsors.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">💼</div><p className="empty-text">No sponsors yet</p></div>
        ) : (
          <div className="grid-3">
            {sponsors.map(s => (
              <div key={s.id} className="img-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.thumbnail_url} alt={s.name} />
                <div className="img-card-body">
                  <div className="img-card-name">{s.name}</div>
                  <div className="img-card-meta">{new Date(s.created_at).toLocaleDateString()}</div>
                  <div className="img-card-actions" style={{ flexWrap:'wrap' }}>
                    <div
                      className="toggle-wrap"
                      style={{ cursor:'pointer' }}
                      onClick={()=>handleToggle(s)}
                    >
                      {togglingId === s.id
                        ? <span className="spinner" />
                        : <div className={`toggle ${s.is_active ? 'on' : ''}`} />
                      }
                      <span className="toggle-label" style={{ fontSize:'0.72rem' }}>
                        {s.is_active ? 'Live' : 'Off'}
                      </span>
                    </div>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={()=>handleDelete(s.id)}
                      disabled={deletingId === s.id}
                    >
                      {deletingId === s.id ? <span className="spinner" /> : '✕'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        <h3 className="card-title">Add Sponsor</h3>
        <div className="drop-zone" style={{ padding:'24px' }} onClick={()=>inputRef.current?.click()}>
          {preview
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={preview} alt="preview" style={{ maxHeight:'120px', borderRadius:'8px', objectFit:'cover' }} />
            : <><div className="drop-zone-icon">💼</div><div className="drop-zone-hint">Click to select banner</div></>
          }
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e:ChangeEvent<HTMLInputElement>)=>handleFile(e.target.files)} />
        </div>
        <div className="form-group">
          <label className="form-label">Sponsor Name</label>
          <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. ISKCON Mayapur" />
        </div>
        <button className="btn btn-primary" onClick={handleUpload} disabled={uploading || !file} style={{ justifyContent:'center' }}>
          {uploading ? <><span className="spinner" /> Uploading…</> : '💼 Add Sponsor'}
        </button>
      </div>
    </div>
  );
}
