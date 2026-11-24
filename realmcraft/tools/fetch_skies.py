"""Fetch CC0 sky HDRIs from Poly Haven (1K: for lighting and reflections) and pack them as assets/sky/<mood>.js (base64).
    python tools/fetch_skies.py <download folder>"""
import base64, hashlib, json, os, sys, urllib.request
UA = {'User-Agent': 'realmcraft-asset-fetch'}
SKIES = {'day': 'kloofendal_48d_partly_cloudy_puresky', 'sunset': 'belfast_sunset_puresky', 'dusk': 'qwantani_dusk_2_puresky', 'overcast': 'kloofendal_overcast_puresky', 'night': 'rogland_clear_night'}
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120) as r: return r.read()
def main(dl):
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sky'); os.makedirs(out, exist_ok=True); os.makedirs(dl, exist_ok=True)
    credits = ['# Skies', 'All from [Poly Haven](https://polyhaven.com), CC0. 1K HDR for lighting.', '| Mood | Poly Haven | Author |', '|---|---|---|']
    for mood, pid in SKIES.items():
        info = json.loads(get('https://api.polyhaven.com/info/' + pid)); f = json.loads(get('https://api.polyhaven.com/files/' + pid))['hdri']['1k']['hdr']
        raw = os.path.join(dl, pid + '_1k.hdr')
        if not os.path.exists(raw):
            data = get(f['url'])
            if hashlib.md5(data).hexdigest() != f['md5']: raise SystemExit('md5 mismatch ' + pid)
            open(raw, 'wb').write(data)
        b64 = base64.b64encode(open(raw, 'rb').read()).decode(); authors = ', '.join(info.get('authors', {}).keys())
        open(os.path.join(out, mood + '.js'), 'w', encoding='utf-8', newline='\n').write(f"// sky '{mood}': Poly Haven '{pid}' (CC0) by {authors}\n(window.RC_SKY = window.RC_SKY || {{}})[{json.dumps(mood)}] = {json.dumps({'source': 'polyhaven:' + pid, 'hdr': b64})};\n")
        credits.append(f"| {mood} | [{info.get('name', pid)}](https://polyhaven.com/a/{pid}) | {authors} |"); print(mood, pid, len(b64) // 1024, 'KB')
    open(os.path.join(out, 'CREDITS.md'), 'w', encoding='utf-8', newline='\n').write('\n'.join(credits) + '\n')
if __name__ == '__main__': main(sys.argv[1])
