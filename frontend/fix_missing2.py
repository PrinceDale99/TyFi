import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
imports = """import FarmerDashboard from './components/FarmerDashboard';
import LPDashboard from './components/LPDashboard';
import LandingPage from './components/LandingPage';
"""

content = content.replace("import React, { useState, useEffect } from 'react';", f"import React, {{ useState, useEffect }} from 'react';\n{imports}")

# Fix LandingPageProps
content = content.replace("<LandingPage \n          onConnect={() => setIsWalletConnected(true)} \n          isLoading={isLoading} \n          tvl={testnetTvl} \n          subsidy={subsidyBalance}\n        />", "<LandingPage \n          onConnect={() => setIsWalletConnected(true)} \n          isLoading={isLoading} \n          tvl={testnetTvl} \n          subsidy={subsidyBalance}\n          network={network}\n          setNetwork={setNetwork}\n        />")

# Fix LPDashboard onAddLiquidity and onWithdrawLiquidity types
content = content.replace("onAddLiquidity={(amount) => { setFundingAmount(Number(amount)); handleContributeLiquidity('lp'); }}", "onAddLiquidity={(amount: string) => { setFundingAmount(Number(amount)); handleContributeLiquidity('lp'); }}")
content = content.replace("onWithdrawLiquidity={(amount) => { setFundingAmount(Number(amount)); setStakingMode('withdraw'); handleContributeLiquidity('lp'); }}", "onWithdrawLiquidity={(amount: string) => { setFundingAmount(Number(amount)); setStakingMode('withdraw'); handleContributeLiquidity('lp'); }}")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
