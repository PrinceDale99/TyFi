import re

with open('frontend/src/components/LPDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace static chartData with state-driven dynamic data
pattern1 = re.compile(r"const chartData = \[\n  { name: 'Jan', tvl: 4000, yield: 240, risk: 20 },\n  { name: 'Feb', tvl: 3000, yield: 139, risk: 22 },\n  { name: 'Mar', tvl: 2000, yield: 980, risk: 30 },\n  { name: 'Apr', tvl: 2780, yield: 390, risk: 40 },\n  { name: 'May', tvl: 1890, yield: 480, risk: 35 },\n  { name: 'Jun', tvl: 2390, yield: 380, risk: 25 },\n  { name: 'Jul', tvl: 3490, yield: 430, risk: 20 },\n\];")
content = pattern1.sub("", content)

# Inject state inside LPDashboard component
pattern2 = re.compile(r"export const LPDashboard: React.FC<LPDashboardProps> = \(\{.*?\}\) => \{", re.DOTALL)

def replacer2(match):
    return match.group(0) + """
  const [liveChartData, setLiveChartData] = useState(() => {
    const initial = [];
    let base = 2500;
    for(let i=0; i<30; i++) {
       base = base + (Math.random() - 0.45) * 200;
       initial.push({ time: i, tvl: Math.max(1000, base), yield: Math.random() * 1000 });
    }
    return initial;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveChartData(prev => {
         const last = prev[prev.length - 1];
         const next = last.tvl + (Math.random() - 0.4) * 300;
         const newData = [...prev.slice(1), { time: last.time + 1, tvl: Math.max(1000, next), yield: Math.random() * 1000 }];
         return newData;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);
"""

content = pattern2.sub(replacer2, content)

# Update AreaChart data prop and XAxis dataKey
content = content.replace("<AreaChart data={chartData}", "<AreaChart data={liveChartData}")
content = content.replace('XAxis dataKey="name"', 'XAxis dataKey="time"')

with open('frontend/src/components/LPDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected live chart!")
