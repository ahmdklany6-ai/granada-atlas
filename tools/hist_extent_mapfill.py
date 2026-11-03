# Build 5.15 — urban fill of the IGN MTN50 1st-edition sheet 1009 (1932) and the undated MTN50 drafts ("catastrones",
# 1910–1970) → approximate city outline. Inputs: wms_*.jpg from tools/verify/hist_extent_fetch.py (runner); run in that folder.
import numpy as np, json, sys
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage import measure
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union
BB=[-3.645,37.150,-3.555,37.205]; W,H=2000,1534
def lonlat(x,y): return [round(BB[0]+x/W*(BB[2]-BB[0]),6), round(BB[3]-y/H*(BB[3]-BB[1]),6)]
def mask_of(k,a):
    r,g,b=a[...,0],a[...,1],a[...,2]
    if k=='mtn50': return (r-g>45)&(r-b>40)&(r>160)
    return (r-g>40)&(r-b>50)&(r<215)
def extract(k, close_r, open_r, seed):
    a=np.asarray(Image.open(f'wms_{k}.jpg').convert('RGB')).astype(int); m=mask_of(k,a)
    st=lambda rr: ndi.iterate_structure(ndi.generate_binary_structure(2,1), rr)
    m1=ndi.binary_opening(m, st(open_r))           # drop thin red roads / text
    m2=ndi.binary_closing(m1, st(close_r))          # merge blocks across streets
    m2=ndi.binary_fill_holes(m2)
    lab,n=ndi.label(m2); sizes=ndi.sum(m2,lab,range(1,n+1))
    x,y=seed; core=lab[y,x]
    keep=np.zeros_like(m2)
    if core: keep|=lab==core
    # also keep big components close to the core (contiguous suburbs separated by a road)
    dist=ndi.distance_transform_edt(~keep)
    for i,s in enumerate(sizes,1):
        if i!=core and s>1500 and dist[lab==i].min()<12: keep|=lab==i
    keep=ndi.binary_closing(keep, st(close_r)); keep=ndi.binary_fill_holes(keep)
    cs=measure.find_contours(np.pad(keep,1).astype(float),0.5)
    polys=[Polygon([(c[1]-1,c[0]-1) for c in cc]) for cc in cs if len(cc)>50]
    P=unary_union([p.buffer(0) for p in polys]); P=max(P.geoms,key=lambda g:g.area) if P.geom_type=='MultiPolygon' else P
    P=Polygon(P.exterior).buffer(9,join_style=1).buffer(-9,join_style=1); P=max(P.geoms,key=lambda g:g.area) if P.geom_type=='MultiPolygon' else P; P=Polygon(P.exterior).buffer(-3).buffer(3); P=max(P.geoms,key=lambda g:g.area) if P.geom_type=='MultiPolygon' else P; P=Polygon(P.exterior).simplify(3)
    coords=[lonlat(x,y) for x,y in P.exterior.coords]
    im=Image.open(f'wms_{k}.jpg').convert('RGB'); d=ImageDraw.Draw(im); d.line([(x,y) for x,y in P.exterior.coords],fill=(0,0,255),width=5); im.resize((1000,767)).save(f'../ext/chk_{k}.jpg',quality=85)
    print(k,'vertices',len(coords),'area px',int(P.area), 'km2', round(P.area*((BB[2]-BB[0])/W*111320*np.cos(np.radians(37.18)))*((BB[3]-BB[1])/H*110950)/1e6,2))
    return coords
def px(lon,lat): return int((lon-BB[0])/(BB[2]-BB[0])*W), int((BB[3]-lat)/(BB[3]-BB[1])*H)
out={}
out['mtn50']=extract('mtn50', 6, 1, px(-3.6010,37.1740)); out['catastrones']=extract('catastrones', 6, 2, px(-3.6010,37.1740))
json.dump(out,open('../ext/traced_auto.json','w'))
