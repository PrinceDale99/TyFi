import json
import re

transcript_path = r'C:\Users\princ\.gemini\antigravity-cli\brain\41323a25-4106-4661-997a-cd692a353d8b\.system_generated\logs\transcript_full.jsonl'
best_content = ""
max_len = 0

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            for tc in data.get('tool_calls', []):
                args = tc.get('arguments', {})
                args_str = str(args)
                if 'export default function App' in args_str and len(args_str) > max_len:
                    max_len = len(args_str)
                    best_content = args_str
        except:
            pass

print(f"Found something of length {max_len}")
if max_len > 0:
    with open('frontend/src/recovered_args.txt', 'w', encoding='utf-8') as f:
        f.write(best_content)
