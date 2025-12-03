import * as fs from 'fs';
import * as path from 'path';
import { processSingleFile } from './processScrapedFile';

// Basis-Ordner mit deinen gescrapten Dateien
const BASE_DIR = path.join(__dirname, './scrapedData');

/**
 * Sucht rekursiv alle .html-Dateien in einem Ordner (inkl. Unterordner).
 * Überspringt Dateien, für die bereits eine .processed.json existiert.
 */
function collectHtmlFiles(dir: string, result: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectHtmlFiles(fullPath, result);
    } else if (entry.isFile()) {
      if (
        fullPath.endsWith('.html') &&
        !fullPath.endsWith('.processed.html') &&
        !fs.existsSync(`${fullPath}.processed.json`)
      ) {
        result.push(fullPath);
      }
    }
  }

  return result;
}

async function main(): Promise<void> {
  if (!fs.existsSync(BASE_DIR)) {
    console.error('Basis-Ordner existiert nicht:', BASE_DIR);
    process.exit(1);
  }

  const files = collectHtmlFiles(BASE_DIR);

  if (files.length === 0) {
    console.log('Keine HTML-Dateien zum Verarbeiten gefunden.');
    return;
  }

  console.log(`Gefundene Dateien: ${files.length}`);

  for (const filePath of files) {
    console.log(`\n>> Verarbeite Datei: ${filePath}`);
    await processSingleFile(filePath);
    // optional Rate-Limit:
    // await new Promise(r => setTimeout(r, 500));
  }

  console.log('\nFertig.');
}

main().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
