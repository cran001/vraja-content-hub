"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed.');
      login(data.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: '20px',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top:'-20%', left:'50%', transform:'translateX(-50%)',
        width: '600px', height: '600px',
        background: 'radial-gradient(ellipse, rgba(124,106,247,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ fontSize:'3rem', marginBottom:'12px' }}>🕌</div>
          <h1 style={{
            fontSize: '1.4rem', fontWeight: 800,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Vraja Realm
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Content Hub Admin Panel
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email" type="email" required
              className="form-input"
              placeholder="admin@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password" type="password" required
              className="form-input"
              placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.85rem',
              color: 'var(--danger)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ justifyContent:'center', padding:'12px', marginTop:'4px' }}
          >
            {loading ? <><span className="spinner" /> Signing in…</> : 'Sign In →'}
          </button>
        </form>
      </div>
    </main>
  );
}
