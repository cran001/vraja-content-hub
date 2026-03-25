"use client";

interface NavItem {
  id: string;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'gallery',   icon: '🖼️',  label: 'Gallery'          },
  { id: 'upload',    icon: '⬆️',  label: 'Bulk Upload'      },
  { id: 'darshan',   icon: '🌅',  label: 'Daily Darshan'    },
  { id: 'events',    icon: '📅',  label: 'Events Scheduler' },
  { id: 'sponsors',  icon: '💼',  label: 'Sponsorships'     },
  { id: 'categories',icon: '🗂️', label: 'Categories'       },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  userEmail?: string;
}

export default function Sidebar({ activeTab, onTabChange, onLogout, userEmail }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>🕌 Vraja Realm</h1>
        <p>Content Hub Admin</p>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {userEmail && (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '10px', padding: '0 4px', wordBreak: 'break-all' }}>
            {userEmail}
          </p>
        )}
        <button className="logout-btn" onClick={onLogout}>
          <span>🚪</span> Logout
        </button>
      </div>
    </aside>
  );
}
