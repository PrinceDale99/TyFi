import re
import os

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

vault_match = re.search(r'(\{activeTab === \'vault\' && \(\s*<div className="space-y-6">.*?</div>\s*\)\})', content, re.DOTALL)
if vault_match:
    print("Found vault_match length:", len(vault_match.group(1)))
    
sandbox_match = re.search(r'(\{isTestnet && \(\s*<ParallaxCard className="border-indigo-500/20 shadow-\[0_0_25px_rgba\(99,102,241,0\.05\)\] animate-in fade-in slide-in-from-right-4 duration-500">.*?</ParallaxCard>\s*\)\})', content, re.DOTALL)
if sandbox_match:
    print("Found sandbox_match length:", len(sandbox_match.group(1)))

