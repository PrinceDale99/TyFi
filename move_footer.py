import re

with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

footer_pattern = re.compile(r'(<footer.*?</footer>)', re.DOTALL)
footers = footer_pattern.findall(content)

if not footers:
    print("Footer not found")
else:
    footer = footers[-1] # The last footer
    # Remove footer from where it is
    content = content.replace(footer, '')
    
    # Place it right before the last </main>
    # Find the last </main>
    main_pattern = re.compile(r'(</main>)')
    parts = main_pattern.split(content)
    if len(parts) >= 3:
        last_index = len(parts) - 2
        parts[last_index] = footer + '\n      </main>'
        new_content = "".join(parts)
        
        with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Moved footer inside main.")
    else:
        print("Could not find </main>")
