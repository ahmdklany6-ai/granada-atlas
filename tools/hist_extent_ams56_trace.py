# Build 5.15 — outline of the continuous built-up area traced BY HAND on the AMS 1956–1957 orthophoto (IGN PNOA-histórico
# WMS, layer AMS_1956-1957, EPSG:4326 snapshot of 2000 × 1534 px over [-3.645, 37.150, -3.555, 37.205]); vertices in px.
from PIL import Image, ImageDraw
import json
P=[(880,380),(960,375),(975,440),(1000,520),(1060,560),(1120,545),(1180,560),(1230,600),(1260,640),(1210,665),(1150,680),(1110,720),(1120,790),(1160,830),(1200,900),(1170,960),(1120,990),(1060,1000),(1000,1010),(940,1015),(880,1005),(845,980),(830,920),(825,860),(820,800),(815,720),(810,650),(790,595),(720,565),(705,550),(760,530),(820,500),(800,450),(840,420),(870,430)]
im=Image.open('wms_ams56.jpg').convert('RGB'); d=ImageDraw.Draw(im); d.line(P+[P[0]],fill=(255,40,40),width=5)
x0,y0,x1,y1=550,250,1500,1250; im.crop((x0,y0,x1,y1)).resize((950,1000)).save('../ext/ams_chk.jpg',quality=85)
BB=[-3.645,37.150,-3.555,37.205]; W,H=2000,1534
json.dump([[round(BB[0]+x/W*(BB[2]-BB[0]),6), round(BB[3]-y/H*(BB[3]-BB[1]),6)] for x,y in P+[P[0]]],open('../ext/ams_trace.json','w'))
