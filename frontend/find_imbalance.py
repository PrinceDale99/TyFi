import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def print_imbalance(start, end, name):
    print(f"\n--- {name} ---")
    stack = []
    for i in range(start, end):
        if i >= len(lines): break
        line = lines[i]
        for m in re.finditer(r'<div', line):
            stack.append(i+1)
        for m in re.finditer(r'</div', line):
            if stack:
                stack.pop()
            else:
                print(f"Extra close at {i+1}")
    print(f"Unclosed divs opened at: {stack}")

print_imbalance(1834, 2111, 'vault')
print_imbalance(2142, 2372, 'right_col_controls')
