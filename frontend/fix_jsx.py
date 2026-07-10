import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('<ParallaxCard className="p-0"><WeatherWidget\n                          weather={weather}\n                          isLoading={isLoading}\n                          onRefresh={() => {\n                            addNotification(\'Refreshing live weather feeds...\', \'info\');\n                          }}\n                        />\n                      </div>', '<ParallaxCard className="p-0"><WeatherWidget\n                          weather={weather}\n                          isLoading={isLoading}\n                          onRefresh={() => {\n                            addNotification(\'Refreshing live weather feeds...\', \'info\');\n                          }}\n                        /></ParallaxCard>\n                      </div>')

# Actually, the replacement for AssetDistribution never matched, so it wasn't wrapped in ParallaxCard, which means it doesn't have an unclosed ParallaxCard!
# Wait, did it? `Get-Content src/App.tsx | Select-String -Pattern "AssetDistribution"` returned `<AssetDistribution farms={farms} />` without ParallaxCard! So it wasn't unclosed.

# Fix the >= operators in sandbox
content = content.replace('>= 110 km/h', '>= 110 km/h') # Wait, `>=` is invalid in JSX text unless inside `{""}`
content = content.replace('Wind Trigger (>= 110 km/h)', 'Wind Trigger ({">="} 110 km/h)')
content = content.replace('Rain Trigger (>= 200 mm)', 'Rain Trigger ({">="} 200 mm)')

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
