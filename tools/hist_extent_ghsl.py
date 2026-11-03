# Build 5.15 — GHSL GHS-BUILT-S R2023A (JRC, CC BY 4.0), 100 m: cells with >= 20 % built-up surface contiguous with the
# historic centre, holes filled → built-up extent per epoch. Inputs: ghsl_*.npz/json from tools/verify/hist_extent_fetch.py.
import numpy as np, json
from scipy import ndimage as ndi
from skimage import measure
from shapely.geometry import Polygon
from shapely.ops import unary_union, transform as stransform
from pyproj import Transformer
meta=json.load(open('ghsl_meta.json')); Z=np.load('ghsl_built_s.npz')
inv=Transformer.from_crs('ESRI:54009','EPSG:4326',always_xy=True)
fwd=Transformer.from_crs('EPSG:4326','ESRI:54009',always_xy=True)
THR=float(__import__('os').environ.get('THR','2000'))   # m² built per 1 ha cell (= 20 %)
out={}
for ep in sorted(meta,key=int):
    a=Z['e'+ep].astype(float); t=meta[ep]['transform']  # [a,b,c,d,e,f] affine: x=a*col+b*row+c
    nd=meta[ep]['nodata']; 
    if nd is not None: a[a==nd]=0
    m=a>=THR
    m=ndi.binary_closing(m, ndi.generate_binary_structure(2,1)); m=ndi.binary_fill_holes(m)
    cx,cy=fwd.transform(-3.5985,37.1760); col=int((cx-t[2])/t[0]); row=int((cy-t[5])/t[4])
    lab,n=ndi.label(m); core=lab[row,col]
    keep=lab==core; keep=ndi.binary_fill_holes(keep)
    cs=measure.find_contours(np.pad(keep,1).astype(float),0.5)
    P=unary_union([Polygon([(c[1]-1+0.5,c[0]-1+0.5) for c in cc]).buffer(0) for cc in cs if len(cc)>8])
    P=max(P.geoms,key=lambda g:g.area) if P.geom_type=='MultiPolygon' else P; P=Polygon(P.exterior).simplify(0.6)
    # pixel (col,row) centre coords -> mollweide -> lon/lat
    g=stransform(lambda x,y: inv.transform(t[2]+np.array(x)*t[0], t[5]+np.array(y)*t[4]), P)
    out[ep]={'coords':[[round(x,5),round(y,5)] for x,y in g.exterior.coords],'km2':round(keep.sum()*0.01,1)}
    print(ep,'cells',int(keep.sum()),'km2',out[ep]['km2'],'vertices',len(out[ep]['coords']))
json.dump(out,open('../ext/ghsl_extents.json','w'))
