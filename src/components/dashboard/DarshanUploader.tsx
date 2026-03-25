"use client";

import { useState, useRef, ChangeEvent } from 'react';
import { useToast } from '@/context/ToastContext';

export default function DarshanUploader() {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files,      setFiles]      = useState<File[]>([]);
  const [previews,   setPreviews]   = useState<string[]>([]);
  const [date,       setDate]       = useState(new Date().toISOString().split('T')[0]);
  const [title,      setTitle]      = useState('');
  const [uploading,  setUploading]  = useState(false);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    setFiles(arr);
    setPreviews(arr.map(f => URL.createObjectURL(f)));
  };

  const handleUploadAll = async () => {
    if (files.length === 0) { showToast('Select at least one image.', 'error'); return; }
    if (!date)              { showToast('Select a date.', 'error'); return; }
    setUploading(true);
    const token = localStorage.getItem('authToken');
    let ok = 0;

    for (const file of files) {
      const fd = new FormData();
      fd.append('image_0', file);
      fd.append('name', title || `Darshan – ${date}`);
      fd.append('content_type', 'darshan');
      fd.append('visible_date', date);
      fd.append('is_sponsor', 'false');
      try {
        const res = await fetch('/api/admin/wallpapers', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (res.ok) ok++;
      } catch { /* continue */ }
    }

    setUploading(false);
    showToast(`${ok}/${files.length} darshan photos uploaded!`, ok === files.length ? 'success' : 'error');
    if (ok > 0) { setFiles([]); setPreviews([]); setTitle(''); }
  };

  return (
    <div style={{ maxWidth: '700px' }}>
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ fontSize:'2rem' }}>🌅</span>
          <div>
            <h3 style={{ fontWeight:700 }}>Daily Darshan Uploader</h3>
            <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)' }}>
              Upload today&apos;s deity photos. The API will only serve them on the selected date.
            </p>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Darshan Date</label>
            <input type="date" className="form-input" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Title (optional)</label>
            <input className="form-input" value={title} placeholder="e.g. Vrindavan Darshan" onChange={e=>setTitle(e.target.value)} />
          </div>
        </div>

        <div
          className="drop-zone"
          style={{ padding:'32px' }}
          onClick={() => inputRef.current?.click()}
        >
          <div className="drop-zone-icon">🌸</div>
          <div className="drop-zone-text">{files.length > 0 ? `${files.length} photo(s) selected` : 'Click to select photos'}</div>
          <div className="drop-zone-hint">Images will be tagged as Darshan for {date}</div>
          <input ref={inputRef} type="file" multiple accept="image/*" hidden onChange={(e:ChangeEvent<HTMLInputElement>)=>handleFiles(e.target.files)} />
        </div>

        {previews.length > 0 && (
          <div className="preview-grid">
            {previews.map((src, i) => (
              <div key={i} className="preview-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`preview-${i}`} />
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-primary" onClick={handleUploadAll} disabled={uploading || files.length === 0} style={{ justifyContent:'center' }}>
          {uploading ? <><span className="spinner" /> Uploading…</> : `Upload ${files.length || ''} Darshan Photo${files.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
