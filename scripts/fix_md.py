import sys

def fix_doc(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove the duplicate header
    content = content.replace('# PDAX API for Institutions Documentation\n\n## Introduction\n# PDAX API for Institutions Documentation\n\nWelcome to PDAX API for Institutions Documentation.', 
                              '# PDAX API for Institutions Documentation\n\n## Introduction\nWelcome to PDAX API for Institutions Documentation.')

    # Remove the errant wrappers around code blocks
    content = content.replace('`json\n```json', '```json')
    content = content.replace('```\n`\n', '```\n')
    content = content.replace('```\n`', '```')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

fix_doc('PDAX_API_DOCS.md')
