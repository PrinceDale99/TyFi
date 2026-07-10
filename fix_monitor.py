import re

with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the FarmerDashboard hijack for 'monitor'
pattern1 = re.compile(r"\{\s*activeTab === 'monitor' && userRole === 'farmer' \? \(\s*<FarmerDashboard[\s\S]*?/>\s*\)\s*:\s*", re.MULTILINE)
if pattern1.search(content):
    content = pattern1.sub("{", content)
    print("Removed FarmerDashboard hijack.")
else:
    print("Could not find FarmerDashboard hijack.")

# 2. Remove "Quick Protocol Access" box
pattern2 = re.compile(r'<div className="glass-panel">\s*<h3 className="font-black text-white mb-6 uppercase tracking-widest text-sm">Quick Protocol Access</h3>\s*<div className="grid grid-cols-2 md:grid-cols-1 gap-3">.*?</div>\s*</div>', re.DOTALL)
if pattern2.search(content):
    content = pattern2.sub("", content)
    print("Removed Quick Protocol Access box.")
else:
    print("Could not find Quick Protocol Access box.")

with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
