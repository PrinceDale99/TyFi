import re

with open('src/components/FarmerDashboard.tsx.bak', 'r', encoding='utf-8') as f:
    text = f.read()

# The incorrect injection starts with:
#       {/* Weather Mapping & Charts (Monitoring) */}
# And ends before:
# export const FarmerDashboard = ({ farms, profile, network, walletAddress, notificationHistory, onAddFarm, onDeleteFarm, weather, isLoadingWeather }: any) => {

marker_start = "      {/* Weather Mapping & Charts (Monitoring) */}"
marker_end = "export const FarmerDashboard"

if marker_start in text and marker_end in text:
    idx_start = text.find(marker_start)
    idx_end = text.find(marker_end)
    # Restore the end of ParallaxCard
    fixed_text = text[:idx_start] + "      </div>\n    </div>\n  );\n};\n\n" + text[idx_end:]
    
    with open('src/components/FarmerDashboard.tsx', 'w', encoding='utf-8') as f:
        f.write(fixed_text)
    print("Fixed ParallaxCard!")
else:
    print("Markers not found!")
