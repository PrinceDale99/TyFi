import React from 'react';
import { 
  Home, 
  Shield, 
  Zap, 
  Activity, 
  Map as MapIcon, 
  FileText, 
  Settings, 
  HelpCircle,
  Award
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home size={20} /> },
    { id: 'policies', label: 'My Policies', icon: <Shield size={20} /> },
    { id: 'monitoring', label: 'Live Monitor', icon: <Zap size={20} /> },
    { id: 'claims', label: 'Damage Scan', icon: <Activity size={20} /> },
    { id: 'map', label: 'Risk Map', icon: <MapIcon size={20} /> },
    { id: 'vault', label: 'Vault', icon: <FileText size={20} /> },
  ];

  const secondaryItems = [
    { id: 'rewards', label: 'Rewards', icon: <Award size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
    { id: 'help', label: 'Support', icon: <HelpCircle size={20} /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">V</div>
        <span className="logo-text">VAULT</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <span className="nav-label">Main Menu</span>
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
              {activeTab === item.id && <div className="nav-indicator" />}
            </button>
          ))}
        </div>

        <div className="nav-section">
          <span className="nav-label">Account</span>
          {secondaryItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="user-status">
          <div className="status-dot online" />
          <span>System Online</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
