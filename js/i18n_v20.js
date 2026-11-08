/* v20 strings (build 5.22): Exercise 1.3 morphology in the artistic map language (a notation on a 250 m grid), its
   layer player and the per-layer PNG export. [ar, he, en]. Numbers and units are passed already formatted; they stay
   left-to-right. */
(function (root) {
  root.GA.i18n.add({
    'x20.style': ['لغة الخريطة', 'שפת המפה', 'Map language'],
    'x20.arch': ['معمارية', 'אדריכלית', 'Architectural'],
    'x20.art': ['فنية', 'אמנותית', 'Artistic'],
    'x20.styleHint': ['الفنية: كل خلية ‎250‎ م بلون حسب نسبة البناء فيها، وخط بني حول النسيج المرصوص المتصل، والساحات كشبكة. تتغير الخريطة والمفتاح والتصدير معًا.',
      'אמנותית: כל תא של ‎250‎ מ׳ בגוון לפי שיעור הבינוי בו, קו חום סביב המרקם הצפוף הרציף, והכיכרות כרשת. המפה, המקרא והייצוא משתנים יחד.',
      'Artistic: each 250 m cell takes a tone from its built share, a brown line runs around contiguous compact fabric, and squares are a lattice. The map, legend and exports change together.'],
    'x20.lg.sparse': ['نسيج متفرّق: أقل من ‎15 %‎ من الخلية مبني ({p} من المساحة المبنية)', 'מרקם דליל: פחות מ-‎15 %‎ מהתא בנוי ({p} מהשטח הבנוי)', 'sparse fabric: under 15 % of the cell built ({p} of the built area)'],
    'x20.lg.medium': ['نسيج متوسط: ‎15–35 %‎ مبني ({p})', 'מרקם בינוני: ‎15–35 %‎ בנוי ({p})', 'medium fabric: 15–35 % built ({p})'],
    'x20.lg.compact': ['نسيج مرصوص: أكثر من ‎35 %‎ مبني ({p})', 'מרקם צפוף: מעל ‎35 %‎ בנוי ({p})', 'compact fabric: over 35 % built ({p})'],
    'x20.lg.edge': ['حافة النسيج المرصوص المتصل', 'שפת המרקם הצפוף הרציף', 'edge of contiguous compact fabric'],
    'x20.lg.square': ['ساحات ومناطق مشاة (OSM)', 'כיכרות ואזורי הולכי רגל (OSM)', 'squares and pedestrian areas (OSM)'],
    'x20.i.cells': ['خلايا ‎250‎ م', 'תאים של ‎250‎ מ׳', '250 m cells'],
    'x20.i.cellsV': ['{s} متفرّقة · {m} متوسطة · {c} مرصوصة', '{s} דלילים · {m} בינוניים · {c} צפופים', '{s} sparse · {m} medium · {c} compact'],
    'x20.c.shares': ['المساحة المبنية حسب نوع النسيج', 'השטח הבנוי לפי סוג המרקם', 'Built area by type of fabric'],
    'x20.k.sparse': ['متفرّق', 'דליל', 'sparse'], 'x20.k.medium': ['متوسط', 'בינוני', 'medium'], 'x20.k.compact': ['مرصوص', 'צפוף', 'compact'],
    'x20.s.morphology': ['{c} من المساحة المبنية في نسيج مرصوص، متصل في المركز والبلدة القديمة، و{m} في نسيج متوسط، و{s} فقط متفرّقة على الأطراف.',
      '{c} מהשטח הבנוי נמצא במרקם צפוף, רציף במרכז ובעיר העתיקה, {m} במרקם בינוני, ורק {s} דליל בשוליים.',
      '{c} of the built area lies in compact fabric, continuous in the centre and the old town; {m} is medium fabric and only {s} is sparse, at the edges.'],
    'x20.lim.art': ['حدود: كل رمز يمثّل خلية ‎250‎ م كاملة لا موقع مبنى؛ نسبة البناء من بصمات OSM (راستر ‎4‎ م). الفجوات المحتملة في بيانات المباني ({g}) لا تُرسم هنا وتظهر في النسخة المعمارية. الساحات من OSM.',
      'מגבלות: כל סמל מייצג תא שלם של ‎250‎ מ׳ ולא מיקום בניין; שיעור הבינוי מטביעות OSM (רסטר ‎4‎ מ׳). פערים אפשריים בנתוני הבניינים ({g}) אינם מסומנים כאן ומופיעים בגרסה האדריכלית. הכיכרות מ-OSM.',
      'Limits: each symbol stands for a whole 250 m cell, not a building position; built share from OSM footprints (4 m raster). Probable gaps in the building data ({g}) are not drawn here; the architectural version shows them. Squares from OSM.'],
    'x20.play': ['شغّل الطبقات', 'הפעל שכבות', 'Play layers'],
    'x20.stop': ['أوقف', 'עצור', 'Stop'],
    'x20.all': ['الكل', 'הכול', 'All'],
    'x20.layersZip': ['PNG لكل طبقة (ZIP)', 'PNG לכל שכבה (ZIP)', 'PNG per layer (ZIP)'],
  });
})(window);
