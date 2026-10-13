# Vendo MVP

Vendo helpt studenten en personeel van KdG om vóór ze vertrekken te zien welke automaat in de buurt werkt en hun product heeft. De vulploeg van de externe firma ziet meteen wat leeg of kapot is.

Team Error 707 · Project "Vending machines dashboard"

| Deel | Voor wie | Map |
|---|---|---|
| **App** (PWA, installeerbaar op je gsm) | studenten & personeel | `app/` |
| **Website / dashboard** | vulploeg van de firma | `dashboard/` |
| Gedeelde data + UI-onderdelen | beide | `shared/` |

## Starten

Je hebt geen build nodig om het te bekijken. Je hebt wel een lokale webserver nodig (de service worker van de PWA werkt niet via `file://`):

```bash
# optie 1 (Node)
npx serve .
# optie 2 (Python)
python -m http.server 8080
```

Open daarna `http://localhost:8080` (of de poort die `serve` toont).

**Demo-accounts** (wachtwoord overal `demo`):

| Rol | E-mail | Waar |
|---|---|---|
| Student | `lotte.peeters@student.kdg.be` | app |
| Personeel | `tom.janssens@kdg.be` | app |
| Vulploeg | `sam@vulploeg.be` | dashboard |

**Student of personeel?** In deze MVP is er functioneel geen verschil: de rol volgt uit het e-mailadres (`@student.kdg.be` of `@kdg.be`) en wordt enkel getoond in het profiel en bij meldingen in het dashboard.

Je kan in de app ook inloggen met elk nieuw `@student.kdg.be`- of `@kdg.be`-adres (wachtwoord van minstens 4 tekens). Dan wordt er automatisch een account aangemaakt.

**Tip voor de demo:** zet app en dashboard naast elkaar in hetzelfde browservenster. Wat je in de ene tab doet, verschijnt meteen in de andere.

### Op je gsm testen
Zet de map online, bijvoorbeeld met GitHub Pages (Settings → Pages → branch `main`, map `/`). Open de `/app/`-link op je gsm. Op Android kies je in het browsermenu **App installeren**, op een iPhone in Safari **Deel → Zet op beginscherm**.

## Functies (uit Problem Statement + Conceptual Solution)

**Campus:** voorlopig enkel **Campus Groenplaats** (Nationalestraat). De kaart gebruikt het echte grondplan uit *GRP_grondplan.pdf*: gelijkvloers, mezzanine en verdiep 1 tot 5. De datastructuur ondersteunt meerdere campussen, dus andere campussen kunnen later in dezelfde vorm worden toegevoegd (zie `campuses` in `shared/store.js`).

**App (studenten & personeel)**
- **Favorieten:** markeer producten met ☆. Ze staan bovenaan bij Ontdek, samen met hoeveel er nog beschikbaar zijn op de campus.
- Zoeken op product, categorie of label (bv. "red bull", "chips", "vegan"). Je ziet direct welke automaten het **op voorraad** hebben, de dichtstbijzijnde eerst.
- Filters: drank, snacks of koffie, suikervrij, vegan, glutenvrij, en "enkel werkend".
- **Dichtstbij:** je stelt je eigen locatie in (verdiep + plek op de kaart). De app schat dan de loopafstand ("1 verdiep hoger · ~40 m · 1 min").
- **Kaart** per verdiep met pins in een statuskleur: werkt, bijna leeg, storing gemeld of defect.
- Elke automaat toont welke producten erin zitten met de **voorraad per product** ernaast. Vulgraad-percentages zie je enkel in het dashboard van de vulploeg.
- Detail van een automaat: inhoud, prijzen, voorraad per vak en wanneer hij laatst bijgevuld werd.
- **Reserveren / online bestellen:** het product wordt **8 uur** opzijgelegd en je krijgt een ophaalcode met afteltimer. Kies "betalen aan de automaat" of "nu online betalen" (demo). Ophalen simuleer je door de code in te tikken, daarna gaat de voorraad met 1 omlaag. Je kan maximaal 2 actieve reservaties tegelijk hebben.
- **Annulatiekost € 0,50:** annuleer je zelf of haal je niet op binnen 8 uur, dan betaal je € 0,50, want het product lag opzij. Was het al online betaald, dan krijg je de rest terug. Annuleert de vulploeg (bv. automaat defect), dan betaal je niets.
- **Storing melden** met type probleem en een toelichting.
- **Product voorstellen** en **stemmen** op ideeën. Bestaat een idee al, dan wordt je stem erbij geteld.
- **Meldingen** (belletje) wanneer je melding opgelost is, je reservatie verloopt of je idee gepland is.
- Licht/donker thema, installeerbaar als app en de interface blijft ook offline beschikbaar.

**Dashboard (vulploeg)**
- Overzicht met kerncijfers, een lijst "actie nodig" (eerst defect, dan gemeld, dan bijna leeg), vulgraad per automaat en recente activiteit.
- Automaten: filteren en zoeken. Per automaat kan je de status zetten (werkt of defect), de voorraad per vak aanpassen (+/−), een vak of alles bijvullen, het product in een vak wisselen en vakken toevoegen.
- **Bijvullijst:** de automaten die dringend bijgevuld moeten worden, plus een laadlijst voor de bestelwagen (totaal per product). Je kan die lijst afdrukken.
- Meldingen afhandelen (open → in behandeling → opgelost). De melder krijgt automatisch bericht.
- Reservaties opvolgen of annuleren.
- Productideeën gesorteerd op stemmen. Pas je de status aan, dan krijgen de stemmers een bericht. Met "Als product" maak je er meteen een product van.
- Productcatalogus: prijzen aanpassen en nieuwe producten toevoegen.
- Kaart per campus en verdiep.
- Demo-tools: verkopen simuleren en de demodata resetten.

## Hoe het werkt (zonder backend)

Alle data zit in `shared/store.js`. Die module:
- maakt bij de eerste start de demodata aan (Campus Groenplaats, 10 automaten, 21 producten, meldingen, ideeën);
- bewaart alles in `localStorage`. App en dashboard komen van dezelfde website en delen die opslag dus;
- synchroniseert live tussen tabbladen (`storage`-event + `BroadcastChannel`);
- bevat alle **acties** (`reserve`, `reportIssue`, `refillMachine`, …) en **afgeleide gegevens** (status, vulgraad, afstand).

Beperkingen die bij deze keuze horen:
- De data staat per browser. Een ander toestel ziet andere data.
- De login is niet beveiligd: wachtwoorden staan in platte tekst in de demodata.
- Betalen en "code intikken aan de automaat" zijn gesimuleerd.
- De voorraad komt niet uit de echte automaten. Volgens de problem statement heeft de firma al een systeem dat lege vakken detecteert, en dat is de bron die je later koppelt.

## Naar een echte backend (volgende stap)

De UI roept enkel functies op uit `Vendo.actions` en `Vendo.get`. Om een server te gebruiken vervang je de binnenkant van die functies door API-calls. De UI zelf hoeft niet te veranderen.

| Actie in store.js | Voorstel endpoint |
|---|---|
| `auth.login` | `POST /api/auth/login` (KdG SSO) |
| `get.machinesOfCampus` | `GET /api/campuses/{id}/machines` |
| `reserve` / `cancelReservation` / `pickupReservation` | `POST /api/reservations`, `DELETE /api/reservations/{id}`, `POST /api/reservations/{id}/pickup` |
| `reportIssue` / `setReportStatus` | `POST /api/reports`, `PATCH /api/reports/{id}` |
| `addSuggestion` / `toggleVote` / `setSuggestionStatus` | `POST /api/suggestions`, `POST /api/suggestions/{id}/vote`, `PATCH …` |
| `setSlotQty` / `refillSlot` / `refillMachine` / `setMachineStatus` | `PATCH /api/machines/{id}/slots/{code}`, `POST /api/machines/{id}/refill`, `PATCH /api/machines/{id}` |
| live sync | WebSocket / Server-Sent Events in plaats van `BroadcastChannel` |

## Stijl aanpassen

De stijl is Tailwind CSS en is al gebouwd in `shared/vendo.css`. Voeg je nieuwe Tailwind-klassen toe in de HTML/JS, bouw de CSS dan opnieuw:

```bash
npm install
npm run build:css     # of: npm run watch:css tijdens het ontwikkelen
```

Kleuren en thema (licht/donker) staan in `shared/input.css` en `tailwind.config.js`. Het palet is hetzelfde als in het prototype.

## Structuur

```
index.html              startpagina (kies app of dashboard)
app/
  index.html, app.js    studenten-app
  manifest.webmanifest  PWA-manifest
  sw.js                 service worker (offline)
  icons/                app-iconen
dashboard/
  index.html, dashboard.js
shared/
  store.js              data, opslag, sync, acties  ← het "hart"
  ui.js                 badges, toasts, thema, plattegrond
  input.css → vendo.css Tailwind-bron en gebouwde CSS
  assets/               lettertype, iconen en grondplannen (plan/grp-*.png)
```
