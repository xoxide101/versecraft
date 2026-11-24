"""Fetch CC0 textures from Poly Haven (polyhaven.com) and pack them for RealmCraft.

    python tools/fetch_textures.py <download folder>

For each texture: the 1K colour, relief (OpenGL normal) and AO/rough/metal maps are downloaded (checked by md5),
shrunk (colour 1024 px, the others 512 px), and written as assets/tex/<name>.js holding data: URLs, because a page
opened from a folder may not load picture files into WebGL. assets/tex/CREDITS.md lists every texture and its author
(CC0 needs no credit; we give it anyway). Real-world size (metres per picture) goes in too, for scaling.
"""
import hashlib, io, json, os, sys, time, urllib.request, base64
from PIL import Image

UA = {'User-Agent': 'realmcraft-asset-fetch'}
SET = {   # our name: Poly Haven id
    # ground
    'cobble_road': 'cobblestone_floor_04', 'cobble_square': 'cobblestone_pavement', 'cobble_grassy': 'grassy_cobblestone', 'cobble_mossy': 'mossy_cobblestone',
    'gravel_road': 'gravel_road', 'forest_ground': 'forest_ground_04', 'mud_leaves': 'brown_mud_leaves_01', 'dirt': 'park_dirt', 'dirt_path': 'stony_dirt_path',
    'sand': 'coast_sand_01', 'pebbles_shore': 'river_small_rocks',
    # buildings
    'plaster': 'plastered_wall', 'plaster_worn': 'worn_mossy_plasterwall', 'stone_wall': 'stone_wall', 'castle_wall': 'castle_wall_slates', 'red_brick': 'medieval_red_brick',
    'roof_clay': 'clay_roof_tiles', 'roof_slate': 'roof_slates_02', 'roof_thatch': 'thatch_roof_angled', 'planks_weathered': 'weathered_planks', 'planks_oak': 'oak_wood_planks',
    # nature
    'rock_face': 'rock_face_03', 'rock_mossy': 'mossy_rock', 'rock_lichen': 'lichen_rock', 'bark_brown': 'bark_brown_02', 'bark_pine': 'pine_bark',
}
MAPS = {'map': ('Diffuse', 1024, 82), 'normal': ('nor_gl', 512, 90), 'arm': ('arm', 512, 85)}
# paths in high detail (the gauge): 2K colour, 1K relief, AO/rough and height (for parallax)
HD = {'path_cobble_road': 'cobblestone_floor_04', 'path_cobble_square': 'cobblestone_pavement', 'path_cobble_mossy': 'mossy_cobblestone', 'path_cobble_grassy': 'grassy_cobblestone',
      'path_stone_way': 'stone_pathway_02', 'path_flagstone': 'stone_tiles', 'path_dirt': 'stony_dirt_path', 'path_gravel': 'gravel_road'}
MAPS_HD = {'map': ('Diffuse', 2048, 85, '2k'), 'normal': ('nor_gl', 1024, 92, '2k'), 'arm': ('arm', 1024, 88, '2k'), 'height': ('Displacement', 1024, 92, '2k')}

def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r: return r.read()
        except Exception as e:
            if i == 2: raise
            time.sleep(2)

def main(dl, hd=False):
    global SET, MAPS
    if hd: SET, MAPS = HD, MAPS_HD
    here = os.path.dirname(os.path.abspath(__file__)); out = os.path.join(here, '..', 'assets', 'tex'); os.makedirs(out, exist_ok=True); os.makedirs(dl, exist_ok=True)
    credits = ['# Textures\n', 'All from [Poly Haven](https://polyhaven.com), CC0 (public domain). Shrunk for RealmCraft.\n', '| Our name | Poly Haven | Author | Size (m) |', '|---|---|---|---|']
    for name, pid in SET.items():
        info = json.loads(get('https://api.polyhaven.com/info/' + pid)); files = json.loads(get('https://api.polyhaven.com/files/' + pid))
        dims = info.get('dimensions') or [2000, 2000]; meters = [round(d / 1000, 2) for d in dims]
        packed = {'name': name, 'source': 'polyhaven:' + pid, 'meters': meters}
        for key, spec in MAPS.items():
            kind, px, q = spec[:3]; res = spec[3] if len(spec) > 3 else '1k'
            f = files.get(kind, {}).get(res, {}).get('jpg') or files.get(kind, {}).get(res, {}).get('png')
            if not f: continue
            raw_path = os.path.join(dl, f'{pid}_{kind}_{res}' + os.path.splitext(f['url'])[1])
            if not os.path.exists(raw_path):
                data = get(f['url'])
                if hashlib.md5(data).hexdigest() != f['md5']: raise SystemExit(f'md5 mismatch: {pid} {kind}')
                open(raw_path, 'wb').write(data)
            im = Image.open(raw_path).convert('RGB'); im = im.resize((px, px), Image.LANCZOS) if im.size[0] != px else im
            buf = io.BytesIO(); im.save(buf, 'JPEG', quality=q, optimize=True)
            packed[key] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
        js = f"// {name}: Poly Haven '{pid}' (CC0) by {', '.join(info.get('authors', {}).keys())}; {meters[0]} x {meters[1]} m\n(window.RC_TEX = window.RC_TEX || {{}})[{json.dumps(name)}] = {json.dumps(packed)};\n"
        open(os.path.join(out, name + '.js'), 'w', encoding='utf-8', newline='\n').write(js)
        credits.append(f"| {name} | [{info.get('name', pid)}](https://polyhaven.com/a/{pid}) | {', '.join(info.get('authors', {}).keys())} | {meters[0]} x {meters[1]} |")
        print(f'{name:18} {pid:28} {os.path.getsize(os.path.join(out, name + ".js")) // 1024} KB')
    # credits: the base set, then a section for the high-detail paths (each run rewrites only its own part)
    cp, marker = os.path.join(out, 'CREDITS.md'), '\n## High-detail paths\n'
    prev = open(cp, encoding='utf-8').read() if os.path.exists(cp) else ''
    base, hdpart = (prev.split(marker) + [''])[:2]
    text = (base.rstrip('\n') + '\n' + marker + '\n'.join(credits[4:]) + '\n') if hd else ('\n'.join(credits) + '\n' + ((marker + hdpart) if hdpart else ''))
    open(cp, 'w', encoding='utf-8', newline='\n').write(text)

if __name__ == '__main__': main(sys.argv[1], '--hd' in sys.argv)
