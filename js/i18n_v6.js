/* v6 strings: standalone sections, classified climate/environment rasters, historical overlays, street reveal. [ar, he, en] */
(function (root) {
  root.GA.i18n.add({
    // ----- standalone sections -----
    'v6.drawSection': ['رسم مقطع', 'שרטוט חתך', 'Draw section'],
    'v6.drawSectionHint': ['ارسموا مقطعًا A–B أو متعدد الأجزاء في أي مكان — دون اختيار منطقة دراسة', 'שרטטו חתך A–B או רב־קטעי בכל מקום — ללא בחירת אזור מחקר', 'Draw an A–B or multi-segment section anywhere — no study area needed'],
    'v6.orSection': ['أو مقطع بلا منطقة دراسة:', 'או חתך ללא אזור מחקר:', 'Or a section, no study area needed:'],
    'v6.standalone': ['مقطع مستقل', 'חתך עצמאי', 'Standalone section'],
    'v6.secInFabric': ['المقاطع هنا تابعة للنسيج {n}.', 'החתכים כאן שייכים למרקם {n}.', 'Sections here belong to the fabric {n}.'],
    'v6.secStandaloneNote': ['لا يلزم اختيار منطقة: تُحفظ المقاطع المستقلة في هذا المتصفح، ويمكن ربطها بنسيج لاحقًا.', 'אין צורך באזור מחקר: חתכים עצמאיים נשמרים בדפדפן זה, ואפשר לצרף אותם למרקם בהמשך.', 'No study area needed: standalone sections are saved in this browser and can be attached to a fabric later.'],
    'v6.secNoneStandalone': ['لا توجد مقاطع بعد. اضغطوا «رسم مقطع» وانقروا على الخريطة: A، ثم نقاط وسيطة اختيارية، ثم B.', 'אין עדיין חתכים. לחצו «שרטוט חתך» ולחצו על המפה: A, נקודות ביניים אופציונליות, ואז B.', 'No sections yet. Press “Draw section” and click on the map: A, optional intermediate points, then B.'],
    'v6.attach': ['ربط بنسيج…', 'צירוף למרקם…', 'Attach to a fabric…'],
    'v6.noFabrics': ['لا توجد أنسجة محفوظة بعد', 'אין עדיין מרקמים שמורים', 'No saved fabrics yet'],
    'v6.attachNote': ['يُنقل المقطع {n} إلى النسيج المختار ويظهر في تحليله وتصديراته.', 'החתך {n} יועבר למרקם שנבחר ויופיע בניתוח ובייצוא שלו.', 'The section {n} moves into the chosen fabric and appears in its analysis and exports.'],
    'v6.attached': ['رُبط «{n}» بالنسيج «{a}».', '«{n}» צורף למרקם «{a}».', '“{n}” attached to “{a}”.'],
    'v6.standaloneList': ['المقاطع المستقلة ({n})', 'חתכים עצמאיים ({n})', 'Standalone sections ({n})'],
    'v6.covDem': ['{p}% من خط المقطع خارج نموذج الارتفاع (MDT25)؛ تُترك تلك الأجزاء فارغة.', '{p}% מקו החתך מחוץ למודל הגובה (MDT25); חלקים אלה נשארים ריקים.', '{p}% of the line lies outside the terrain model (MDT25); those parts are left blank.'],
    'v6.covBld': ['{p}% من خط المقطع خارج نطاق بيانات المباني المنشورة؛ لا تظهر مبانٍ هناك (غياب بيانات، لا غياب مبانٍ).', '{p}% מקו החתך מחוץ לתחום נתוני המבנים שפורסמו; לא יוצגו שם מבנים (היעדר נתונים, לא היעדר מבנים).', '{p}% of the line lies outside the published building data; no buildings are drawn there (missing data, not missing buildings).'],
    'v6.geojson': ['GeoJSON', 'GeoJSON', 'GeoJSON'],
    // ----- classified rasters -----
    'rc.noData': ['بلا قيمة (غيوم/ماء/خارج التغطية)', 'ללא ערך (עננים/מים/מחוץ לכיסוי)', 'no value (cloud, water or no coverage)'],
    'rc.classified': ['الألوان: فئات الأطلس، محوّلة من تصنيف الخدمة المنشور.', 'צבעים: מחלקות האטלס, מומרות מהסיווג שפרסם השירות.', 'Colours: atlas classes, converted from the service’s published classification.'],
    'rc.lstMethod': ['كل بكسل يُعاد إلى قيمته بالكلفن عبر جدول ألوان GIBS الرسمي ثم يُصنَّف بالدرجات المئوية.', 'כל פיקסל מוחזר לערכו בקלווין לפי טבלת הצבעים הרשמית של GIBS ואז מסווג במעלות צלזיוס.', 'Each pixel is converted back to kelvin with the official GIBS colormap, then classed in °C.'],
    'rc.lstFallback': ['تعذّر تحميل جدول الألوان؛ تظهر ألوان الخدمة الأصلية ومفتاحها.', 'טבלת הצבעים לא נטענה; מוצגים צבעי השירות המקוריים ומקרא השירות.', 'The colour table could not be loaded; the service’s original colours and legend are shown.'],
    // ----- historical explorer overlays -----
    'hx.overlays': ['طبقات فوق الخريطة', 'שכבות מעל המפה', 'Overlays'],
    'hx.placesLayer': ['أماكن مرتبطة (ويكيبيديا)', 'מקומות מקושרים (ויקיפדיה)', 'Linked places (Wikipedia)'],
    'hx.placesLegend': ['النقاط الحمراء: مواقع حالية لمقالات ويكيبيديا الإسبانية المدرجة تحت «أماكن مرتبطة». ليست جزءًا من الخريطة التاريخية. انقروا نقطة لمعرفة المصدر.', 'הנקודות האדומות: מיקומים עכשוויים של ערכי ויקיפדיה בספרדית המופיעים תחת «מקומות מקושרים». אינן חלק מהמפה ההיסטורית. לחצו על נקודה למקור.', 'Red dots: present-day positions of the Spanish-Wikipedia articles listed under “Linked places”. They are not part of the historical map. Click a dot for its source.'],
    'hx.areasLayer': ['أنسجتي المحفوظة (حدود متقطعة)', 'המרקמים השמורים שלי (קו מקווקו)', 'My saved fabrics (dashed outline)'],
    'hx.placeMeaning': ['مكان مرتبط: الموقع الحالي لمقالة ويكيبيديا (es)، وليس معلمًا مرسومًا على الخريطة التاريخية.', 'מקום מקושר: המיקום העכשווי של ערך ויקיפדיה (es), לא פרט המצויר במפה ההיסטורית.', 'Linked place: the present-day position of a Wikipedia (es) article — not a feature drawn on the historical map.'],
    'hx.placeRev': ['المقالة عُدّلت في {d}', 'הערך עודכן ב־{d}', 'article revised {d}'],
    // ----- streets -----
    'v6.streetsReveal': ['تظهر الطرق الرئيسية أولًا؛ تقوى الشوارع المحلية ثم ممرات المشاة تدريجيًا مع التقريب.', 'הדרכים הראשיות מוצגות תחילה; רחובות מקומיים ואז שבילי הולכי רגל מתחזקים בהדרגה עם ההתקרבות.', 'Major roads show first; local streets, then pedestrian paths, gain strength as you zoom in.'],
  });
})(window);
