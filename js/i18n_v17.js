/* v17 strings (build 5.19): print layout up to 700 dpi — pages built in strips, progress, cancel, size warning. [ar, he, en]
   Numbers and units are passed already formatted; they stay left-to-right inside RTL text. */
(function (root) {
  root.GA.i18n.add({
    'v17.progress': ['جارٍ الرسم: المربع {i} من {n} (الشريط {s} من {sn})…', 'מעבד: אריח {i} מתוך {n} (רצועה {s} מתוך {sn})…', 'Rendering: tile {i} of {n} (strip {s} of {sn})…'],
    'v17.cancel': ['إلغاء', 'ביטול', 'Cancel'],
    'v17.go': ['متابعة التصدير', 'המשך בייצוא', 'Continue export'],
    'v17.cancelled': ['أُلغي التصدير؛ لم يُنشأ أي ملف.', 'הייצוא בוטל; לא נוצר קובץ.', 'Export cancelled; no file was created.'],
    'v17.bigWarn': ['تصدير كبير جدًا: {w} × {h} بكسل (≈ {mpx} ميغابكسل)، الحجم المقدّر ≈ {mb} MB، والمدة ≈ {min} دقيقة (حسب الجهاز). تُبنى الصفحة على شرائح بالدقة المطلوبة كاملة.',
      'ייצוא גדול מאוד: {w} × {h} פיקסלים (≈ {mpx} מגה-פיקסל), גודל משוער ≈ {mb} MB, זמן ≈ {min} דקות (תלוי במכשיר). הדף נבנה ברצועות ברזולוציה המלאה שנבחרה.',
      'Very large export: {w} × {h} px (≈ {mpx} Mpx), estimated ≈ {mb} MB and ≈ {min} min (depends on the device). The page is built in strips at the full chosen dpi.'],
    'v17.bigPng': ['قد لا تفتح كثير من برامج عرض الصور ملف PNG بهذا الحجم؛ ملف PDF أنسب للطباعة.', 'תוכנות רבות להצגת תמונות אינן פותחות PNG בגודל כזה; PDF מתאים יותר להדפסה.', 'Many image viewers cannot open a PNG this large; PDF is better for printing.'],
    'v17.noWarn': ['لا تسألني مجددًا (يُحفظ في هذا المتصفح)', 'אל תשאל שוב (נשמר בדפדפן זה)', 'Don’t ask again (saved in this browser)'],
    'v17.warnOpt': ['التحذير قبل التصديرات الكبيرة جدًا (الحجم والمدة)', 'אזהרה לפני ייצוא גדול מאוד (גודל וזמן)', 'Warn before very large exports (size and time)'],
    'v17.size': ['الصفحة {w} × {h} بكسل في {s} شريط، {mb} MB.', 'הדף {w} × {h} פיקסלים ב-{s} רצועות, {mb} MB.', 'Page {w} × {h} px in {s} strip(s), {mb} MB.'],
    'v17.seamOk': ['الملصقات عند حواف المربعات متطابقة ({c} حافة فُحصت).', 'התוויות בגבולות האריחים זהות ({c} גבולות נבדקו).', 'Labels at tile edges match ({c} edge(s) checked).'],
    'v17.seamBad': ['تنبيه: تختلف الملصقات عند {n} من {c} حافة بين المربعات (مثال: {ex}). قد يتكرر ملصق أو ينقص هناك.', 'שימו לב: התוויות שונות ב-{n} מתוך {c} גבולות בין אריחים (לדוגמה: {ex}). ייתכן שתווית חוזרת או חסרה שם.', 'Note: labels differ at {n} of {c} tile edge(s) (e.g. {ex}); a label may be repeated or missing there.'],
    'v17.gpuSmall': ['لا يمكن لهذا الجهاز رسم الخريطة بدقة {d} dpi: أكبر لوحة رسومية يسمح بها {lim} بكسل، وهي أصغر من مربع واحد مع هامش التداخل. اختر دقة أقل.',
      'מכשיר זה אינו יכול לצייר את המפה ב-{d} dpi: הקנבס הגרפי הגדול ביותר שהוא מאפשר הוא {lim} פיקסלים, קטן מאריח אחד עם שולי החפיפה. בחרו רזולוציה נמוכה יותר.',
      'This device cannot render the map at {d} dpi: its largest graphics canvas is {lim} px, smaller than one tile with its overlap. Choose a lower dpi.'],
    'v17.canvasRefused': ['رفض المتصفح لوحة رسوميات بحجم {w} × {h} بكسل (أعطى {gw} × {gh})، لذا لا يمكن الرسم بدقة {d} dpi هنا. اختر دقة أقل أو استخدم جهازًا آخر.',
      'הדפדפן סירב לקנבס גרפי בגודל {w} × {h} פיקסלים (נתן {gw} × {gh}), ולכן לא ניתן לצייר כאן ב-{d} dpi. בחרו רזולוציה נמוכה יותר או מכשיר אחר.',
      'The browser refused a {w} × {h} px graphics canvas (it gave {gw} × {gh}), so the map cannot be rendered at {d} dpi here. Choose a lower dpi or another device.'],
    'v17.tilesTimeout': ['لم تكتمل بلاطات الخريطة الأساسية أو الطبقات خلال 3 دقائق (الشبكة؟)؛ أُوقف التصدير بدل التقاط خريطة ناقصة.', 'אריחי מפת הבסיס או השכבות לא נטענו תוך 3 דקות (רשת?); הייצוא נעצר במקום ללכוד מפה חסרה.', 'Basemap tiles or layers did not finish loading within 3 minutes (network?); the export stopped instead of capturing an incomplete map.'],
    'v17.noPngStream': ['هذا المتصفح لا يدعم إنشاء ملفات PNG كبيرة على شرائح (CompressionStream). استخدم PDF، أو متصفحًا أحدث.', 'דפדפן זה אינו תומך ביצירת PNG גדול ברצועות (CompressionStream). השתמשו ב-PDF או בדפדפן חדש יותר.', 'This browser cannot build a large PNG in strips (no CompressionStream). Use PDF, or a newer browser.'],
  });
})(window);
