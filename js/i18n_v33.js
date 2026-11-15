/* v33 strings (build 5.45): the tour's "five towns" slide draws every residential area of the five municipalities — the
   town centres, their separate neighbourhoods and villages, and groups of scattered houses — each with its own popup.
   [ar, he, en]. Numbers and units arrive as left-to-right spans from js/tour.js. */
(function (root) {
  root.GA.i18n.add({
    'x45.s2.l1t': ['أين يسكن الناس حول القاعدة (استعمال الأرض السكني والبيوت في OSM، بالطريقة نفسها للبلديات الخمس): مراكز البلدات، وأحياؤها وقراها المنفصلة، وبلون أفتح وخط متقطّع مجموعات البيوت المتفرقة. معًا {n} نسمة (INE، ‏1 كانون الثاني 2025). انقر على أي منطقة لترى أرقامها.',
      'היכן גרים סביב הבסיס (שימוש קרקע למגורים ובתים ב־OSM, באותה שיטה לכל חמש הרשויות): מרכזי העיירות, השכונות והכפרים הנפרדים שלהן, ובצבע בהיר יותר ובקו מקווקו קבוצות של בתים מפוזרים. יחד {n} תושבים (INE, ‏1 בינואר 2025). לחצו על אזור לנתונים שלו.',
      'Where people live around the base (OSM residential land use and houses, the same method for all five municipalities): the town centres, their separate neighbourhoods and villages and, lighter with a dashed outline, groups of scattered houses. Together {n} residents (INE, 1 January 2025). Click an area for its figures.'],
    'x45.s2.l1src': ['OpenStreetMap ‏(ODbL): استعمال الأرض السكني وبصمات البيوت، مقطوعة عند حدود البلديات (خطوط OSM، والأسماء حسب IGN ‏CC BY 4.0)؛ روجعت المناطق على الصورة الجوية PNOA ‏(© IGN، ‏CC BY 4.0) · tools/build_tour_towns.py · السكان: INE، الجدول 2871',
      'OpenStreetMap ‏(ODbL): שימוש קרקע למגורים וקווי מתאר של בתים, חתוכים בגבולות הרשויות (קווי OSM, שמות לפי IGN ‏CC BY 4.0); האזורים נבדקו מול תצלום האוויר PNOA ‏(© IGN, ‏CC BY 4.0) · tools/build_tour_towns.py · תושבים: INE, טבלה 2871',
      'OpenStreetMap (ODbL): residential land use and house footprints, cut at the municipal boundaries (OSM lines, named with IGN, CC BY 4.0); the areas were checked on the PNOA orthophoto (© IGN, CC BY 4.0) · tools/build_tour_towns.py · residents: INE table 2871'],
    'x45.lgTown': ['منطقة سكنية متصلة: مراكز البلدات وأحياؤها وقراها', 'אזור מגורים רצוף: מרכזי העיירות, שכונות וכפרים', 'Continuous residential area: town centres, neighbourhoods and villages'],
    'x45.lgScatter': ['بيوت متفرقة على أراضٍ زراعية (مجموعات من {n} بيوت أو أكثر)', 'בתים מפוזרים על חלקות חקלאיות (קבוצות של {n} בתים ומעלה)', 'Scattered houses on rural plots (groups of {n} or more)'],
    'x45.kind.core': ['مركز البلدة: المنطقة السكنية المتصلة حول مركزها', 'מרכז העיירה: אזור המגורים הרצוף סביב מרכזה', 'Town centre: the continuous residential area around the centre of the town'],
    'x45.kind.part': ['حيّ أو قرية منفصلة تابعة لهذه البلدية', 'שכונה או כפר נפרדים השייכים לרשות הזו', 'A separate neighbourhood or village of this municipality'],
    'x45.kind.scatter': ['بيوت متفرقة على أراضٍ زراعية: {n} بيوت أو أكثر، كل بيت يبعد عن التالي أقل من {d}. الحدّ مرسوم على بُعد {o} حولها، فيضمّ الأراضي والطرق التي بينها.',
      'בתים מפוזרים על חלקות חקלאיות: {n} בתים ומעלה, כל בית במרחק של פחות מ־{d} מהבא. קו המתאר עובר {o} סביבם, ולכן כולל גם את החלקות והדרכים שביניהם.',
      'Scattered houses on rural plots: {n} or more houses, each less than {d} from the next. The outline runs {o} around them, so it holds the plots and lanes between them.'],
    'x45.area.core': ['مساحة مركز البلدة', 'שטח מרכז העיירה', 'Area of the town centre'],
    'x45.area.part': ['مساحة هذا الجزء', 'שטח החלק הזה', 'Area of this part'],
    'x45.area.scatter': ['المساحة داخل الحدّ', 'השטח בתוך קו המתאר', 'Area inside the outline'],
    'x45.houses': ['بيوت مرسومة في OSM (حدّ أدنى: بعضها ناقص)', 'בתים ממופים ב־OSM (חסם תחתון: חלקם חסרים)', 'Houses mapped in OSM (a lower bound: some are missing)'],
    'x45.popSrc': ['المناطق: OpenStreetMap ‏(ODbL)، روجعت على الصورة الجوية PNOA ‏(© IGN، ‏CC BY 4.0) · السكان: INE، الجدول 2871',
      'האזורים: OpenStreetMap ‏(ODbL), נבדקו מול תצלום האוויר PNOA ‏(© IGN, ‏CC BY 4.0) · תושבים: INE, טבלה 2871',
      'Areas: OpenStreetMap (ODbL), checked on the PNOA orthophoto (© IGN, CC BY 4.0) · residents: INE table 2871'],
    'x45.pop': ['سكان البلدية كلها، 1 كانون الثاني 2025', 'תושבי הרשות כולה, 1 בינואר 2025', 'Residents of the whole municipality, 1 January 2025'],
  });
})(window);
