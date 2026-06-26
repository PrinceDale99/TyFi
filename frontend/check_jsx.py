import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

tag_pattern = re.compile(r'</?([a-zA-Z0-9]+)[^>]*>')
void_elements = {'img', 'input', 'br', 'hr', 'meta'}

stack = []

for i in range(1700, 2400):
    if i >= len(lines): break
    line = lines[i]
    
    # Ignore comments
    line = re.sub(r'\{/\*.*?\*/\}', '', line)
    
    # find all tags
    for match in re.finditer(tag_pattern, line):
        tag_full = match.group(0)
        tag_name = match.group(1)
        
        # Self closing
        if tag_full.endswith('/>') or tag_name in void_elements:
            continue
            
        if tag_full.startswith('</'):
            if stack and stack[-1] == tag_name:
                stack.pop()
            else:
                print(f"Line {i+1}: Found close tag </{tag_name}> but stack is {stack[-5:] if stack else 'empty'}")
        else:
            stack.append(tag_name)

print(f"Remaining stack: {stack}")
