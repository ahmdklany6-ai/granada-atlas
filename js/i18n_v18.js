/* v18 strings (build 5.20): the southern-axis layers — metro extension under construction, the 1931 tram, the Escúzar
   estate with IFMIF-DONES. [ar, he, en]. Numbers and units are passed already formatted; they stay left-to-right. */
(function (root) {
  root.GA.i18n.add({
    'ly.g.south': ['الأساسيات: محور الجنوب', 'בסיס: ציר הדרום', 'Essentials: southern axis'],
    'v18.lyMetro': ['مترو الجنوب 2026', 'הרכבת הקלה דרומה 2026', 'Southern metro 2026'],
    'v18.lyTram': ['ترام Gabia القديم (1931)', 'החשמלית ל-Gabia (1931)', 'Old Gabia tram (1931)'],
    'v18.lyPole': ['Escúzar والمسرّع', 'Escúzar והמאיץ', 'Escúzar and accelerator'],
    'v18.fit': ['اعرض على الخريطة', 'הצג במפה', 'Show on the map'],
    'v18.fitAll': ['اعرض المحور كله', 'הצג את כל הציר', 'Show the whole axis'],
    // metro
    'v18.lgTrack': ['السكة الجديدة قيد الإنشاء، أرميا ← Churriana ← Las Gabias ({km} كم)', 'המסילה החדשה בבנייה, Armilla ← Churriana ← Las Gabias ({km} ק״מ)', 'New track under construction, Armilla → Churriana → Las Gabias ({km} km)'],
    'v18.lgNow': ['آخر محطة اليوم (أرميا)', 'התחנה הסופית היום (Armilla)', 'End of the line today (Armilla)'],
    'v18.lgEnd': ['آخر السكة الجديدة: Las Gabias، ساحة Estación de Tranvías', 'סוף המסילה החדשה: Las Gabias, כיכר Estación de Tranvías', 'End of the new track: Las Gabias, Plaza Estación de Tranvías'],
    'v18.metroNote': ['سكة واحدة من الخط المزدوج كما هي مرسومة في OpenStreetMap وهي قيد الإنشاء. المحطات السبع الجديدة غير مرسومة بعد، فلا نرسمها. لم يُعلن موعد الافتتاح.', 'מסילה אחת מהקו הכפול כפי שמופה ב-OpenStreetMap בזמן הבנייה. שבע התחנות החדשות עדיין לא מופו, ולכן אינן מוצגות. לא פורסם מועד פתיחה.', 'One track of the double line as mapped in OpenStreetMap while under construction. The seven new stations are not mapped yet, so they are not drawn. No opening date has been announced.'],
    // tram
    'v18.lgTram': ['خط Granada–Gabia (افتُتح 1918، أُغلق 1974)', 'קו Granada–Gabia (נפתח 1918, נסגר 1974)', 'Granada–Gabia line (opened 1918, closed 1974)'],
    'v18.lgTrunk': ['الخط الرئيسي نحو Alhendín (المقطع الظاهر فقط)', 'הקו הראשי לכיוון Alhendín (רק הקטע המוצג)', 'Main line towards Alhendín (shown stretch only)'],
    'v18.lgTramSt': ['محطة كما طُبعت على خريطة 1931', 'תחנה כפי שהודפסה במפה של 1931', 'Station as printed on the 1931 map'],
    'v18.tramNote': ['منقول باليد عن خريطة IGN 1:50,000 (الطبعة الأولى، لوحة 1026، 1931) حيث كُتب «Tranvía de Granada a Gabia»، ثم مُطابق مع الصور الجوية. الموقع تقريبي (± 100 م).', 'הועתק ביד ממפת IGN ‏1:50,000 (מהדורה ראשונה, גיליון 1026, 1931), שבה נכתב «Tranvía de Granada a Gabia», ולאחר מכן הותאם לצילומי האוויר. המיקום משוער (± 100 מ׳).', 'Traced by hand from the IGN 1:50,000 map (1st edition, sheet 1026, 1931), where it is labelled “Tranvía de Granada a Gabia”, then aligned to aerial imagery. Approximate position (± 100 m).'],
    // pole
    'v18.lgEstate': ['حدود منطقة CITAI ({ha} هكتار)', 'גבול אזור CITAI ‏({ha} הקטאר)', 'CITAI estate boundary ({ha} ha)'],
    'v18.lgScience': ['علوم: IFMIF-DONES (مبنى UGR-DONES)', 'מדע: IFMIF-DONES (בניין UGR-DONES)', 'Science: IFMIF-DONES (UGR-DONES building)'],
    'v18.lgLogistics': ['لوجستيك: Lidl، Amazon', 'לוגיסטיקה: Lidl, Amazon', 'Logistics: Lidl, Amazon'],
    'v18.lgIndustry': ['صناعة: Knauf', 'תעשייה: Knauf', 'Industry: Knauf'],
    'v18.lgVillage': ['قرية Escúzar: {n} ساكن ({y})', 'הכפר Escúzar: {n} תושבים ({y})', 'Escúzar village: {n} residents ({y})'],
    'v18.lgGap': ['من آخر محطة مترو إلى المسرّع: {km} كم بخط مستقيم، بلا سكة', 'מהתחנה הסופית של הרכבת הקלה עד המאיץ: {km} ק״מ בקו אווירי, בלי מסילה', 'Metro terminus to the accelerator: {km} km straight line, no rail'],
    'v18.poleNote': ['الأشكال من OpenStreetMap. شكل IFMIF-DONES هو قطعة مبنى UGR-DONES فقط وليس كل أرض المشروع. الوظائف والاستثمارات أرقام أعلنها أصحابها، وليست عدًّا.', 'הצורות מ-OpenStreetMap. צורת IFMIF-DONES היא רק מגרש בניין UGR-DONES, לא כל שטח הפרויקט. המשרות וההשקעות הן נתונים שפרסמו הבעלים, לא ספירה.', 'Shapes from OpenStreetMap. The IFMIF-DONES shape is the UGR-DONES building plot only, not the whole project site. Jobs and investment are figures announced by the operators, not counts.'],
    'v18.opened': ['البداية', 'התחלה', 'Opened'],
    'v18.jobs': ['الوظائف (حسب المعلن)', 'משרות (לפי ההודעה)', 'Jobs (as announced)'],
    'v18.inv': ['الاستثمار (حسب المعلن)', 'השקעה (לפי ההודעה)', 'Investment (as announced)'],
    'v18.area': ['المساحة', 'שטח', 'Area'],
    'v18.notPub': ['غير منشور', 'לא פורסם', 'not published'],
  });
})(window);
