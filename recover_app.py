import json
import re

transcript_path = r'C:\Users\princ\.gemini\antigravity-cli\brain\41323a25-4106-4661-997a-cd692a353d8b\.system_generated\logs\transcript_full.jsonl'
app_tsx_content = None

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            content = data.get('content', '')
            
            # Check tool calls
            tool_calls = data.get('tool_calls', [])
            for tc in tool_calls:
                # Recover from write_to_file
                if tc.get('name') == 'default_api:write_to_file':
                    args = tc.get('arguments', {})
                    if 'App.tsx' in args.get('TargetFile', ''):
                        app_tsx_content = args.get('CodeContent')
                # Recover from python script outputs (if any output printed it, unlikely)
        except Exception as e:
            pass

if app_tsx_content:
    with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(app_tsx_content)
    print("Recovered App.tsx from write_to_file")
else:
    # If not in write_to_file, maybe we can extract it from the python script that replaced it?
    # Actually, the user's prompt shows the previous work accomplished:
    # "Global Layout Migration: Migrated App.tsx to a new h-screen flex layout..."
    # The previous agent must have written it somehow!
    print("Could not find App.tsx in write_to_file")
