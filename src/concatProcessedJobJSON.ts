import * as fs from 'fs';
import * as path from 'path';

/**
 * Fügt jedem Objekt im Ergebnis das Feld "employer" hinzu,
 * basierend auf dem Ordnernamen
 */
function addEmployerField(entries: unknown[], employerName: string): unknown[] {
  return entries.map(item => {
    if (typeof item !== 'object' || item === null) return item;

    return {
      ...(item as Record<string, unknown>),
      employer: employerName
    };
  });
}

/**
 * Sammelt rekursiv alle *.processed.json Dateien in einem Ordner
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

/**
 * Verarbeitet genau EINEN Ordner
 */
export function concatOneFolder(baseDir: string): void {
  if (!fs.existsSync(baseDir)) {
    console.error('Ordner existiert nicht:', baseDir);
    return;
  }

  const allFiles = collectProcessedFiles(baseDir);

  if (allFiles.length === 0) {
    console.log('Keine processed.json Dateien in:', baseDir);
    return;
  }

  console.log(`Gefunden in ${baseDir}: ${allFiles.length} Dateien`);

  const allResults: unknown[] = [];

  for (const filePath of allFiles) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (Array.isArray(parsed)) {
        allResults.push(...parsed);
      } else {
        allResults.push(parsed);
      }
    } catch (err: unknown) {
      console.error('Fehlerhafte Datei übersprungen:', filePath);
      console.error(err instanceof Error ? err.message : err);
    }
  }

  const folderName = path.basename(baseDir);
  const outputFile = path.join(baseDir, `${folderName}.data.processed.all.json`);

  try {
    const enrichedResults = addEmployerField(allResults, folderName);

    fs.writeFileSync(outputFile, JSON.stringify(enrichedResults, null, 2), 'utf8');
  } catch (err: unknown) {
    console.error('Fehler beim Schreiben:', outputFile);
    console.error(err instanceof Error ? err.message : err);
    return;
  }

  console.log('Erstellt:', outputFile);
}
