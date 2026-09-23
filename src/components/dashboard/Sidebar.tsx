"use client";

import { useState, useEffect } from 'react';

interface NavItem {
  id: string;
  icon: string;
  label: string;
}

interface NavGroup {
  id: string;
  icon: string;
  label: string;
  children: NavItem[];
}

// Each content type gets its own collapsible section so nothing mixes together.
const NAV_GROUPS: NavGroup[] = [
  { id: 'editorial', icon: '📝', label: 'Editorial', children: [
    { id: 'readiness', icon: '✓', label: 'Readiness' },
    { id: 'publishing', icon: '📝', label: 'Publishing' },
    { id: 'contributions', icon: '📥', label: 'Contributions' },
    { id: 'quotes', icon: '💬', label: 'Quotes / Reflections' },
  ] },
  {
    id: 'stories', icon: '📖', label: 'Stories',
    children: [
      { id: 'books',    icon: '📚', label: 'Books Library' },
      { id: 'story-feed', icon: '📖', label: 'Katha Feed' },
      { id: 'add-book', icon: '➕', label: 'Add New Book'  },
    ],
  },
  {
    id: 'calendar', icon: '📅', label: 'Calendar',
    children: [
      { id: 'dated-events',     icon: '🗓️', label: 'Dated Events'     },
      { id: 'calendar-uploads', icon: '🗓️', label: 'Calendar Manager' },
      { id: 'panchang-preview', icon: '🌙', label: 'Panchang Preview'  },
    ],
  },
  {
    id: 'scriptures', icon: '📜', label: 'Scriptures',
    children: [
      { id: 'scriptures', icon: '📜', label: 'Scripture Library' },
      { id: 'daily-verses', icon: '🪷', label: 'Daily Verses' },
    ],
  },
  {
    id: 'wallpapers', icon: '🖼️', label: 'Wallpapers',
    children: [
      { id: 'gallery',    icon: '🗂️', label: 'Gallery'          },
      { id: 'upload',     icon: '⬆️', label: 'Bulk Upload'      },
      { id: 'darshan',    icon: '🌅', label: 'Daily Darshan'    },
      { id: 'events',     icon: '📅', label: 'Festival Artwork' },
      { id: 'sponsors',   icon: '💼', label: 'Sponsorships'     },
      { id: 'categories', icon: '🏷️', label: 'Categories'       },
    ],
  },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  userEmail?: string;
  communityOnly?: boolean;
}

export default function Sidebar({ activeTab, onTabChange, onLogout, userEmail, communityOnly }: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<string[]>(['stories']);

  // Opening a tab always reveals its section
  useEffect(() => {
    const group = NAV_GROUPS.find(g => g.children.some(c => c.id === activeTab));
    if (group) {
      setOpenGroups(prev => prev.includes(group.id) ? prev : [...prev, group.id]);
    }
  }, [activeTab]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>🕌 Vraja Realm</h1>
        <p>Content Hub Admin</p>
      </div>

      <nav className="sidebar-nav">
        {(communityOnly ? [{ id: 'contributor', icon: '📝', label: 'Editorial', children: [{ id: 'contributions', icon: '📥', label: 'My contributions' }] }] : NAV_GROUPS).map(group => {
          const isOpen = openGroups.includes(group.id);
          return (
            <div key={group.id} className={`nav-group ${isOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="nav-group-header"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
              >
                <span className="nav-group-chevron">▸</span>
                <span className="nav-icon">{group.icon}</span>
                {group.label}
              </button>

              {isOpen && (
                <div className="nav-sublist">
                  {group.children.map(item => (
                    <button
                      type="button"
                      key={item.id}
                      className={`nav-subitem ${activeTab === item.id ? 'active' : ''}`}
                      onClick={() => onTabChange(item.id)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
