import re

with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Refactor the <main> element
pattern = re.compile(r'(<main className="flex-1 h-screen overflow-y-auto relative z-10 custom-scrollbar p-4 md:p-8 pt-28 md:pt-8 w-full max-w-7xl mx-auto">)(\s*<div className="container mx-auto">)', re.DOTALL)

new_main = r'''\1
        {activeTab === 'monitor' && userRole === 'farmer' ? (
          <FarmerDashboard 
            farms={farms} 
            profile={profileForm}
            network={network}
            walletAddress={walletAddress}
            notificationHistory={notificationHistory}
            onAddFarm={() => setIsEditProfileModalOpen(true)}
            onDeleteFarm={handleDeleteFarm}
          />
        ) : activeTab === 'marketplace' && userRole === 'sponsor' ? (
          <LPDashboard 
            sponsorInfo={sponsorInfo}
            network={network}
            walletAddress={walletAddress}
            userLpBalance={userLpBalance}
            totalVaultTVL={String(testnetTvl)}
            notificationHistory={notificationHistory}
            onAddLiquidity={handleAddLiquidity}
            onWithdrawLiquidity={handleWithdrawLiquidity}
          />
        ) : (
\2'''

new_content, count = pattern.subn(new_main, content)

if count > 0:
    end_pattern = re.compile(r'(</main>)')
    parts = end_pattern.split(new_content)
    if len(parts) >= 3:
        # replace the LAST occurrence of </main> which is at index len(parts) - 2
        last_index = len(parts) - 2
        parts[last_index] = '        )}\n      </main>'
        new_content = "".join(parts)
        
    with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replaced main content successfully.")
else:
    print("Regex failed to match main content.")
