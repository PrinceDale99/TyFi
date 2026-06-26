import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

open_divs = 0
close_divs = 0

for i in range(1700, 2396):
    if i >= len(lines): break
    line = lines[i]
    open_divs += len(re.findall(r'<div', line))
    close_divs += len(re.findall(r'</div', line))

print(f"Total open: {open_divs}, Total close: {close_divs}")
