/* Build 5.48 — the third study area: the air base (Base Aérea de Armilla) and the towns on its fence, with its own
   12 × 10 km analysis frame (data/ex13b), so the five analyses are no longer empty at the base. [ar, he, en]. */
(function (root) {
  root.GA.i18n.add({
    'v35.area.base': ['القاعدة — قاعدة أرميّا الجوية وما حولها', 'הבסיס — בסיס חיל האוויר ארמייה וסביבתו', 'The base — Armilla air base and around it'],
    'v35.mk.base': ['القاعدة · أرميّا', 'הבסיס · ארמייה', 'Base · Armilla'],
    'v35.card.base': ['القاعدة وسياجها والبلدات الخمس حولها', 'הבסיס, הגדר שלו וחמש העיירות סביבו', 'The base, its fence and the five towns around it'],
    'v35.intro.base': ['قاعدة أرميّا الجوية ({ha} هكتار، محيطها {km} كم على خط OSM)، بين أرميّا وتشوريانا ولاس غابياس وألهندين وأوخيخاريس. {housing} % من السياج يلامس سكنًا. للتحليلات الخمسة هنا إطار خاص (⁦12 × 10⁩ كم) لأن إطار المدينة ينتهي عند منتصف القاعدة.', 'בסיס חיל האוויר ארמייה ({ha} הקטאר, היקף {km} ק״מ לפי קו OSM), בין ארמייה, צ׳וריאנה, לאס גביאס, אלהנדין ואוחיחארס. {housing} % מהגדר נוגעים במגורים. לחמשת הניתוחים כאן מסגרת משלהם (⁦12 × 10⁩ ק״מ) כי מסגרת העיר נגמרת באמצע הבסיס.', 'Armilla air base ({ha} ha, {km} km around on the OSM outline), between Armilla, Churriana, Las Gabias, Alhendín and Ogíjares. {housing} % of the fence touches housing. The five analyses have their own frame here (12 × 10 km) because the city frame ends halfway across the base.'],
    'v35.i.estRes': ['السكان داخل القاعدة (مقدَّر)', 'תושבים בתוך הבסיס (מודל)', 'Residents inside the base (modelled)'],
    'v35.i.est1km': ['السكان ضمن 1 كم من السياج', 'תושבים עד 1 ק״מ מהגדר', 'Residents within 1 km of the fence'],
    'v35.i.frameRes': ['السكان في إطار القاعدة (⁦12 × 10⁩ كم)', 'תושבים במסגרת הבסיס (⁦12 × 10⁩ ק״מ)', 'Residents in the base frame (12 × 10 km)'],
    'v35.i.muniTop': ['أكبر البلديات في الإطار (سكان مقدَّرون)', 'הרשויות הגדולות במסגרת (תושבים מודלים)', 'Largest municipalities in the frame (modelled residents)'],
    'v35.i.estCov': ['تغطية المباني داخل القاعدة (OSM)', 'כיסוי מבנים בתוך הבסיס (OSM)', 'Building coverage inside the base (OSM)'],
    'v35.i.vsFactoryFrame': ['للمقارنة: إطار القاعدة كله', 'להשוואה: כל מסגרת הבסיס', 'For comparison: the whole base frame'],
    'v35.i.buildings': ['مبانٍ مرسومة في OSM داخل الإطار', 'מבנים ממופים ב-OSM במסגרת', 'Buildings mapped in OSM in the frame'],
    'v35.i.estPlaces': ['محلات وخدمات داخل القاعدة', 'חנויות ושירותים בתוך הבסיס', 'Shops and services inside the base'],
    'v35.i.est1kmPlaces': ['محلات وخدمات ضمن 1 كم من السياج', 'חנויות ושירותים עד 1 ק״מ מהגדר', 'Shops and services within 1 km of the fence'],
    'v35.i.framePlaces': ['محلات وخدمات في الإطار كله', 'חנויות ושירותים בכל המסגרת', 'Shops and services in the whole frame'],
    'v35.i.nearPeakF': ['أقرب قمة نشاط تجاري', 'שיא הפעילות המסחרית הקרוב', 'Nearest commercial peak'],
    'v35.i.estLst': ['وسيط حرارة السطح صيفًا داخل القاعدة', 'חציון טמפרטורת פני השטח בקיץ בתוך הבסיס', 'Median summer surface temperature inside the base'],
    'v35.i.est1kmMeet': ['أماكن لقاء ضمن 1 كم من السياج', 'מקומות מפגש עד 1 ק״מ מהגדר', 'Meeting places within 1 km of the fence'],
    'v35.i.factoryFrame': ['إطار القاعدة', 'מסגרת הבסיס', 'base frame'],
    'v35.i.hotEst': ['خلايا ≥ ⁦47 °C⁩ داخل القاعدة', 'תאים ≥ ⁦47 °C⁩ בתוך הבסיס', 'Cells ≥ 47 °C inside the base'],
    'v35.lg.frameB': ['امتداد بيانات التحليل (إطار ⁦12 × 10⁩ كم حول القاعدة)', 'היקף נתוני הניתוח (מסגרת ⁦12 × 10⁩ ק״מ סביב הבסיס)', 'extent of the analysis data (12 × 10 km frame around the base)'],
    'v35.fr.note': ['إطار تحليل ثالث (⁦12 × 10⁩ كم) حول القاعدة الجوية والبلدات على سياجها، بالمصادر والطرق والفئات نفسها لإطار المدينة. داخل القاعدة لا سكان ولا محلات تقريبًا، والأرقام تُظهر ذلك كما هو.', 'מסגרת ניתוח שלישית (⁦12 × 10⁩ ק״מ) סביב בסיס חיל האוויר והעיירות על הגדר שלו, באותם מקורות, שיטות ומחלקות כמו מסגרת העיר. בתוך הבסיס כמעט אין תושבים או חנויות, והמספרים מראים זאת כפי שהוא.', 'A third analysis frame (12 × 10 km) around the air base and the towns on its fence, with the same sources, methods and classes as the city frame. Inside the base there are almost no residents or shops, and the numbers show that as it is.']
  });
})(window);
