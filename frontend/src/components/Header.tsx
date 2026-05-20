import React from 'react';
import { Wallet, Bell, Search, User } from 'lucide-react';
import { useXlmToPhp } from '../hooks/useXlmToPhp';

interface HeaderProps {
  walletAddress: string;
  balance: number;
  onConnect: () => void;
  onDisconnect: () => void;
}

const Header: React.FC<HeaderProps> = ({ walletAddress, balance, onConnect, onDisconnect }) => {
  const { formatPhp } = useXlmToPhp();
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <header className="header">
      <div className="header-search">
        <Search size={18} className="search-icon" />
        <input type="text" placeholder="Search policies, regions, or alerts..." />
      </div>

      <div className="header-actions">
        <div className="balance-display glass flex flex-col items-end justify-center py-1 px-3">
          <div className="flex items-center gap-1">
            <span className="balance-label text-xs">XLM</span>
            <span className="balance-value text-sm font-bold text-white">{balance.toLocaleString()} XLM</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5 leading-none">{formatPhp(balance)}</span>
        </div>

        <button className="notification-btn glass">
          <Bell size={20} />
          <span className="notification-badge" />
        </button>

        {!walletAddress ? (
          <button className="connect-btn pulse-button" onClick={onConnect}>
            <Wallet size={18} />
            <span>Connect Wallet</span>
          </button>
        ) : (
          <button 
            className="user-profile-btn glass hover:bg-rose-500/10 transition-colors group"
            onClick={onDisconnect}
            title="Disconnect Wallet"
          >
            <span className="address-text group-hover:text-rose-400">{formatAddress(walletAddress)}</span>
            <div className="user-avatar-mini group-hover:bg-rose-500/20 group-hover:text-rose-400">
              <User size={16} />
            </div>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
