/* Builds the GIS download for one study area: GeoPackage (one file, one table per layer,
   QGIS default styles inside), GeoJSON per layer (EPSG:4326) with .qml sidecars, an optional
   elevation GeoTIFF, README and metadata.json — all packed into one ZIP.
   Layers come only from data actually retrieved for this area; nothing is synthesised. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const req = (n, g) => isNode ? require(n) : root.GA[g];
  const G = req('../geo.js', 'geo'), A = req('../analysis.js', 'analysis'), K = req('../clip.js', 'clip'), PJ = req('../proj.js', 'proj');
  const P = req('../palette.js', 'palette'), Q = req('./qml.js', 'qml'), GP = req('./gpkg.js', 'gpkg'), TIF = req('./geotiff.js', 'geotiff'), Z = req('./zip.js', 'zip'), I = req('../i18n.js', 'i18n');
  const t = I.t;

  I.add({
    'x.title': ['تنزيل بيانات GIS', 'הורדת נתוני GIS', 'Download GIS data'],
    'x.lead': ['حزمة ZIP تُفتح في QGIS: GeoPackage واحد بطبقات منفصلة، وملفات GeoJSON، وملف README بالمصادر والقيود.', 'חבילת ZIP שנפתחת ב-QGIS: GeoPackage אחד עם שכבות נפרדות, קובצי GeoJSON ו-README עם המקורות והמגבלות.', 'A ZIP that opens in QGIS: one GeoPackage with separate layers, GeoJSON files, and a README with sources and limitations.'],
    'x.layers': ['الطبقات', 'שכבות', 'Layers'],
    'x.formats': ['الصيغ', 'פורמטים', 'Formats'],
    'x.gpkg': ['GeoPackage (.gpkg) — مُفضّل، كل الطبقات في ملف واحد', 'GeoPackage (.gpkg) — מועדף, כל השכבות בקובץ אחד', 'GeoPackage (.gpkg) — preferred, all layers in one file'],
    'x.geojson': ['GeoJSON — ملف لكل طبقة (EPSG:4326) مع ملف نمط QGIS', 'GeoJSON — קובץ לכל שכבה (EPSG:4326) עם קובץ סגנון QGIS', 'GeoJSON — one file per layer (EPSG:4326) with a QGIS style file'],
    'x.crs': ['نظام الإحداثيات في GeoPackage', 'מערכת הקואורדינטות ב-GeoPackage', 'GeoPackage coordinate system'],
    'x.crs4326': ['EPSG:4326 — WGS 84 (درجات، كما في المصدر)', 'EPSG:4326 — WGS 84 (מעלות, כמו במקור)', 'EPSG:4326 — WGS 84 (degrees, as in the source)'],
    'x.crs25830': ['EPSG:25830 — ETRS89 / UTM 30N (أمتار، النظام الرسمي لغرناطة)', 'EPSG:25830 — ETRS89 / UTM 30N (מטרים, המערכת הרשמית לגרנדה)', 'EPSG:25830 — ETRS89 / UTM 30N (metres, Granada\'s official system)'],
    'x.dem': ['نموذج الارتفاع كـ GeoTIFF (يُجلب الآن من Copernicus GLO-90 عبر Open-Meteo)', 'מודל גבהים כ-GeoTIFF (נאסף כעת מ-Copernicus GLO-90 דרך Open-Meteo)', 'Elevation raster as GeoTIFF (fetched now from Copernicus GLO-90 via Open-Meteo)'],
    'x.demNote': ['شبكة بخلية {c} م ({n} بكسل، {r} طلبات). الدقة الأصلية للنموذج ~90 م؛ القيم الأدق مُعاد اعتيانها وليست تفاصيل إضافية.', 'רשת בתא של {c} מ׳ ({n} פיקסלים, {r} בקשות). הרזולוציה המקורית ~90 מ׳; ערכים צפופים יותר הם דגימה מחדש ולא פירוט נוסף.', 'Grid of {c} m cells ({n} pixels, {r} requests). Native resolution is ~90 m; finer cells are resampled, not extra detail.'],
    'x.cell': ['حجم الخلية', 'גודל תא', 'Cell size'],
    'x.go': ['تنزيل الحزمة (ZIP)', 'הורדת החבילה (ZIP)', 'Download package (ZIP)'],
    'x.building': ['جارٍ التجهيز…', 'מכין…', 'Preparing…'],
    'x.stepGpkg': ['كتابة GeoPackage…', 'כותב GeoPackage…', 'Writing GeoPackage…'],
    'x.stepDem': ['جلب الارتفاعات {a}/{b}…', 'אוסף גבהים {a}/{b}…', 'Fetching elevations {a}/{b}…'],
    'x.done': ['جاهز: {v}', 'מוכן: {v}', 'Ready: {v}'],
    'x.fail': ['تعذّر إنشاء الحزمة: {v}', 'יצירת החבילה נכשלה: {v}', 'Could not build the package: {v}'],
    'x.needArea': ['حدّدوا منطقة أولًا.', 'בחרו אזור תחילה.', 'Select an area first.'],
    'x.needAnalysis': ['حلّلوا المنطقة لتضمين طبقات المباني والشوارع والاستخدامات. يمكن تنزيل الحدود وحدها الآن.', 'נתחו את האזור כדי לכלול מבנים, רחובות ושימושים. אפשר להוריד כבר עכשיו את הגבול בלבד.', 'Analyse the area to include buildings, streets and land use. The boundary alone can be downloaded now.'],
    'x.needRefresh': ['البيانات الخام لهذا التحليل غير محفوظة في المتصفح. حدّثوا البيانات (يعيد جلب OSM) لتضمين الطبقات التفصيلية.', 'הנתונים הגולמיים של ניתוח זה אינם שמורים בדפדפן. רעננו את הנתונים (אחזור OSM מחדש) כדי לכלול את השכבות המפורטות.', 'The raw data for this analysis is not kept in the browser. Refresh the data (re-fetches OSM) to include the detailed layers.'],
    'x.ready': ['جاهزة', 'מוכנה', 'ready'], 'x.empty': ['فارغة (0 عناصر)', 'ריקה (0 ישויות)', 'empty (0 features)'], 'x.unavailable': ['غير متاحة', 'לא זמינה', 'unavailable'], 'x.notConnected': ['المصدر غير مربوط بعد', 'המקור טרם חובר', 'source not connected yet'], 'x.notFetched': ['لم تُجلب', 'לא נאספה', 'not fetched'], 'x.failed': ['فشل المصدر', 'המקור נכשל', 'source failed'], 'x.features': ['{n} عنصر', '{n} ישויות', '{n} features'],
    'x.validated': ['تم التحقق من البنية داخل الأداة؛ لم يُختبر في QGIS على هذا الجهاز.', 'המבנה נבדק בתוך הכלי; לא נבדק ב-QGIS במחשב זה.', 'Structure checked in the tool; not opened in QGIS on this computer.'],
    // layer titles
    'L.study_area': ['حدود منطقة الدراسة', 'גבול אזור המחקר', 'Study area boundary'],
    'L.buildings': ['المباني', 'מבנים', 'Buildings'],
    'L.streets': ['الشوارع وتصنيفها', 'רחובות וסיווגם', 'Streets and classification'],
    'L.landuse': ['استخدامات الأراضي (مقصوصة)', 'שימושי קרקע (חתוכים)', 'Land use (clipped)'],
    'L.parks_open_space': ['الحدائق والمساحات المفتوحة', 'גנים ושטחים פתוחים', 'Parks and open space'],
    'L.public_facilities': ['المرافق العامة', 'מבני ציבור', 'Public facilities'],
    'L.transit_stops': ['مواقف ومحطات النقل', 'תחנות תחבורה', 'Transport stops'],
    'L.pois_all': ['كل النقاط المصنّفة', 'כל הנקודות המסווגות', 'All classified points'],
    'L.section_line': ['خط مقطع التضاريس', 'קו החתך הטופוגרפי', 'Terrain section line'],
    'L.section_points': ['نقاط مقطع التضاريس', 'נקודות החתך הטופוגרפי', 'Terrain section points'],
    'L.photos_commons': ['مواقع صور Wikimedia Commons', 'מיקומי תצלומי Wikimedia Commons', 'Wikimedia Commons photo locations'],
    'L.climate_cell': ['خلية المناخ المرجعية (ERA5)', 'תא האקלים הייחוסי (ERA5)', 'Reference climate cell (ERA5)'],
    'L.elevation': ['نموذج الارتفاع (GeoTIFF)', 'מודל גבהים (GeoTIFF)', 'Elevation (GeoTIFF)'],
    'L.population': ['السكان حسب القسم الإحصائي (INE)', 'אוכלוסייה לפי אזור סטטיסטי (INE)', 'Population by census section (INE)'],
    'L.gtfs': ['تكرار خدمة الحافلات (GTFS)', 'תדירות אוטובוסים (GTFS)', 'Bus service frequency (GTFS)'],
    'L.catastro': ['مباني Catastro (طوابق وسنة البناء)', 'מבני Catastro (קומות ושנת בנייה)', 'Catastro buildings (floors and year)'],
    'L.lst': ['حرارة سطح الأرض (Landsat)', 'טמפרטורת פני השטח (Landsat)', 'Land surface temperature (Landsat)'],
    // clipping notes
    'N.study_area': ['الحدود كما رُسمت في الأداة.', 'הגבול כפי שסומן בכלי.', 'The boundary as drawn in the tool.'],
    'N.buildings': ['غير مقصوصة: كل مبنى يقع مركز مسقطه داخل الحدود يُصدَّر كاملًا (نفس قاعدة التحليل). الحقل crosses_boundary=1 يشير إلى المباني التي تعبر الحد.', 'לא חתוכים: כל מבנה שמרכז טביעת הרגל שלו בתוך הגבול מיוצא בשלמותו (אותו כלל כמו בניתוח). השדה crosses_boundary=1 מציין מבנים החוצים את הגבול.', 'Not clipped: every building whose footprint centroid is inside is exported whole (same rule as the analysis). crosses_boundary=1 marks buildings that cross the boundary.'],
    'N.streets': ['مقصوصة بدقة عند الحد؛ length_m هو الطول داخل المنطقة، وclipped=1 للمقاطع المقصوصة.', 'חתוכים במדויק בגבול; length_m הוא האורך בתוך האזור, ו-clipped=1 למקטעים שנחתכו.', 'Clipped exactly at the boundary; length_m is the length inside the area; clipped=1 for cut segments.'],
    'N.landuse': ['مقصوصة بدقة عند الحد (Greiner–Hormann). area_m2 بعد القص وorig_area_m2 قبله.', 'חתוכים במדויק בגבול (Greiner–Hormann). area_m2 לאחר החיתוך ו-orig_area_m2 לפניו.', 'Clipped exactly at the boundary (Greiner–Hormann). area_m2 after clipping, orig_area_m2 before.'],
    'N.points': ['نقاط داخل الحدود؛ المضلعات (مثل مدرسة) ممثلة بمركزها مع from_polygon=1.', 'נקודות בתוך הגבול; פוליגונים (כמו בית ספר) מיוצגים במרכזם עם from_polygon=1.', 'Points inside the boundary; polygons (e.g. a school site) are represented by their centroid with from_polygon=1.'],
    'N.transit': ['الحضور فقط — لا يدل على تكرار الخدمة.', 'נוכחות בלבד — אינו מעיד על תדירות השירות.', 'Presence only — says nothing about service frequency.'],
    'N.section': ['قيم ارتفاع حقيقية من النموذج الرقمي (~90 م) على خط مستقيم عبر المركز؛ ليس مقطع شارع مُقاسًا.', 'ערכי גובה אמיתיים מהמודל הדיגיטלי (~90 מ׳) על קו ישר דרך המרכז; אינו חתך רחוב מדוד.', 'Real elevation-model values (~90 m) on a straight line through the centre; not a measured street section.'],
    'N.photos': ['مواقع وبيانات وصفية وروابط فقط؛ الصور نفسها لها تراخيص فردية ولا تُعاد توزيعها.', 'מיקומים, מטא-נתונים וקישורים בלבד; לתמונות עצמן רישיונות נפרדים והן אינן מופצות מחדש.', 'Locations, metadata and links only; the images have individual licences and are not redistributed.'],
    'N.climate': ['نقطة واحدة تمثل خلية إعادة تحليل إقليمية (~9–25 كم). حرارة هواء، ليست حرارة سطح.', 'נקודה אחת המייצגת תא ניתוח חוזר אזורי (~9–25 ק״מ). טמפרטורת אוויר, לא טמפרטורת פני שטח.', 'One point representing a regional reanalysis cell (~9–25 km). Air temperature, not surface temperature.'],
    'N.dem': ['قيم Copernicus DEM GLO-90 عند مركز كل بكسل كما يعيدها Open-Meteo؛ البكسلات خارج الحدود = NoData (-9999).', 'ערכי Copernicus DEM GLO-90 במרכז כל פיקסל כפי ש-Open-Meteo מחזיר; פיקסלים מחוץ לגבול = NoData (-9999).', 'Copernicus DEM GLO-90 values at each pixel centre as returned by Open-Meteo; pixels outside the boundary = NoData (-9999).'],
    // README
    'R.head': ['أطلس غرناطة — حزمة بيانات GIS', 'האטלס של גרנדה — חבילת נתוני GIS', 'Granada Atlas — GIS data package'],
    'R.area': ['منطقة الدراسة', 'אזור המחקר', 'Study area'], 'R.created': ['تاريخ الإنشاء', 'נוצר בתאריך', 'Created'], 'R.crs': ['نظام الإحداثيات', 'מערכת קואורדינטות', 'Coordinate system'],
    'R.open': ['الفتح في QGIS: اسحبوا ملف .gpkg إلى QGIS واختاروا الطبقات؛ كل طبقة تُفتح بنمط الألوان الافتراضي المخزّن في الملف. ملفات GeoJSON في مجلد geojson تُفتح مع ملف .qml المرافق تلقائيًا.', 'פתיחה ב-QGIS: גררו את קובץ ה-.gpkg ל-QGIS ובחרו שכבות; כל שכבה נפתחת עם סגנון ברירת המחדל השמור בקובץ. קובצי GeoJSON בתיקייה geojson נפתחים יחד עם קובץ ה-.qml הנלווה אוטומטית.', 'Opening in QGIS: drag the .gpkg into QGIS and pick the layers; each opens with the default style stored in the file. GeoJSON files in the geojson folder load their matching .qml style automatically.'],
    'R.contents': ['المحتوى', 'תוכן', 'Contents'], 'R.missing': ['طبقات غير متاحة (غير مضمّنة)', 'שכבות לא זמינות (לא נכללו)', 'Unavailable layers (not included)'],
    'R.emptyNote': ['الطبقة الفارغة موجودة في الملف بلا عناصر: بُحث عنها ولم يوجد شيء داخل الحدود. الطبقة غير المتاحة غير موجودة لأن مصدرها لم يُجلب أو غير مربوط.', 'שכבה ריקה קיימת בקובץ ללא ישויות: חיפשנו ולא נמצא דבר בתוך הגבול. שכבה לא זמינה אינה בקובץ כי המקור שלה לא נאסף או לא חובר.', 'An empty layer is present with zero features: it was searched and nothing was found inside the boundary. An unavailable layer is absent because its source was not fetched or is not connected.'],
    'R.limits': ['القيود', 'מגבלות', 'Limitations'],
    'R.lim1': ['بيانات OpenStreetMap يحرّرها متطوعون؛ اكتمالها يختلف من حي لآخر. القيم المفقودة تُترك فارغة (NULL) ولا تُقدَّر.', 'נתוני OpenStreetMap נערכים בידי מתנדבים; שלמותם משתנה משכונה לשכונה. ערכים חסרים נשארים ריקים (NULL) ואינם מוערכים.', 'OpenStreetMap is edited by volunteers; completeness varies by neighbourhood. Missing values are left NULL, never estimated.'],
    'R.lim2': ['EPSG:25830: إحداثيات OSM (WGS 84) عوملت كـ ETRS89 دون تحويل مرجعي؛ الفرق في إسبانيا أقل من 1 م عام 2026، وهو التحويل الافتراضي في QGIS/PROJ.', 'EPSG:25830: קואורדינטות OSM (WGS 84) טופלו כ-ETRS89 ללא המרת דאטום; ההפרש בספרד קטן מ-1 מ׳ ב-2026, וזו גם ברירת המחדל ב-QGIS/PROJ.', 'EPSG:25830: OSM coordinates (WGS 84) are treated as ETRS89 without a datum shift; the difference in Spain is under 1 m in 2026, which is also the QGIS/PROJ default.'],
    'R.lim3': ['المساحات والأطوال محسوبة على مجسم GRS80 (أرضية، لا تتأثر بمعامل مقياس UTM).', 'השטחים והאורכים מחושבים על אליפסואיד GRS80 (קרקעיים, ללא השפעת מקדם קנה המידה של UTM).', 'Areas and lengths are computed on the GRS80 ellipsoid (ground values, not affected by the UTM scale factor).'],
    'R.sources': ['المصادر والتراخيص', 'מקורות ורישיונות', 'Sources and licences'],
    'R.osmLic': ['© مساهمو OpenStreetMap. البيانات متاحة بموجب رخصة Open Database License (ODbL 1.0): https://www.openstreetmap.org/copyright — أي قاعدة بيانات مشتقة تُشارَك بالرخصة نفسها ويجب ذكر المصدر.', '© תורמי OpenStreetMap. הנתונים זמינים תחת Open Database License (ODbL 1.0): https://www.openstreetmap.org/copyright — מסד נתונים נגזר משותף באותו רישיון ויש לציין את המקור.', '© OpenStreetMap contributors. Data available under the Open Database License (ODbL 1.0): https://www.openstreetmap.org/copyright — derived databases must be shared under the same licence, with attribution.'],
    'R.demLic': ['Copernicus DEM GLO-90 © DLR e.V. 2010-2014 و© Airbus Defence and Space GmbH 2014-2018، مقدّم ضمن COPERNICUS من الاتحاد الأوروبي وESA؛ عبر Open-Meteo (CC BY 4.0).', 'Copernicus DEM GLO-90 © DLR e.V. 2010-2014 ו-© Airbus Defence and Space GmbH 2014-2018, מסופק במסגרת COPERNICUS על ידי האיחוד האירופי ו-ESA; דרך Open-Meteo (CC BY 4.0).', 'Copernicus DEM GLO-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; via Open-Meteo (CC BY 4.0).'],
    'R.eraLic': ['ERA5 (Copernicus Climate Change Service) عبر Open-Meteo، CC BY 4.0.', 'ERA5 (Copernicus Climate Change Service) דרך Open-Meteo, CC BY 4.0.', 'ERA5 (Copernicus Climate Change Service) via Open-Meteo, CC BY 4.0.'],
    'R.commonsLic': ['Wikimedia Commons: لكل صورة مؤلف وترخيص في الحقلين author وlicense؛ راجعوا صفحة الملف قبل إعادة الاستخدام.', 'Wikimedia Commons: לכל תמונה מחבר ורישיון בשדות author ו-license; בדקו את דף הקובץ לפני שימוש חוזר.', 'Wikimedia Commons: each image has its author and licence in the author and license fields; check the file page before reuse.'],
    'R.fields': ['قاموس الحقول (أسماء الحقول ثابتة بالإنجليزية في كل اللغات)', 'מילון השדות (שמות השדות קבועים באנגלית בכל השפות)', 'Field dictionary (field names stay in English in every language)'],
    'R.retrieved': ['تاريخ الجلب', 'תאריך אחזור', 'Retrieved'], 'R.osmBase': ['لقطة OSM', 'תמונת OSM', 'OSM snapshot'],
    'R.validation': ['التحقق', 'בדיקה', 'Validation'],
    'L.sections': ['خطوط المقاطع', 'קווי חתך', 'Section lines'],
    'L.section_profile': ['نقاط مقطع التضاريس (MDT25)', 'נקודות פרופיל הקרקע (MDT25)', 'Section terrain profile points (MDT25)'],
    'L.section_cuts': ['المباني المقطوعة في المقاطع', 'מבנים חתוכים בחתכים', 'Buildings cut by sections'],
    'L.area_indicators': ['مؤشرات المقارنة لكل منطقة', 'מדדי השוואה לכל אזור', 'Comparison indicators per area'],
    'L.facilities': ['المرافق: صحة، تعليم، إقامة', 'מוסדות: בריאות, חינוך, לינה', 'Facilities: health, education, stays'],
    'N.sections': ['خطوط مرسومة يدويًا (A → B مع الرؤوس الوسيطة).', 'קווים שסומנו ידנית (A → B עם הקודקודים שביניהם).', 'Hand-drawn lines (A → B with intermediate vertices).'],
    'N.profile': ['ارتفاع IGN MDT25 (25 م، استيفاء ثنائي الخطية) على طول كل مقطع.', 'גובה IGN MDT25 (25 מ׳, אינטרפולציה בילינארית) לאורך כל חתך.', 'IGN MDT25 elevation (25 m, bilinear) along each section.'],
    'N.cuts': ['مقطع كل مبنى يعبره الخط. height_source: height (وسم OSM)، levels (تقدير = طوابق × floor_h_m)، unknown (لا ارتفاع).', 'מקטע כל מבנה שהקו חוצה. height_source: height (תג OSM), levels (הערכה = קומות × floor_h_m), unknown (ללא גובה).', 'One segment per building crossed. height_source: height (OSM tag), levels (estimate = floors × floor_h_m), unknown (no height).'],
    'N.indicators': ['قيم NULL تعني «لا بيانات» وليست صفرًا. القيم للمساحة (لكل كم²)، لا لكل ساكن.', 'ערכי NULL פירושם «אין נתונים», לא אפס. הערכים לשטח (לקמ״ר), לא לנפש.', 'NULL means "no data", not zero. Values are per area (per km²), not per resident.'],
    'N.facilities': ['لقطة Overpass؛ نقطة واحدة لكل عنصر داخل المنطقة.', 'תמונת Overpass; נקודה אחת לכל ישות בתוך האזור.', 'Overpass snapshot; one point per feature inside the area.'],
    'N.mdt': ['IGN MDT25 بشبكته الأصلية (EPSG:25830، 25 م)، مقصوص إلى الإطار المحيط بالمناطق + 50 م. قيم صحيحة بالمتر.', 'IGN MDT25 ברשת המקורית (EPSG:25830, 25 מ׳), חתוך למלבן התוחם של האזורים + 50 מ׳. ערכים שלמים במטרים.', 'IGN MDT25 in its native grid (EPSG:25830, 25 m), cropped to the bounding box of the areas + 50 m. Integer metres.'],
    'R.mdtLic': ['IGN MDT25 © Instituto Geográfico Nacional، CC BY 4.0 (scne.es).', 'IGN MDT25 © Instituto Geográfico Nacional, CC BY 4.0 (scne.es).', 'IGN MDT25 © Instituto Geográfico Nacional, CC BY 4.0 (scne.es).'],
  });

  // ---------- field dictionaries (stable names; meanings translated) ----------
  const F = (name, type, ar, he, en) => ({ name, type, d: [ar, he, en] });
  const OSM_ID = [F('osm_id', 'TEXT', 'معرّف OSM (نوع/رقم)', 'מזהה OSM (סוג/מספר)', 'OSM identifier (type/number)'), F('osm_type', 'TEXT', 'نوع عنصر OSM', 'סוג ישות OSM', 'OSM element type'), F('osm_num', 'INTEGER', 'رقم عنصر OSM', 'מספר ישות OSM', 'OSM element number'), F('name', 'TEXT', 'الاسم كما في OSM', 'השם כפי שב-OSM', 'Name as in OSM')];
  const FIELDS = {
    study_area: [F('name', 'TEXT', 'اسم المنطقة', 'שם האזור', 'Area name'), F('shape', 'TEXT', 'circle / square / polygon', 'circle / square / polygon', 'circle / square / polygon'), F('radius_m', 'REAL', 'نصف القطر (م) للدائرة', 'רדיוס (מ׳) לעיגול', 'Radius (m) for circles'), F('side_m', 'REAL', 'طول الضلع (م) للمربع', 'אורך צלע (מ׳) לריבוע', 'Side (m) for squares'), F('n_vertices', 'INTEGER', 'عدد الرؤوس', 'מספר קודקודים', 'Number of vertices'), F('area_m2', 'REAL', 'المساحة الأرضية (م²)', 'שטח קרקעי (מ״ר)', 'Ground area (m²)'), F('perimeter_m', 'REAL', 'المحيط (م)', 'היקף (מ׳)', 'Perimeter (m)'), F('center_lon', 'REAL', 'خط طول مركز التحديد', 'קו אורך של מרכז הבחירה', 'Selection centre longitude'), F('center_lat', 'REAL', 'خط عرض مركز التحديد', 'קו רוחב של מרכז הבחירה', 'Selection centre latitude'), F('center_note', 'TEXT', 'ملاحظة: المركز هندسي وليس مركز المدينة', 'הערה: המרכז גאומטרי, לא מרכז העיר', 'Note: geometric centre, not the city centre'), F('exported', 'TEXT', 'تاريخ التصدير', 'תאריך הייצוא', 'Export date')],
    buildings: OSM_ID.concat([F('building', 'TEXT', 'نوع المبنى (وسم building)', 'סוג המבנה (תג building)', 'Building type (building tag)'), F('levels', 'REAL', 'عدد الطوابق فوق الأرض؛ فارغ إذا غير موسوم', 'קומות מעל הקרקע; ריק אם לא מתויג', 'Floors above ground; NULL if not tagged'), F('levels_tag', 'TEXT', 'القيمة الأصلية لوسم building:levels', 'הערך המקורי של building:levels', 'Original building:levels value'), F('level_band', 'TEXT', 'فئة الطوابق: 1-2، 3-4، 5-8، 9+، no_data', 'קבוצת קומות: 1-2, 3-4, 5-8, 9+, no_data', 'Floor band: 1-2, 3-4, 5-8, 9+, no_data'), F('height_m', 'REAL', 'الارتفاع (م) إذا موسوم', 'גובה (מ׳) אם מתויג', 'Height (m) if tagged'), F('start_date', 'TEXT', 'تاريخ البناء كما وُسم', 'תאריך הבנייה כפי שתויג', 'Construction date as tagged'), F('start_year', 'INTEGER', 'السنة المستخرجة من start_date', 'השנה שחולצה מ-start_date', 'Year parsed from start_date'), F('period', 'TEXT', 'الفترة: pre_1900، 1900_1939 … 2000_plus، no_data', 'תקופה: pre_1900, 1900_1939 … 2000_plus, no_data', 'Period: pre_1900, 1900_1939 … 2000_plus, no_data'), F('roof_shape', 'TEXT', 'شكل السقف إذا موسوم', 'צורת הגג אם מתויגת', 'Roof shape if tagged'), F('amenity', 'TEXT', 'وظيفة عامة إذا موسومة', 'שימוש ציבורי אם מתויג', 'Public use if tagged'), F('footprint_m2', 'REAL', 'مساحة المسقط (م²)', 'שטח טביעת הרגל (מ״ר)', 'Footprint area (m²)'), F('crosses_boundary', 'INTEGER', '1 إذا عبر المبنى حد المنطقة', '1 אם המבנה חוצה את הגבול', '1 if the building crosses the boundary')]),
    streets: OSM_ID.concat([F('highway', 'TEXT', 'تصنيف OSM (highway)', 'סיווג OSM (highway)', 'OSM classification (highway)'), F('tier', 'TEXT', 'الدرجة: primary، collector، local، pedestrian، other', 'דרגה: primary, collector, local, pedestrian, other', 'Tier: primary, collector, local, pedestrian, other'), F('oneway', 'TEXT', 'اتجاه واحد', 'חד-סטרי', 'One-way'), F('lanes', 'TEXT', 'عدد المسارات', 'מספר נתיבים', 'Lanes'), F('maxspeed', 'TEXT', 'السرعة القصوى', 'מהירות מרבית', 'Speed limit'), F('surface', 'TEXT', 'نوع السطح', 'סוג משטח', 'Surface'), F('bridge', 'TEXT', 'جسر', 'גשר', 'Bridge'), F('tunnel', 'TEXT', 'نفق', 'מנהרה', 'Tunnel'), F('length_m', 'REAL', 'الطول داخل المنطقة (م)', 'אורך בתוך האזור (מ׳)', 'Length inside the area (m)'), F('clipped', 'INTEGER', '1 إذا قُص عند الحد', '1 אם נחתך בגבול', '1 if cut at the boundary')]),
    landuse: OSM_ID.concat([F('category', 'TEXT', 'الفئة: public، religious، water، green، cemetery، agri، commercial، industrial، construction، residential', 'קטגוריה: public, religious, water, green, cemetery, agri, commercial, industrial, construction, residential', 'Category: public, religious, water, green, cemetery, agri, commercial, industrial, construction, residential'), F('landuse', 'TEXT', 'وسم landuse', 'תג landuse', 'landuse tag'), F('leisure', 'TEXT', 'وسم leisure', 'תג leisure', 'leisure tag'), F('natural', 'TEXT', 'وسم natural', 'תג natural', 'natural tag'), F('amenity', 'TEXT', 'وسم amenity', 'תג amenity', 'amenity tag'), F('area_m2', 'REAL', 'المساحة داخل المنطقة (م²)', 'שטח בתוך האזור (מ״ר)', 'Area inside the boundary (m²)'), F('orig_area_m2', 'REAL', 'المساحة قبل القص (م²)', 'שטח לפני החיתוך (מ״ר)', 'Area before clipping (m²)'), F('clipped', 'INTEGER', '1 إذا قُص عند الحد', '1 אם נחתך בגבול', '1 if cut at the boundary')]),
    points: OSM_ID.concat([F('category', 'TEXT', 'المجموعة: public، worship، transit، tourism، food، everyday، shop، green، heritage، office، craft', 'קבוצה: public, worship, transit, tourism, food, everyday, shop, green, heritage, office, craft', 'Group: public, worship, transit, tourism, food, everyday, shop, green, heritage, office, craft'), F('subcategory', 'TEXT', 'الفئة الفرعية (مثل public:education)', 'תת-קטגוריה (למשל public:education)', 'Subcategory (e.g. public:education)'), F('amenity', 'TEXT', 'وسم amenity', 'תג amenity', 'amenity tag'), F('shop', 'TEXT', 'وسم shop', 'תג shop', 'shop tag'), F('tourism', 'TEXT', 'وسم tourism', 'תג tourism', 'tourism tag'), F('leisure', 'TEXT', 'وسم leisure', 'תג leisure', 'leisure tag'), F('historic', 'TEXT', 'وسم historic', 'תג historic', 'historic tag'), F('railway', 'TEXT', 'وسم railway', 'תג railway', 'railway tag'), F('highway', 'TEXT', 'وسم highway', 'תג highway', 'highway tag'), F('operator', 'TEXT', 'المشغّل', 'מפעיל', 'Operator'), F('route_ref', 'TEXT', 'أرقام الخطوط إذا موسومة', 'מספרי קווים אם מתויגים', 'Route numbers if tagged'), F('opening_hours', 'TEXT', 'ساعات العمل', 'שעות פתיחה', 'Opening hours'), F('wheelchair', 'TEXT', 'إمكانية الوصول بالكرسي', 'נגישות לכיסא גלגלים', 'Wheelchair access'), F('from_polygon', 'INTEGER', '1 إذا كانت النقطة مركز مضلع', '1 אם הנקודה היא מרכז פוליגון', '1 if the point is a polygon centroid')]),
    section_line: [F('orientation', 'TEXT', 'WE (غرب→شرق) أو NS (جنوب→شمال)', 'WE (מערב→מזרח) או NS (דרום→צפון)', 'WE (west→east) or NS (south→north)'), F('length_m', 'REAL', 'طول الخط (م)', 'אורך הקו (מ׳)', 'Line length (m)'), F('relief_m', 'REAL', 'فرق الارتفاع (م)', 'הפרש גבהים (מ׳)', 'Height difference (m)'), F('min_elev_m', 'REAL', 'أدنى ارتفاع (م)', 'גובה מזערי (מ׳)', 'Minimum elevation (m)'), F('max_elev_m', 'REAL', 'أعلى ارتفاع (م)', 'גובה מרבי (מ׳)', 'Maximum elevation (m)'), F('source', 'TEXT', 'المصدر', 'מקור', 'Source')],
    section_points: [F('seq', 'INTEGER', 'الترتيب على الخط', 'סדר לאורך הקו', 'Order along the line'), F('dist_m', 'REAL', 'المسافة من بداية الخط (م)', 'מרחק מתחילת הקו (מ׳)', 'Distance from the line start (m)'), F('elev_m', 'REAL', 'الارتفاع (م فوق سطح البحر)', 'גובה (מ׳ מעל פני הים)', 'Elevation (m above sea level)')],
    photos_commons: [F('commons_id', 'TEXT', 'معرّف الصفحة في Commons', 'מזהה הדף ב-Commons', 'Commons page id'), F('title', 'TEXT', 'عنوان الملف الأصلي', 'כותרת הקובץ המקורית', 'Original file title'), F('author', 'TEXT', 'المؤلف', 'מחבר', 'Author'), F('license', 'TEXT', 'الترخيص', 'רישיון', 'Licence'), F('license_url', 'TEXT', 'رابط الترخيص', 'קישור לרישיון', 'Licence URL'), F('date', 'TEXT', 'تاريخ الصورة', 'תאריך התצלום', 'Photo date'), F('page_url', 'TEXT', 'صفحة الملف', 'דף הקובץ', 'File page'), F('inside', 'INTEGER', '1 إذا داخل الحدود', '1 אם בתוך הגבול', '1 if inside the boundary'), F('point_is', 'TEXT', 'النقطة: camera / depicted_place / unspecified', 'הנקודה: camera / depicted_place / unspecified', 'The point is: camera / depicted_place / unspecified'), F('depicted_lon', 'REAL', 'خط طول المكان المصوَّر إن اختلف', 'קו אורך של המקום המצולם אם שונה', 'Depicted place longitude, if different'), F('depicted_lat', 'REAL', 'خط عرض المكان المصوَّر', 'קו רוחב של המקום המצולם', 'Depicted place latitude')],
    climate_cell: [F('year', 'INTEGER', 'السنة', 'שנה', 'Year'), F('model_elev_m', 'REAL', 'ارتفاع الخلية في النموذج (م)', 'גובה התא במודל (מ׳)', 'Cell elevation in the model (m)'), F('hot_days_35', 'INTEGER', 'أيام عظمى ≥ 35°م', 'ימים עם מקסימום ≥ 35°C', 'Days with max ≥ 35 °C'), F('nights_20', 'INTEGER', 'ليالٍ صغرى ≥ 20°م', 'לילות עם מינימום ≥ 20°C', 'Nights with min ≥ 20 °C'), F('precip_mm', 'REAL', 'مجموع الأمطار (مم)', 'סך משקעים (מ״מ)', 'Total precipitation (mm)'), F('jul_max_c', 'REAL', 'متوسط عظمى يوليو (°م)', 'ממוצע מקסימום ביולי (°C)', 'July mean daily max (°C)'), F('jan_min_c', 'REAL', 'متوسط صغرى يناير (°م)', 'ממוצע מינימום בינואר (°C)', 'January mean daily min (°C)')],
  };
  FIELDS.sections = [F('section_id', 'TEXT', 'معرّف المقطع', 'מזהה החתך', 'Section id'), F('section_name', 'TEXT', 'اسم المقطع', 'שם החתך', 'Section name'), F('n_vertices', 'INTEGER', 'عدد الرؤوس', 'מספר קודקודים', 'Number of vertices'), F('length_m', 'REAL', 'الطول (م)', 'אורך (מ׳)', 'Length (m)'), F('min_elev_m', 'REAL', 'أدنى ارتفاع (م)', 'גובה מזערי (מ׳)', 'Minimum elevation (m)'), F('max_elev_m', 'REAL', 'أعلى ارتفاع (م)', 'גובה מרבי (מ׳)', 'Maximum elevation (m)'), F('max_grad_pct', 'REAL', 'أقصى انحدار على الخط فوق ≥25 م (٪)', 'שיפוע מרבי לאורך הקו על בסיס ≥25 מ׳ (%)', 'Max gradient along the line over ≥25 m (%)'), F('max_grad_deg', 'REAL', 'نفسه بالدرجات', 'אותו ערך במעלות', 'Same, in degrees'), F('floor_h_m', 'REAL', 'ارتفاع الطابق المستخدم للتقدير (م)', 'גובה קומה ששימש להערכה (מ׳)', 'Floor height used for estimates (m)'), F('source', 'TEXT', 'المصدر', 'מקור', 'Source')];
  FIELDS.section_profile = [F('section_id', 'TEXT', 'معرّف المقطع', 'מזהה החתך', 'Section id'), F('seq', 'INTEGER', 'الترتيب', 'סדר', 'Order'), F('dist_m', 'REAL', 'المسافة من A (م)', 'מרחק מ-A (מ׳)', 'Distance from A (m)'), F('elev_m', 'REAL', 'الارتفاع (م فوق سطح البحر)؛ NULL خارج النموذج', 'גובה (מ׳ מעל פני הים); NULL מחוץ למודל', 'Elevation (m a.s.l.); NULL outside the model')];
  FIELDS.section_cuts = [F('section_id', 'TEXT', 'معرّف المقطع', 'מזהה החתך', 'Section id'), F('osm_id', 'TEXT', 'معرّف المبنى في OSM', 'מזהה המבנה ב-OSM', 'Building OSM id'), F('name', 'TEXT', 'الاسم', 'שם', 'Name'), F('d_from_m', 'REAL', 'بداية القطع من A (م)', 'תחילת החיתוך מ-A (מ׳)', 'Cut start from A (m)'), F('d_to_m', 'REAL', 'نهاية القطع من A (م)', 'סוף החיתוך מ-A (מ׳)', 'Cut end from A (m)'), F('base_elev_m', 'REAL', 'أدنى ارتفاع للأرض تحت القطع (م)', 'גובה הקרקע הנמוך תחת החיתוך (מ׳)', 'Lowest ground under the cut (m)'), F('height_m', 'REAL', 'الارتفاع (م)؛ NULL إذا غير معروف', 'גובה (מ׳); NULL אם לא ידוע', 'Height (m); NULL if unknown'), F('height_source', 'TEXT', 'height / levels / unknown', 'height / levels / unknown', 'height / levels / unknown'), F('levels', 'REAL', 'عدد الطوابق إذا موسوم', 'מספר קומות אם מתויג', 'Floors if tagged'), F('estimated', 'INTEGER', '1 إذا كان الارتفاع تقديرًا من الطوابق', '1 אם הגובה הוא הערכה מקומות', '1 if the height is estimated from floors')];
  const IND = ['area_km2', 'buildings', 'buildings_per_ha', 'gsi', 'levels_coverage', 'median_floors', 'start_coverage', 'street_km_per_km2', 'ped_share', 'green_share', 'health_n', 'health_per_km2', 'education_n', 'education_per_km2', 'stay_n', 'stay_per_km2', 'bus_n', 'bus_per_km2', 'bus_cover300', 'elev_min', 'elev_max', 'relief_m', 'steep_share_15deg', 'slope_p90_deg'];
  FIELDS.area_indicators = [F('area_no', 'INTEGER', 'رقم المنطقة', 'מספר האזור', 'Area number'), F('area_name', 'TEXT', 'اسم المنطقة', 'שם האזור', 'Area name')].concat(IND.map(k => F(k, 'REAL', k, k, k)), [F('notes', 'TEXT', 'ملاحظات عدالة المقارنة', 'הערות להוגנות ההשוואה', 'Comparison fairness notes')]);
  FIELDS.facilities = OSM_ID.slice(0, 1).concat([F('name', 'TEXT', 'الاسم', 'שם', 'Name'), F('grp', 'TEXT', 'health / education / stay', 'health / education / stay', 'health / education / stay'), F('cls', 'TEXT', 'الصنف (hospital، school، hotel…)', 'סוג (hospital, school, hotel…)', 'Class (hospital, school, hotel…)'), F('from_polygon', 'INTEGER', '1 إذا كانت النقطة مركز مضلع', '1 אם הנקודה היא מרכז פוליגון', '1 if the point is a polygon centre')]);
  const AREA_F = [F('area_no', 'INTEGER', 'رقم المنطقة في المقارنة', 'מספר האזור בהשוואה', 'Area number in the comparison'), F('area_name', 'TEXT', 'اسم المنطقة', 'שם האזור', 'Area name')];
  let MULTI = false;
  FIELDS.parks_open_space = FIELDS.landuse; FIELDS.public_facilities = FIELDS.points; FIELDS.transit_stops = FIELDS.points; FIELDS.pois_all = FIELDS.points;
  const LI = { ar: 0, he: 1, en: 2 };

  // ---------- helpers ----------
  const idParts = (id) => { const [type, num] = id.split('/'); return { osm_id: id, osm_type: type, osm_num: +num }; };
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
  function assignHoles(outers, inners) {
    return outers.map(o => [G.closeRing(o)].concat(inners.filter(h => h.length && G.pointInRing(h[0], o)).map(G.closeRing)));
  }
  const round = (crs) => crs === 25830 ? (v) => Math.round(v * 1000) / 1000 : (v) => Math.round(v * 1e7) / 1e7;
  function mapCoords(g, fn) {
    const walk = (c) => typeof c[0] === 'number' ? fn(c) : c.map(walk);
    return { type: g.type, coordinates: walk(g.coordinates) };
  }
  // RFC 7946 winding (exterior counter-clockwise, holes clockwise). TM is orientation-preserving,
  // so the same winding holds in EPSG:25830.
  function wind(g) {
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return g;
    const sa = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a; };
    const fix = (poly) => poly.map((r, i) => ((i === 0) === (sa(r) < 0)) ? r.slice().reverse() : r);
    return { type: g.type, coordinates: g.type === 'Polygon' ? fix(g.coordinates) : g.coordinates.map(fix) };
  }
  function toCRS(g, crs) { g = wind(g); const r = round(crs); return mapCoords(g, crs === 25830 ? (c) => PJ.EPSG25830.forward(c).map(r) : (c) => c.map(r)); }

  // ---------- layer assembly ----------
  function buildLayers(ctx) {
    const { spec, ring, run, area } = ctx; const out = []; const bb = G.bbox(ring);
    const inside = (p) => G.inBBox(p, bb) && G.pointInRing(p, ring);
    const now = new Date().toISOString();
    out.push({ id: 'study_area', geomType: 'POLYGON', status: 'ready', note: 'N.study_area', features: [{ geometry: { type: 'Polygon', coordinates: [G.closeRing(ring)] }, properties: {
      name: (area && area.name) || null, shape: spec.type, radius_m: spec.type === 'circle' ? spec.radius : null, side_m: spec.type === 'square' ? spec.side : null,
      n_vertices: G.openRing(ring).length, area_m2: +G.ringArea(ring).toFixed(2), perimeter_m: +G.perimeter(ring).toFixed(2), center_lon: spec.center[0], center_lat: spec.center[1],
      center_note: 'selection centre (geometric), not the city centre', exported: now } }] });

    const parsed = run && run.parsed; const res = run && run.result || {};
    const osmState = !run || !run.tasks || !run.tasks.osm ? 'notFetched' : run.tasks.osm.state === 'error' ? 'failed' : run.tasks.osm.state === 'skipped' ? 'notFetched' : parsed ? 'ok' : (res.osm ? 'needRefresh' : 'notFetched');
    const osmLayers = ['buildings', 'streets', 'landuse', 'parks_open_space', 'public_facilities', 'transit_stops', 'pois_all'];
    if (osmState !== 'ok') osmLayers.forEach(id => out.push({ id, status: 'unavailable', reason: osmState === 'needRefresh' ? 'x.needRefresh' : osmState === 'failed' ? 'x.failed' : 'x.notFetched' }));
    else {
      // buildings — centroid rule, whole footprints
      const B = [];
      parsed.buildings.forEach(b => {
        const c = G.centroidLL(b.outers[0]); if (!inside(c)) return;
        const t = b.tags; const lv = num(t['building:levels']); const y = A.parseYear(t.start_date || t['building:start_date']);
        const crosses = b.outers.some(o => o.some(p => !inside(p)));
        B.push({ geometry: { type: 'MultiPolygon', coordinates: assignHoles(b.outers, b.inners) }, properties: Object.assign(idParts(b.id), {
          name: t.name || null, building: t.building, levels: lv && lv > 0 ? lv : null, levels_tag: t['building:levels'] || null, level_band: lv && lv > 0 ? A.levelBand(lv) : 'no_data',
          height_m: num(t.height), start_date: t.start_date || t['building:start_date'] || null, start_year: y, period: y ? A.periodOf(y) : 'no_data', roof_shape: t['roof:shape'] || null,
          amenity: t.amenity || null, footprint_m2: +A.featArea(b).toFixed(2), crosses_boundary: crosses ? 1 : 0 }) });
      });
      out.push({ id: 'buildings', geomType: 'MULTIPOLYGON', status: B.length ? 'ready' : 'empty', note: 'N.buildings', features: B });
      // streets — exact clipping
      const S = [];
      parsed.streets.forEach(s => {
        const pieces = K.clipLine(s.coords, ring).filter(p => p.length > 1); if (!pieces.length) return;
        const len = pieces.reduce((a, p) => a + G.lineLength(p), 0); if (len < 0.01) return;
        const t = s.tags;
        S.push({ geometry: { type: 'MultiLineString', coordinates: pieces }, properties: Object.assign(idParts(s.id), { name: t.name || null, highway: t.highway, tier: A.streetTier(t) || 'other', oneway: t.oneway || null, lanes: t.lanes || null, maxspeed: t.maxspeed || null, surface: t.surface || null, bridge: t.bridge || null, tunnel: t.tunnel || null, length_m: +len.toFixed(2), clipped: Math.abs(G.lineLength(s.coords) - len) > 0.05 ? 1 : 0 }) });
      });
      out.push({ id: 'streets', geomType: 'MULTILINESTRING', status: S.length ? 'ready' : 'empty', note: 'N.streets', features: S });
      // land use — exact polygon clipping
      const LU = [];
      parsed.areas.forEach(f => {
        const cat = A.luCategory(f.tags); if (!cat) return;
        const fb = G.bbox(f.outers.flat()); if (fb[0] > bb[2] || fb[2] < bb[0] || fb[1] > bb[3] || fb[3] < bb[1]) return;
        let mp = [];
        assignHoles(f.outers, f.inners).forEach(poly => { try { mp = mp.concat(K.clipPolygon(poly, ring)); } catch (e) { /* skip unclippable geometry */ } });
        if (!mp.length) return;
        const a = mp.reduce((s, p) => s + G.ringArea(p[0]) - p.slice(1).reduce((u, h) => u + G.ringArea(h), 0), 0); if (a < 0.5) return;
        const orig = A.featArea(f); const t = f.tags;
        LU.push({ geometry: { type: 'MultiPolygon', coordinates: mp }, properties: Object.assign(idParts(f.id), { name: t.name || null, category: cat, landuse: t.landuse || null, leisure: t.leisure || null, natural: t.natural || null, amenity: t.amenity || null, area_m2: +a.toFixed(2), orig_area_m2: +orig.toFixed(2), clipped: Math.abs(orig - a) > 1 ? 1 : 0 }) });
      });
      out.push({ id: 'landuse', geomType: 'MULTIPOLYGON', status: LU.length ? 'ready' : 'empty', note: 'N.landuse', features: LU });
      const parks = LU.filter(f => f.properties.category === 'green');
      out.push({ id: 'parks_open_space', geomType: 'MULTIPOLYGON', status: parks.length ? 'ready' : 'empty', note: 'N.landuse', features: parks });
      // points
      const seen = new Set(); const PTS = [];
      parsed.pois.forEach(p => {
        if (seen.has(p.id) || !inside(p.pt)) return; seen.add(p.id);
        const sub = A.poiCategory(p.tags); if (!sub) return; const t = p.tags;
        PTS.push({ geometry: { type: 'Point', coordinates: p.pt }, properties: Object.assign(idParts(p.id), { name: t.name || null, category: sub.split(':')[0], subcategory: sub, amenity: t.amenity || null, shop: t.shop || null, tourism: t.tourism || null, leisure: t.leisure || null, historic: t.historic || null, railway: t.railway || null, highway: t.highway || null, operator: t.operator || null, route_ref: t.route_ref || null, opening_hours: t.opening_hours || null, wheelchair: t.wheelchair || null, from_polygon: p.isArea ? 1 : 0 }) });
      });
      const pub = PTS.filter(f => f.properties.category === 'public' || f.properties.category === 'worship');
      const tr = PTS.filter(f => f.properties.category === 'transit');
      out.push({ id: 'public_facilities', geomType: 'POINT', status: pub.length ? 'ready' : 'empty', note: 'N.points', features: pub });
      out.push({ id: 'transit_stops', geomType: 'POINT', status: tr.length ? 'ready' : 'empty', note: 'N.transit', features: tr });
      out.push({ id: 'pois_all', geomType: 'POINT', status: PTS.length ? 'ready' : 'empty', note: 'N.points', features: PTS });
    }
    // terrain section
    if (res.profile && res.sectionLine) {
      const pr = res.profile; const pts = pr.pts || pr.elev.map((_, i) => { const a = res.sectionLine[0], b = res.sectionLine[1], f = i / (pr.elev.length - 1); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; });
      out.push({ id: 'section_line', geomType: 'LINESTRING', status: 'ready', note: 'N.section', features: [{ geometry: { type: 'LineString', coordinates: pts }, properties: { orientation: run.section || 'WE', length_m: +pr.length.toFixed(2), relief_m: +pr.relief.toFixed(1), min_elev_m: pr.min, max_elev_m: pr.max, source: 'Copernicus DEM GLO-90 via Open-Meteo' } }] });
      out.push({ id: 'section_points', geomType: 'POINT', status: 'ready', note: 'N.section', features: pts.map((p, i) => ({ geometry: { type: 'Point', coordinates: p }, properties: { seq: i + 1, dist_m: +pr.dist[i].toFixed(2), elev_m: pr.elev[i] } })) });
    } else ['section_line', 'section_points'].forEach(id => out.push({ id, status: 'unavailable', reason: run && run.tasks && run.tasks.terrain && run.tasks.terrain.state === 'error' ? 'x.failed' : 'x.notFetched' }));
    // photos
    if (res.photos) {
      const ph = res.photos.filter(p => p.pt).map(p => ({ geometry: { type: 'Point', coordinates: p.pt }, properties: { commons_id: p.id, title: p.title, author: p.author || null, license: p.license || null, license_url: p.licenseUrl || null, date: p.date || null, page_url: p.page || null, inside: p.inside ? 1 : 0,
        point_is: p.camera ? 'camera' : p.depicted ? 'depicted_place' : 'unspecified', depicted_lon: p.camera && p.depicted ? p.depicted[0] : null, depicted_lat: p.camera && p.depicted ? p.depicted[1] : null } }));
      out.push({ id: 'photos_commons', geomType: 'POINT', status: ph.length ? 'ready' : 'empty', note: 'N.photos', features: ph });
    } else out.push({ id: 'photos_commons', status: 'unavailable', reason: 'x.notFetched' });
    // climate
    if (res.climate) {
      const c = res.climate;
      out.push({ id: 'climate_cell', geomType: 'POINT', status: 'ready', note: 'N.climate', features: [{ geometry: { type: 'Point', coordinates: [c.gridLon, c.gridLat] }, properties: { year: +c.year, model_elev_m: c.elevation, hot_days_35: c.hot35, nights_20: c.trop20, precip_mm: +c.precip.toFixed(1), jul_max_c: c.monthly[6].max != null ? +c.monthly[6].max.toFixed(2) : null, jan_min_c: c.monthly[0].min != null ? +c.monthly[0].min.toFixed(2) : null } }] });
    } else out.push({ id: 'climate_cell', status: 'unavailable', reason: 'x.notFetched' });
    ['population', 'gtfs', 'catastro', 'lst'].forEach(id => out.push({ id, status: 'unavailable', reason: 'x.notConnected', planned: true }));
    return out;
  }
  function fieldsFor(id) { const f = FIELDS[id] || []; return MULTI && f.length && !f.some(x => x.name === 'area_no') ? AREA_F.concat(f) : f; }

  // sections, indicators and facilities (new in v2); used for one area and for several
  function extraLayers(ctx) {
    const out = []; const secs = ctx.sections || [];
    if (secs.length) {
      out.push({ id: 'sections', geomType: 'LINESTRING', status: 'ready', note: 'N.sections', features: secs.map(p => ({ geometry: { type: 'LineString', coordinates: p.pts }, properties: Object.assign({}, p._area || {}, { section_id: p.id, section_name: p.name, n_vertices: p.pts.length, length_m: +p.L.toFixed(2), min_elev_m: p.min, max_elev_m: p.max, max_grad_pct: +(p.maxGrad * 100).toFixed(1), max_grad_deg: +(Math.atan(p.maxGrad) * 180 / Math.PI).toFixed(1), floor_h_m: p.floorH, source: 'IGN MDT25 (25 m, bilinear); OSM buildings' }) })) });
      const pf = []; const cuts = [];
      secs.forEach(p => { const pl = ctx.polyline(p.pts);
        p.dist.forEach((d, i) => pf.push({ geometry: { type: 'Point', coordinates: ctx.atLL(pl, d) }, properties: Object.assign({}, p._area || {}, { section_id: p.id, seq: i + 1, dist_m: +d.toFixed(2), elev_m: p.elev[i] == null ? null : +p.elev[i].toFixed(2) }) }));
        p.cuts.forEach(c => { cuts.push({ geometry: { type: 'LineString', coordinates: [ctx.atLL(pl, c.d0), ctx.atLL(pl, c.d1)] }, properties: Object.assign({}, p._area || {}, { section_id: p.id, osm_id: c.id, name: c.name, d_from_m: +c.d0.toFixed(2), d_to_m: +c.d1.toFixed(2), base_elev_m: c.base == null ? null : +c.base.toFixed(1), height_m: c.h == null ? null : +c.h.toFixed(1), height_source: c.src, levels: c.lv == null ? null : c.lv, estimated: c.src === 'levels' ? 1 : 0 }) }); }); });
      out.push({ id: 'section_profile', geomType: 'POINT', status: 'ready', note: 'N.profile', features: pf });
      out.push({ id: 'section_cuts', geomType: 'LINESTRING', status: cuts.length ? 'ready' : 'empty', note: 'N.cuts', features: cuts });
    }
    if (ctx.indicators && ctx.indicators.length) out.push({ id: 'area_indicators', geomType: 'POLYGON', status: 'ready', note: 'N.indicators', features: ctx.indicators.map(x => ({ geometry: { type: 'Polygon', coordinates: [G.closeRing(x.ring)] }, properties: Object.assign({ area_no: x.no, area_name: x.name }, x.values, { notes: x.notes || null }) })) });
    return out;
  }
  function facilitiesLayer(ctx) {
    const parsed = ctx.run && ctx.run.parsed; if (!parsed) return null; const ring = ctx.ring; const bb = G.bbox(ring);
    const fs = parsed.pois.filter(p => p.tags && p.tags._fac && G.inBBox(p.pt, bb) && G.pointInRing(p.pt, ring)).map(p => ({ geometry: { type: 'Point', coordinates: p.pt }, properties: { osm_id: p.id, name: p.tags.name || null, grp: p.tags._fac, cls: p.tags._cls, from_polygon: p.isArea ? 1 : 0 } }));
    return { id: 'facilities', geomType: 'POINT', status: fs.length ? 'ready' : 'empty', note: 'N.facilities', features: fs };
  }
  // several study areas → one layer per theme with area_no/area_name on every feature
  function multiLayers(ctx) {
    const merged = {}; const order = [];
    ctx.areas.forEach(a => {
      const ls = buildLayers(a); const fl = facilitiesLayer(a); if (fl) ls.splice(ls.findIndex(l => l.id === 'pois_all') + 1 || ls.length, 0, fl);
      ls.forEach(l => {
        if (!merged[l.id]) { merged[l.id] = Object.assign({}, l, { features: l.features ? [] : undefined }); order.push(l.id); }
        const m = merged[l.id];
        if (l.features) { if (!m.features) m.features = []; l.features.forEach(f => m.features.push({ geometry: f.geometry, properties: Object.assign({ area_no: a.no, area_name: a.area.name }, f.properties) })); m.status = m.features.length ? 'ready' : 'empty'; delete m.reason; }
      });
    });
    return order.map(id => merged[id]).concat(extraLayers(ctx));
  }

  // ---------- styles ----------
  function styleFor(id, lang) {
    const L = (k) => t(k);
    const fill = (c, o) => Object.assign({ kind: 'fill', color: c, outline: '#7A7F86', outlineWidth: 0.12 }, o || {});
    switch (id) {
      case 'study_area': return Q.single({ kind: 'fill', color: P.red, alpha: 0.08, outline: P.red, outlineWidth: 0.7 });
      case 'buildings': return Q.categorized('level_band', 'fill', ['1-2', '3-4', '5-8', '9+'].map(k => ({ value: k, label: t('b.floors', { v: k }), sym: fill(P.band[k], { outline: '#9A9EA4' }) })).concat([{ value: 'no_data', label: t('nodata'), sym: fill('#FFFFFF', { outline: '#9A9EA4' }) }]));
      case 'buildings_period': return Q.categorized('period', 'fill', Object.keys(P.period).map(k => ({ value: k, label: k === 'no_data' ? t('nodata') : k === 'pre_1900' ? t('period.pre_1900') : k === '2000_plus' ? t('period.2000_plus') : k.replace('_', '–'), sym: fill(P.period[k], { outline: '#9A9EA4' }) })));
      case 'streets': return Q.categorized('tier', 'line', Object.keys(P.tier).map(k => ({ value: k, label: t('tier.' + k), sym: { color: P.tier[k], width: P.tierWidth[k] * 0.32, dash: k === 'pedestrian' ? '2;1' : null } })));
      case 'landuse': case 'parks_open_space': return Q.categorized('category', 'fill', Object.keys(P.landuse).map(k => ({ value: k, label: t('lu.c.' + k), sym: fill(P.landuse[k], { alpha: 0.75, outline: P.landuse[k] }) })));
      case 'public_facilities': case 'pois_all': case 'transit_stops':
        return Q.categorized('category', 'marker', Object.keys(P.poi).map(k => ({ value: k, label: t('poi.g.' + k) !== 'poi.g.' + k ? t('poi.g.' + k) : k, sym: { color: P.poi[k], size: 2.2 } })));
      case 'section_line': return Q.single({ kind: 'line', color: P.red, width: 0.6, dash: '3;1.5' });
      case 'section_points': return Q.single({ kind: 'marker', color: P.red, size: 1.4 });
      case 'photos_commons': return Q.single({ kind: 'marker', color: P.ink, size: 1.8 });
      case 'climate_cell': return Q.single({ kind: 'marker', color: P.blue, size: 3 });
      case 'sections': return Q.single({ kind: 'line', color: P.ink, width: 0.7 });
      case 'section_profile': return Q.single({ kind: 'marker', color: P.ink, size: 0.8 });
      case 'section_cuts': return Q.categorized('height_source', 'line', [{ value: 'height', label: 'height (OSM)', sym: { color: P.ink, width: 1.4 } }, { value: 'levels', label: 'levels × floor_h_m (estimate)', sym: { color: '#6E737A', width: 1.4, dash: '2;1' } }, { value: 'unknown', label: 'unknown', sym: { color: P.red, width: 1.4 } }]);
      case 'area_indicators': return Q.single({ kind: 'fill', color: P.red, alpha: 0.05, outline: P.red, outlineWidth: 0.6 });
      case 'facilities': return Q.categorized('grp', 'marker', [{ value: 'health', label: 'health', sym: { color: P.red, size: 2.4 } }, { value: 'education', label: 'education', sym: { color: P.blue, size: 2.4 } }, { value: 'stay', label: 'stay', sym: { color: P.ink, size: 2.4 } }]);
    }
    return null;
  }

  // ---------- elevation raster ----------
  function demPlan(ring, crs, cell) {
    const c = G.centroidLL(ring); let pts, W, H, ox, oy, px, py;
    const MAXPX = 4096; let size = cell;
    for (;;) {
      if (crs === 25830) {
        const xy = G.openRing(ring).map(p => PJ.EPSG25830.forward(p)); const minx = Math.min(...xy.map(p => p[0])), maxx = Math.max(...xy.map(p => p[0])), miny = Math.min(...xy.map(p => p[1])), maxy = Math.max(...xy.map(p => p[1]));
        ox = Math.floor(minx / size) * size; oy = Math.ceil(maxy / size) * size; W = Math.ceil((maxx - ox) / size); H = Math.ceil((oy - miny) / size); px = size; py = size;
        if (W * H <= MAXPX) { pts = []; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) pts.push(PJ.EPSG25830.inverse([ox + (i + 0.5) * px, oy - (j + 0.5) * py])); break; }
      } else {
        const P0 = G.proj(c); const one = P0.toLL([size, size]); px = one[0] - c[0]; py = one[1] - c[1];
        const b = G.bbox(ring); ox = b[0]; oy = b[3]; W = Math.ceil((b[2] - b[0]) / px); H = Math.ceil((b[3] - b[1]) / py);
        if (W * H <= MAXPX) { pts = []; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) pts.push([ox + (i + 0.5) * px, oy - (j + 0.5) * py]); break; }
      }
      size *= 1.25;
    }
    const inside = pts.map(p => G.pointInRing(p, ring));
    const n = inside.filter(Boolean).length;
    return { W, H, ox, oy, px, py, pts, inside, cell: size, n, requests: Math.ceil(n / 100) };
  }
  async function fetchDEM(plan, elevationFn, onProgress) {
    const data = new Float32Array(plan.W * plan.H).fill(-9999);
    const idx = plan.inside.map((b, i) => b ? i : -1).filter(i => i >= 0);
    for (let k = 0; k < idx.length; k += 100) {
      onProgress && onProgress(Math.floor(k / 100) + 1, Math.ceil(idx.length / 100));
      const chunk = idx.slice(k, k + 100); const el = await elevationFn(chunk.map(i => plan.pts[i]));
      chunk.forEach((i, j) => { const v = el[j]; data[i] = (v == null || !isFinite(v)) ? -9999 : v; });
    }
    return data;
  }

  // ---------- README ----------
  function readme(ctx, layers, opts, lang, extra) {
    const li = LI[lang]; const L = []; const t = (k, v) => I.tl(lang, k, v);
    const crsName = opts.crs === 25830 ? 'EPSG:25830 — ETRS89 / UTM zone 30N' : 'EPSG:4326 — WGS 84';
    L.push(t('R.head'), '='.repeat(40), '');
    L.push(`${t('R.area')}: ${ctx.area ? ctx.area.name : '—'} (${ctx.spec.type}, ${G.ringArea(ctx.ring).toFixed(0)} m²)`);
    L.push(`${t('R.created')}: ${extra.now}`);
    L.push(`${t('R.crs')}: GeoPackage = ${crsName}; GeoJSON = EPSG:4326 (RFC 7946)`);
    if (extra.osmBase) L.push(`${t('R.osmBase')}: ${extra.osmBase}`);
    if (extra.runAt) L.push(`${t('R.retrieved')}: ${extra.runAt}`);
    L.push('', t('R.open'), '', t('R.contents'), '-'.repeat(30));
    layers.filter(l => l.status !== 'unavailable').forEach(l => L.push(`• ${l.id} — ${t('L.' + l.id)}: ${l.status === 'empty' ? t('x.empty') : t('x.features', { n: l.features.length })}. ${l.note ? t(l.note) : ''}`));
    if (extra.dem) L.push(`• ${extra.dem.file} — ${t('L.elevation')}: ${extra.dem.W}×${extra.dem.H} px, ${extra.dem.cell.toFixed(1)} m. ${t(extra.dem.mdt ? 'N.mdt' : 'N.dem')}`);
    L.push('', t('R.missing'), '-'.repeat(30));
    layers.filter(l => l.status === 'unavailable').forEach(l => L.push(`• ${l.id} — ${t('L.' + l.id)}: ${t(l.reason)}`));
    L.push('', t('R.emptyNote'), '', t('R.limits'), '-'.repeat(30), '• ' + t('R.lim1'), '• ' + t('R.lim2'), '• ' + t('R.lim3'));
    L.push('', t('R.sources'), '-'.repeat(30), '• ' + t('R.osmLic'), '• ' + t('R.mdtLic'), '• ' + t('R.demLic'), '• ' + t('R.eraLic'), '• ' + t('R.commonsLic'));
    L.push('', t('R.fields'), '-'.repeat(30));
    layers.filter(l => l.status !== 'unavailable').forEach(l => { L.push('', `[${l.id}]`); fieldsFor(l.id).forEach(f => L.push(`  ${f.name} (${f.type}): ${f.d[li]}`)); });
    L.push('', t('R.validation'), '-'.repeat(30), t('x.validated'));
    return L.join('\n') + '\n';
  }

  // ---------- main ----------
  async function build(ctx, opts, deps) {
    const lang = I.lang; const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    MULTI = !!ctx.areas;
    if (MULTI) { ctx.spec = ctx.spec || { type: 'multi' }; ctx.ring = ctx.ring || ctx.areas[0].ring; ctx.area = ctx.area || { name: ctx.name || 'comparison' }; }
    let layers;
    if (MULTI) layers = multiLayers(ctx);
    else { layers = buildLayers(ctx); const fl = facilitiesLayer(ctx); if (fl) layers.splice(layers.findIndex(l => l.id === 'pois_all') + 1, 0, fl); layers = layers.concat(extraLayers(ctx)); if (ctx.sections && ctx.sections.length) layers = layers.filter(l => !((l.id === 'section_line' || l.id === 'section_points') && l.status === 'unavailable')); }
    const files = []; const slug = (ctx.area && ctx.area.name ? ctx.area.name : 'study_area').normalize('NFKC').replace(/[^\p{L}\p{N}\- ]+/gu, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'study_area';
    const base = 'granada_' + slug;
    const avail = layers.filter(l => l.status !== 'unavailable');
    const meta = { generator: 'Granada Atlas', created: now, language: lang, area: ctx.area ? ctx.area.name : null, shape: ctx.spec.type, area_m2: +G.ringArea(ctx.ring).toFixed(2), osm_snapshot: ctx.run && ctx.run.result && ctx.run.result.osmBase || null, analysis_run: ctx.run && ctx.run.runAt || null,
      crs: { gpkg: 'EPSG:' + opts.crs, geojson: 'EPSG:4326' }, layers: layers.map(l => ({ id: l.id, status: l.status, features: l.features ? l.features.length : 0, reason: l.reason ? t(l.reason) : null, note: l.note ? t(l.note) : null, fields: (FIELDS[l.id] || []).map(f => ({ name: f.name, type: f.type, description: f.d[LI[lang]], description_en: f.d[2] })) })) };
    deps.progress && deps.progress(t('x.stepGpkg'));
    if (opts.gpkg) {
      const SQL = await deps.loadSQL();
      const srs = [{ id: 4326, name: 'WGS 84 geodetic', wkt: PJ.WKT[4326], description: 'longitude/latitude coordinates in decimal degrees on the WGS 84 spheroid' }];
      if (opts.crs === 25830) srs.push({ id: 25830, name: 'ETRS89 / UTM zone 30N', wkt: PJ.WKT[25830], description: 'ETRS89 / UTM zone 30N (EPSG:25830)' });
      const gl = avail.map(l => ({ table: l.id, title: t('L.' + l.id), description: l.note ? t(l.note) : '', geomType: l.geomType, srsId: opts.crs, fields: fieldsFor(l.id).map(f => ({ name: f.name, type: f.type })), features: l.features.map(f => ({ geometry: toCRS(f.geometry, opts.crs), properties: f.properties })) }));
      const styles = []; if (opts.styles !== false) avail.forEach(l => { const s = styleFor(l.id, lang); if (s) styles.push({ table: l.id, name: t('L.' + l.id), qml: s }); });
      const attributes = [
        { table: 'layer_status', title: 'layer_status', description: 'Every layer of this export, including unavailable ones', fields: [{ name: 'layer', type: 'TEXT' }, { name: 'status', type: 'TEXT' }, { name: 'features', type: 'INTEGER' }, { name: 'explanation', type: 'TEXT' }], rows: layers.map(l => ({ layer: l.id, status: l.status, features: l.features ? l.features.length : 0, explanation: l.reason ? t(l.reason) : l.note ? t(l.note) : '' })) },
        { table: 'field_dictionary', title: 'field_dictionary', description: 'Meaning of every field (stable English names)', fields: [{ name: 'layer', type: 'TEXT' }, { name: 'field', type: 'TEXT' }, { name: 'type', type: 'TEXT' }, { name: 'description', type: 'TEXT' }, { name: 'description_en', type: 'TEXT' }], rows: avail.flatMap(l => fieldsFor(l.id).map(f => ({ layer: l.id, field: f.name, type: f.type, description: f.d[LI[lang]], description_en: f.d[2] }))) },
        { table: 'sources', title: 'sources', description: 'Sources, licences and dates', fields: [{ name: 'source', type: 'TEXT' }, { name: 'licence', type: 'TEXT' }, { name: 'data_date', type: 'TEXT' }, { name: 'retrieved', type: 'TEXT' }, { name: 'layers', type: 'TEXT' }], rows: [
          { source: 'OpenStreetMap (supplied extract 2026-10-23; facilities via Overpass API)', licence: 'ODbL 1.0 — © OpenStreetMap contributors', data_date: meta.osm_snapshot, retrieved: meta.analysis_run, layers: 'buildings, streets, landuse, parks_open_space, public_facilities, transit_stops, pois_all, facilities, section_cuts' },
          { source: 'IGN MDT25 (Instituto Geográfico Nacional)', licence: 'CC BY 4.0 — © Instituto Geográfico Nacional', data_date: '2008–2015', retrieved: null, layers: 'sections, section_profile, section_cuts' + (opts.dem && deps.demGrid ? ', elevation_mdt25 GeoTIFF' : '') },
          { source: 'Copernicus DEM GLO-90 via Open-Meteo Elevation API', licence: 'CC BY 4.0 (Open-Meteo); © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the EU and ESA', data_date: 'DEM release 2021', retrieved: meta.analysis_run, layers: 'section_line, section_points' + (opts.dem ? ', elevation GeoTIFF' : '') },
          { source: 'ERA5 via Open-Meteo Historical Weather API', licence: 'CC BY 4.0', data_date: ctx.run && ctx.run.result && ctx.run.result.climate ? ctx.run.result.climate.year : null, retrieved: meta.analysis_run, layers: 'climate_cell' },
          { source: 'Wikimedia Commons API', licence: 'per file (see author, license fields)', data_date: null, retrieved: meta.analysis_run, layers: 'photos_commons' } ] },
      ];
      files.push({ name: base + '.gpkg', data: GP.write(SQL, { layers: gl, attributes, styles, srs, timestamp: now }) });
    }
    if (opts.geojson) {
      avail.forEach(l => {
        const fc = { type: 'FeatureCollection', name: l.id, features: l.features.map((f, i) => ({ type: 'Feature', id: i + 1, properties: Object.assign({}, ...fieldsFor(l.id).map(fd => ({ [fd.name]: f.properties[fd.name] == null ? null : f.properties[fd.name] }))), geometry: toCRS(f.geometry, 4326) })) };
        files.push({ name: 'geojson/' + l.id + '.geojson', data: JSON.stringify(fc) });
        const s = styleFor(l.id, lang); if (s) files.push({ name: 'geojson/' + l.id + '.qml', data: s });
      });
    }
    if (opts.styles !== false) avail.forEach(l => { const s = styleFor(l.id, lang); if (s) files.push({ name: 'styles/' + l.id + '.qml', data: s }); });
    if (opts.styles !== false && avail.some(l => l.id === 'buildings')) files.push({ name: 'styles/buildings_period.qml', data: styleFor('buildings_period', lang) });
    let demInfo = null;
    if (opts.dem && deps.demGrid) { // IGN MDT25 crop in its native 25 m EPSG:25830 grid
      const g = deps.demGrid; const rings = MULTI ? ctx.areas.map(a => a.ring) : [ctx.ring];
      const U = rings.flat().map(p => PJ.EPSG25830.forward(p)); const pad = 50;
      const i0 = Math.max(0, Math.floor((Math.min(...U.map(p => p[0])) - pad - g.ox) / g.px)), i1 = Math.min(g.width - 1, Math.ceil((Math.max(...U.map(p => p[0])) + pad - g.ox) / g.px));
      const j0 = Math.max(0, Math.floor((g.oy - Math.max(...U.map(p => p[1])) - pad) / g.py)), j1 = Math.min(g.height - 1, Math.ceil((g.oy - Math.min(...U.map(p => p[1])) + pad) / g.py));
      if (i1 > i0 && j1 > j0) {
        const W = i1 - i0 + 1, H = j1 - j0 + 1; const data = new Float32Array(W * H);
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const v = g.arr[(j0 + j) * g.width + i0 + i]; data[j * W + i] = v === g.nodata ? -9999 : v; }
        const file = 'elevation_mdt25_epsg25830.tif';
        files.push({ name: file, data: TIF.write({ width: W, height: H, data, originX: g.ox + i0 * g.px, originY: g.oy - j0 * g.py, pixelX: g.px, pixelY: g.py, epsg: 25830, geographic: false, nodata: -9999,
          metadata: { SOURCE: 'IGN MDT25 (Modelo Digital del Terreno 25 m), catalogue epochs 2008-2015', UNITS: 'metre above mean sea level (Alicante)', NATIVE_RESOLUTION: '25 m', CELL: g.px.toFixed(3) + ' x ' + g.py.toFixed(3) + ' m', CROP: 'bounding box of the study area(s) + 50 m; not masked', LICENSE: 'CC BY 4.0 - Instituto Geografico Nacional', RETRIEVED: now } }) });
        demInfo = { file, W, H, cell: g.px, valid: Array.from(data).filter(v => v !== -9999).length, mdt: true };
        meta.elevation = { file, width: W, height: H, cell_m: +g.px.toFixed(3), crs: 'EPSG:25830', nodata: -9999, valid_pixels: demInfo.valid, source: 'IGN MDT25' };
      }
    }
    if (opts.dem && !demInfo) {
      const plan = demPlan(ctx.ring, opts.crs, opts.demCell || 30);
      const data = await fetchDEM(plan, deps.elevation, (a, b) => deps.progress && deps.progress(t('x.stepDem', { a, b })));
      const file = `elevation_glo90_epsg${opts.crs}.tif`;
      files.push({ name: file, data: TIF.write({ width: plan.W, height: plan.H, data, originX: plan.ox, originY: plan.oy, pixelX: plan.px, pixelY: plan.py, epsg: opts.crs, geographic: opts.crs === 4326, nodata: -9999,
        metadata: { SOURCE: 'Copernicus DEM GLO-90 via Open-Meteo Elevation API', UNITS: 'metre above sea level', NATIVE_RESOLUTION: '~90 m', CELL: plan.cell.toFixed(2) + (opts.crs === 4326 ? ' m (approx., in degrees)' : ' m'), MASK: 'pixels outside the study boundary are NoData', RETRIEVED: now, ATTRIBUTION: '© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the EU and ESA' } }) });
      demInfo = { file, W: plan.W, H: plan.H, cell: plan.cell, valid: Array.from(data).filter(v => v !== -9999).length };
      meta.elevation = { file, width: plan.W, height: plan.H, cell_m: +plan.cell.toFixed(2), crs: 'EPSG:' + opts.crs, nodata: -9999, valid_pixels: demInfo.valid };
    }
    const rx = { now, osmBase: meta.osm_snapshot, runAt: meta.analysis_run, dem: demInfo };
    files.push({ name: 'README_' + lang + '.txt', data: readme(ctx, layers, opts, lang, rx) });
    if (lang !== 'en') files.push({ name: 'README_en.txt', data: readme(ctx, layers, opts, 'en', rx) }); // English copy for sharing
    files.push({ name: 'metadata.json', data: JSON.stringify(meta, null, 1) });
    const zipBytes = Z.zip(files.map(f => ({ name: base + '/' + f.name, data: f.data })));
    MULTI = false;
    return { zipBytes, filename: base + '_gis.zip', files: files.map(f => ({ name: f.name, size: typeof f.data === 'string' ? f.data.length : f.data.length })), layers, demInfo };
  }

  function inventory(ctx) { return buildLayers(ctx).map(l => ({ id: l.id, status: l.status, count: l.features ? l.features.length : 0, reason: l.reason, note: l.note, planned: l.planned })); }

  const api = { build, inventory, buildLayers, demPlan, fetchDEM, styleFor, FIELDS, toCRS };
  if (isNode) module.exports = api; else { root.GA = root.GA || {}; root.GA.gisexport = api; }
})(typeof window !== 'undefined' ? window : globalThis);
