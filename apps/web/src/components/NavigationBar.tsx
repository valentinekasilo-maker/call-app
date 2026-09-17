import React from 'react';
import { Star, Clock, User, Phone } from 'lucide-react';

export type ActiveTab = 'favorites' | 'history' | 'contacts' | 'keypad';

interface NavigationBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  badgeCounts?: {
    history?: number;
  };
}

export const NavigationBar: React.FC<NavigationBarProps> = ({
  activeTab,
  onTabChange,
  badgeCounts,
}) => {
  const tabs = [
    {
      id: 'favorites' as ActiveTab,
      label: 'Favorites',
      icon: Star,
    },
    {
      id: 'history' as ActiveTab,
      label: 'Recents',
      icon: Clock,
      badge: badgeCounts?.history,
    },
    {
      id: 'contacts' as ActiveTab,
      label: 'Contacts',
      icon: User,
    },
    {
      id: 'keypad' as ActiveTab,
      label: 'Keypad',
      icon: Phone,
    },
  ];

  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        backgroundColor: 'var(--nav-bar-bg)',
        backdropFilter: 'blur(28px) saturate(190%)',
        WebkitBackdropFilter: 'blur(28px) saturate(190%)',
        borderTop: '1px solid var(--nav-bar-border)',
        padding: '6px 12px 14px 12px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 50,
      }}
    >
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const IconComponent = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '4px 0',
              color: isActive ? 'var(--nav-tab-active)' : 'var(--nav-tab-inactive)',
              position: 'relative',
              transition: 'color 0.15s ease',
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconComponent
                size={22}
                strokeWidth={isActive ? 2.3 : 1.8}
                fill={isActive && (tab.id === 'favorites' || tab.id === 'keypad') ? 'currentColor' : 'none'}
              />
              {tab.badge && tab.badge > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    minWidth: '16px',
                    height: '16px',
                    padding: '0 4px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--accent-hangup)',
                    color: '#FFFFFF',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: isActive ? 600 : 500,
                letterSpacing: '-0.01em',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
