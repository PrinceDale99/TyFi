import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import FarmerDashboard from './components/FarmerDashboard';", "import { FarmerDashboard } from './components/FarmerDashboard';")
content = content.replace("import LPDashboard from './components/LPDashboard';", "import { LPDashboard } from './components/LPDashboard';")
content = content.replace("import LandingPage from './components/LandingPage';\n", "")

# The LandingPage props didn't replace because there was some extra whitespace or format.
# Let's fix LandingPage Props using regex.
content = re.sub(r'<LandingPage\s+onConnect=\{\(\) => setIsWalletConnected\(true\)\}\s+isLoading=\{isLoading\}\s+tvl=\{testnetTvl\}\s+subsidy=\{subsidyBalance\}\s+/>', '<LandingPage \n          onConnect={() => setIsWalletConnected(true)} \n          isLoading={isLoading} \n          tvl={testnetTvl} \n          subsidy={subsidyBalance}\n          network={network}\n          setNetwork={setNetwork}\n        />', content)


with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
