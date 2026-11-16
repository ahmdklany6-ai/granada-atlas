/* v34 strings (build 5.46): the measuring tool — a button in the map's top-right row, a red line on top of every layer
   with each segment's length on the map, and the total in kilometres and metres. [ar, he, en]. Numbers arrive as
   left-to-right spans from js/app.js and js/selection.js. */
(function (root) {
  root.GA.i18n.add({
    'v34.m.btn': ['قياس', 'מדידה', 'Measure'],
    'v34.m.btnHint': ['قياس مسافة على الخريطة بالمتر والكيلومتر', 'מדידת מרחק במפה במטרים ובקילומטרים', 'Measure a distance on the map in metres and kilometres'],
    'v34.m.title': ['قياس المسافة', 'מדידת מרחק', 'Distance'],
    'v34.m.hint0': ['انقروا على الخريطة لوضع أول نقطة.', 'לחצו על המפה כדי להניח את הנקודה הראשונה.', 'Click the map to place the first point.'],
    'v34.m.hint1': ['انقروا نقطة ثانية؛ يظهر الطول على الخريطة.', 'לחצו נקודה שנייה; האורך יופיע על המפה.', 'Click a second point; the length appears on the map.'],
    'v34.m.pts': ['{n} نقاط', '{n} נקודות', '{n} points'],
    'v34.m.last': ['آخر مقطع:', 'קטע אחרון:', 'last segment:'],
    'v34.m.total': ['المجموع', 'סה״כ', 'Total'],
    'v34.m.keys': ['نقرة مزدوجة أو Enter للإنهاء · Backspace يحذف آخر نقطة · اسحبوا أي نقطة لتحريكها', 'לחיצה כפולה או Enter לסיום · Backspace מוחק את הנקודה האחרונה · גררו נקודה כדי להזיז אותה', 'Double-click or Enter to finish · Backspace removes the last point · drag any point to move it'],
    'v34.m.undo': ['حذف آخر نقطة', 'מחיקת הנקודה האחרונה', 'Remove last point'],
    'v34.m.finish': ['إنهاء', 'סיום', 'Finish'],
    'v34.m.new': ['قياس جديد', 'מדידה חדשה', 'New measurement'],
    'v34.m.drag': ['اسحبوا لتحريك النقطة', 'גררו כדי להזיז את הנקודה', 'Drag to move the point'],
    'v34.m.on': ['وضع القياس: انقروا نقاطًا على الخريطة. نقرة مزدوجة أو Enter أو Esc للإنهاء.', 'מצב מדידה: לחצו נקודות במפה. לחיצה כפולה, Enter או Esc לסיום.', 'Measuring: click points on the map. Double-click, Enter or Esc to finish.'],
  });
})(window);
