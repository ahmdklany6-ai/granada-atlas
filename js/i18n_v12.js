/* v12 strings (build 5.13): tree-cover classes (zero vs missing), study-area marks, analysis-board export (legends, charts,
   omitted sections), historical images unavailable, print layout. [ar, he, en] */
(function (root) {
  root.GA.i18n.add({
    'v12.tcdZero': ['0 % — بلا غطاء شجري (مقيس)', '0 % — ללא כיסוי עצים (נמדד)', '0 % — no tree cover (measured)'],
    'v12.tcdMissing': ['لا بيانات (غير مقيس)', 'אין נתונים (לא נמדד)', 'No data (not measured)'],
    // ----- study areas -----
    'v12.showAll': ['إظهار كل المناطق', 'הצגת כל האזורים', 'Show all areas'],
    'v12.outside': ['خارج هذا الإطار: المنطقة {n}. فعّلوا «إظهار كل المناطق» لرؤيتها.', 'מחוץ למסגרת זו: אזור {n}. סמנו «הצגת כל האזורים» כדי לראות אותו.', 'Outside this frame: area {n}. Tick “Show all areas” to include it.'],
    // ----- analysis board export -----
    'v12.includeEmpty': ['تضمين الأقسام الفارغة', 'לכלול מקטעים ריקים', 'Include empty sections'],
    'v12.noData': ['لا بيانات لهذه الخريطة.', 'אין נתונים למפה זו.', 'No data for this map.'],
    'v12.sectionEmpty': ['لا محتوى في هذا القسم بعد.', 'אין עדיין תוכן במקטע זה.', 'There is no content in this section yet.'],
    'v12.sectionFail': ['تعذّر رسم هذا المقطع: {e}', 'לא ניתן לשרטט חתך זה: {e}', 'This section could not be drawn: {e}'],
    'v12.keyInd': ['مؤشرات رئيسية', 'מדדים עיקריים', 'Key indicators'],
    'v12.contents': ['محتوى هذا الملف', 'תוכן המסמך', 'In this document'],
    'v12.omitted': ['أُغفلت لأنها بلا بيانات:', 'הושמטו כי אין להם נתונים:', 'Omitted because they have no data:'],
    // ----- historical images -----
    'v12.imgUnavailable': ['الصورة غير متاحة', 'התמונה אינה זמינה', 'Image unavailable'],
    'v12.histBlank': ['أعادت خدمة IGN صورة فارغة (بيضاء) لهذه المنطقة: {l}. لا تغطية جوية هنا في هذه الرحلة.', 'שירות IGN החזיר תמונה ריקה (לבנה) לאזור זה: {l}. אין כיסוי צילום אוויר כאן בטיסה זו.', 'The IGN service returned a blank (white) image for this area: {l}. That flight has no coverage here.'],
    'v12.histFailed': ['تعذّر تحميل الصورة من IGN: {e}', 'לא ניתן לטעון את התמונה מ-IGN: {e}', 'The image could not be loaded from IGN: {e}'],
    'v12.pnoaFallback': ['PNOA {y} — أحدث رحلة تغطي هذه المنطقة؛ {l} أعادت صورة فارغة هنا (لا تغطية).', 'PNOA {y} — הטיסה העדכנית ביותר המכסה אזור זה; {l} החזירו תמונה ריקה כאן (אין כיסוי).', 'PNOA {y} — the most recent flight covering this area; {l} returned a blank image here (no coverage).'],
    'v12.keepEmptySlots': ['إبقاء الخانات الفارغة (وإلا تتوسع العناصر لملء الصفحة)', 'להשאיר משבצות ריקות (אחרת הפריטים מתרחבים למילוי הדף)', 'Keep empty slots (otherwise the other items expand to fill the page)'],
  });
})(window);
