export default function CalendarPlaceholder() {
  return (
    <div className="card">
      <div className="empty-state" style={{ padding: '80px 20px' }}>
        <div className="empty-icon">📅</div>
        <p className="empty-text">Calendar uploads are coming soon.</p>
        <p style={{
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          maxWidth: '440px',
          margin: '10px auto 0',
          lineHeight: 1.6,
        }}>
          This space is reserved for festival dates, ekadashi schedules and observance
          content. The format is still being decided — nothing else will be mixed in here.
        </p>
      </div>
    </div>
  );
}
