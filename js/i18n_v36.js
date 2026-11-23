/* Build 5.50 — the analysis cards that were empty for study areas south of the city (owner report, 23 Nov 2026,
   "analysis_Base" PDF): construction years from the Catastro, data coverage ("outside the data", never 0), and the
   extended places, bus, trees, canopy and noise sources. [ar, he, en]. Numbers stay left-to-right (⁦…⁩). */
(function (root) {
  root.GA.i18n.add({
    // construction periods: OSM start_date + the Catastro year of construction
    'v36.withYear': ['مبانٍ لها سنة بناء', 'מבנים עם שנת בנייה', 'Buildings with a construction year'],
    'v36.yearSrc': ['مصدر السنة', 'מקור השנה', 'Source of the year'],
    'v36.yearSrcV': ['OSM ‏{o} · الكاتاسترو ‏{c}', 'OSM ‏{o} · קדסטר ‏{c}', 'OSM {o} · Catastro {c}'],
    'v36.bldUnit': ['مبانٍ', 'מבנים', 'buildings'],
    'v36.catDetail': ['سنة البناء من سجل الكاتاسترو (INSPIRE، ⁦2026⁩) حيث لا يوجد تاريخ في OSM', 'שנת הבנייה מרשם הקדסטר (INSPIRE, ⁦2026⁩) כשאין תאריך ב-OSM', 'Year of construction from the Catastro (INSPIRE, 2026) where OSM has no date'],
    'v36.catCaveat': ['سنة الكاتاسترو هي سنة البناء المسجّلة للمبنى المسّاحي؛ ترميم كبير قد يغيّرها. مبنى بلا سنة يبقى «بلا بيانات».', 'שנת הקדסטר היא שנת הבנייה הרשומה למבנה הקדסטרלי; שיפוץ גדול עשוי לשנות אותה. מבנה בלי שנה נשאר "אין נתונים".', 'The Catastro year is the year of construction recorded for the cadastral building; a major renovation can replace it. A building without a year stays "no data".'],
    'v36.mPeriods': ['السنة من start_date في OSM إن وُجد، وإلا من سنة البناء في الكاتاسترو (INSPIRE Buildings، dateOfConstruction): لكل مبنى في OSM وسيط سنوات المباني المسّاحية التي يقع مركزها داخله.', 'השנה מ-start_date ב-OSM אם קיים, אחרת משנת הבנייה בקדסטר (INSPIRE Buildings, dateOfConstruction): לכל מבנה ב-OSM החציון של שנות המבנים הקדסטרליים שמרכזם בתוכו.', 'Year from the OSM start_date where present, otherwise the Catastro year of construction (INSPIRE Buildings, dateOfConstruction): for each OSM building, the median year of the cadastral buildings whose centre falls inside it.'],
    // noise: the road and railway strategic maps are drawn with the agglomeration map (5.50)
    'g3.noiseDetail': ['SICA، المرحلة الثالثة: التجمّع الحضري + الطرق الرئيسية + السكك؛ خريطة البلدية 2022 كملف PDF', 'SICA, שלב שלישי: האגלומרציה + כבישים ראשיים + מסילות; מפת העירייה 2022 כ-PDF', 'SICA, 3rd phase: agglomeration + main roads + railways; municipal 2022 map as PDF'],
    'v36.noiseBlank': ['خارج مدينة غرناطة تُرسم فقط خرائط الطرق الرئيسية والسكك؛ شوارع البلدات غير منمذجة — الفراغ في الخريطة لا يعني الهدوء.', 'מחוץ לעיר גרנדה מוצגות רק מפות הכבישים הראשיים והמסילות; רחובות העיירות אינם ממודלים — ריק במפה אינו אומר שקט.', 'Outside the city of Granada only the main-road and railway maps exist; town streets are not modelled — blank on the map does not mean quiet.'],
    // coverage: an area outside a dataset is missing data, not zero
    'v36.outside': ['خارج نطاق البيانات', 'מחוץ לכיסוי הנתונים', 'outside the data'],
    'v36.outsideNote': ['هذه المنطقة خارج نطاق ملف البيانات، فلا يُعرض عدد (وليس صفرًا).', 'האזור מחוץ לכיסוי קובץ הנתונים, לכן לא מוצג מספר (ולא אפס).', 'This area lies outside the data file’s coverage, so no count is shown (it is not zero).'],
    'v36.outsideBus': ['هذه المنطقة خارج نطاق ملف الجداول الزمنية؛ المحطات المرسومة في OSM في بطاقة «محطات النقل العام».', 'האזור מחוץ לכיסוי קובץ לוחות הזמנים; התחנות הממופות ב-OSM בכרטיס "תחנות תחבורה ציבורית".', 'This area lies outside the timetable file’s coverage; the stops mapped in OSM are in the “Public transport stops” card.'],
    'v36.partial': ['* البيانات تغطي ⁦{p}⁩ فقط من المنطقة؛ الأرقام أقل من الحقيقة.', '* הנתונים מכסים רק ⁦{p}⁩ מהאזור; המספרים נמוכים מהמציאות.', '* The data covers only {p} of the area; the counts are lower than the real ones.'],
  });
})(window);
