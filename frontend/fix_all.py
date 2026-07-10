import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
imports = """import { FarmerDashboard } from './components/FarmerDashboard';
import { LPDashboard } from './components/LPDashboard';
import LandingPage from './components/LandingPage';
"""

if "import { FarmerDashboard }" not in content:
    content = content.replace("import React, { useState, useEffect } from 'react';", f"import React, {{ useState, useEffect }} from 'react';\n{imports}")

# Fix LandingPageProps
content = re.sub(r'<LandingPage\s+onConnect=\{\(\) => setIsWalletConnected\(true\)\}\s+isLoading=\{isLoading\}\s+tvl=\{testnetTvl\}\s+subsidy=\{subsidyBalance\}\s+/>', '<LandingPage \n          onConnect={() => setIsWalletConnected(true)} \n          isLoading={isLoading} \n          tvl={testnetTvl} \n          subsidy={subsidyBalance}\n          network={network}\n          setNetwork={setNetwork}\n        />', content)
content = re.sub(r'<LandingPage \n\s*onConnect=\{\(\) => setIsWalletModalOpen\(true\)\}\n\s*isLoading=\{isLoading && !isWalletModalOpen\}\n\s*tvl=\{contractTvl\}\n\s*subsidy=\{contractSubsidy\}\n\s*/>', '<LandingPage \n          onConnect={() => setIsWalletModalOpen(true)} \n          isLoading={isLoading && !isWalletModalOpen} \n          tvl={contractTvl} \n          subsidy={contractSubsidy}\n          network={network}\n          setNetwork={setNetwork}\n        />', content)

# Fix LPDashboard onAddLiquidity and onWithdrawLiquidity types
content = content.replace("onAddLiquidity={(amount) => { setFundingAmount(Number(amount)); handleContributeLiquidity('lp'); }}", "onAddLiquidity={(amount: string) => { setFundingAmount(Number(amount)); handleContributeLiquidity('lp'); }}")
content = content.replace("onWithdrawLiquidity={(amount) => { setFundingAmount(Number(amount)); setStakingMode('withdraw'); handleContributeLiquidity('lp'); }}", "onWithdrawLiquidity={(amount: string) => { setFundingAmount(Number(amount)); setStakingMode('withdraw'); handleContributeLiquidity('lp'); }}")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
