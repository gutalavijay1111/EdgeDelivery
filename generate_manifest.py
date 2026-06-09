import json
import os
from datetime import datetime, timezone

IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.webp', '.gif')

REGIONS = {
    'JP': 'Japan',
    'US': 'United States',
    'IN': 'India',
}

def list_images(folder):
    if not os.path.isdir(folder):
        return []
    return [
        f"{folder}/{f}"
        for f in sorted(os.listdir(folder))
        if f.lower().endswith(IMAGE_EXTS)
    ]

def write_manifest(path, region_code, region_name, images):
    manifest = {
        'region': region_code,
        'region_name': region_name,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'images': images,
    }
    with open(path, 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f'  {path}: {len(images)} images')

print('Generating manifests...')

all_images = []

for code, name in REGIONS.items():
    images = list_images(f'data/{code}')
    write_manifest(f'manifest-{code}.json', code, name, images)
    all_images.extend(images)

write_manifest('manifest.json', 'GLOBAL', 'Global', all_images)
