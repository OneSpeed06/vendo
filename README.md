# Vendo: handleiding voor het team

Vendo is de MVP van ons project *Vending machines dashboard* (Team Error 707, KdG). Het project bestaat uit twee delen:

- een **app** voor studenten en personeel: automaten zoeken op de kaart, voorraad bekijken, reserveren, storingen melden en producten voorstellen;
- een **dashboard** voor de vulploeg: voorraad, bijvullijst, meldingen, reservaties en productideeën.

Deze handleiding legt uit hoe je het project in **WebStorm** opent, hoe je het start en hoe we samenwerken. De technische uitleg (architectuur, functies, naar een echte backend) staat in [`vendo/README.md`](vendo/README.md).

---

## 1. Wat heb je nodig?

| Tool | Nodig? | Waarvoor |
|---|---|---|
| **WebStorm** | ja | de IDE. Gratis voor niet-commercieel gebruik, of via je JetBrains-studentenlicentie (aanvragen met je KdG-mail op jetbrains.com/student). IntelliJ IDEA Ultimate werkt op dezelfde manier. |
| **Git** | ja | om de repo te clonen en wijzigingen te pushen. WebStorm vraagt om het te installeren als het ontbreekt. |
| **Node.js (LTS)** | enkel als je de opmaak (CSS) aanpast | om de Tailwind-CSS opnieuw te bouwen. Downloaden via nodejs.org. |

Een build is niet nodig om het project te bekijken. Het is gewone HTML, CSS en JavaScript.

## 2. Project openen in WebStorm

1. Open WebStorm. Kies in het startscherm **Clone Repository** (in oudere versies heet dat *Get from VCS*).
2. Plak de URL: `https://github.com/OneSpeed06/vendo.git`
3. Kies waar je het wil bewaren en klik op **Clone**. Vertrouw het project als WebStorm daarom vraagt (**Trust Project**).
4. Het project opent op de **hoofdmap van de repo**. Laat het zo: dan werkt de Git-integratie meteen (commit, pull, push via het menu **Git**).

De code zelf zit in de submap `vendo/`:

```
vendo-mvp/                (de repo)
├── README.md             ← dit bestand
└── vendo/
    ├── index.html        startpagina (kies app of dashboard)
    ├── app/              studenten-app (PWA)
    ├── dashboard/        dashboard vulploeg
    ├── shared/           gedeelde data (store.js), UI (ui.js), CSS, grondplannen
    ├── package.json      npm-scripts
    └── README.md         technische documentatie
```

Heb je de repo al gecloned via de terminal? Kies dan in WebStorm **File → Open** en selecteer de map `vendo-mvp`.

## 3. Het project starten

### Manier A: de ingebouwde server van WebStorm (makkelijkst)

1. Open `vendo/index.html` in de editor.
2. Rechtsboven in de editor verschijnen browsericonen. Klik op Chrome, Firefox of Edge. Je kan ook rechts klikken op het bestand en **Open In → Browser** kiezen.
3. WebStorm opent iets als `http://localhost:63342/vendo-mvp/vendo/index.html`.
4. Kies **App** of **Dashboard**.

Wijzigingen zie je na het opslaan (Ctrl+S) en het verversen van de pagina (F5).

### Manier B: via npm (lijkt meer op een echte website)

1. Open `vendo/package.json`.
2. Klik op het groene ▶-icoon naast `"start"`. Je kan ook het **npm**-venster openen (*View → Tool Windows → npm*) en dubbelklikken op `start`.
3. Open `http://localhost:8080` in je browser.

> ⚠️ **Gebruik in één demo altijd dezelfde manier.** De data staat in de opslag van je browser, en die hoort bij één adres. Wat je via `localhost:63342` doet, zie je niet via `localhost:8080`, en omgekeerd.

### Demo-accounts

Het wachtwoord is overal `demo`.

| Rol | E-mail | Waar |
|---|---|---|
| Student | `lotte.peeters@student.kdg.be` | app |
| Personeel | `tom.janssens@kdg.be` | app |
| Vulploeg | `sam@vulploeg.be` | dashboard |

Je kan ook gewoon op de knoppen **Demo student**, **Demo personeel** of **Demo-account vulploeg** klikken.

## 4. Het project gebruiken: korte rondleiding

Zet de app en het dashboard naast elkaar in **hetzelfde browservenster**, met twee tabbladen of twee vensters naast elkaar. Alles wat je in het ene doet, verschijnt meteen in het andere.

Tip: maak de app smal met de gsm-weergave van de browser (F12 en dan Ctrl+Shift+M).

**In de app (als student):**
1. Bovenaan staan je **favorieten**, met hoeveel er nog beschikbaar zijn. Voeg er een toe met ☆ in de inhoud van een automaat.
2. Zoek bijvoorbeeld "red bull". Je ziet welke automaten het op voorraad hebben, de dichtstbijzijnde eerst.
3. Klik bij een automaat op **Op kaart**, of kies bovenaan **Kaart** en wissel tussen gelijkvloers, mezzanine en verdiep 1 tot 5. Tik op een lege plek om je eigen locatie te zetten. Met de schakelaar **Enkel werkende** verberg of toon je defecte automaten.
4. Open een automaat en **reserveer** een product. Het blijft 8 uur opzij en je krijgt een ophaalcode.
5. Bij **Reservaties** kan je het product **ophalen** (de code intikken gebeurt gesimuleerd) of **annuleren** (gratis in de eerste 15 minuten, daarna € 0,50).
6. **Meld een storing** of **stel een product voor** bij Ideeën.

**In het dashboard (als vulploeg):**
1. Bij **Overzicht** zie je wat aandacht nodig heeft.
2. Bij **Meldingen** zet je een melding op *In behandeling* en daarna op *Opgelost*. De student krijgt daarover een bericht in de app (het belletje).
3. Bij **Automaten** klik je op **Beheer** om voorraad aan te passen, bij te vullen of een automaat op *Defect* te zetten. Kijk daarna in de app: de automaat is meteen aangepast.
4. Bij **Kaart** kies je **Verplaatsen** om een automaat naar zijn juiste plek te slepen, of **Automaat toevoegen** om er een bij te plaatsen.
5. **Bijvullijst** toont wat er in de bestelwagen moet.
6. Linksonder staan demo-tools: **Simuleer 5 verkopen** en **Demo-data resetten**.

## 5. Waar pas ik wat aan?

| Ik wil… | Bestand |
|---|---|
| automaten toevoegen of verplaatsen op de kaart | in het dashboard: **Kaart → Verplaatsen / Automaat toevoegen**. Voor de demodata zelf: `vendo/shared/store.js` → `const machines` (`x` en `y` in % van het grondplan) |
| producten of prijzen aanpassen | `vendo/shared/store.js` → `const products` (of via het dashboard) |
| regels aanpassen (8 uur, € 0,50, 15 min gratis annuleren, max. 2 reservaties…) | `vendo/shared/store.js` → `CONFIG` bovenaan |
| demo-gebruikers, meldingen of ideeën aanpassen | `vendo/shared/store.js` → `users`, `reports`, `suggestions` |
| schermen van de app | `vendo/app/app.js` |
| schermen van het dashboard | `vendo/dashboard/dashboard.js` |
| kaart, badges, toasts, thema | `vendo/shared/ui.js` |
| kleuren / licht- en donker-thema | `vendo/shared/input.css` + `vendo/tailwind.config.js` |

**Belangrijk na een wijziging in de demodata (`store.js`):** je browser onthoudt de oude data. Klik op **Demo-data resetten** in het dashboard of in het profiel van de app. Je kan ook `DATA_VERSION` bovenaan `store.js` met 1 verhogen. Dan krijgt iedereen automatisch de nieuwe data.

## 6. Opmaak aanpassen (Tailwind CSS)

De opmaak gebruikt Tailwind-klassen in de HTML en JS (bv. `rounded-xl bg-brand-500`). De gebouwde CSS staat in `vendo/shared/vendo.css`. **Pas dat bestand niet met de hand aan.**

Gebruik je een klasse die nog nergens in het project voorkomt, dan moet je de CSS opnieuw bouwen:

1. Open in WebStorm de **Terminal** (Alt+F12) en ga naar de projectmap:
   ```bash
   cd vendo
   npm install          # alleen de eerste keer
   ```
2. Start het script `watch:css` via het **npm**-venster, of in de terminal:
   ```bash
   npm run watch:css
   ```
   Laat dat lopen terwijl je werkt: bij elke wijziging wordt `vendo.css` automatisch opnieuw gebouwd.
3. Commit `vendo.css` mee, zodat teamgenoten zonder Node het ook correct zien.

Extra: met `npm install` gedaan geeft WebStorm automatisch aanvullingen voor de Tailwind-klassen.

## 7. Samenwerken met Git

- **Altijd eerst pullen** voor je begint: *Git → Pull* (of Ctrl+T, *Update Project*).
- Werk aan iets groters op een **eigen branch**: rechtsonder op `main` klikken en dan **New Branch**, bv. `feature/favorieten-sorteren`. Maak daarna een pull request op GitHub.
- **Commit** met Ctrl+K. Schrijf een duidelijke boodschap, bv. *"Automaat KG.21 verplaatst naar gang 2e verdiep"*. Daarna **Push** met Ctrl+Shift+K.
- `node_modules/` en `.idea/` (WebStorm-instellingen) staan in `.gitignore` en komen dus niet in de repo.
- **Conflict in `vendo.css`?** Kies een van beide versies en voer daarna `npm run build:css` uit. Het resultaat is dan weer correct.
- **Conflict in `store.js`?** Los het op met de merge-tool van WebStorm. Die opent vanzelf bij een conflict.

## 8. Problemen?

| Probleem | Oplossing |
|---|---|
| Ik zie oude data of mijn wijziging in `store.js` verschijnt niet | Klik op **Demo-data resetten**, of verhoog `DATA_VERSION`. |
| De app toont een oude versie van de code | Herlaad met **Ctrl+Shift+R**. Helpt dat niet: F12 → *Application* → *Service workers* → **Unregister**, en dan herladen. |
| Grondplannen of iconen laden niet | Open je de HTML rechtstreeks als bestand (`file://…`)? Gebruik manier A of B uit stap 3. |
| Wat ik in de app doe, verschijnt niet in het dashboard | Beide moeten via exact hetzelfde adres (en dezelfde poort) geopend zijn, in dezelfde browser. |
| Opmaak ziet er kapot uit na mijn wijziging | Bouw de CSS opnieuw (stap 6). |
| `npm` wordt niet herkend | Installeer Node.js LTS en herstart WebStorm. |

Vragen? Stel ze in de teamchat.
