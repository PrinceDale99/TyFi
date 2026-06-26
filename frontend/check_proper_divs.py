import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def print_imbalance(start, end, name):
    print(f"\n--- {name} ---")
    open_count = 0
    close_count = 0
    for i in range(start, end):
        if i >= len(lines): break
        line = lines[i]
        
        # Count <div ...> but not <div .../>
        div_opens = re.findall(r'<div[^>]*>', line)
        real_opens = [d for d in div_opens if not d.endswith('/>')]
        
        div_closes = re.findall(r'</div', line)
        
        open_count += len(real_opens)
        close_count += len(div_closes)

    print(f"Open: {open_count}, Close: {close_count}, Diff: {open_count - close_count}")

print_imbalance(1700, 1729, 'header')
print_imbalance(1834, 2111, 'vault')
print_imbalance(2142, 2372, 'right_col_controls')
