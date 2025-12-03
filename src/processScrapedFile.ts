import * as fs from 'fs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4.1-mini' as const;

const PROMPT = `Strukturiere mir den Dateiinhalt! Uns interessieren ausschließlich Stellenangebote! Wenn du zu einem Punkt nichts findest, schreibe N/A. Gib nur gültiges JSON zurück. Keine Kommentare, keine Höflichkeiten, nur das JSON-Objekt!
[
  {
    "description" : "Stellenbezeichnung",
    "organisation" : "Organisation",
    "sallery" : "Bezahlung/Tarif",
    "deadline" : "Bewerbungsfrist",
    "further" : "Weitere Infos wenn vorhanden"
  }
]`;

interface ChatCompletionMessage {
  content?: string | null;
}

interface ChatCompletionChoice {
  message?: ChatCompletionMessage;
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

/**
 * Verarbeitet genau eine Datei:
 * - liest Inhalt
 * - schickt an ChatGPT
 * - schreibt <filePath>.processed.json
 */
export async function processSingleFile(filePath: string): Promise<void> {
  if (!OPENAI_API_KEY) {
    console.error('Fehler: OPENAI_API_KEY ist nicht gesetzt.');
    return;
  }

  let fileContent: string;
  try {
    fileContent = fs.readFileSync(filePath, 'utf8');
  } catch (err: unknown) {
    console.error(`Fehler beim Lesen der Datei ${filePath}:`, err instanceof Error ? err.message : err);
    return;
  }

  const body = {
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Du bist ein nüchternes, sachliches Analysemodell.'
      },
      {
        role: 'user',
        content: `${PROMPT}\n\n---\n\nDateiinhalt:\n${fileContent}`
      }
    ]
  };

  let apiJson: ChatCompletionResponse;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error(`API-Fehler für ${filePath}:`, res.status, res.statusText);
      console.error('Antwort:', txt);
      return;
    }

    apiJson = (await res.json()) as ChatCompletionResponse;
  } catch (err: unknown) {
    console.error(`Fehler beim API-Call für ${filePath}:`, err instanceof Error ? err.message : err);
    return;
  }

  const rawContent = apiJson?.choices?.[0]?.message?.content ?? '';
  const outPath = `${filePath}.processed.json`;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch {
    console.error(`Antwort ist kein valides JSON für ${filePath}:`);
    console.error(rawContent);
    return;
  }

  try {
    fs.writeFileSync(outPath, JSON.stringify(parsedJson, null, 2), 'utf8');
  } catch (err: unknown) {
    console.error(`Fehler beim Schreiben der Output-Datei für ${filePath}:`, err instanceof Error ? err.message : err);
    return;
  }

  console.log('Gespeichert:', outPath);
}
