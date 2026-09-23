"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import DatedEventForm from './DatedEventForm';

/** A `dated_events` row as the admin API returns it — dates and times already formatted. */
export interface DatedEventRowUi {
  id: string;
  title: string;
  title_hi: string | null;
  event_type: string;
  event_date: string;
  description: string | null;
  fasting_guidelines: string | null;
  parana_date: string | null;
  parana_start_time: string | null;
  parana_end_time: string | null;
  parana_type: string | null;
  time_slot: string | null;
  is_major_event: boolean;
  is_active: boolean;
  image_url: string | null;
  details_url: string | null;
  timing_timezone?: string | null;
  timing_location?: string | null;
  timing_source?: string | null;
  applicability?: string;
  scope_key?: string | null;
}

const BADGE_BY_TYPE: Record<string, string> = {
  Festival: 'badge-event',
  Ekadashi: 'badge-wallpaper',
  Appearance: 'badge-sponsor',
  Disappearance: 'badge-darshan',
  Parana: 'badge-wallpaper',
  'Special Observance': 'badge-event',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats yyyy-MM-dd for display without going through Date, so the day can never shift. */
function displayDate(iso: string): { day: string; month: string; year: string } {
  const [year, month, day] = (iso ?? '').split('-');
  return {
    day: day ?? '—',
    month: MONTHS[Number(month) - 1] ?? '',
    year: year ?? '',
  };
}

/** The line the app will show for this row's timing. */
function paranaSummary(event: DatedEventRowUi): string | null {
  if (!event.parana_start_time) return null;
  if (event.parana_end_time) return `Parana ${event.parana_start_time} – ${event.parana_end_time}`;
  if (event.parana_type === 'after') return `Parana after ${event.parana_start_time}`;
  return 'Parana timing incomplete';
}

export default function DatedEventsManager() {
  const { showToast } = useToast();

  const [events, setEvents]   = useState<DatedEventRowUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DatedEventRowUi | null | 'new'>(null);
  const [busyId, setBusyId]   = useState<string | null>(null);
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const suffix = params.toString() ? `?${params}` : '';
      const res = await fetch(`/api/admin/dated-events${suffix}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (!res.ok) throw new Error();
      setEvents((await res.json()).items);
    } catch {
      showToast('Failed to load events.', 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to, showToast]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const liveCount = useMemo(() => events.filter(e => e.is_active).length, [events]);

  const toggleActive = async (event: DatedEventRowUi) => {
    setBusyId(event.id);
    const next = !event.is_active;
    setEvents(prev => prev.map(e => (e.id === event.id ? { ...e, is_active: next } : e)));
    try {
      const res = await fetch('/api/admin/dated-events', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: event.id, is_active: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setEvents(prev => prev.map(e => (e.id === event.id ? { ...e, is_active: event.is_active } : e)));
      showToast('Failed to update the event.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (event: DatedEventRowUi) => {
    if (!confirm(`Delete "${event.title}" (${event.event_date})? This cannot be undone.`)) return;
    setBusyId(event.id);
    try {
      const res = await fetch(`/api/admin/dated-events?id=${event.id}&confirm=${event.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (!res.ok) throw new Error();
      setEvents(prev => prev.filter(e => e.id !== event.id));
      showToast('Event deleted.');
    } catch {
      showToast('Failed to delete the event.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (editing) {
    return (
      <DatedEventForm
        event={editing === 'new' ? null : editing}
        onSaved={() => { setEditing(null); loadEvents(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div className="toolbar">
        <span className="toolbar-count">
          {events.length} event{events.length === 1 ? '' : 's'} · {liveCount} live
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            style={{ width: '158px' }}
            aria-label="From date"
          />
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <input
            className="form-input"
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            style={{ width: '158px' }}
            aria-label="To date"
          />
          {(from || to) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setFrom(''); setTo(''); }}>
              Clear
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setEditing('new')}>➕ Add Event</button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : events.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🗓️</div>
            <p className="empty-text">
              No dated events {from || to ? 'in this range' : 'yet'} — add the first festival or
              Ekadashi.
            </p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setEditing('new')}>
              ➕ Add Event
            </button>
          </div>
        </div>
      ) : (
        <div>
          {events.map(event => {
            const parts = displayDate(event.event_date);
            const parana = paranaSummary(event);
            return (
              <div key={event.id} className="event-row">
                <div className="event-row-date">
                  <span className="event-row-day">{parts.day}</span>
                  <span className="event-row-month">{parts.month}</span>
                  <span className="event-row-year">{parts.year}</span>
                </div>

                <div className="event-row-body">
                  <div className="event-row-title">
                    {event.is_major_event && <span title="Major event">★ </span>}
                    {event.title}
                    {event.title_hi && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {event.title_hi}</span>
                    )}
                  </div>
                  <div className="img-card-meta" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <span className={`badge ${BADGE_BY_TYPE[event.event_type] ?? 'badge-event'}`}>
                      {event.event_type}
                    </span>
                    <span className={`badge ${event.is_active ? 'badge-sponsor' : 'badge-darshan'}`}>
                      {event.is_active ? 'Live' : 'Hidden'}
                    </span>
                    {event.fasting_guidelines && <span className="badge badge-darshan">Fasting</span>}
                    {parana && (
                      <span
                        className={`badge ${parana === 'Parana timing incomplete' ? 'badge-darshan' : 'badge-wallpaper'}`}
                      >
                        {parana}
                        {event.parana_date && event.parana_date !== event.event_date
                          ? ` (${displayDate(event.parana_date).day} ${displayDate(event.parana_date).month})`
                          : ''}
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p
                      style={{
                        fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '8px',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}
                    >
                      {event.description}
                    </p>
                  )}
                </div>

                <div className="page-row-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => setEditing(event)}>✏️ Edit</button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => toggleActive(event)}
                    disabled={busyId === event.id}
                  >
                    {event.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(event)}
                    disabled={busyId === event.id}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
