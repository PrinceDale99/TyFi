import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import { LPDashboard } from './components/LPDashboard';", "import { LPDashboard } from './components/LPDashboard';\nimport LandingPage from './components/LandingPage';")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
