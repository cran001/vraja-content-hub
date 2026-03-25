"use client";

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { useToast } from '@/context/ToastContext';

interface Category { id: string; name: string; parent_id: string | null; level: number; }

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';
interface PreviewFile {
  id: string;
  file: File;
  previewUrl: string;
  status: FileStatus;
}

interface BulkUploaderProps {
  categories: Category[];
  onCategoriesChange: () => void;
}

export default function BulkUploader({ categories, onCategoriesChange }: BulkUploaderProps) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles]           = useState<PreviewFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [creatingLevel, setCreatingLevel] = useState<number | null>(null);
  const [newCatName, setNewCatName] = useState('');

  // Shared metadata
  const [name,         setName]        = useState('');
  const [contentType,  setContentType] = useState('wallpaper');
  const [categoryId,   setCategoryId]  = useState('');
  const [visibleDate,  setVisibleDate] = useState('');
  const [expiresOn,    setExpiresOn]   = useState('');
  const [isSponsor,    setIsSponsor]   = useState(false);

  // Cascading dropdowns
  const rootCats = categories.filter(c => c.level === 0);
  const [selRoot, setSelRoot] = useState('');
  const [selSub,  setSelSub]  = useState('');

  const subCats    = categories.filter(c => c.parent_id === selRoot);
  const subSubCats = categories.filter(c => c.parent_id === selSub);

  const handleRootChange = (id: string) => {
    setSelRoot(id); setSelSub(''); setCategoryId(id);
  };
  const handleSubChange  = (id: string) => {
    setSelSub(id); setCategoryId(id);
  };
  const handleSubSubChange = (id: string) => {
    setCategoryId(id);
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const newFiles: PreviewFile[] = Array.from(incoming).map(f => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: 'pending',
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };
  
  const onPaste = (e: ClipboardEvent | import('react').ClipboardEvent) => {
    if (e.clipboardData?.files?.length) {
      addFiles(e.clipboardData.files);
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files);
  const removeFile   = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const updateStatus = (id: string, status: FileStatus) =>
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status } : f));

  const handleCreateCategory = async (parentId: string | null) => {
    if (!newCatName.trim()) return;
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newCatName.trim(), parent_id: parentId }),
      });
      if (res.ok) {
        showToast('Category created!');
        onCategoriesChange();
      } else {
        showToast('Failed to create category', 'error');
      }
    } catch {
      showToast('Error creating category', 'error');
    } finally {
      setCreatingLevel(null);
      setNewCatName('');
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) { showToast('Add at least one image first.', 'error'); return; }
    if (!name.trim())       { showToast('Please enter a name.', 'error'); return; }

    setIsUploading(true);
    const token = localStorage.getItem('authToken');
    let successCount = 0;

    // Upload files in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map(async (pf) => {
        updateStatus(pf.id, 'uploading');
        const fd = new FormData();
        fd.append('image_0', pf.file);
        fd.append('name', name.trim());
        fd.append('content_type', contentType);
        if (categoryId)   fd.append('category_id',  categoryId);
        if (visibleDate)  fd.append('visible_date',  visibleDate);
        if (expiresOn)    fd.append('expires_on',    expiresOn);
        fd.append('is_sponsor', String(isSponsor));

        try {
          const res = await fetch('/api/admin/wallpapers', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          if (!res.ok) throw new Error();
          updateStatus(pf.id, 'done');
          successCount++;
        } catch {
          updateStatus(pf.id, 'error');
        }
      }));
    }

    setIsUploading(false);
    showToast(`${successCount} / ${files.length} uploaded!`, successCount === files.length ? 'success' : 'error');
  };

  const needsDate = contentType === 'darshan' || contentType === 'event';

  return (
    <div 
      style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start', minHeight: '100%' }}
      onPaste={onPaste}
    >
      {/* Left: Drop zone + preview */}
      <div>
        <div
          className={`drop-zone ${isDragging ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <div className="drop-zone-icon">📂</div>
          <div className="drop-zone-text">Drag &amp; drop images, or paste from clipboard (Ctrl+V)</div>
          
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' }}>
            <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>+ Select Photos</button>
            <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); dirInputRef.current?.click(); }}>+ Select Folder</button>
          </div>
          
          <input ref={inputRef} type="file" multiple accept="image/*" hidden onChange={onFileChange} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <input ref={dirInputRef} type="file" multiple accept="image/*" hidden onChange={onFileChange} {...{ webkitdirectory: "true", directory: "true" } as any} />
        </div>

        {files.length > 0 && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'16px 0 8px' }}>
              <span style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>{files.length} image{files.length !== 1 ? 's' : ''} selected</span>
              <button className="btn btn-sm btn-secondary" onClick={() => setFiles([])}>Clear All</button>
            </div>
            <div className="preview-grid">
              {files.map(pf => (
                <div key={pf.id} className="preview-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pf.previewUrl} alt="preview" />
                  {pf.status === 'pending' && (
                    <button className="preview-remove" onClick={() => removeFile(pf.id)}>✕</button>
                  )}
                  {pf.status !== 'pending' && (
                    <div className={`preview-status ${pf.status}`}>{pf.status}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right: Shared metadata panel */}
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        <h3 className="card-title">Upload Settings</h3>

        <div className="form-group">
          <label className="form-label">Name / Title</label>
          <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Gaura Purnima 2026" />
        </div>

        <div className="form-group">
          <label className="form-label">Content Type</label>
          <select className="form-select" value={contentType} onChange={e=>setContentType(e.target.value)}>
            <option value="wallpaper">🖼️ Wallpaper (General)</option>
            <option value="darshan">🌅 Daily Darshan</option>
            <option value="event">📅 Festival / Event</option>
            <option value="sponsor">💼 Sponsor Banner</option>
          </select>
        </div>

        {/* Cascading category dropdowns */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <label className="form-label">Category</label>
            {creatingLevel !== 0 && <button className="btn btn-sm" style={{ padding: 0, color: 'var(--accent)', background: 'none' }} onClick={() => { setCreatingLevel(0); setNewCatName(''); }}>+ Add New</button>}
          </div>
          {creatingLevel === 0 ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="form-input" autoFocus placeholder="New Category" value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateCategory(null)} />
              <button className="btn btn-sm btn-primary" onClick={() => handleCreateCategory(null)}>✓</button>
              <button className="btn btn-sm btn-secondary" onClick={() => setCreatingLevel(null)}>✕</button>
            </div>
          ) : (
            <select className="form-select" value={selRoot} onChange={e=>handleRootChange(e.target.value)}>
              <option value="">— Select primary —</option>
              {rootCats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {(selRoot || creatingLevel === 1) && (
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <label className="form-label">Sub-Category</label>
              {creatingLevel !== 1 && selRoot && <button className="btn btn-sm" style={{ padding: 0, color: 'var(--accent)', background: 'none' }} onClick={() => { setCreatingLevel(1); setNewCatName(''); }}>+ Add New</button>}
            </div>
            {creatingLevel === 1 ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="form-input" autoFocus placeholder="New Sub-Category" value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateCategory(selRoot)} />
                <button className="btn btn-sm btn-primary" onClick={() => handleCreateCategory(selRoot)}>✓</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setCreatingLevel(null)}>✕</button>
              </div>
            ) : (
              <select className="form-select" value={selSub} onChange={e=>handleSubChange(e.target.value)}>
                <option value="">— Select sub —</option>
                {subCats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        )}

        {(selSub || creatingLevel === 2) && (
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <label className="form-label">Sub-Sub-Category</label>
              {creatingLevel !== 2 && selSub && <button className="btn btn-sm" style={{ padding: 0, color: 'var(--accent)', background: 'none' }} onClick={() => { setCreatingLevel(2); setNewCatName(''); }}>+ Add New</button>}
            </div>
            {creatingLevel === 2 ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="form-input" autoFocus placeholder="New Sub-Sub-Category" value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateCategory(selSub)} />
                <button className="btn btn-sm btn-primary" onClick={() => handleCreateCategory(selSub)}>✓</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setCreatingLevel(null)}>✕</button>
              </div>
            ) : (
              <select className="form-select" onChange={e=>handleSubSubChange(e.target.value)}>
                <option value="">— Select sub-sub —</option>
                {subSubCats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Date fields — shown when relevant */}
        {(needsDate || contentType === 'event') && (
          <div className="form-group">
            <label className="form-label">Visible Date {needsDate && <span style={{color:'var(--danger)'}}>*</span>}</label>
            <input type="date" className="form-input" value={visibleDate} onChange={e=>setVisibleDate(e.target.value)} />
            <span style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>Content becomes visible on this date</span>
          </div>
        )}

        {contentType === 'event' && (
          <div className="form-group">
            <label className="form-label">Expires On</label>
            <input type="date" className="form-input" value={expiresOn} onChange={e=>setExpiresOn(e.target.value)} />
            <span style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>Leave empty = don&apos;t auto-expire</span>
          </div>
        )}

        <div className="toggle-wrap">
          <div className={`toggle ${isSponsor ? 'on' : ''}`} onClick={()=>setIsSponsor(!isSponsor)} />
          <span className="toggle-label">Mark as Sponsor Ad</span>
        </div>

        <hr className="divider" />

        <button
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={isUploading || files.length === 0}
          style={{ justifyContent:'center' }}
        >
          {isUploading ? <><span className="spinner" /> Uploading…</> : `⬆️ Upload ${files.length > 0 ? files.length : ''} Image${files.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
