# Land-sprites: één huisstijl

**Referentie (Thije, 17 nov): de otter-ontwerpen.** Mensen en bewoners van het land volgen `land/pro-otters-alle-types.png`
(in de projectmap; in de repo `assets/land/<type>/<type>-otter-0..3.png`): gedetailleerde pixelart, zwarte rand, rijke kleuren,
neon alleen als accent op gloeiende delen. Nieuwe bewoners tekenen we in die stijl, vier uitvoeringen per type, en we maken ze
**niet** grauw met `stijl.py`. `stijl.py` was voor de eerste PixelLab-overvallers en maakt alles te donker en te vlak voor mensen.
Eerst kijken wat er al is voordat je nieuwe bewoners laat genereren.

**Gebouwen van het land** (17 nov): PixelLab pixflux, 128 px, `view: low top-down`, prompt = gebouw + "isometric building on a small dark riveted metal base plate, grimy, weathered, cables, a little glowing neon accent, black outline", met `assets/gebouwen/groot/smederij.png` (op 128 px gezet) als `init_image` met `init_image_strength` 60. Hoger kopieert de smederij.
Per type vier: huis, werk, opslag, baken. Niet door `stijl.py` halen.

Hieronder de oude werkwijze voor overvallers en machines:

Alle sprites van het land (en straks alles) volgen de muizen: grauw, donker, korrelig, zwarte rand, neon alleen als accent.

1. Maak met PixelLab (`create-image-pixflux`, 1 generatie, isometrisch, `no_background`) een sprite. Prompt: onderwerp + "single character standing alone, no ground, no base, no shadow".
2. Draai `python3 scripts/land/stijl.py <in.png> <uit.png>` (of twee mappen). Dit zet de kleuren om naar het palet in `palet.json`
   (afgeleid uit de muizen-sprites met `palet.py`), desatureert en verdonkert, voegt korrel en zwarte rand toe.
3. Resultaat in `assets/land/<archetype>/pl-<naam>.png`.

Maten: eenheden 64 px, reuzen 128 px, machines 96 px (ruwe PixelLab-maat; het spel schaalt naar tegels).
