import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def check_block(start_line, end_line, name):
    o = 0
    c = 0
    for i in range(start_line, end_line):
        if i >= len(lines): break
        line = lines[i]
        o += len(re.findall(r'<div', line))
        c += len(re.findall(r'</div', line))
    print(f"{name}: open {o}, close {c}, diff {o-c}")

check_block(1700, 1729, 'header')
check_block(1729, 1813, 'monitor')
check_block(1813, 1819, 'calc')
check_block(1819, 1834, 'history')
check_block(1834, 2111, 'vault')
check_block(2111, 2122, 'marketplace')
check_block(2122, 2128, 'docs')
check_block(2128, 2136, 'payout')
check_block(2142, 2372, 'right_col_controls')
check_block(2373, 2392, 'copilot')

