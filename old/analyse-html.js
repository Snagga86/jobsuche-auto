// process-file.js
// Voraussetzung: Node 18+ (wegen globalem fetch) und OPENAI_API_KEY in der Umgebung

const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = ""
const file = "./scrapedData/HU-Berlin/page-1.html"

// HIER anpassen:
const INPUT_FILE = path.join(__dirname, file);
const PROMPT = `Strukturiere mir den Dateiinhalt! Uns interessieren ausschließlich Stellenangebote! Wenn du zu einem Punkt nichts findest, schreibe N/A. Gib nur gültiges JSON zurück. Keine Kommentare, keine Höflichkeiten.
{
    "description" : Stellenbezeichnung,
    "organisation" : Organisation,
    "sallery" : Bezahlung/Tarif,
    "deadline" : Bewerbungsfrist,
    "further" : Weitere Infos wenn vorhanden
}`;

// Modell ggf. anpassen
const MODEL = 'gpt-4.1-mini';

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('Fehler: OPENAI_API_KEY ist nicht gesetzt.');
    process.exit(1);
  }

  let fileContent;
  try {
    fileContent = fs.readFileSync(INPUT_FILE, 'utf8');
  } catch (err) {
    console.error('Fehler beim Lesen der Datei:', err.message);
    process.exit(1);
  }

  const body = {
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Du bist ein nüchternes, sachliches Analysemodell.',
      },
      {
        role: 'user',
        content: `${PROMPT}\n\n---\n\nDateiinhalt:\n${fileContent}`,
      },
    ],
  };

  let apiJson;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('API-Fehler:', res.status, res.statusText);
      console.error('Antwort:', txt);
      process.exit(1);
    }

    apiJson = await res.json();
  } catch (err) {
    console.error('Fehler beim API-Call:', err.message);
    process.exit(1);
  }

  const outPath = INPUT_FILE + '.processed.json';

  const rawContent = apiJson.choices[0].message.content;

    let parsedJson;

    try {
    parsedJson = JSON.parse(rawContent);
    } catch (err) {
    console.error("Antwort ist kein valides JSON!");
    console.error(rawContent);
    process.exit(1);
    }

    fs.writeFileSync(
    outPath,
    JSON.stringify(parsedJson, null, 2),
    "utf8"
    );


  console.log('Gespeichert:', outPath);
}

main().catch((err) => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
