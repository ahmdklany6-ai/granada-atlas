/* v10 strings (build 5.10): section trees at true scale, long-section detail view, 3D view, historical explorer framing
   and image cards. [ar, he, en] */
(function (root) {
  root.GA.i18n.add({
    // ----- section trees -----
    'v10.lgTreeSch': ['شجرة بحجم تخطيطي {h} م وتاج {c} م — غير مقيس', 'עץ בגודל סכמטי {h} מ׳ וצמרת {c} מ׳ — לא נמדד', 'tree drawn at a schematic {h} m height and {c} m crown — not measured'],
    'v10.nTreeSch': ['الأشجار بمقياس الرسم نفسه للمباني والأشخاص؛ يُستخدم الارتفاع والتاج المسجّلان كما هما، وما ينقص يُرسم تخطيطيًّا ({h} م، تاج {c} م، متقطع) وليس قياسًا.', 'העצים באותו קנה מידה כמו המבנים והאנשים; גובה וצמרת רשומים משמשים כפי שהם, ומה שחסר משורטט סכמטית ({h} מ׳, צמרת {c} מ׳, מקווקו) ואינו מדידה.', 'Trees are drawn at the same scale as buildings and people; recorded height and crown are used as given, missing values are drawn schematically ({h} m, {c} m crown, dashed) and are not measurements.'],
    'v10.treeH': ['ارتفاع الشجرة التخطيطي', 'גובה עץ סכמטי', 'Schematic tree height'],
    'v10.treeCrown': ['قطر التاج التخطيطي', 'קוטר צמרת סכמטי', 'Schematic crown diameter'],
    'v10.treeSchHint': ['يُطبَّق فقط على الأشجار التي لا يُسجَّل لها ارتفاع أو تاج في OSM؛ لا يغيّر القيم المسجّلة.', 'חל רק על עצים שאין להם גובה או צמרת רשומים ב-OSM; אינו משנה ערכים רשומים.', 'Applies only to trees without a recorded height or crown in OSM; recorded values are never changed.'],
    // ----- long sections -----
    'v10.view': ['العرض', 'תצוגה', 'View'],
    'v10.full': ['المقطع كاملًا', 'החתך המלא', 'Full section'],
    'v10.detail': ['تفاصيل الشارع', 'פרטי הרחוב', 'Street detail'],
    'v10.overview': ['نظرة عامة على المقطع والجزء الظاهر', 'מבט כולל על החתך והחלק המוצג', 'Overview of the section and the visible part'],
    'v10.panBack': ['إزاحة إلى الخلف على طول المقطع', 'הזזה אחורה לאורך החתך', 'Move back along the section'],
    'v10.panFwd': ['إزاحة إلى الأمام على طول المقطع', 'הזזה קדימה לאורך החתך', 'Move forward along the section'],
    'v10.position': ['موضع الجزء الظاهر', 'מיקום החלק המוצג', 'Position of the visible part'],
    'v10.fitHeight': ['ملاءمة الارتفاع', 'התאמה לגובה', 'Fit height'],
    'v10.fitAll': ['ملاءمة المقطع كاملًا', 'התאמה לחתך כולו', 'Fit entire section'],
    'v10.viewNote': ['«تفاصيل الشارع» يعرض جزءًا من الخط بالمقياس نفسه (حقيقي أو مبالغة معلنة) — لا يُمطّ أي ارتفاع. التصدير يأخذ العرض الظاهر مع خريطة الموقع.', '«פרטי הרחוב» מציג חלק מהקו באותו קנה מידה (אמיתי או הגזמה מוצהרת) — שום גובה אינו נמתח. הייצוא לוקח את התצוגה המוצגת עם מפת המיקום.', '"Street detail" shows part of the line at the same scale (true, or a stated exaggeration) — no height is stretched. Exports take the view on screen, with the locator.'],
    'v10.detailOf': ['تفاصيل {a}–{b} م من {L} م', 'פרט {a}–{b} מ׳ מתוך {L} מ׳', 'detail {a}–{b} m of {L} m'],
    // ----- historical explorer -----
    'v10.zoomGranada': ['تكبير إلى غرناطة', 'התמקדות בגרנדה', 'Zoom to Granada'],
    'v10.fitHist': ['ملاءمة الخريطة التاريخية', 'התאמה למפה ההיסטורית', 'Fit historical map'],
    'v10.histExtent': ['«{p}» سلسلة وطنية من IGN تغطي إسبانيا كلها؛ يعرضها المستكشف من التكبير 11 (نحو 30 كم) حول غرناطة.', '«{p}» היא סדרה ארצית של IGN המכסה את כל ספרד; הסייר מציג אותה מזום 11 (כ-30 ק״מ) סביב גרנדה.', '"{p}" is a national IGN series covering all of Spain; the explorer shows it from zoom 11 (about 30 km across) around Granada.'],
    'v10.openImage': ['فتح الصورة كاملة', 'פתיחת התמונה המלאה', 'Open the full image'],
    // ----- 3D view -----
    'v10.to3d': ['التبديل إلى العرض ثلاثي الأبعاد', 'מעבר לתצוגה תלת-ממדית', 'Switch to the 3D view'],
    'v10.to2d': ['العودة إلى العرض ثنائي الأبعاد', 'חזרה לתצוגה דו-ממדית', 'Back to the 2D view'],
    'v10.resetView': ['إعادة ضبط العرض', 'איפוס התצוגה', 'Reset view'],
    'v10.no3d': ['هذا الجهاز أو المتصفح لا يدعم العرض ثلاثي الأبعاد.', 'מכשיר או דפדפן זה אינו תומך בתצוגה תלת-ממדית.', 'This device or browser does not support the 3D view.'],
    'v10.note3d': ['<b>عرض ثلاثي الأبعاد تقريبي.</b> الأرض من MDT25 (25 م) داخل مربع 20 كم فقط، وخارجه مسطّحة عند قيمة الحافة. المباني تظهر من التكبير 14 تقريبًا: الارتفاع المسجّل كتلة داكنة، والمقدّر من عدد الطوابق × 3 م كتلة أفتح، وما لا بيانات له يبقى مسطّحًا. كتل بسيطة بلا تفاصيل واجهات — ليست نماذج ممسوحة. الرسم الدقيق للمناطق والمقاطع أسهل في العرض ثنائي الأبعاد.', '<b>תצוגה תלת-ממדית משוערת.</b> הקרקע מ-MDT25 ‏(25 מ׳) רק בתוך ריבוע 20 ק״מ, ומחוצה לו שטוחה בערך הקצה. מבנים מופיעים מזום 14 בערך: גובה רשום — גוש כהה, גובה מוערך מקומות × 3 מ׳ — גוש בהיר, ובלי נתונים — נשאר שטוח. גושים פשוטים ללא פרטי חזית — אינם מודלים שנמדדו. שרטוט מדויק של אזורים וחתכים קל יותר בדו-ממד.', '<b>Approximate 3D view.</b> Terrain from MDT25 (25 m) inside the 20 km square only; outside it the surface is flat at the edge value. Buildings appear from about zoom 14: tagged height as a solid block, floors × 3 m as a lighter ESTIMATE, no data left flat. Plain blocks with no façade detail — not surveyed models. Precise drawing of areas and sections is easier in 2D.'],
  });
})(window);
