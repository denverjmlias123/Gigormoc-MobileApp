import json
from pathlib import Path

data = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
total_files = data.get('total_files', 0)
total_words = data.get('total_words', 0)
files = data.get('files', {})

print(f"Corpus: {total_files} files · ~{total_words:,} words")
for cat, flist in files.items():
    if flist:
        exts = set(Path(f).suffix for f in flist if Path(f).suffix)
        ext_str = " ".join(sorted(exts)[:5])
        print(f"  {cat:<8} {len(flist)} files ({ext_str})")
