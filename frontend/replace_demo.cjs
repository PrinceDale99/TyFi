const fs = require('fs');

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Network initial state
  content = content.replace(/localStorage\.getItem\('typhoon_vault_network'\) \|\| 'demo'/g, "localStorage.getItem('typhoon_vault_network') || 'testnet'");

  // isDemo references
  content = content.replace(/const isDemo = network === 'demo';/g, '');
  content = content.replace(/if \(network === 'demo'\) return;/g, '');

  content = content.replace(/isDemo \? testnetTvl : contractTvl/g, 'contractTvl');
  content = content.replace(/isDemo \? subsidyBalance : contractSubsidy/g, 'contractSubsidy');

  // contributeLiquidityOnChain
  content = content.replace(/let txHash = 'demo-hash';\s*if \(\!isDemo\) \{\s*txHash = await contributeLiquidityOnChain\(\s*walletAddress,\s*fundingAmount,\s*type,\s*stakingMode,\s*network\s*\);\s*\} else \{\s*await new Promise\(r => setTimeout\(r, 800\)\);\s*txHash = '0x' \+ Math.random\(\)\.toString\(16\)\.slice\(2, 10\) \+ '\.\.\.' \+ Math.random\(\)\.toString\(16\)\.slice\(2, 6\);\s*\}/s, 'const txHash = await contributeLiquidityOnChain(walletAddress, fundingAmount, type, stakingMode, network);');

  content = content.replace(/if \(isDemo\) \{\s*setTestnetTvl\(prev => Math.max\(0, prev - fundingAmount\)\);\s*\}\s*/g, '');
  content = content.replace(/if \(isDemo\) \{\s*setTestnetTvl\(prev => prev \+ fundingAmount\);\s*\}\s*/g, '');
  content = content.replace(/if \(isDemo\) \{\s*setSubsidyBalance\(prev => prev \+ fundingAmount\);\s*\}\s*/g, '');

  // UI text
  content = content.replace(/isDemo \? 'Sandbox Simulation' : 'Real-time Ledger Data'/g, "isTestnet ? 'Testnet Real-time Data' : 'Mainnet Ledger Data'");
  content = content.replace(/\{isDemo && \(/g, '{isTestnet && (');
  content = content.replace(/\{\!isDemo && lpDeposit > 0 && \(/g, '{lpDeposit > 0 && (');
  content = content.replace(/\{\(isTestnet \|\| isDemo\) && \(/g, '{isTestnet && (');
  content = content.replace(/\{\(isTestnet \|\| isDemo\) \? \(/g, '{isTestnet ? (');

  content = content.replace(/isDemo \? 'bg-indigo-500\/20 text-indigo-400' : 'bg-sky-500\/20 text-sky-400'/g, "'bg-sky-500/20 text-sky-400'");
  content = content.replace(/isDemo \? 'Isolated Demo' : 'Sandbox'/g, "'Testnet Sandbox'");
  content = content.replace(/isDemo \? 'text-indigo-400 bg-indigo-500\/10' : 'text-sky-400 bg-sky-500\/10'/g, "'text-sky-400 bg-sky-500/10'");
  content = content.replace(/isDemo \? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500\/20' : 'bg-sky-500 text-white shadow-lg shadow-sky-500\/20'/g, "'bg-sky-500 text-white shadow-lg shadow-sky-500/20'");
  content = content.replace(/isDemo \? 'focus:border-indigo-500' : 'focus:border-sky-500'/g, "'focus:border-sky-500'");
  content = content.replace(/isDemo \? 'bg-indigo-500 hover:bg-indigo-400 shadow-\[0_0_15px_rgba\(99,102,241,0\.2\)\] group-hover:shadow-\[0_0_20px_rgba\(99,102,241,0\.3\)\]' : 'bg-sky-500 hover:bg-sky-400 shadow-\[0_0_15px_rgba\(14,165,233,0\.2\)\] group-hover:shadow-\[0_0_20px_rgba\(14,165,233,0\.3\)\]'/g, "'bg-sky-500 hover:bg-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.2)] group-hover:shadow-[0_0_20px_rgba(14,165,233,0.3)]'");
  content = content.replace(/isDemo \? 'bg-indigo-500 text-white' : 'bg-sky-500 text-white'/g, "'bg-sky-500 text-white'");

  // Fix Theme selector (remove demo)
  content = content.replace(/<button\s*onClick=\{\(\) => \{\s*setNetwork\('demo'\);\s*\}\}\s*className=\{`w-full text-left px-3 py-2 rounded-lg transition-all text-xs font-bold \$\{.*?\}`\}\s*>\s*<div className="flex items-center gap-2">\s*<div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" \/>\s*Demo Sandbox\s*<\/div>\s*<\/button>/s, "");

  fs.writeFileSync(filePath, content);
}

cleanFile('src/App.tsx');
