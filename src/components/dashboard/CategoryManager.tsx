"use client";

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';

interface Category { id: string; name: string; parent_id: string | null; level: number; slug: string; is_active?:boolean; is_selectable?:boolean; sort_order?:number; }

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
  const [dependencyReport,setDependencyReport]=useState<unknown>(null);

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
    if (!confirm('Delete this category only if it is an empty leaf? Child categories and referenced media must be resolved first.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/categories?id=${id}&confirm=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data=await res.json();
      if (!res.ok) {setDependencyReport(data.details??data);throw new Error(data.message);}
      setDependencyReport(null);
      showToast('Category deleted.', 'info');
      onCategoriesChange();
    } catch(error) { showToast(error instanceof Error?error.message:'Delete failed.', 'error'); }
    finally { setDeletingId(null); }
  };

  const update=async(id:string,patch:Record<string,unknown>)=>{
    try{
      const res=await fetch('/api/admin/categories',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({id,...patch})});
      const data=await res.json();if(!res.ok)throw new Error(data.message);
      onCategoriesChange();showToast('Category updated.');
    }catch(error){showToast(String(error),'error');}
  };

  const levelPrefix = (level: number) => '└─ '.repeat(level);
  const levelColors = ['var(--accent)','var(--accent-2)','var(--success)','var(--text-secondary)'];

  return (
    <div className="editorial-grid">
      {/* Tree */}
      <div>
        <h3 className="card-title">Category Tree</h3>
        <p>Inactive ancestors hide their descendants’ artwork. Counts include the full subtree; empty categories remain visible.</p>
        {dependencyReport!=null&&<pre role="alert" className="editorial-json">{JSON.stringify(dependencyReport,null,2)}</pre>}
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
                <label><input type="checkbox" checked={cat.is_active??true} onChange={e=>void update(cat.id,{is_active:e.target.checked})}/> Active</label>
                <label><input type="checkbox" checked={cat.is_selectable??true} onChange={e=>void update(cat.id,{is_selectable:e.target.checked})}/> Selectable</label>
                <label>Order <input key={`${cat.id}-${cat.sort_order}`} aria-label={`Sort order for ${cat.name}`} type="number" style={{width:65}} defaultValue={cat.sort_order??0} onBlur={e=>{const value=Number(e.target.value);if(value!==(cat.sort_order??0))void update(cat.id,{sort_order:value});}}/></label>
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
