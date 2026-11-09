/* v24 strings (build 5.26): Exercise 1.3 human dimension in the artistic map language — each layer a 3D object over a
   line drawing seen from the south-west, with a top view. [ar, he, en]. Numbers stay left-to-right. */
(function (root) {
  root.GA.i18n.add({
    'x24.styleHint': ['الفنية: كل طبقة جسم ثلاثي الأبعاد فوق رسم خطي لغرناطة من الجنوب الغربي (السكان، التجارة، الشوارع التجارية، الباصات، أماكن اللقاء، الزوار)، وتحتها نفس الطبقات من فوق. تتغير الخريطة والمفتاح والتصدير معًا.',
      'אמנותית: כל שכבה היא גוף תלת-ממדי מעל שרטוט קווי של גרנדה ממבט מדרום-מערב (תושבים, מסחר, רחובות מסחריים, אוטובוסים, מקומות מפגש, מבקרים), ומתחתיה אותן שכבות ממבט על. המפה, המקרא והייצוא משתנים יחד.',
      'Artistic: each layer is a 3D object over a line drawing of Granada seen from the south-west (residents, commerce, shop streets, buses, meeting places, visitors), with the same layers from above below it. The map, legend and exports change together.'],
    'x24.lg.res': ['السكان: {n} خلية ‎100‎ م فوق ‎15,000‎/كم²، طائرة فوق مكانها؛ الارتفاع = الكثافة', 'תושבים: {n} תאים של ‎100‎ מ׳ מעל ‎15,000‎ לקמ״ר, מרחפים מעל מקומם; הגובה = הצפיפות', 'residents: {n} 100 m cells above 15,000/km², floating above their place; height = density'],
    'x24.lg.peaks': ['التجارة: أعمدة على قمم C1–C6؛ الارتفاع = محلات/كم² (C1 = {v})، الحلقة ‎300‎ م', 'מסחר: עמודים על שיאי C1–C6; הגובה = חנויות לקמ״ר (C1 = {v}), הטבעת ‎300‎ מ׳', 'commerce: columns on peaks C1–C6; height = shops/km² (C1 = {v}), ring 300 m'],
    'x24.lg.streets': ['الشوارع التجارية: أكثف 6 كجدران؛ الارتفاع = محلات لكل ‎100‎ م ({s} = {v})', 'רחובות מסחריים: 6 הצפופים כקירות; הגובה = חנויות ל-‎100‎ מ׳ ({s} = {v})', 'shop streets: the 6 densest as walls; height = shops per 100 m ({s} = {v})'],
    'x24.lg.buses': ['الباصات: أكثر {n} موقف؛ الارتفاع = رحلات باليوم (الأعلى {v})', 'אוטובוסים: {n} התחנות העמוסות; הגובה = נסיעות ביום (המרבי {v})', 'buses: the {n} busiest stops; height = trips per day (top {v})'],
    'x24.lg.meeting': ['أماكن اللقاء: {s} ساحة (أزرق)، {p} حديقة (زيتي)، والأسواق كتل', 'מקומות מפגש: {s} כיכרות (כחול), {p} גינות (זית), והשווקים כגושים', 'meeting places: {s} squares (blue), {p} parks (olive), markets as blocks'],
    'x24.lg.hotels': ['الزوار: {n} فندقًا ونُزلًا كمكعبات طائرة فوق مكانها', 'מבקרים: {n} בתי מלון ואכסניות כקוביות מרחפות מעל מקומן', 'visitors: {n} hotels and hostels as cubes floating above their place'],
    'x24.topCap': ['نفس الطبقات من فوق (‎10 × 10‎ كم، الشمال للأعلى)', 'אותן שכבות ממבט על (‎10 × 10‎ ק״מ, צפון למעלה)', 'the same layers from above (10 × 10 km, north up)'],
    'x24.src.art': ['النسخة الفنية: ارتفاع كل جسم مقياس لقيمته لا ارتفاع حقيقي. الباصات: جدول ‎26.10.2026‎ (رخصة الملف غير مذكورة). الشارع التجاري: باسم، ‎250‎ م أو أكثر، ‎20‎ محلًا أو أكثر على ‎25‎ م. غير مرسوم لغياب البيانات: النشاط حسب الوقت، مسارات المشي والدراجة، من يستخدم الأماكن، النشاط غير الرسمي.',
      'הגרסה האמנותית: גובה כל גוף הוא קנה מידה לערכו ולא גובה אמיתי. אוטובוסים: לוח זמנים ‎26.10.2026‎ (רישיון הקובץ לא צוין). רחוב מסחרי: בעל שם, ‎250‎ מ׳ ומעלה, ‎20‎ חנויות ומעלה בטווח ‎25‎ מ׳. לא משורטט בהיעדר נתונים: פעילות לפי שעה, מסלולי הליכה ואופניים, מי משתמש במקומות, פעילות לא פורמלית.',
      'Artistic version: each object\'s height is a scale for its value, not a real height. Buses: schedule of 26 Oct 2026 (licence of the file not stated). Shop street: named, 250 m or longer, 20 or more shops within 25 m. Not drawn for lack of data: activity by time of day, actual walking and cycling routes, who uses the places, informal activity.'],
  });
})(window);
