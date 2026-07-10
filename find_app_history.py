import json

transcript_path = r'C:\Users\princ\.gemini\antigravity-cli\brain\41323a25-4106-4661-997a-cd692a353d8b\.system_generated\logs\transcript_full.jsonl'
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            for tc in data.get('tool_calls', []):
                args = tc.get('arguments', {})
                if 'App.tsx' in str(args):
                    print(tc.get("name"))
        except:
            pass
