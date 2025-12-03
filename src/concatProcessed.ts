import * as fs from 'fs';
import * as path from 'path';

// Basisordner mit deinen processed.json-Dateien
const BASE_DIR = path.join(__dirname, './scrapedData/Uni-Hamburg');

/**
 * Sammelt rekursiv alle *.processed.json Dateien
 */
function collectProcessedFiles(dir: string, result: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectProcessedFiles(fullPath, result);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.processed.json')) {
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

  const allFiles = collectProcessedFiles(BASE_DIR);

  if (allFiles.length === 0) {
    console.log('Keine *.processed.json Dateien gefunden.');
    return;
  }

  console.log(`Gefundene Dateien: ${allFiles.length}`);

  const allResults: unknown[] = [];

  for (const filePath of allFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed: unknown = JSON.parse(content);

      if (Array.isArray(parsed)) {
        allResults.push(...parsed);
      } else {
        allResults.push(parsed);
      }
    } catch (err: unknown) {
      console.error('Fehler beim Verarbeiten:', filePath);
      console.error(err instanceof Error ? err.message : err);
    }
  }

  const folderName = path.basename(BASE_DIR);
  const outputFile = path.join(BASE_DIR, `${folderName}.data.processed.all.json`);

  try {
    fs.writeFileSync(outputFile, JSON.stringify(allResults, null, 2), 'utf8');
  } catch (err: unknown) {
    console.error('Fehler beim Schreiben der Output-Datei:', err instanceof Error ? err.message : err);
    return;
  }

  console.log('\nFertig.');
  console.log('Gesamtausgabe:', outputFile);
}

main().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
