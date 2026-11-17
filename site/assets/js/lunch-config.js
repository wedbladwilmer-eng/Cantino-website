/* Fast information om lunchen. Ändra här, inte i Google-formuläret.
   Ändringar i den här filen kräver inget bygge: publicera bara mappen site/. */
window.CANTINO_LUNCH_CONFIG = {
  // Publicerat Google-kalkylark (svaren från lunchformuläret) som CSV.
  csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_6Nn57kCMdA-so8nGnJ89J8zJAmGFCm5VNJxQ6pqdJHuviOPtZXb0CzmUNyyArjoLeWPBTXW5-yA-/pub?gid=190938577&single=true&output=csv",

  // Visas i reservläget. Byt till adressen till Cantinos egen sida på kvartersmenyn.se.
  kvartersmenynUrl: "https://www.kvartersmenyn.se/",

  tider: { dagar: "Måndag–fredag", fran: "11:00", till: "15:00" },

  // Formulärets Pris-fält skriver över det här om det är ifyllt.
  pris: "145 kr",
  avhamtning: "135 kr",
  pensionar: "135 kr",
  ingar: ["smör", "bröd", "kaffe", "te", "kaka", "bordsvatten", "måltidsdryck", "salladsbuffé"],

  // Så länge får hämtningen ta innan reservläget visas (millisekunder).
  timeoutMs: 5000
};
