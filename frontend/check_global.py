import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

stack = []
start_checking = False

for i, line in enumerate(lines):
    if 'return (' in line and i > 1500:
        start_checking = True
        
    if not start_checking: continue
    
    div_opens = re.findall(r'<div[^>]*>', line)
    real_opens = [d for d in div_opens if not d.endswith('/>')]
    div_closes = re.findall(r'</div', line)
    
    for _ in real_opens:
        stack.append(i + 1)
        
    for _ in div_closes:
        if stack:
            stack.pop()
        else:
            print(f"Extra closing div at line {i + 1}")
            
print(f"Unclosed divs opened at: {stack}")
