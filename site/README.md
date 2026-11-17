# Cantino Restaurang – hemsida

Statisk sida. Allt innehåll som ändras ofta ligger i mappen `data/` som vanliga textfiler (JSON).
Publiceras på Netlify: https://cantino-restaurang.netlify.app

## Veckans lunch (Google-formuläret)
Lunchen fylls i i Google-formuläret, på mobilen eller datorn. Svaren hamnar i ett Google-kalkylark
som är publicerat som CSV, och sidan hämtar det varje gång någon besöker den.
**Inget behöver laddas upp till Netlify när veckans lunch ändras.**

Fyll i formuläret så här:
- **Vecka**: veckonumret, till exempel `47`.
- **Måndag–Fredag**: en rätt per rad (tryck Enter mellan rätterna). Lämna en dag tom om ni har stängt.
- **Pris**: lämna tomt för ordinarie pris, eller skriv t.ex. `150` eller `150:-` om priset ändras just den veckan.

Rättelser: skicka bara formuläret igen för samma vecka. Det senaste svaret vinner.
Lördag och söndag visas nästa veckas meny om den redan är inskickad, annars den här veckans.
Finns ingen meny för veckan, eller går kalkylarket inte att nå inom 5 sekunder, står det
"Veckans lunch publiceras på måndag." med en länk till kvartersmenyn.se. En gammal vecka visas aldrig.

Sidan rättar inte stavfel, men tar bort extra mellanslag och tomma rader och gör första bokstaven versal.
Rättens namn visas i fetstil när raden innehåller "serveras med", "toppas med", "toppad med" eller "med".

**Fast information** (öppettider, ordinarie pris, avhämtnings- och pensionärspris, vad som ingår,
länken till kalkylarket och till kvartersmenyn.se) står i `assets/js/lunch-config.js`.
Ändra där och publicera `site/` som vanligt. **Byt `kvartersmenynUrl` till adressen till Cantinos egen
sida på kvartersmenyn.se**: just nu går länken till kvartersmenyn.se:s startsida.

Koden finns i `assets/js/lunch.js`. Testerna körs med:
```
node --test tools/test_lunch.js        # tolkning av CSV, veckor, val av meny, text
node tools/test_lunch_e2e.js           # i webbläsaren: alla fall plus skärmdumpar i verify/lunch/
```

## Byta kvällsmenyn
`data/meny.json`. Varje rätt:
```json
{ "namn": "Grillad entrecôte", "beskrivning": "Bearnaisesås och pommes", "pris": "189 kr" }
```
- `"vegetarisk": true` skriver VEG efter namnet, `"husets": true` skriver HUSETS.
- `{ "rubrik": "Vin" }` skapar en underrubrik (används under Dryck).
- `"notis"` på en kategori visas som en kort kursiv rad under kategorinamnet.
- Startsidan visar de fyra första rätterna i Förrätter, Varmrätter & grill och Pizza.
  Hela menyn visas på sidan `/meny`.
- Sätt `"demo": false` när menyn är riktig, så försvinner raden "Exempelmeny".

## Öppettider
`data/oppettider.json` styr raden "Öppet nu / Lunch serveras nu" under öppettiderna.
Själva tiderna står som text på tre ställen som ändras för hand: avsnittet Öppettider i `src/index.html`,
sidfoten i `src/_delar/footer.html` och strukturerad data för Google (sök på `openingHoursSpecification` i `src/index.html`).
Kör sedan `python3 tools/build.py`.

## Omdömen
`data/omdomen.json`. Uppdatera Google-betyget (`"varde"`), antalet (`"antal"`) och månaden (`"per"`).
Sidan visar bara betyget, inga citat.

## Bilder
Alla foton ligger i en mapp: `foton/original/`. Filen heter efter var den används på sidan.
Skriptet `tools/foton.py` ger alla samma behandling (något varmare, något mörkare, lätt dämpade färger),
beskär och sparar webbversionerna i `site/assets/foto/`. Det gör också delningsbilden `og-cantino.jpg`.

| Fil i `foton/original/` | Används i | Ursprung | Status |
|---|---|---|---|
| `hero.webp` | Hero (överst), delningsbild | Biff med rött vin, levande ljus. Från beställaren, ursprung ej angivet | Kontrollera att ni har rätt att använda bilden |
| `lunch.webp` | Veckans lunch | AI-genererad (köttbullar), från beställaren. Används obehandlad, med restaurangmiljön i bakgrunden | **Ska ersättas**: eget foto av en lunchtallrik |

Används inte på sidan, med avsikt:
- AI-genererad fasad och AI-genererad matsal. En AI-bild av en verklig lokal är vilseledande.
  Ersätts med egna foton av fasaden och matsalen.

Byta ett foto:
1. Lägg det nya fotot i `foton/original/` med samma namn (t.ex. `lunch.jpg`). Liggande fungerar för hero, stående för lunch.
2. Kör `python3 tools/foton.py`.
3. Uppdatera `alt`-texten i `src/index.html` (sök på filnamnet, t.ex. `lunch-860`), kör `python3 tools/build.py` och publicera `site/`.

## Formuläret
Förfrågningsformuläret för sällskap och event ligger på sidan `/sallskap`. Skickas via Netlify Forms (`"formular": "netlify"` i `data/site.json`). Förfrågningar syns under
Netlify → sajten → Forms. Slå på e-postavisering där: Forms → Form notifications → Email.
Spam stoppas med ett dolt honeypot-fält. Ingen reCAPTCHA.
Alternativ: skriv en Formspree-adress i `"formular"`. Tomt värde = demoläge.

## Länkar
`data/site.json` → `lankar`: Foodora, Google och Instagram används i sidfoten och vid omdömet.
Facebook och Tripadvisor visas inte förrän de har riktiga adresser (lägg då till dem i `src/_delar/footer.html`).
Busslinjerna (60 och 62) står under Hitta hit i `src/index.html`.

## Bygga och publicera
Källfilerna ligger i `src/`: sidorna `index.html`, `meny.html` och `sallskap.html`, och de gemensamma
delarna i `src/_delar/` (stilmall, header, sidfot och skript). Kör `python3 tools/build.py` för att bygga
`site/` (sätter ihop delarna, lägger in typsnitt och karta och skapar 404- och tacksidan).
Dra sedan `site/` till Netlify. Ändringar i `data/` kräver inget bygge.

## Före lansering som riktig sajt
- Ta bort raden `X-Robots-Tag: noindex` i `_headers` (den hindrar Google från att indexera demot).
- Byt `SITE_URL` i `tools/build.py` till den riktiga domänen och bygg om.
- Sätt `"demo": false` i `data/meny.json` och byt de tillfälliga bilderna.
