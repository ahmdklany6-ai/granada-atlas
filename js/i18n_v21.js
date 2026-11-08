/* v21 strings (build 5.23): Exercise 1.3 city centre in the artistic map language — a 500 m grid over the whole map,
   Granada at full strength and its surroundings faded, the centre as black-and-white aerial squares. [ar, he, en].
   Numbers and units are passed already formatted; they stay left-to-right. */
(function (root) {
  root.GA.i18n.add({
    'x21.styleHint': ['الفنية: شبكة ‎500‎ م على كل الخريطة، غرناطة المبنية بقوة كاملة وما حولها باهت، والمركز مربعات من الصورة الجوية بالأبيض والأسود. تتغير الخريطة والمفتاح والتصدير معًا.',
      'אמנותית: רשת של ‎500‎ מ׳ על כל המפה, גרנדה הבנויה בעוצמה מלאה וסביבתה דהויה, והמרכז כריבועים מתצלום האוויר בשחור-לבן. המפה, המקרא והייצוא משתנים יחד.',
      'Artistic: a 500 m grid over the whole map, built-up Granada at full strength and its surroundings faded, the centre as black-and-white aerial squares. The map, legend and exports change together.'],
    'x21.lg.grid': ['شبكة ‎500‎ م: أقوى داخل غرناطة، خفيفة خارجها', 'רשת ‎500‎ מ׳: חזקה בתוך גרנדה, קלה מחוצה לה', '500 m grid: stronger inside Granada, light outside'],
    'x21.lg.tiles': ['المركز: مربعات ‎500‎ م تبلغ فيها الكثافة التجارية ‎500‎ مكان/كم² أو أكثر، من الصورة الجوية ({n})', 'המרכז: ריבועי ‎500‎ מ׳ שבהם הצפיפות המסחרית מגיעה ל-‎500‎ מקומות לקמ״ר ומעלה, מתצלום האוויר ({n})', 'centre: 500 m squares where commercial density reaches 500 places/km² or more, from the aerial photo ({n})'],
    'x21.lg.crosses': ['صلبان على زوايا مربعات المركز', 'צלבים בפינות ריבועי המרכז', 'crosses on the corners of the centre squares'],
    'x21.lg.peaks': ['قمم التجارة C1–C6 داخل غرناطة', 'שיאי המסחר C1–C6 בתוך גרנדה', 'commercial peaks C1–C6 inside Granada'],
    'x21.lg.names': ['أسماء للتوجيه: البيازين والحمراء', 'שמות להתמצאות: אלבאיסין ואלהמברה', 'names for orientation: Albaicín and Alhambra'],
    'x21.lg.city': ['غرناطة المبنية ({a}): نسبة البناء ‎12 %‎ أو أكثر بعد التنعيم على ‎250‎ م، داخل البلدية', 'גרנדה הבנויה ({a}): שיעור בינוי ‎12 %‎ ומעלה לאחר החלקה של ‎250‎ מ׳, בתוך העירייה', 'built-up Granada ({a}): built share 12 % or more after smoothing over 250 m, inside the municipality'],
    'x21.lg.around': ['ما حول غرناطة (باهت)', 'סביבת גרנדה (דהויה)', 'around Granada (faded)'],
    'x21.src.art': ['النسخة الفنية: الصورة الجوية PNOA © IGN (CC BY 4.0) بالأبيض والأسود؛ كل شوارع OSM. المربع يمثّل خلية ‎500‎ م كاملة بلغت الكثافة فيها ‎500‎ مكان/كم² في أي نقطة ({n} مربعًا تلمس المدينة)؛ C2 في Armilla خارج البلدية فلا يُرسم. شكل المدينة {a}.',
      'הגרסה האמנותית: תצלום אוויר PNOA ‏© IGN ‏(CC BY 4.0) בשחור-לבן; כל רחובות OSM. ריבוע מייצג תא שלם של ‎500‎ מ׳ שבו הצפיפות הגיעה ל-‎500‎ מקומות לקמ״ר בנקודה כלשהי ({n} ריבועים הנוגעים בעיר); C2 ב-Armilla מחוץ לעירייה ואינו מסומן. צורת העיר {a}.',
      'Artistic version: PNOA aerial photo © IGN (CC BY 4.0) in black and white; every OSM street. A square stands for a whole 500 m cell whose density reaches 500 places/km² anywhere in it ({n} squares touching the city); C2 in Armilla lies outside the municipality and is not drawn. City shape {a}.'],
  });
})(window);
