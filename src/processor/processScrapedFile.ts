import * as fs from 'fs';
import { jsonrepair } from 'jsonrepair';
import { callLLM } from '../service/callLLM';

const PROMPT = `Strukturiere mir den Dateiinhalt! Uns interessieren ausschließlich Stellenangebote! Wenn ganz klar ist, dass die Deadline in der vergangenheit liegt: Den Eintrag überspringen! Wenn du zu einem Punkt nichts findest, schreibe N/A. Gib nur gültiges JSON zurück. Keine Kommentare, keine Höflichkeiten, nur das JSON-Objekt!
[
  {
    "description" : "Stellenbezeichnung",
    "organisation" : "Organisation",
    "sallery" : "Bezahlung/Tarif",
    "deadline" : "Bewerbungsfrist",
    "further" : "Weitere Infos wenn vorhanden"
  }
]`;

export async function processScrapedFile(filePath: string): Promise<void> {
  let fileContent: string;

  try {
    fileContent = fs.readFileSync(filePath, 'utf8');
  } catch (err: unknown) {
    console.error(`Fehler beim Lesen der Datei ${filePath}:`, err instanceof Error ? err.message : err);
    return;
  }

  const fullPrompt = `${PROMPT}\n\n---\n\nDateiinhalt:\n${fileContent}`;

  let rawContent: string;
  try {
    rawContent = await callLLM(fullPrompt, "gpt-4.1-mini");
  } catch (err: unknown) {
    console.error(`Fehler beim LLM-Call für ${filePath}:`, err instanceof Error ? err.message : err);
    return;
  }

  const outPath = `${filePath}.processed.json`;

  let parsedJson: unknown;
  try {
    const repaired = jsonrepair(rawContent);
    parsedJson = JSON.parse(repaired);
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
