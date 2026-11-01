/* v9 strings (build 5.9): boundaries, construction-period coverage, water and runoff, infrastructure, wind and rainfall,
   historical landmarks, print layout. [ar, he, en] */
(function (root) {
  root.GA.i18n.add({
    // ----- boundaries -----
    'v9.lyMuni': ['حدود بلدية غرناطة (الخارجية)', 'גבול עיריית גרנדה (חיצוני)', 'Granada municipality (outer boundary)'],
    'v9.lgMuni': ['الحدود الإدارية لبلدية غرناطة', 'הגבול המנהלי של עיריית גרנדה', 'Administrative boundary of the municipality of Granada'],
    'v9.muniNote': ['بلدية غرناطة فقط (الحدود البلدية الرسمية كما في OSM) — ليست المنطقة الحضرية الكبرى ولا البصمة الحضرية GHSL. تُحفظ كل الأجزاء كما رُسمت.', 'עיריית גרנדה בלבד (הגבול העירוני כפי שמופה ב-OSM) — לא המטרופולין ולא טביעת הרגל העירונית של GHSL. כל החלקים נשמרים כפי שמופו.', 'The municipality of Granada only (its administrative boundary as mapped in OSM) — not the metropolitan area and not the GHSL urban footprint. Every mapped part is kept.'],
    'v9.lyNeigh': ['حدود الأحياء', 'גבולות השכונות', 'Neighbourhood boundaries'],
    'v9.neighNote': ['32 حيًّا (barrios، OSM admin_level 10) داخل البلدية.', '32 שכונות (barrios, OSM admin_level 10) בתוך העירייה.', '32 neighbourhoods (barrios, OSM admin_level 10) inside the municipality.'],
    'v9.lyDistricts': ['المناطق والمركز الحضري', 'רובעים ומרכז עירוני', 'Districts and urban centre'],
    'v9.ghslNote': ['المركز الحضري GHSL تعريف إحصائي أوروبي للتجمّع العمراني، وليس حدًّا إداريًّا.', 'המרכז העירוני של GHSL הוא הגדרה סטטיסטית אירופית של הרצף הבנוי, לא גבול מנהלי.', 'The GHSL urban centre is a European statistical definition of the built-up agglomeration, not an administrative boundary.'],
    // ----- construction period -----
    'v9.periodUnknown': ['فترة البناء غير معروفة (لا يوجد start_date)', 'תקופת בנייה לא ידועה (אין start_date)', 'Construction period unknown (no start_date)'],
    'v9.periodCoverage': ['{d} من {n} مبنى فقط تحمل تاريخًا صالحًا في OSM.', 'רק ל-{d} מתוך {n} מבנים יש תאריך שמיש ב-OSM.', 'Only {d} of {n} buildings carry a usable date in OSM.'],
    'v9.periodNote': ['الفجوة في بيانات المصدر وليست خطأ عرض؛ لا تُخترع تواريخ. مصدر أفضل: سنة البناء في السجل العقاري (Catastro INSPIRE).', 'הפער הוא בנתוני המקור ולא בתצוגה; לא ממציאים תאריכים. מקור טוב יותר: שנת הבנייה ב-Catastro (INSPIRE).', 'The gap is in the source data, not the display; no dates are invented. A better source would be the year of construction in the Spanish cadastre (Catastro INSPIRE buildings).'],
  });
})(window);
