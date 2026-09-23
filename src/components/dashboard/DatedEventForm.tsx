"use client";

import { useMemo, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { uploadKey } from '@/lib/uploadKey';
import {
  EVENT_TYPES,
  defaultParanaDate,
  validateDatedEvent,
  type DatedEventInput,
} from '@/lib/datedEvents';
import type { DatedEventRowUi } from './DatedEventsManager';

type ParanaMode = 'none' | 'window' | 'after';

interface DatedEventFormProps {
  event: DatedEventRowUi | null;
  onSaved: () => void;
  onCancel: () => void;
}

/** Reads the stored parana shape back into the editor's three-way choice. */
function paranaModeOf(event: DatedEventRowUi | null): ParanaMode {
  if (!event?.parana_start_time) return 'none';
  if (event.parana_type === 'after' || !event.parana_end_time) return 'after';
  return 'window';
}

/** Exactly what the Android app will render for this timing — see HomeScreen's event card. */
function paranaPreview(mode: ParanaMode, start: string, end: string): string {
  if (mode === 'none' || !start) return 'No parana timing on this event.';
  if (mode === 'after') return `Parana after ${start}`;
  if (!end) return 'Incomplete — a window needs an end time.';
  return `Parana: ${start} – ${end}`;
}

export default function DatedEventForm({ event, onSaved, onCancel }: DatedEventFormProps) {
  const { showToast } = useToast();

  const [title, setTitle]                 = useState(event?.title ?? '');
  const [titleHi, setTitleHi]             = useState(event?.title_hi ?? '');
  const [eventType, setEventType]         = useState(event?.event_type ?? '');
  const [date, setDate]                   = useState(event?.event_date ?? '');
  const [description, setDescription]     = useState(event?.description ?? '');
  const [fasting, setFasting]             = useState(event?.fasting_guidelines ?? '');
  const [timeSlot, setTimeSlot]           = useState(event?.time_slot ?? '');
  const [detailsUrl, setDetailsUrl]       = useState(event?.details_url ?? '');
  const [timingZone,setTimingZone] = useState(event?.timing_timezone ?? '');
  const [timingLocation,setTimingLocation] = useState(event?.timing_location ?? '');
  const [timingSource,setTimingSource] = useState(event?.timing_source ?? '');
  const [applicability,setApplicability] = useState(event?.applicability ?? 'global');
  const [scopeKey,setScopeKey] = useState(event?.scope_key ?? '');
  const [isMajor, setIsMajor]             = useState(event?.is_major_event === true);
  const [isActive, setIsActive]           = useState(event ? event.is_active !== false : false);

  const [paranaMode, setParanaMode]       = useState<ParanaMode>(paranaModeOf(event));
  const [paranaStart, setParanaStart]     = useState(event?.parana_start_time ?? '');
  const [paranaEnd, setParanaEnd]         = useState(event?.parana_end_time ?? '');
  const [paranaDate, setParanaDate]       = useState(event?.parana_date ?? '');
  // Until the editor edits it themselves, the parana date follows the fast date + 1.
  const [paranaDateTouched, setParanaDateTouched] = useState(Boolean(event?.parana_date));

  const [image, setImage]                 = useState<File | null>(null);
  const [imagePreview, setImagePreview]   = useState<string | null>(null);
  const [removeImage, setRemoveImage]     = useState(false);
  const [errors, setErrors]               = useState<string[]>([]);
  const [saving, setSaving]               = useState(false);

  const effectiveParanaDate = paranaDateTouched && paranaDate
    ? paranaDate
    : date ? defaultParanaDate(date) : '';

  const input: DatedEventInput = useMemo(() => ({
    title,
    titleHi,
    eventType,
    date,
    description,
    fastingGuidelines: fasting,
    timeSlot,
    detailsUrl,
    paranaType: paranaMode,
    paranaDate: paranaMode === 'none' ? null : effectiveParanaDate,
    paranaStartTime: paranaMode === 'none' ? null : paranaStart,
    paranaEndTime: paranaMode === 'window' ? paranaEnd : null,
    isMajorEvent: isMajor,
    isActive,
  }), [
    title, titleHi, eventType, date, description, fasting, timeSlot, detailsUrl,
    paranaMode, effectiveParanaDate, paranaStart, paranaEnd, isMajor, isActive,
  ]);

  const handleImage = (file: File | null) => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
    if (file) setRemoveImage(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // The same validator the API runs, so the form cannot submit a shape the API would reject.
    const validated = validateDatedEvent(input);
    if (!validated.ok) {
      setErrors(validated.errors);
      showToast(validated.errors[0], 'error');
      return;
    }
    setErrors([]);
    const value = validated.value;

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('timing_timezone',timingZone);
      fd.append('timing_location',timingLocation);
      fd.append('timing_source',timingSource);
      fd.append('applicability',applicability);
      fd.append('scope_key',scopeKey);
      if (event) fd.append('id', event.id);
      fd.append('title', value.title);
      if (value.titleHi) fd.append('title_hi', value.titleHi);
      fd.append('event_type', value.eventType);
      fd.append('date', value.date);
      fd.append('description', value.description);
      if (value.fastingGuidelines) fd.append('fasting_guidelines', value.fastingGuidelines);
      if (value.timeSlot) fd.append('time_slot', value.timeSlot);
      if (value.detailsUrl) fd.append('details_url', value.detailsUrl);

      // Parana travels as a complete set or as an explicit clear — never half of one.
      fd.append('parana_type', value.paranaType ?? 'none');
      if (value.paranaStartTime && value.paranaDate) {
        fd.append('parana_date', value.paranaDate);
        fd.append('parana_start_time', value.paranaStartTime);
        if (value.paranaEndTime) fd.append('parana_end_time', value.paranaEndTime);
      }

      fd.append('is_major_event', String(value.isMajorEvent));
      fd.append('is_active', String(value.isActive));
      if (image) fd.append('image', image);
      if (removeImage && !image) fd.append('remove_image', 'true');

      const res = await fetch('/api/admin/dated-events', {
        method: event ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}`, ...(image ? {'Idempotency-Key':uploadKey(image,fd)}:{}) },
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data?.errors)) setErrors(data.errors);
        throw new Error(data?.message ?? 'Failed to save the event.');
      }

      showToast(event ? 'Event updated.' : 'Event created.');
      onSaved();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save the event.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const existingImage = removeImage ? null : event?.image_url ?? null;

  return (
    <form className="card" onSubmit={handleSubmit} style={{ maxWidth: '760px' }}>
      <div className="toolbar" style={{ marginBottom: '4px' }}>
        <h3 className="card-title" style={{ marginBottom: 0 }}>
          {event ? 'Edit Event' : 'New Dated Event'}
        </h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
          ← Back to list
        </button>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0 20px' }}>
        Served to the app by <code>/api/v1/events/dated</code>. Hidden events are withheld from
        the feed entirely.
      </p>

      {errors.length > 0 && (
        <div
          className="card"
          style={{ borderColor: 'rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.08)', marginBottom: '18px' }}
        >
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: 'var(--danger)' }}>
            {errors.map((message, index) => <li key={index}>{message}</li>)}
          </ul>
        </div>
      )}

      <div className="grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="event-date">Date *</label>
          <input
            id="event-date"
            className="form-input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="event-type">Type *</label>
          <select
            id="event-type"
            className="form-select"
            value={eventType}
            onChange={e => setEventType(e.target.value)}
          >
            <option value="">— Choose a type —</option>
            {EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: '16px' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="event-title">Title *</label>
          <input
            id="event-title"
            className="form-input"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Nrsimha Caturdasi"
            maxLength={255}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="event-title-hi">Hindi title</label>
          <input
            id="event-title-hi"
            className="form-input"
            type="text"
            value={titleHi}
            onChange={e => setTitleHi(e.target.value)}
            placeholder="e.g. नृसिंह चतुर्दशी"
            maxLength={255}
          />
        </div>
      </div>

        <div className="card" style={{marginTop:16}}><h3>Applicability and timing source</h3><p>Hub clock times require a location and timezone. Other locations use the Android calculation source.</p>
          <label className="form-group">Applicability<select className="form-select" value={applicability} onChange={e=>setApplicability(e.target.value)}>{['global','tradition','region','location'].map(v=><option key={v}>{v}</option>)}</select></label>
          <label className="form-group">Scope key<input className="form-input" value={scopeKey} onChange={e=>setScopeKey(e.target.value)}/></label>
          <label className="form-group">Timing location key<input className="form-input" placeholder="e.g. in-mumbai" value={timingLocation} onChange={e=>setTimingLocation(e.target.value)}/></label>
          <label className="form-group">IANA timezone<input className="form-input" placeholder="e.g. Asia/Kolkata" value={timingZone} onChange={e=>setTimingZone(e.target.value)}/></label>
          <label className="form-group">Timing source<textarea className="form-textarea" value={timingSource} onChange={e=>setTimingSource(e.target.value)}/></label>
        </div>
        <div className="form-group" style={{ marginTop: '16px' }}>
        <label className="form-label" htmlFor="event-description">Description</label>
        <textarea
          id="event-description"
          className="form-textarea"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What the day commemorates, shown on the event detail screen"
          rows={4}
        />
      </div>

      <div className="form-group" style={{ marginTop: '16px' }}>
        <label className="form-label" htmlFor="event-fasting">Fasting guidelines</label>
        <textarea
          id="event-fasting"
          className="form-textarea"
          value={fasting}
          onChange={e => setFasting(e.target.value)}
          placeholder="e.g. Fast from grains and beans until sunset."
          rows={3}
        />
      </div>

      <hr className="divider" />

      {/* ── Parana ───────────────────────────────────────── */}
      <h4 className="card-title" style={{ marginBottom: '4px' }}>Parana — breaking the fast</h4>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
        A window needs both times. Choose <strong>after a time</strong> for the boundary case where
        Hari Vasara ends past one-third of daylight, so the fast may only be broken past that
        moment — the app then shows &ldquo;Parana after 10:50&rdquo; with no closing time.
      </p>

      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {([
          ['none',   'No parana timing'],
          ['window', 'Window (start and end)'],
          ['after',  'After a time (no end)'],
        ] as [ParanaMode, string][]).map(([mode, label]) => (
          <label
            key={mode}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.87rem', cursor: 'pointer' }}
          >
            <input
              type="radio"
              name="parana-mode"
              value={mode}
              checked={paranaMode === mode}
              onChange={() => setParanaMode(mode)}
            />
            {label}
          </label>
        ))}
      </div>

      {paranaMode !== 'none' && (
        <>
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label" htmlFor="parana-date">
                Parana date{' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>
                  (day after the fast)
                </span>
              </label>
              <input
                id="parana-date"
                className="form-input"
                type="date"
                value={effectiveParanaDate}
                onChange={e => { setParanaDate(e.target.value); setParanaDateTouched(true); }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="parana-start">
                {paranaMode === 'after' ? 'Break fast after *' : 'Start time *'}
              </label>
              <input
                id="parana-start"
                className="form-input"
                type="time"
                value={paranaStart}
                onChange={e => setParanaStart(e.target.value)}
              />
            </div>

            {paranaMode === 'window' && (
              <div className="form-group">
                <label className="form-label" htmlFor="parana-end">End time *</label>
                <input
                  id="parana-end"
                  className="form-input"
                  type="time"
                  value={paranaEnd}
                  onChange={e => setParanaEnd(e.target.value)}
                />
              </div>
            )}
          </div>

          <p style={{ fontSize: '0.85rem', marginTop: '12px' }}>
            <span className="badge badge-wallpaper">In the app</span>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>
              {paranaPreview(paranaMode, paranaStart, paranaEnd)}
            </span>
          </p>
        </>
      )}

      <hr className="divider" />

      <div className="grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="event-time-slot">Time slot</label>
          <input
            id="event-time-slot"
            className="form-input"
            type="text"
            value={timeSlot}
            onChange={e => setTimeSlot(e.target.value)}
            placeholder="e.g. Sunrise – 08:30"
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="event-details-url">Details URL</label>
          <input
            id="event-details-url"
            className="form-input"
            type="url"
            value={detailsUrl}
            onChange={e => setDetailsUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>

      <div className="form-group" style={{ marginTop: '16px' }}>
        <span className="form-label">Banner image</span>
        <div className="drop-zone" onClick={() => document.getElementById('event-image-input')?.click()}>
          {imagePreview || existingImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreview ?? existingImage ?? ''}
              alt="Event banner"
              style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }}
            />
          ) : (
            <>
              <div className="drop-zone-icon">🖼️</div>
              <div className="drop-zone-text">Click to choose a banner</div>
              <div className="drop-zone-hint">Optional — shown on the event card and detail screen</div>
            </>
          )}
        </div>
        <input
          id="event-image-input"
          type="file"
          accept="image/*"
          hidden
          onChange={e => handleImage(e.target.files?.[0] ?? null)}
        />
        {(image || existingImage) && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: '8px', alignSelf: 'flex-start' }}
            onClick={() => { handleImage(null); if (event?.image_url) setRemoveImage(true); }}
          >
            ✕ Remove image
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '26px', flexWrap: 'wrap', marginTop: '20px' }}>
        <div className="toggle-wrap" onClick={() => setIsMajor(!isMajor)} role="presentation">
          <div className={`toggle ${isMajor ? 'on' : ''}`} />
          <span className="toggle-label">Major event</span>
        </div>
        <div className="toggle-wrap" onClick={() => setIsActive(!isActive)} role="presentation">
          <div className={`toggle ${isActive ? 'on' : ''}`} />
          <span className="toggle-label">{isActive ? 'Live in the app' : 'Hidden'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : event ? '💾 Save Event' : '➕ Create Event'}
        </button>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
