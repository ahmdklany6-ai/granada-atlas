/* v14 strings (build 5.15): historical built-up extent per period on the Historical Maps page, images in the place
   popups. [ar, he, en] — numbers and dates stay left-to-right inside RTL text. */
(function (root) {
  root.GA.i18n.add({
    'v14.extLayer': ['الامتداد العمراني التاريخي للمدينة', 'השטח הבנוי ההיסטורי של העיר', 'Historical built-up extent of the city'],
    'v14.layerPeriod': ['الطبقة المختارة:', 'השכבה שנבחרה:', 'Selected layer:'],
    'v14.extent': ['الامتداد العمراني', 'השטח הבנוי', 'Built-up extent'],
    'v14.approx': ['إعادة بناء تقريبية', 'שחזור משוער', 'approximate reconstruction'],
    'v14.undated': ['سنة الإصدار غير مسجّلة', 'שנת ההוצאה אינה רשומה', 'edition year not recorded'],
    'v14.tracedAuto': ['استُخرج الحدّ من التعبئة العمرانية المطبوعة على الخريطة (مناطق البناء الملوّنة، مدموجة عبر الشوارع، بلا الأبنية المتفرقة). يتبع ما رسمه المسّاح، لا قياسًا حديثًا.', 'הקו הופק מהמילוי העירוני המודפס במפה (שטחים בנויים צבועים, מאוחדים מעבר לרחובות, ללא בניינים בודדים). הוא משקף את מה ששרטט המודד, לא מדידה עכשווית.', 'Outline derived from the urban fill printed on the map (coloured built-up blocks, merged across streets, isolated buildings left out). It follows what the surveyor drew, not a modern measurement.'],
    'v14.tracedHand': ['رُسم الحدّ يدويًا على الصورة الجوية حول النسيج المبني المتصل؛ الأطراف المتفرقة والمباني المعزولة غير مشمولة. الدقة نحو 50–100 م.', 'הקו שורטט ביד על תצלום האוויר סביב המרקם הבנוי הרציף; שוליים דלילים ומבנים בודדים אינם כלולים. דיוק של כ-50–100 מ׳.', 'Outline traced by hand on the aerial photograph around the continuous built fabric; sparse fringes and isolated buildings are left out. Accuracy about 50–100 m.'],
    'v14.ghslObs': ['خلايا 100 م التي يغطي البناء 20 % منها على الأقل، والمتصلة بالمركز التاريخي (GHSL، من صور لاندسات لتلك الفترة). يتجاوز حدود البلدية حيث امتدت المدينة.', 'תאים של 100 מ׳ שלפחות 20 % משטחם בנוי, הרציפים למרכז ההיסטורי (GHSL, מצילומי לנדסאט של אותה תקופה). חוצה את גבול העירייה במקום שבו העיר התפשטה.', '100 m cells with at least 20 % built-up surface, contiguous with the historic centre (GHSL, from Landsat imagery of that time). Crosses the municipal boundary where the city spread.'],
    'v14.ghslModel': ['خلايا 100 م التي يغطي البناء 20 % منها على الأقل، والمتصلة بالمركز التاريخي. هذه الحقبة في GHSL مُنمذجة من رصد 2014 و2018، لا صورة من السنة نفسها.', 'תאים של 100 מ׳ שלפחות 20 % משטחם בנוי, הרציפים למרכז ההיסטורי. תקופה זו ב-GHSL ממודלת מתצפיות 2014 ו-2018, לא תצלום מאותה שנה.', '100 m cells with at least 20 % built-up surface, contiguous with the historic centre. This GHSL epoch is modelled from 2014 and 2018 observations, not an image of that year.'],
    'v14.relNearest': ['الطبقة تغطي {p}؛ الحدّ المعروض هو أقرب حقبة موثّقة ({y}) وليس تاريخ الطبقة نفسه.', 'השכבה מכסה את {p}; הקו המוצג הוא התקופה המתועדת הקרובה ביותר ({y}), לא תאריך השכבה עצמה.', 'The layer covers {p}; the outline shown is the nearest documented epoch ({y}), not the layer’s own date.'],
    'v14.relWithin': ['الحقبة {y} تقع ضمن مدى الطبقة {p}.', 'התקופה {y} נמצאת בטווח השכבה {p}.', 'Epoch {y} lies within the layer’s range {p}.'],
    'v14.noExt': ['لا يوجد حدّ موثوق لهذه الفترة:', 'אין קו אמין לתקופה זו:', 'No reliable boundary for this period:'],
    'v14.none.minutas': ['في المسودات الخرائطية لغرناطة (1895) رُسمت المدينة ككتلة مظللة على أوراق ناقصة وغير متطابقة، فلا يمكن رسم حدّها.', 'במינוטות של גרנדה (1895) העיר מצוירת כגוש מקווקו על גיליונות חסרים ולא מיושרים, ולכן לא ניתן לשרטט את גבולה.', 'in the Granada minutas (1895) the city is drawn as a hatched mass on incomplete, misaligned sheets, so its edge cannot be traced.'],
    'v14.none.mtn25': ['سنة إصدار ورقة غرناطة ضمن 1975–2003 غير مسجّلة هنا، فلا يُطابَق أي حدّ معها.', 'שנת ההוצאה של גיליון גרנדה בטווח 1975–2003 אינה רשומה כאן, ולכן לא הותאם לה קו.', 'the edition year of the Granada sheet within 1975–2003 is not recorded here, so no outline is matched to it.'],
    'v14.none.unknown': ['لم يُسجَّل مصدر لهذه الطبقة.', 'לא נרשם מקור לשכבה זו.', 'no source is recorded for this layer.'],
    'v14.extFail': ['تعذّر تحميل بيانات الامتداد العمراني.', 'לא ניתן לטעון את נתוני השטח הבנוי.', 'The built-up extent data could not be loaded.'],
    'v14.extOff': ['الامتداد العمراني التاريخي مخفي.', 'השטח הבנוי ההיסטורי מוסתר.', 'The historical built-up extent is hidden.'],
    'v14.extVsMuni': ['الخط الأحمر هو المدينة المبنية في تلك الفترة؛ الخط الأسود الرفيع هو حدود البلدية الإدارية الحالية، وليس امتداد المدينة التاريخي.', 'הקו האדום הוא העיר הבנויה באותה תקופה; הקו השחור הדק הוא גבול העירייה המנהלי של היום, לא שטח העיר ההיסטורי.', 'The red line is the built-up city of that period; the thin black line is today’s administrative municipal boundary, not the historical city.'],
    'v14.left': ['اليسار:', 'שמאל:', 'Left:'],
    'v14.historical': ['صورة تاريخية', 'תמונה היסטורית', 'Historical image'],
    'v14.presentDay': ['منظر حالي', 'מבט עכשווי', 'Present-day view'],
    'v14.circa': ['نحو {y}', 'בערך {y}', 'c. {y}'],
    'v14.before': ['قبل {y}', 'לפני {y}', 'before {y}'],
    'v14.noPopImg': ['لا توجد صورة بترخيص حرّ مسجّلة لهذا المكان.', 'אין תמונה ברישיון חופשי הרשומה למקום זה.', 'No freely licensed image is recorded for this place.'],
    'v14.imgFailed': ['تعذّر تحميل الصورة (Wikimedia Commons).', 'לא ניתן לטעון את התמונה (Wikimedia Commons).', 'The image could not be loaded (Wikimedia Commons).']
  });
})(window);
