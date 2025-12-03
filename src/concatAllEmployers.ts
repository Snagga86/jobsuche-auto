import * as fs from 'fs';
import * as path from 'path';

// Root-Ordner, der alle Uni-Folder enthält
const ROOT_DIR = path.join(__dirname, './scrapedData');

/**
 * Rekursiv alle *.data.processed.all.json Dateien finden
 */
function collectAllDataFiles(dir: string, result: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectAllDataFiles(fullPath, result);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.data.processed.all.json')) {
        result.push(fullPath);
      }
    }
  }

  return result;
}

async function main(): Promise<void> {
  if (!fs.existsSync(ROOT_DIR)) {
    console.error('Ordner existiert nicht:', ROOT_DIR);
    process.exit(1);
  }

  const allFiles = collectAllDataFiles(ROOT_DIR);

  if (allFiles.length === 0) {
    console.log('Keine *.data.processed.all.json Dateien gefunden.');
    return;
  }

  console.log(`Gefundene Dateien: ${allFiles.length}`);

  const allResults: unknown[] = [];

  for (const filePath of allFiles) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (Array.isArray(parsed)) {
        allResults.push(...parsed);
      } else {
        allResults.push(parsed);
      }

      console.log(' +', filePath);
    } catch (err: unknown) {
      console.error('Fehlerhafte Datei übersprungen:', filePath);
      console.error(err instanceof Error ? err.message : err);
    }
  }

  const outputFile = path.join(ROOT_DIR, 'scrapedData.data.processed.ALL.json');

  try {
    fs.writeFileSync(outputFile, JSON.stringify(allResults, null, 2), 'utf8');
  } catch (err: unknown) {
    console.error('Fehler beim Schreiben der Output-Datei:', err instanceof Error ? err.message : err);
    return;
  }

  console.log('\nGesamtdatei erstellt:');
  console.log(outputFile);
  console.log('Einträge insgesamt:', allResults.length);
}

main().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
