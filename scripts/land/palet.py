# Gedeeld palet voor alle land-sprites, afgeleid uit de muizen-sprites (grauw, bruin, olijf, staal) plus neonaccenten.
# Gebruik: python3 scripts/land/palet.py  -> schrijft scripts/land/palet.png (swatches) en palet.json
import glob, json
from PIL import Image
px=[]
for f in glob.glob('assets/muizen/*.png'):
    if 'gloed' in f or f.endswith('muis.png'): continue
    im=Image.open(f).convert('RGBA')
    for p in im.getdata():
        if p[3]>200: px.append(p[:3])
# neonpixels apart houden: sterk verzadigd en licht
def neon(c):
    mx,mn=max(c),min(c); return mx>170 and (mx-mn)>110
basis=[p for p in px if not neon(p)]
im=Image.new('RGB',(len(basis),1)); im.putdata(basis)
q=im.quantize(colors=28,method=Image.Quantize.MEDIANCUT)
pal=q.getpalette()[:28*3]
kleuren=[tuple(pal[i:i+3]) for i in range(0,len(pal),3)]
kleuren=sorted(set(kleuren),key=lambda c:sum(c))
NEON=[(0x4e,0xf2,0xff),(0xa8,0xff,0x2e),(0xff,0x3a,0x3a),(0xff,0x9a,0x2a),(0xe0,0x40,0xd0)]
alles=kleuren+NEON
json.dump({'basis':['#%02x%02x%02x'%c for c in kleuren],'neon':['#%02x%02x%02x'%c for c in NEON]},open('scripts/land/palet.json','w'),indent=1)
s=Image.new('RGB',(len(alles),1)); s.putdata(alles); s.save('scripts/land/palet.png')
print(len(alles),json.load(open('scripts/land/palet.json'))['basis'])
