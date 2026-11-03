"""Build 5.15: data for the Historical Maps page.
  data/ref/history_extents.json — Granada's built-up extent per period (one outline per historical layer, or an explicit
      "no reliable boundary" with the reason), each with its source, date / date range, method and reliability class
  data/ref/place_images.json   — one historical and/or one present-day image per linked place (Wikimedia Commons), with
      date, author, licence, link and captions in ar / he / en; chosen by eye from tools/verify/hist_extent_fetch.py output
Usage: python3 tools/build_history_extras.py <dir with ghsl_extents.json, traced_auto.json, ams_trace.json, commons_candidates.json>"""
import json, os, re, sys
D = sys.argv[1]; ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda n: json.load(open(os.path.join(D, n), encoding='utf-8'))
ghsl, traced, ams, cand = J('ghsl_extents.json'), J('traced_auto.json'), J('ams_trace.json'), J('commons_candidates.json')
close = lambda c: c if c[0] == c[-1] else c + [c[0]]
poly = lambda c: {'type': 'Polygon', 'coordinates': [close([[round(x, 5), round(y, 5)] for x, y in c])]}
GHSL_SRC = {'name': 'JRC GHSL — GHS-BUILT-S R2023A (100 m)', 'url': 'https://human-settlement.emergency.copernicus.eu/ghs_buS2023.php', 'license': 'CC BY 4.0', 'cite': 'Pesaresi M., Politis P. (2023): GHS-BUILT-S R2023A, European Commission, JRC'}
IGN = 'IGN / CNIG · CC BY 4.0'
ext = {}
# documented maps / photographs: approximate reconstructions (traced), with the documented sheet / flight date
ext['mtn50_1932'] = {'kind': 'traced', 'date': '1932', 'period': '1932', 'geometry': poly(traced['mtn50']),
    'src': {'name': 'IGN — Mapa Topográfico Nacional 1:50,000, 1st edition, sheet 1009 "Granada" (1932); south edge on sheet 1026 "Padul" (1931)', 'url': 'https://www.ign.es/wms/primera-edicion-mtn', 'license': IGN},
    'method': 'auto', 'note': 'mapfill'}
ext['catastrones'] = {'kind': 'traced', 'date': None, 'period': '1910–1970', 'geometry': poly(traced['catastrones']),
    'src': {'name': 'IGN — MTN50 drafts ("catastrones"), sheet 1009 "Granada"; edition year not recorded ("sin datos")', 'url': 'https://www.ign.es/wms/primera-edicion-mtn', 'license': IGN},
    'method': 'auto', 'note': 'undated'}
ext['ams_1956'] = {'kind': 'traced', 'date': None, 'period': '1956–1957', 'geometry': poly(ams),
    'src': {'name': 'IGN — American flight (AMS) series B orthophoto, 1956–1957', 'url': 'https://www.ign.es/wms/pnoa-historico', 'license': IGN},
    'method': 'hand', 'note': 'photo'}
# GHSL epochs (1975, 1990, 2000 from Landsat of that time; 2015 and 2020 modelled by GHSL from 2014 / 2018 observations)
for ep, obs in [('1975', True), ('1990', True), ('2000', True), ('2015', False), ('2020', False)]:
    ext['ghsl_' + ep] = {'kind': 'ghsl', 'date': ep, 'period': ep, 'observed': obs, 'km2': ghsl[ep]['km2'], 'geometry': poly(ghsl[ep]['coords']), 'src': GHSL_SRC, 'method': 'ghsl'}
# historical layer → extent (or none, with the reason). The selected layer's own date range is always shown beside it.
LAYER = {
    'minutas': {'none': 'minutas'},           # Granada sheets dated 1895: the city is a hatched mass on incomplete, misaligned sheets
    'mtn50': {'ext': 'mtn50_1932'},
    'catastrones': {'ext': 'catastrones'},
    'ams56': {'ext': 'ams_1956'},
    'inter7386': {'ext': 'ghsl_1975', 'rel': 'nearest'},
    'mtn25': {'none': 'mtn25'},               # sheet edition year within 1975–2003 not recorded here
    'nac8186': {'ext': 'ghsl_1990', 'rel': 'nearest'},
    'olistat': {'ext': 'ghsl_2000', 'rel': 'nearest'},
    'sigpac': {'ext': 'ghsl_2000', 'rel': 'within'},
    'pnoa2004': {'ext': 'ghsl_2000', 'rel': 'nearest'},
    'pnoa2010': {'ext': 'ghsl_2015', 'rel': 'nearest'},
    'pnoa2016': {'ext': 'ghsl_2015', 'rel': 'nearest'},
    'pnoa2022': {'ext': 'ghsl_2020', 'rel': 'nearest'},
    'pnoa2024': {'ext': 'ghsl_2020', 'rel': 'nearest'},
}
json.dump({'built': '5.15', 'note': 'Outer built-up extent of Granada per historical layer; approximate. Not the municipal boundary.', 'extents': ext, 'layers': LAYER},
          open(os.path.join(ROOT, 'data/ref/history_extents.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---------- place images ----------
clean = lambda s: re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s or '')).strip()
def pick(place, i, kind, y1, y2, circa, author, cap):
    it = cand[place][i]; f = it['title'][5:]
    return {'file': f, 'kind': kind, 'y1': y1, 'y2': y2, 'circa': circa, 'author': author, 'license': it['license'], 'licurl': it.get('licurl') or '',
            'url': it['url'], 'w': it['w'], 'h': it['h'], 'cap': cap}
IM = {
  'Alhambra': [pick('Alhambra', 8, 'hist', 1850, 1880, True, 'Anonymous photographer (Rijksmuseum, RP-F-F01139-BT)',
                 ['منظر على قصر الحمراء، طبعة ألبومين', 'מבט על האלהמברה, הדפס אלבומין', 'View over the Alhambra, albumen print']),
               pick('Alhambra', 0, 'now', 2014, 2014, False, 'Jebulon', ['قصر كارلوس الخامس والحمراء عند الفجر', 'ארמון קרל החמישי והאלהמברה עם שחר', 'Palace of Charles V and the Alhambra at dawn'])],
  'Generalife': [pick('Generalife', 5, 'hist', 1875, 1900, True, 'Anonymous photographer (Rijksmuseum, RP-F-00-3141)',
                 ['قناة الماء في جنة العريف («Vista de la acequia»)', 'תעלת המים בחנרליפה ("Vista de la acequia")', 'The water channel of the Generalife ("Vista de la acequia")']),
                 pick('Generalife', 0, 'now', 2004, 2004, False, 'Jean-Pierre Dalbéra', ['فناء الساقية في جنة العريف', 'חצר התעלה בחנרליפה', 'Court of the Water Channel, Generalife'])],
  'Albaicín': [pick('Albaicín', 6, 'hist', 1850, 1880, True, 'Anonymous photographer (Rijksmuseum, RP-F-F01139-AL)', ['شارع في حي البيازين، طبعة ألبومين', 'רחוב באלבאיסין, הדפס אלבומין', 'A street in the Albaicín, albumen print']),
               pick('Albaicín', 0, 'now', 2006, 2006, False, 'Miguel303xm', ['منظر على حي البيازين', 'מבט על האלבאיסין', 'View over the Albaicín'])],
  'Sacromonte': [pick('Sacromonte', 2, 'hist', 1874, 1874, False, 'Gustave Doré (wood engraving) in Ch. Davillier, L’Espagne, Paris: Hachette, 1874',
                 ['«مغارات الغجر في الساكرومونتي» — نقش خشبي لغوستاف دوريه', '"מערות הצוענים בסאקרומונטה" — חיתוך עץ מאת גוסטב דורה', '"The gypsy caves of the Sacromonte" — wood engraving by Gustave Doré']),
                 pick('Sacromonte', 0, 'now', 2012, 2012, False, 'Jebulon', ['حي الساكرومونتي', 'שכונת סאקרומונטה', 'The Sacromonte quarter'])],
  'Catedral_de_Granada': [pick('Catedral_de_Granada', 1, 'hist', None, 1886, False, 'J. Laurent', ['الصحن الرئيسي للكاتدرائية، طبعة ألبومين', 'הספינה המרכזית של הקתדרלה, הדפס אלבומין', 'The cathedral’s main nave, albumen print']),
                          pick('Catedral_de_Granada', 0, 'now', 2012, 2012, False, 'Jebulon', ['الكاتدرائية من مرصد سان كريستوبال', 'הקתדרלה מתצפית סן כריסטובל', 'The cathedral from the San Cristóbal viewpoint'])],
  'Plaza_Nueva_(Granada)': [pick('Plaza_Nueva_(Granada)', 2, 'hist', 1871, 1871, True, 'J. Laurent', ['الساحة الجديدة (بلاثا نويبا)', 'פלאסה נואבה', 'Plaza Nueva']),
                            pick('Plaza_Nueva_(Granada)', 0, 'now', 2009, 2009, False, 'Antonio Cantero', ['الساحة الجديدة اليوم', 'פלאסה נואבה כיום', 'Plaza Nueva today'])],
  'Alcaicería_de_Granada': [pick('Alcaicería_de_Granada', 0, 'now', 2010, 2010, False, 'Jesus Abizanda', ['مدخل القيسارية (أُعيد بناؤها بعد حريق 1843)', 'הכניסה לאלקאיסריה (נבנתה מחדש אחרי השריפה של 1843)', 'Entrance to the Alcaicería (rebuilt after the 1843 fire)'])],
  'Embovedado_del_Darro': [pick('Embovedado_del_Darro', 0, 'now', 2022, 2022, False, 'Juliaruizconde13', ['كنيسة سانتا آنا في الساحة الجديدة، عند بداية تغطية نهر حدرّة', 'כנסיית סנטה אנה בפלאסה נואבה, בתחילת כיסוי נהר הדארו', 'Santa Ana church on Plaza Nueva, where the Darro’s vault begins'])],
  'Plaza_de_Bib-Rambla': [pick('Plaza_de_Bib-Rambla', 0, 'now', 2015, 2015, False, 'Berthold Werner', ['ساحة باب الرملة', 'כיכר ביב-רמבלה', 'Plaza de Bib-Rambla'])],
  'Gran_Vía_de_Colón': [pick('Gran_Vía_de_Colón', 0, 'now', 2008, 2008, False, 'monicat81', ['شارع غران بيا دي كولون', 'שדרות גראן ויה דה קולון', 'Gran Vía de Colón'])],
  'Realejo-San_Matías': [pick('Realejo-San_Matías', 0, 'now', 2017, 2017, False, '0000ff', ['كنيسة سانتو دومينغو في الريالخو', 'כנסיית סנטו דומינגו בריאלחו', 'Santo Domingo church, Realejo'])],
  'Cartuja_de_Granada': [pick('Cartuja_de_Granada', 0, 'now', 2007, 2007, False, 'Germán Póo-Caamaño', ['دير الكارتوخا', 'מנזר הקרטוחה', 'The Cartuja monastery'])],
  'Almanjáyar': [],
}
json.dump({'built': '5.15', 'source': 'Wikimedia Commons (file pages linked); metadata retrieved 3 Nov 2026', 'images': IM},
          open(os.path.join(ROOT, 'data/ref/place_images.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('ok', len(ext), 'extents,', sum(len(v) for v in IM.values()), 'images')
