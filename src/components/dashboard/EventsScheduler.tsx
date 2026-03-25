"use client";

import { useState, useRef, ChangeEvent } from 'react';
import { useToast } from '@/context/ToastContext';

interface Category { id: string; name: string; parent_id: string | null; level: number; }

interface EventsSchedulerProps { categories: Category[]; }

export default function EventsScheduler({ categories }: EventsSchedulerProps) {
  const { showToast } = useToast();
  const inputRef     = useRef<HTMLInputElement>(null);
  const [files,       setFiles]      = useState<File[]>([]);
  const [previews,    setPreviews]   = useState<string[]>([]);
  const [title,       setTitle]      = useState('');
  const [categoryId,  setCategoryId] = useState('');
  const [visibleDate, setVisibleDate]= useState('');
  const [expiresOn,   setExpiresOn]  = useState('');
  const [uploading,   setUploading]  = useState(false);

  // Cascading selects
  const [selRoot, setSelRoot] = useState('');
  const [selSub,  setSelSub]  = useState('');
  const rootCats    = categories.filter(c => c.level === 0);
  const subCats     = categories.filter(c => c.parent_id === selRoot);
  const subSubCats  = categories.filter(c => c.parent_id === selSub);

  const handleFiles = (fl: FileList | null) => {
    if (!fl) return;
    const arr = Array.from(fl);
    setFiles(arr); setPreviews(arr.map(f => URL.createObjectURL(f)));
  };

  const handleUpload = async () => {
    if (files.length === 0)  { showToast('Add at least one image.', 'error'); return; }
    if (!title.trim())        { showToast('Title is required.', 'error'); return; }
    if (!visibleDate)         { showToast('Set a visible date.', 'error'); return; }

    setUploading(true);
    const token = localStorage.getItem('authToken');
    let ok = 0;

    for (const file of files) {
      const fd = new FormData();
      fd.append('image_0', file);
      fd.append('name', title.trim());
      fd.append('content_type', 'event');
      fd.append('visible_date', visibleDate);
      if (expiresOn)   fd.append('expires_on', expiresOn);
      if (categoryId)  fd.append('category_id', categoryId);
      fd.append('is_sponsor', 'false');
      try {
        const res = await fetch('/api/admin/wallpapers', {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
        if (res.ok) ok++;
      } catch { /* continue */ }
    }

    setUploading(false);
    showToast(`${ok}/${files.length} event images scheduled!`, ok === files.length ? 'success' : 'error');
    if (ok > 0) { setFiles([]); setPreviews([]); setTitle(''); setVisibleDate(''); setExpiresOn(''); }
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:'24px', alignItems:'start' }}>
      {/* Left */}
      <div>
        <div className="drop-zone" onClick={() => inputRef.current?.click()}>
          <div className="drop-zone-icon">📅</div>
          <div className="drop-zone-text">{files.length > 0 ? `${files.length} file(s) ready` : 'Click to select event photos'}</div>
          <div className="drop-zone-hint">These will ONLY appear on the selected visible date</div>
          <input ref={inputRef} type="file" multiple accept="image/*" hidden onChange={(e:ChangeEvent<HTMLInputElement>)=>handleFiles(e.target.files)} />
        </div>
        {previews.length > 0 && (
          <div className="preview-grid" style={{ marginTop:'16px' }}>
            {previews.map((src, i) => (
              <div key={i} className="preview-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right */}
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        <h3 className="card-title">Event Details</h3>

        <div className="form-group">
          <label className="form-label">Event Title *</label>
          <input className="form-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Gaura Purnima 2026" />
        </div>

        <div className="form-group">
          <label className="form-label">Visible Date * <span style={{color:'var(--accent)',fontWeight:400}}>(goes live this day)</span></label>
          <input type="date" className="form-input" value={visibleDate} onChange={e=>setVisibleDate(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Expires On <span style={{color:'var(--text-muted)',fontWeight:400}}>(auto-hides after)</span></label>
          <input type="date" className="form-input" value={expiresOn} onChange={e=>setExpiresOn(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="form-select" value={selRoot} onChange={e=>{ setSelRoot(e.target.value); setSelSub(''); setCategoryId(e.target.value); }}>
            <option value="">— Primary —</option>
            {rootCats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {selRoot && subCats.length > 0 && (
          <div className="form-group">
            <select className="form-select" value={selSub} onChange={e=>{ setSelSub(e.target.value); setCategoryId(e.target.value); }}>
              <option value="">— Sub-category —</option>
              {subCats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {selSub && subSubCats.length > 0 && (
          <div className="form-group">
            <select className="form-select" onChange={e=>setCategoryId(e.target.value)}>
              <option value="">— Sub-sub-category —</option>
              {subSubCats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <button className="btn btn-primary" onClick={handleUpload} disabled={uploading || files.length === 0} style={{ justifyContent:'center' }}>
          {uploading ? <><span className="spinner" /> Scheduling…</> : `📅 Schedule ${files.length || ''} Photo${files.length !== 1?'s':''}`}
        </button>
      </div>
    </div>
  );
}
