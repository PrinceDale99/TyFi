import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The bug: <footer> is outside </main>, causing it to render next to it in a flex row.
# We need to move </main> to be AFTER the footer.

pattern = re.compile(r'(</main>)\s*({\/\* Premium Footer \*\/}\s*<footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 relative z-10">.*?</footer>)', re.DOTALL)

new_content, count = pattern.subn(r'\2\n      \1', content)

if count > 0:
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Moved footer inside main successfully.")
else:
    print("Regex failed to match. Let's look closer.")

