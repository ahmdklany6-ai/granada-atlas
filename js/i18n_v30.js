/* v30 strings (build 5.33): one button for all artistic maps; the climate map as four layers draped on the terrain
   (approved 9 Nov 2026, back on the GitHub site). [ar, he, en]. Numbers stay left-to-right. */
(function (root) {
  root.GA.i18n.add({
    'x31.allArt': ['كل الخرائط فنية', 'כל המפות אמנותיות', 'All maps artistic'],
    'x31.allArch': ['كل الخرائط معمارية', 'כל המפות אדריכליות', 'All maps architectural'],
    'x24.styleHint.climate': ['الفنية: أربع طبقات من نفس الإطار — التضاريس، النبات صيفًا، المباني، حرارة السطح صيفًا — كل واحدة مفرودة على شكل الأرض الحقيقي وفوق بعض، بمنظر من الجنوب الغربي. تتغير الخريطة والمفتاح والتصدير معًا.',
      'אמנותית: ארבע שכבות של אותה מסגרת — פני השטח, צמחייה בקיץ, מבנים, טמפרטורת פני השטח בקיץ — כל אחת פרוסה על צורת הקרקע האמיתית ומונחות זו מעל זו, במבט מדרום-מערב. המפה, המקרא והייצוא משתנים יחד.',
      'Artistic: four layers of the same frame — terrain, summer vegetation, buildings, summer surface heat — each draped over the real terrain and stacked, seen from the south-west. The map, legend and exports change together.'],
    'x25.k.terrain': ['التضاريس', 'פני השטח', 'Terrain'], 'x25.k.veg': ['النبات', 'צמחייה', 'Vegetation'], 'x25.k.built': ['البناء', 'בינוי', 'Buildings'], 'x25.k.heat': ['حرارة السطح', 'חום פני השטח', 'Surface heat'],
    'x25.lg.terrain': ['التضاريس (IGN MDT25): {a}–{b} م، الارتفاع مضخّم ×{x}', 'פני השטח (IGN MDT25): {a}–{b} מ׳, הגובה מוגזם ×{x}', 'terrain (IGN MDT25): {a}–{b} m, relief exaggerated ×{x}'],
    'x25.lg.veg': ['النبات صيفًا (NDVI، Landsat): {p} من البلوكات خضراء (≥ ‎0.4‎)', 'צמחייה בקיץ (NDVI, Landsat): {p} מהבלוקים ירוקים (≥ ‎0.4‎)', 'summer vegetation (NDVI, Landsat): {p} of blocks green (≥ 0.4)'],
    'x25.lg.built': ['المباني (OSM): {p} من الإطار مبني', 'מבנים (OSM): {p} מהמסגרת בנוי', 'buildings (OSM): {p} of the frame built'],
    'x25.lg.edge': ['حدود غرناطة المبنية على كل الطبقات', 'גבול גרנדה הבנויה בכל השכבות', 'edge of built-up Granada on every layer'],
    'x25.src.climate': ['النسخة الفنية: كل طبقة مفرودة على التضاريس الحقيقية (الارتفاع مضخّم لتظهر على ‎10‎ كم)؛ المنظر من الجنوب الغربي. حرارة السطح ليست حرارة الهواء.', 'הגרסה האמנותית: כל שכבה פרוסה על פני השטח האמיתיים (הגובה מוגזם כדי שייראה ב-‎10‎ ק״מ); מבט מדרום-מערב. טמפרטורת פני השטח אינה טמפרטורת האוויר.', 'Artistic version: each layer is draped over the real terrain (relief exaggerated to read at 10 km); seen from the south-west. Surface temperature is not air temperature.'],
  });
})(window);
