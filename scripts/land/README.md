# Land-sprites: één huisstijl

Alle sprites van het land (en straks alles) volgen de muizen: grauw, donker, korrelig, zwarte rand, neon alleen als accent.

1. Maak met PixelLab (`create-image-pixflux`, 1 generatie, isometrisch, `no_background`) een sprite. Prompt: onderwerp + "single character standing alone, no ground, no base, no shadow".
2. Draai `python3 scripts/land/stijl.py <in.png> <uit.png>` (of twee mappen). Dit zet de kleuren om naar het palet in `palet.json`
   (afgeleid uit de muizen-sprites met `palet.py`), desatureert en verdonkert, voegt korrel en zwarte rand toe.
3. Resultaat in `assets/land/<archetype>/pl-<naam>.png`.

Maten: eenheden 64 px, reuzen 128 px, machines 96 px (ruwe PixelLab-maat; het spel schaalt naar tegels).
