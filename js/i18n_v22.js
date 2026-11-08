/* v22 strings (build 5.24): Exercise 1.3 density in the artistic map language — needles per 100 m cell seen from the
   south-west, five colour classes, a top view of the same cells. [ar, he, en]. Numbers stay left-to-right. */
(function (root) {
  root.GA.i18n.add({
    'x22.styleHint': ['الفنية: إبرة لكل خلية ‎100‎ م، طولها حسب عدد السكان ولونها حسب الفئة، بمنظر من الجنوب الغربي؛ وتحتها نفس الخلايا من فوق. تتغير الخريطة والمفتاح والتصدير معًا.',
      'אמנותית: מחט לכל תא של ‎100‎ מ׳, אורכה לפי מספר התושבים וצבעה לפי הקטגוריה, במבט מדרום-מערב; ומתחתיה אותם תאים ממבט על. המפה, המקרא והייצוא משתנים יחד.',
      'Artistic: one needle per 100 m cell, its length by residents and its colour by class, seen from the south-west; below it, the same cells from above. The map, legend and exports change together.'],
    'x22.lg.grid': ['شبكة ‎500‎ م على الأرض', 'רשת ‎500‎ מ׳ על הקרקע', '500 m grid on the ground'],
    'x22.lg.streets': ['الشوارع الرئيسية وحدود البلدية (OSM)', 'הרחובות הראשיים וגבול העירייה (OSM)', 'main streets and municipal boundary (OSM)'],
    'x22.lg.edge': ['حدود غرناطة المبنية ({a})؛ الإبر خارجها باهتة', 'גבול גרנדה הבנויה ({a}); המחטים מחוצה לה דהויות', 'edge of built-up Granada ({a}); needles outside it are faded'],
    'x22.c1': ['أقل من ‎5,000‎ ساكن/كم² ({n} خلية)', 'פחות מ-‎5,000‎ תושבים לקמ״ר ({n} תאים)', 'under 5,000 residents/km² ({n} cells)'],
    'x22.c2': ['‎5,000–10,000‎ ({n})', '‎5,000–10,000‎ ({n})', '5,000–10,000 ({n})'],
    'x22.c3': ['‎10,000–20,000‎ ({n})', '‎10,000–20,000‎ ({n})', '10,000–20,000 ({n})'],
    'x22.c4': ['‎20,000–30,000‎ ({n})', '‎20,000–30,000‎ ({n})', '20,000–30,000 ({n})'],
    'x22.c5': ['أكثر من ‎30,000‎ ({n})', 'מעל ‎30,000‎ ({n})', 'over 30,000 ({n})'],
    'x22.lg.labels': ['أعلى إبرة ({v} ساكن/كم²)، البيازين والحمراء', 'המחט הגבוהה ביותר ({v} תושבים לקמ״ר), אלבאיסין ואלהמברה', 'tallest needle ({v} residents/km²), Albaicín and Alhambra'],
    'x22.c.shares': ['السكان حسب فئة الكثافة', 'התושבים לפי קטגוריית צפיפות', 'Residents by density class'],
    'x22.k1': ['أقل من ‎5,000‎', 'פחות מ-‎5,000‎', 'under 5,000'], 'x22.k2': ['‎5,000–10,000‎', '‎5,000–10,000‎', '5,000–10,000'], 'x22.k3': ['‎10,000–20,000‎', '‎10,000–20,000‎', '10,000–20,000'], 'x22.k4': ['‎20,000–30,000‎', '‎20,000–30,000‎', '20,000–30,000'], 'x22.k5': ['أكثر من ‎30,000‎', 'מעל ‎30,000‎', 'over 30,000'],
    'x22.topCap': ['نفس الخلايا من فوق (‎10 × 10‎ كم، الشمال للأعلى)', 'אותם תאים ממבט על (‎10 × 10‎ ק״מ, צפון למעלה)', 'the same cells from above (10 × 10 km, north up)'],
    'x22.src.art': ['النسخة الفنية: إبرة لكل خلية ‎100‎ م؛ طولها مقياس للكثافة (الإبرة الحمراء = ‎10,000‎ ساكن/كم²) لا ارتفاع حقيقي. المنظر من الجنوب الغربي: المقياس صحيح شرق–غرب فقط؛ المسقط الأفقي الصحيح في المنظر العلوي.',
      'הגרסה האמנותית: מחט לכל תא של ‎100‎ מ׳; אורכה הוא קנה מידה לצפיפות (המחט האדומה = ‎10,000‎ תושבים לקמ״ר) ולא גובה אמיתי. המבט מדרום-מערב: קנה המידה נכון רק מזרח–מערב; ההיטל הנכון במבט העל.',
      'Artistic version: one needle per 100 m cell; its length is a density scale (the red needle = 10,000 residents/km²), not a real height. Seen from the south-west, the scale is true east–west only; the true plan is the top view.'],
  });
})(window);
