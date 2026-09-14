from pathlib import Path
from PIL import Image, ImageOps
import json

root = Path(__file__).resolve().parents[1]
files = json.loads((root / 'tools/images.json').read_text())
manifest = {}
for index, source in enumerate(files):
    image = ImageOps.exif_transpose(Image.open(root / source)).convert('RGB')
    folder = root / 'assets/images/venues' / Path(source).parent.name
    folder.mkdir(parents=True, exist_ok=True)
    variants = []
    for width in (480, 960, 1600):
        copy = image.copy()
        copy.thumbnail((width, width * 2))
        target = folder / (Path(source).stem + '-' + str(width) + '.webp')
        copy.save(target, 'WEBP', quality=82, method=6)
        variants.append({'src': target.relative_to(root).as_posix(), 'width': copy.width, 'height': copy.height})
    manifest[source] = variants
hero = root / 'assets/images/hero'
hero.mkdir(parents=True, exist_ok=True)
for name, index in [('grand-interior',29),('legacy-interior',33),('glorious-stage',15)]:
    image = ImageOps.exif_transpose(Image.open(root / files[index])).convert('RGB')
    for width in (640, 1600):
        copy = image.copy()
        copy.thumbnail((width, width))
        copy.save(hero / f'{name}-{width}.webp', 'WEBP', quality=85, method=6)
(root / 'tools/image-manifest.json').write_text(json.dumps(manifest, indent=2))
print('Optimized', len(files), 'existing photographs; created 6 hero variants.')
