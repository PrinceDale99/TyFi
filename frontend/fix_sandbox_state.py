import re

with open('src/components/FarmerDashboard.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Make sure AiCopilot is imported
if 'import AiCopilot' not in text:
    text = text.replace('import { WeatherChart } from \'./WeatherChart\';', 'import { WeatherChart } from \'./WeatherChart\';\nimport AiCopilot from \'./AiCopilot\';\nimport { Wind, Sun, AlertTriangle, X } from \'lucide-react\';')

# Now add local sandbox state to FarmerDashboard
state_injection = """
  // Sandbox State
  const [isSandboxEnabled, setIsSandboxEnabled] = React.useState(false);
  const [isSimulatingWeather, setIsSimulatingWeather] = React.useState(false);
  const [simulatedWeather, setSimulatedWeather] = React.useState<any>(null);

  const displayWeather = isSimulatingWeather && simulatedWeather ? simulatedWeather : weather;

  const handleSimulateWeather = (type: string) => {
    if (!isSandboxEnabled) {
      alert("Sandbox mode is disabled. The Oracle detects no typhoons or hurricanes or any destructive natural disaster.");
      return;
    }
    setIsSimulatingWeather(true);
    let sim: any = { ...weather };
    if (type === 'normal') {
      sim.windSpeed = 45;
      sim.rainfall = 25;
      sim.condition = 'Clear';
      sim.agromonitorStatus = 'Normal';
    } else if (type === 'wind_trigger') {
      sim.windSpeed = 115;
      sim.rainfall = 80;
      sim.condition = 'Stormy';
      sim.agromonitorStatus = 'High Risk - Wind Damage';
    } else if (type === 'rain_trigger') {
      sim.windSpeed = 50;
      sim.rainfall = 250;
      sim.condition = 'Heavy Rain';
      sim.agromonitorStatus = 'Flood Risk - Saturated Soil';
    } else if (type === 'double_trigger') {
      sim.windSpeed = 165;
      sim.rainfall = 300;
      sim.condition = 'Super Typhoon';
      sim.agromonitorStatus = 'Critical - Severe Typhoon Impact';
    }
    setSimulatedWeather(sim);
  };

  const handleResetWeather = () => {
    setIsSimulatingWeather(false);
    setSimulatedWeather(null);
  };
"""

if 'const [isSandboxEnabled' not in text:
    # insert state inside FarmerDashboard
    idx = text.find('export const FarmerDashboard = ({')
    idx_brace = text.find('{', idx)
    idx_end_brace = text.find(') => {', idx_brace)
    if idx_end_brace != -1:
        text = text[:idx_end_brace + 6] + state_injection + text[idx_end_brace + 6:]

# Replace all instances of weather inside FarmerDashboard's JSX with displayWeather
# except where weather is destructured from props
text = text.replace('weather={weather}', 'weather={displayWeather}')

with open('src/components/FarmerDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Injected state and imports")
