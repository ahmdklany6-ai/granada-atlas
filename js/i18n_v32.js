/* v32 strings (build 5.40): the identity map (page 00 of Exercise 1.3) as an illustrated map — central Granada with its
   landmarks drawn in 3D line. [ar, he, en]. Numbers stay left-to-right. */
(function (root) {
  root.GA.i18n.add({
    'x32.styleHint': ['الفنية: خريطة مصوّرة لوسط غرناطة (5 × 5 كم) مع أشهر معالمها مرسومة بخط ثلاثي الأبعاد في مواقعها الحقيقية. المعمارية: خريطة الموقع.', 'אמנותית: מפה מאוירת של מרכז גרנדה (5 × 5 ק"מ) עם האתרים המוכרים ביותר בקו תלת־ממדי במקומם האמיתי. אדריכלית: מפת ההתמצאות.', 'Artistic: an illustrated map of central Granada (5 × 5 km) with its best-known landmarks drawn in 3D line at their real positions. Architectural: the locator map.'],
    'x32.note': ['رسوم المعالم توضيحية تخطيطية في مواقعها الحقيقية (OpenStreetMap / Overture): أشكال مبسّطة ومكبّرة، ليست بمقياس الرسم ولا مقاسة. الأساس: شوارع وحدائق وأنهار OpenStreetMap (ODbL)، وخطوط كنتور ‎10 m‎ من IGN MDT25 ‏(CC BY 4.0)، والمدينة المبنية من مباني OpenStreetMap. ‎5 × 5 km‎ · EPSG:25830.', 'איורי האתרים הם סכמטיים וממוקמים במקומם האמיתי (OpenStreetMap / Overture): צורות מפושטות ומוגדלות, לא בקנה מידה ולא נמדדו. בסיס: רחובות, פארקים ונהרות OpenStreetMap ‏(ODbL), קווי גובה ‎10 m‎ מ־IGN MDT25 ‏(CC BY 4.0), העיר הבנויה ממבני OpenStreetMap. ‎5 × 5 km‎ · EPSG:25830.', 'Landmark drawings are schematic illustrations at their real positions (OpenStreetMap / Overture): shapes simplified and enlarged, not to scale and not measured. Base: OpenStreetMap streets, parks and rivers (ODbL), 10 m contours from IGN MDT25 (CC BY 4.0), built-up city from OpenStreetMap buildings. 5 × 5 km · EPSG:25830.'],
    'x32.lg.streets': ['الشوارع (OpenStreetMap)', 'רחובות (OpenStreetMap)', 'Streets (OpenStreetMap)'],
    'x32.lg.rivers': ['الأنهار: حدرة، شنيل، بيرو', 'נהרות: דארו, חניל, ביירו', 'Rivers: Darro, Genil, Beiro'],
    'x32.lg.hills': ['التلال والسهل خارج المدينة المبنية (كنتور ‎10 m‎)', 'גבעות ומישור מחוץ לעיר הבנויה (קווי גובה ‎10 m‎)', 'Hills and fields outside the built city (10 m contours)'],
    'x32.lg.city': ['المدينة المبنية', 'העיר הבנויה', 'Built-up city'],
    'x32.lg.landmarks': ['معالم: رسم تخطيطي ليس بمقياس الرسم', 'אתרים: איור סכמטי, לא בקנה מידה', 'Landmarks: schematic drawing, not to scale'],
    'x32.ch.title': ['السكان 2015 ← 2025: التغيّر', 'תושבים 2015 → 2025: שינוי', 'Residents 2015 → 2025: change'],
    'x32.ch.city': ['مدينة غرناطة', 'העיר גרנדה', 'Granada city'],
    'x32.ch.rest': ['باقي التجمّع الحضري', 'שאר המטרופולין', 'Rest of the agglomeration'],
    'x32.ch.five': ['البلدات الخمس جنوباً', 'חמש העיירות בדרום', 'Five southern towns'],
    'x32.f.spain': ['إسبانيا', 'ספרד', 'Spain'],
    'x32.f.andalucia': ['الأندلس · محافظة غرناطة', 'אנדלוסיה · מחוז גרנדה', 'Andalucía · province of Granada'],
    'x32.f.metro': ['التجمّع الحضري · 34 بلدية', 'המטרופולין · 34 רשויות', 'Agglomeration · 34 municipalities'],
    'x32.sec.title': ['مقطع من الغرب إلى الشرق عبر الكاتدرائية والحمراء (IGN MDT25، الارتفاع مضخّم)', 'חתך ממערב למזרח דרך הקתדרלה והאלהמברה (IGN MDT25, גובה מוגזם)', 'Section west → east through the cathedral and the Alhambra (IGN MDT25, height exaggerated)'],
    'x32.aerialH': ['المركز من الأعلى (PNOA)', 'המרכז מלמעלה (PNOA)', 'The centre from above (PNOA)'],
    'x32.fiveShort': ['الخرائط الخمس', 'חמש המפות', 'The five maps'],
    'x32.lgH': ['مفتاح الخريطة', 'מקרא', 'Legend'],
    'x32.five': ['الخرائط الخمس في هذه البطاقة', 'חמש המפות בכרטיס זה', 'The five maps of this card'],
    'x32.aerial': ['المركز من الأعلى: البيازين، الكاتدرائية، الحمراء. PNOA © IGN (CC BY 4.0)', 'המרכז מלמעלה: אלבאיסין, הקתדרלה, האלהמברה. PNOA © IGN (CC BY 4.0)', 'The centre from above: Albaicín, cathedral, Alhambra. PNOA © IGN (CC BY 4.0)'],
    'x32.src': ['خرائط الموقع: es-atlas (MIT، بيانات IGN بترخيص CC BY 4.0)، بدون جزر الكناري؛ بلديات التجمّع وسكانها: INE.', 'מפות התמצאות: es-atlas (MIT, נתוני IGN ברישיון CC BY 4.0), ללא האיים הקנריים; רשויות המטרופולין ותושביהן: INE.', 'Locator maps: es-atlas (MIT; IGN data, CC BY 4.0), Canary Islands not shown; agglomeration municipalities and residents: INE.'],
  });
})(window);
