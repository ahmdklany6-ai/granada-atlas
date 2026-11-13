/* v33 strings (build 5.42): Exercise 2.1 (Scale) — the Base Aérea de Armilla as a closed island in the growing south.
   City level (1:10,000): the base, its band and fence, dead ends and detours, the metro extension, the aeronautical
   height limits (RD 118/2019, Ministry of Defence data). [ar, he, en]. Numbers stay left-to-right. */
(function (root) {
  root.GA.i18n.add({
    'x34.gap.chg': ['تغيّر السكان 2015→2025 (INE)', 'שינוי תושבים 2015→2025 (INE)', 'Residents change 2015→2025 (INE)'],
    'x34.gap.inc': ['صافي الدخل للفرد 2024 (INE ADRH)', 'הכנסה נטו לנפש 2024 (INE ADRH)', 'Net income per person 2024 (INE ADRH)'],
    'x34.gap.rent': ['مؤشر الإيجار 2024، 2015 = 100 (INE IPVA)', 'מדד שכר דירה 2024, 2015 = 100 (INE IPVA)', 'Rent index 2024, 2015 = 100 (INE IPVA)'],
    'x34.gap.title': ['الفروقات: البلدات الخمس حول القاعدة مقابل مدينة غرناطة', 'הפערים: חמש העיירות סביב הבסיס מול העיר גרנדה', 'The gaps: the five towns around the base vs Granada city'],
    'x34.lg.straight': ['الخط المستقيم بين البلدتين', 'הקו הישר בין שתי העיירות', 'Straight line between the two towns'],
    'x34.m.island': ['01 · الجزيرة المغلقة: القاعدة، حزام ‎300 m‎، وما يقع على طول السياج', '01 · האי הסגור: הבסיס, רצועת ‎300 m‎ ומה שלאורך הגדר', '01 · The closed island: the base, its 300 m band and what lies along the fence'],
    'x34.m.walk': ['02 · المشي: طرق مسدودة عند السياج والالتفاف حول القاعدة', '02 · הליכה: דרכים ללא מוצא ליד הגדר והעקיפה סביב הבסיס', '02 · Walking: dead ends at the fence and the detour around the base'],
    'x34.m.growth': ['03 · بلدات تنمو، ومترو يتوقف عند القاعدة', '03 · עיירות שגדלות, ומטרו שנעצר ליד הבסיס', '03 · Growing towns, and a metro that stops at the base'],
    'x34.m.height': ['04 · السقف: قيود الارتفاع الجوية (RD 118/2019)', '04 · התקרה: מגבלות הגובה האוויריות (RD 118/2019)', '04 · The ceiling: aeronautical height limits (RD 118/2019)'],
    'x34.lg.l1': ['مترو غرناطة الخط 1 اليوم، ومحطاته (OSM)', 'מטרו גרנדה קו 1 היום, ותחנותיו (OSM)', 'Metro de Granada line 1 today, with its stops (OSM)'],
    'x34.inset.title': ['الخط 1: ألبولوتي ← غرناطة ← أرميا ← لاس غابياس', 'קו 1: אלבולוטה ← גרנדה ← ארמייה ← לאס גאביאס', 'Line 1: Albolote → Granada → Armilla → Las Gabias'],
    'x34.inset.meta': ['‎{n}‎ محطة · ‎{d} min‎ من أرميا لألبولوتي · كل ‎{i} min‎ (وسوم OSM)', '‎{n}‎ תחנות · ‎{d} min‎ מארמייה לאלבולוטה · כל ‎{i} min‎ (תגי OSM)', '{n} stops · {d} min Armilla → Albolote · every {i} min (OSM tags)'],
    'x34.inset.src': ['OSM relation 7183554 · المربع = إطار الخريطة', 'OSM relation 7183554 · המלבן = מסגרת המפה', 'OSM relation 7183554 · the box = this map'],
    'x34.base': ['قاعدة أرميا الجوية', 'בסיס חיל האוויר ארמייה', 'Base Aérea de Armilla'],
    'x34.lg.base': ['القاعدة الجوية: أرض مغلقة (OSM، 371 هكتار)', 'הבסיס: שטח סגור (OSM, ‎371 ha‎)', 'Air base: closed land (OSM, 371 ha)'],
    'x34.lg.band': ['حزام ‎300 m‎ حول السياج', 'רצועת ‎300 m‎ סביב הגדר', '300 m band around the fence'],
    'x34.lg.fence.housing': ['السياج بجانب سكن', 'הגדר ליד מגורים', 'Fence next to housing'],
    'x34.lg.fence.open': ['السياج بجانب أرض مفتوحة', 'הגדר ליד שטח פתוח', 'Fence next to open land'],
    'x34.lg.fence.road': ['السياج بجانب شارع رئيسي', 'הגדר ליד כביש ראשי', 'Fence next to a main road'],
    'x34.lg.fence.green': ['السياج بجانب حديقة أو خضرة', 'הגדר ליד גינה או ירוק', 'Fence next to parks or green'],
    'x34.lg.fence.industry': ['السياج بجانب صناعة', 'הגדר ליד תעשייה', 'Fence next to industry'],
    'x34.lg.route': ['طريق المشي حول القاعدة (المسافة × الخط المستقيم)', 'מסלול הליכה סביב הבסיס (מרחק × קו ישר)', 'Walking route around the base (distance × straight line)'],
    'x34.lg.dead': ['طريق مسدود عند السياج', 'דרך ללא מוצא ליד הגדר', 'Dead end at the fence'],
    'x34.lg.metro': ['تمديد المترو 1 قيد الإنشاء (OSM)', 'הארכת המטרו 1 בבנייה (OSM)', 'Metro line 1 extension under construction (OSM)'],
    'x34.lg.h.above': ['الأرض أعلى من سطح القيد الجوي', 'הקרקע מעל משטח ההגבלה', 'Ground already above the height-limit surface'],
    'x34.lg.h.0-15': ['ارتفاع مسموح ‎0–15 m‎ (تقريب)', 'גובה מותר ‎0–15 m‎ (קירוב)', 'Allowed height 0–15 m (approx.)'],
    'x34.lg.h.15-30': ['ارتفاع مسموح ‎15–30 m‎', 'גובה מותר ‎15–30 m‎', 'Allowed height 15–30 m'],
    'x34.lg.h.30-60': ['ارتفاع مسموح ‎30–60 m‎', 'גובה מותר ‎30–60 m‎', 'Allowed height 30–60 m'],
    'x34.lg.built': ['مبانٍ (OSM)', 'מבנים (OSM)', 'Buildings (OSM)'],
    'x34.lg.muni2': ['حدود البلديات (النسبة عند كل بلدة = تغيّر السكان 2015→2025، INE)', 'גבולות רשויות (האחוז ליד כל עיירה = שינוי תושבים 2015→2025, INE)', 'Municipal boundaries (the % at each town = residents change 2015→2025, INE)'],
    'x34.lg.muni': ['حدود البلديات؛ اللون = تغيّر السكان 2015→2025 (INE)', 'גבולות רשויות; צבע = שינוי תושבים 2015→2025 (INE)', 'Municipal boundaries; tint = residents change 2015→2025 (INE)'],
  });
})(window);
