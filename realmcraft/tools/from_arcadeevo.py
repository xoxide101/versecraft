"""ArcadeEvo's town → a RealmCraft realm file (data/wrenhaven.js).

Input: the JSON of ArcadeEvo's world (run its createYs1World() and save it; see docs/arcadeevo-map.md).
    python tools/from_arcadeevo.py ys1world.json data/wrenhaven.js
The old game's names are swapped for our own (RENAME); the people's own names, jobs and routes stay.
"""
import json, sys, re

RENAME = [  # longest first
    ("SARA'S FORTUNE PARLOR", "MADAME ILSA'S FORTUNE PARLOR"), ("Sara's Fortune Parlor", "Madame Ilsa's Fortune Parlor"),
    ("PIM'S WEAPON SMITHERY", "CORWIN'S SMITHY"), ("Pim's Weapon Smithery", "Corwin's Smithy"),
    ("BARBADO TAVERN", "THE SALTED ANCHOR"), ("Barbado Tavern", "the Salted Anchor"), ("Barbado", "the Salted Anchor"),
    ("CELCETA HERBALIST", "GREENBOUGH HERBALIST"), ("Celceta", "Greenbough"), ("celceta", "greenbough"),
    ("ESTERIA GUILDHALL", "ADVENTURERS' GUILDHALL"), ("ESTERIA PLAINS", "VAEL PLAINS"), ("Esteria", "Vael"), ("ESTERIA", "VAEL"),
    ("MINEA", "WRENHAVEN"), ("Minea", "Wrenhaven"), ("minea", "wrenhaven"),
    ("Adol Christin", "Rowan"), ("Adol", "Rowan"), ("ADOL", "ROWAN"),
    ("Sara", "Madame Ilsa"), ("SARA", "MADAME ILSA"), ("Pim", "Corwin"), ("PIM", "CORWIN"),
    ("Books of Ys", "Lost Chronicles"), ("Book of Ys", "Lost Chronicle"), ("Ys", "the old kingdom"),
    ("Roda", "Elder"), ("Darm", "Grey"), ("Solomon", "the Ancients"), ("Zepik", "Millbrook"), ("Feena", "Liora"), ("Lilia", "Wren"),
    ("Jeva", "Hanna"), ("Dalles", "the Shade"), ("Dark Fact", "the Masked One"), ("Falcom", ""),
]
def ren(s):
    if not isinstance(s, str): return s
    s = re.sub(r'minea_?', '', s) if re.fullmatch(r'[a-z0-9_]+', s) else s   # ids: minea_inn → inn
    s = re.sub(r'(?i)esteria', 'Vael', s); s = re.sub(r'(?i)celceta', 'Greenbough', s); s = re.sub(r'\bsara\b', 'ilsa', s)
    for a, b in RENAME: s = re.sub(r'\b' + re.escape(a) + r'\b', b, s) if a[0].isalpha() else s.replace(a, b)
    return s
def deep(o):
    if isinstance(o, str): return ren(o)
    if isinstance(o, list): return [deep(x) for x in o]
    if isinstance(o, dict): return {k: deep(v) for k, v in o.items()}
    return o

src, out = sys.argv[1], sys.argv[2]
z = json.load(open(src, encoding='utf-8'))['minea']
W, H = z['width'], z['height']
# ground paint: one letter per cell (TerrainCraft); things on top (MapCraft)
PAINT = {0: '.', 1: ',', 2: 'T', 3: '~', 4: '=', 5: ',', 6: '-', 7: '.', 8: ',', 9: 'L'}
paint = [''.join(PAINT[c] for c in row) for row in z['tiles']]
things = []
for b in z.get('buildings') or []:
    door = next((p for p in z['portals'] if p['tx'] >= b['tx'] and p['tx'] < b['tx'] + b['w'] and p['ty'] == b['ty'] + b['h']), None)
    things.append({'kind': 'building', 'id': b['id'].replace('m_', ''), 'x': b['tx'], 'z': b['ty'], 'w': b['w'], 'd': b['h'], 'name': b['name'], 'sign': b['signKind'],
                   'style': b.get('archStyle') or 'one_story_cottage', 'roof': b['roofStyle'], 'chimney': bool(b.get('hasChimney')),
                   'door': {'x': door['tx'] + 0.5, 'z': door['ty'] + 0.1, 'to': door['targetZone'], 'label': door['label']} if door else None})
for r, row in enumerate(z['tiles']):
    for c, t in enumerate(row):
        if t == 7: things.append({'kind': 'lamp', 'x': c + 0.5, 'z': r + 0.5})
for i in z['inspectables']:
    things.append({'kind': i['kind'], 'id': i['id'].replace('minea_', ''), 'x': i['tx'] + 0.5, 'z': i['ty'] + 0.5, 'title': i['title'], 'lines': i['lines']})
for s in z['shrubs']:
    t = {'kind': 'shrub', 'id': s['id'], 'x': s['tx'] + 0.5, 'z': s['ty'] + 0.5, 'variant': s['variant'], 'hidden': s['hiddenKind']}
    if s.get('hiddenAmount'): t['amount'] = s['hiddenAmount']
    if s.get('clueText'): t['clue'] = s['clueText']
    if s.get('rewardName'): t['reward'] = s['rewardName']
    things.append(t)
for c in z['chests']:
    things.append({'kind': 'chest', 'id': c['id'], 'x': c['tx'] + 0.5, 'z': c['ty'] + 0.5, 'reward': c['rewardName'], 'amount': c.get('amount')})
for f in z.get('forageNodes') or []:
    things.append({'kind': 'forage', 'id': f['id'], 'x': f['tx'] + 0.5, 'z': f['ty'] + 0.5, 'node': f['nodeKind'], 'item': f['itemId'], 'name': f['itemName'], 'amount': f['amount']})
for s in z.get('craftStations') or []:
    things.append({'kind': 'station', 'id': s['id'], 'x': s['tx'] + 0.5, 'z': s['ty'] + 0.5, 'station': s['stationKind'], 'title': s['title'], 'subtitle': s['subtitle']})
for b in z.get('boats') or []:
    things.append({'kind': 'boat', 'id': b['id'], 'x': b['tx'] + 0.5, 'z': b['ty'] + 0.5, 'facing': b['facing'], 'sail': b['sailColor'], 'hull': b['hullColor']})
gate = next(p for p in z['portals'] if p['targetZone'] == 'plains')
doors = [{'x': gate['tx'] + 0.5, 'z': gate['ty'] + 0.5, 'w': gate['widthTiles'], 'to': 'plains', 'label': gate['label']}]
JOB = {'water_carry': 'carry water', 'carry_crate': 'carry crates'}
people = []
for n in z['npcs']:
    p = {'id': n['id'].replace('minea_', ''), 'name': n['name'], 'role': 'important' if n['role'] in ('quest', 'bakery', 'inn', 'weapon', 'armor') or not n.get('secondary') else 'townsfolk',
         'age': n.get('ageGroup') or ('child' if n.get('task') == 'play' else 'adult'), 'job': JOB.get(n.get('task'), n.get('task') or 'stand'),
         'at': {'x': n['tx'] + 0.5, 'z': n['ty'] + 0.5}, 'look': {'cloak': n['cloakColor'], 'hair': n['hairColor'], 'tunic': n['tunicColor']}, 'says': [n['greeting']]}
    if n.get('followUpGreeting'): p['says'].append(n['followUpGreeting'])
    if n.get('walkSpeed'): p['speed'] = round(n['walkSpeed'] / 44, 2)
    if n.get('waypoints'):
        p['route'] = [{k: v for k, v in {'x': w['tx'] + 0.5, 'z': w['ty'] + 0.5, 'wait': w.get('waitSec'), 'work': w.get('performTask') or None, 'doing': w.get('activityLabel')}.items() if v is not None} for w in n['waypoints']]
    people.append(p)
# a few more ages: an elder and an infant carried by a parent (the cast covers all ages)
people.append({'id': 'elder_wyn', 'name': 'GRANDMOTHER WYN', 'role': 'townsfolk', 'age': 'elder', 'job': 'stroll', 'at': {'x': 44.5, 'z': 38.5}, 'look': {'cloak': '#7c6f9b', 'hair': '#e5e7eb', 'tunic': '#d6c7a1'},
               'says': ['Sixty winters I have watched the boats come in. Each one still brings a story.'], 'speed': 0.6, 'route': [{'x': 44.5, 'z': 38.5, 'wait': 6, 'doing': 'Feeding the pigeons'}, {'x': 53.5, 'z': 38.5, 'wait': 5}, {'x': 53.5, 'z': 44.5, 'wait': 8, 'doing': 'Resting on the bench'}, {'x': 44.5, 'z': 44.5, 'wait': 4}]})
people.append({'id': 'mother_tess', 'name': 'TESS · WITH BABY ALBIN', 'role': 'townsfolk', 'age': 'adult', 'carries': 'infant', 'job': 'stroll', 'at': {'x': 58.5, 'z': 36.5}, 'look': {'cloak': '#be7a5c', 'hair': '#5b3a29', 'tunic': '#f1e3c8'},
               'says': ['Shh, he finally fell asleep. The fountain always calms him.'], 'speed': 0.7, 'route': [{'x': 58.5, 'z': 36.5, 'wait': 7, 'doing': 'Rocking the baby'}, {'x': 58.5, 'z': 42.5, 'wait': 5}, {'x': 52.5, 'z': 42.5, 'wait': 6}]})
realm = deep({
    'id': 'wrenhaven', 'name': z['name'], 'subtitle': z.get('subtitle', ''), 'w': W, 'h': H,
    'calendar': {'hoursPerDay': 24, 'hourSeconds': 45, 'days': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], 'marketDays': [0, 3, 6],
                 'months': [{'name': n, 'days': 30} for n in ['Frostwane', 'Thawmoon', 'Seedtide', 'Blossom', 'Brightsun', 'Highsummer', 'Goldfield', 'Harvest', 'Leaffall', 'Mistmoon', 'Deepfrost', 'Longnight']],
                 'seasons': [{'name': 'Spring', 'from': 2}, {'name': 'Summer', 'from': 5}, {'name': 'Autumn', 'from': 8}, {'name': 'Winter', 'from': 11}],
                 'start': {'year': 1, 'month': 3, 'day': 1, 'hour': 10}},
    'terrain': {'paint': paint, 'legend': {'.': 'grass', ',': 'paving', '-': 'cobble', '~': 'water', '=': 'pier', 'T': 'forest', 'L': 'landmark'},
                'shape': [{'op': 'terrace', 'z': round(H * 0.67) + 0.58, 'rise': 0.62, 'soft': 1.16}, {'op': 'terrace', 'z': round(H * 0.36) + 0.58, 'rise': 0.62, 'soft': 1.16},
                          {'op': 'sea', 'floor': -0.64, 'deepFrom': 65.5, 'deepRange': 9.5, 'deep': 1.32}]},
    'things': things, 'doors': doors, 'people': people,
    'players': [{'id': 'p1', 'name': 'Rowan', 'title': 'Wanderer', 'at': {'x': 49.5, 'z': 62.5}, 'look': {'cloak': '#b91c1c', 'hair': '#c2410c', 'tunic': '#1e3a8a'}}],
})
with open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// RealmCraft realm: Wrenhaven Town & Harbor (made from ArcadeEvo\'s town by tools/from_arcadeevo.py; edit freely)\n')
    f.write('(window.RC_REALMS = window.RC_REALMS || {}).wrenhaven = ' + json.dumps(realm, ensure_ascii=False, indent=1) + ';\n')
print('people', len(people), 'things', len(things), 'size', W, H)
