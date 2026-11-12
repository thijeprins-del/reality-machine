# Zet PixelLab-uitvoer om naar de huisstijl van de muizen: grauw, donker, korrelig, zwarte rand, neon alleen als accent.
# Gebruik: python3 scripts/land/stijl.py <in.png> <uit.png> [--seed N]   of   stijl.py <map-in> <map-uit>
import sys, json, os, random
from PIL import Image
P=json.load(open(os.path.join(os.path.dirname(__file__),'palet.json')))
hx=lambda h:tuple(int(h[i:i+2],16) for i in (1,3,5))
BASIS=[hx(h) for h in P['basis']]; NEON=[hx(h) for h in P['neon']]
RAND=hx('#060505')
def d2(a,b): return sum((x-y)**2 for x,y in zip(a,b))
def punt(c, neon_ok):
    r,g,b=c; mx,mn=max(c),min(c)
    if neon_ok and mx>200 and mx-mn>120:       # felle, verzadigde pixel: dichtstbijzijnde neonkleur
        return min(NEON,key=lambda n:d2(n,c))
    grijs=(r+g+b)/3
    f=0.42                                     # 42% van de kleur blijft over: grauw
    c=tuple(int(grijs+(v-grijs)*f) for v in c)
    c=tuple(int(v*0.82) for v in c)            # donkerder
    return min(BASIS[1:],key=lambda p:d2(p,c))
def restyle(im, seed=1):
    im=im.convert('RGBA'); w,h=im.size; px=im.load(); rnd=random.Random(seed)
    uit=Image.new('RGBA',(w,h),(0,0,0,0)); u=uit.load()
    for y in range(h):
        for x in range(w):
            r,g,b,a=px[x,y]
            if a<128: continue
            c=punt((r,g,b), True)
            if c not in NEON and rnd.random()<0.10:   # korrel: een stap donkerder of lichter in het palet
                i=BASIS.index(c); i=max(1,min(len(BASIS)-1,i+rnd.choice((-1,1)))); c=BASIS[i]
            u[x,y]=c+(255,)
    # zwarte rand (4-buren), zoals de muizen-sprites
    rand=[(x,y) for y in range(h) for x in range(w) if u[x,y][3]==0 and any(0<=x+dx<w and 0<=y+dy<h and u[x+dx,y+dy][3]>0 for dx,dy in((1,0),(-1,0),(0,1),(0,-1)))]
    for x,y in rand: u[x,y]=RAND+(255,)
    return uit
if __name__=='__main__':
    a,b=sys.argv[1],sys.argv[2]
    if os.path.isdir(a):
        os.makedirs(b,exist_ok=True)
        for f in sorted(os.listdir(a)):
            if f.endswith('.png'): restyle(Image.open(os.path.join(a,f))).save(os.path.join(b,f))
    else: restyle(Image.open(a)).save(b)
