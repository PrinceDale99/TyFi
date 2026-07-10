import re

with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the layout
pattern = re.compile(r'  return \(\n    <div className="min-h-screen bg-\[#020617\] text-slate-200 selection:bg-sky-500/30 relative">.*?<main className="pt-24 pb-12 px-4 max-w-7xl mx-auto">', re.DOTALL)

new_layout = """  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 selection:bg-sky-500/30 relative overflow-hidden">
      {/* Dynamic Ambient Background Mesh */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMSIvPjwvc3ZnPg==')] opacity-[0.03]"></div>
        <div className={`absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full mix-blend-screen filter blur-[150px] opacity-30 animate-pulse ${
          isMainnet ? 'bg-emerald-900/40' : 'bg-indigo-900/40'
        }`}></div>
        <div className={`absolute top-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen filter blur-[150px] opacity-20 ${
          isMainnet ? 'bg-teal-900/30' : 'bg-sky-900/30'
        }`}></div>
        <div className={`absolute -bottom-[20%] left-[20%] w-[80vw] h-[80vw] rounded-full mix-blend-screen filter blur-[150px] opacity-30 ${
          isMainnet ? 'bg-green-900/20' : 'bg-blue-900/20'
        }`}></div>
      </div>

      {/* Floating Glassmorphic Sidebar (Desktop) */}
      <nav className="hidden md:flex flex-col w-72 h-[calc(100vh-2rem)] m-4 rounded-3xl border border-white/10 bg-slate-950/40 backdrop-blur-3xl shadow-2xl relative z-50 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-colors duration-700 ${
              isMainnet ? 'bg-emerald-500 shadow-emerald-500/20' : isTestnet ? 'bg-sky-500 shadow-sky-500/20' : 'bg-indigo-500 shadow-indigo-500/20'
            }`}>
              <img src="/logo.svg" alt="TyFi Logo" className="w-7 h-7" />
            </div>
            <div>
              <div className="text-lg font-black text-white tracking-tighter uppercase italic">TyFi</div>
              <div className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-700 ${
                isMainnet ? 'text-emerald-400' : isTestnet ? 'text-sky-400' : 'text-indigo-400'
              }`}>
                {isMainnet ? 'Mainnet Live' : 'Testnet Sandbox'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center bg-white/5 p-1 rounded-full border border-white/5 gap-1 select-none w-full">
            <button
              onClick={() => setNetwork('testnet')}
              className={`flex-1 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-full transition-all duration-300 ${
                network === 'testnet' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white'
              }`}
            >
              Testnet
            </button>
            <button
              onClick={() => setNetwork('mainnet')}
              className={`flex-1 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-full transition-all duration-300 ${
                network === 'mainnet' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mainnet
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          {(['monitor', 'history', 'calc', 'vault', 'marketplace', 'docs', 'payment'] as const)
            .filter(tab => {
              if (userRole === 'sponsor') {
                return ['marketplace', 'history', 'vault', 'docs'].includes(tab);
              }
              return true;
            })
            .map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === tab 
                  ? (isMainnet ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : isTestnet ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20') 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 space-y-3 relative">
          <button 
            onClick={() => setIsNotificationCenterOpen(!isNotificationCenterOpen)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all border border-transparent hover:bg-white/5 ${
              isNotificationCenterOpen 
                ? (isMainnet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400')
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Bell size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Alerts</span>
            </div>
            {notificationHistory.length > 0 && (
              <span className={`w-2 h-2 rounded-full ${
                notificationHistory[0]?.timestamp > Date.now() - 60000 ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'
              }`} />
            )}
          </button>

          {/* Notification Popover (Sidebar version) */}
          {isNotificationCenterOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotificationCenterOpen(false)}></div>
              <div className="absolute bottom-full left-0 mb-4 w-80 max-h-[400px] bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">Protocol Alerts</h4>
                  <button 
                    onClick={() => {
                      setNotificationHistory([]);
                      setIsNotificationCenterOpen(false);
                    }}
                    className="text-[10px] text-slate-500 hover:text-rose-400 font-bold uppercase transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="overflow-y-auto custom-scrollbar flex-1">
                  {notificationHistory.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <Bell size={32} className="mx-auto text-slate-800" />
                      <p className="text-xs text-slate-500 font-medium">No recent alerts or signals.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {notificationHistory.map((notif) => (
                        <div key={notif.id} className="p-4 hover:bg-white/5 transition-colors group">
                          <div className="flex gap-3">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              notif.type === 'success' ? 'bg-emerald-500' : 
                              notif.type === 'warning' ? 'bg-amber-500' : 'bg-sky-500'
                            }`} />
                            <div className="space-y-1">
                              <p className="text-xs text-slate-200 font-medium leading-relaxed">{notif.text}</p>
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">
                                {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className={`flex items-center gap-3 bg-white/5 px-3 py-2.5 rounded-2xl border transition-all cursor-pointer group hover:bg-white/10 ${
            isProfileDashboardOpen 
              ? (isMainnet ? 'border-emerald-500/30 ring-1 ring-emerald-500/20' : 'border-sky-500/30 ring-1 ring-sky-500/20')
              : 'border-white/5'
          }`} onClick={() => setIsProfileDashboardOpen(true)}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-700 ${
              isMainnet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'
            }`}>
              <Wallet size={16} />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-[10px] font-black text-white uppercase tracking-widest truncate">{userRole === 'sponsor' ? sponsorInfo?.name : userRole === 'farmer' ? profileForm.farmerName : 'Profile'}</div>
              <div className="text-[9px] font-mono text-slate-500 truncate">{formatAddress(walletAddress)}</div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 p-4">
        <div className="glass-panel border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-2xl">
           <div className="flex items-center gap-3">
             <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg ${
                isMainnet ? 'bg-emerald-500' : 'bg-sky-500'
              }`}>
                <img src="/logo.svg" alt="TyFi Logo" className="w-5 h-5" />
             </div>
             <div className="text-lg font-black text-white tracking-tighter uppercase italic">TyFi</div>
           </div>
           <div className="flex items-center gap-4">
             <button onClick={() => setIsNotificationCenterOpen(!isNotificationCenterOpen)} className="text-slate-400 hover:text-white relative">
               <Bell size={20} />
               {notificationHistory.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />}
             </button>
             <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-400 hover:text-white">
               <Menu size={24} />
             </button>
           </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl flex flex-col p-6 animate-in fade-in duration-200">
           <div className="flex justify-end mb-8">
             <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-white"><X size={32}/></button>
           </div>
           <div className="flex flex-col gap-6 flex-1 overflow-y-auto">
             {(['monitor', 'history', 'calc', 'vault', 'marketplace', 'docs', 'payment'] as const)
              .filter(t => userRole === 'sponsor' ? ['marketplace', 'history', 'vault', 'docs'].includes(t) : true)
              .map(tab => (
               <button key={tab} onClick={() => {setActiveTab(tab); setIsMobileMenuOpen(false);}} className={`text-3xl font-black uppercase tracking-tighter text-left ${activeTab === tab ? 'text-white' : 'text-slate-600'}`}>
                 {tab}
               </button>
             ))}
             <div className="h-px bg-white/10 my-4" />
             <button onClick={() => { setIsProfileDashboardOpen(true); setIsMobileMenuOpen(false); }} className="text-2xl font-black uppercase tracking-tighter text-left text-slate-400">Settings</button>
             <button onClick={handleDisconnect} className="text-xl mt-8 font-black uppercase tracking-tighter text-left text-rose-500">Disconnect</button>
           </div>
        </div>
      )}

      {/* Main Viewport */}
      <main className="flex-1 h-screen overflow-y-auto relative z-10 custom-scrollbar p-4 md:p-8 pt-28 md:pt-8 w-full max-w-7xl mx-auto">"""

new_content, count = pattern.subn(new_layout, content)
if count > 0:
    with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replaced layout successfully.")
else:
    print("Regex failed to match.")
