// ProcessedDataAggregator.ts
import * as fs from 'fs';
import * as path from 'path';

export class DataAggregator {
  private readonly rootDir: string;

  /**
   * @param rootDir Root-Ordner, der alle Arbeitgeber-Folder enthält.
   *                Default: <projekt-root>/scrapedData
   */
  constructor(rootDir?: string) {
    this.rootDir = rootDir ?? path.join(process.cwd(), 'scrapedData');
  }

  /**
   * Fügt jedem Objekt im Ergebnis das Feld "employer" hinzu,
   * basierend auf dem Ordnernamen.
   */
  private addEmployerField(entries: unknown[], employerName: string): unknown[] {
    return entries.map(item => {
      if (typeof item !== 'object' || item === null) return item;

      return {
        ...(item as Record<string, unknown>),
        employer: employerName,
      };
    });
  }

  /**
   * Sammelt rekursiv alle *.processed.json Dateien in einem Ordner.
   */
  private collectProcessedFiles(dir: string, result: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.collectProcessedFiles(fullPath, result);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.processed.json')) {
          result.push(fullPath);
        }
      }
    }

    return result;
  }

  /**
   * Sammelt rekursiv alle *.data.processed.all.json Dateien unter rootDir.
   */
  private collectAllDataFiles(dir: string, result: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.collectAllDataFiles(fullPath, result);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.data.processed.all.json')) {
          result.push(fullPath);
        }
      }
    }

    return result;
  }

  /**
   * Verarbeitet genau EINEN Arbeitgeber-Ordner:
   * - sammelt alle *.processed.json
   * - merged sie
   * - ergänzt "employer"
   * - schreibt <employer>.data.processed.all.json in diesen Ordner
   */
  public concatOneEmployerFolder(baseDir: string): void {
    if (!fs.existsSync(baseDir)) {
      console.error('Ordner existiert nicht:', baseDir);
      return;
    }

    const allFiles = this.collectProcessedFiles(baseDir);

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
      const enrichedResults = this.addEmployerField(allResults, folderName);
      fs.writeFileSync(outputFile, JSON.stringify(enrichedResults, null, 2), 'utf8');
    } catch (err: unknown) {
      console.error('Fehler beim Schreiben:', outputFile);
      console.error(err instanceof Error ? err.message : err);
      return;
    }

    console.log('Erstellt:', outputFile);
  }

  /**
   * Läuft über alle direkten Unterordner von rootDir
   * und ruft jeweils concatOneEmployerFolder auf.
   */
  public concatAllEmployers(): void {
    if (!fs.existsSync(this.rootDir)) {
      console.error('Ordner existiert nicht:', this.rootDir);
      return;
    }

    const entries = fs.readdirSync(this.rootDir, { withFileTypes: true });

    const folders = entries
      .filter(e => e.isDirectory())
      .map(e => path.join(this.rootDir, e.name));

    if (folders.length === 0) {
      console.log('Keine Unterordner gefunden.');
      return;
    }

    console.log(`Gefundene Arbeitgeber-Ordner: ${folders.length}`);

    for (const dir of folders) {
      console.log('\n== Verarbeite:', dir);
      this.concatOneEmployerFolder(dir);
    }

    console.log('\nAlle Arbeitgeber-Ordner verarbeitet.');
  }

  /**
   * Nimmt alle <employer>.data.processed.all.json Dateien unter rootDir
   * und schreibt eine große Gesamtdatei:
   *   <rootDir>/scrapedData.data.processed.ALL.json
   */
  public concatGlobal(): void {
    if (!fs.existsSync(this.rootDir)) {
      console.error('Root-Ordner existiert nicht:', this.rootDir);
      return;
    }

    const allFiles = this.collectAllDataFiles(this.rootDir);

    if (allFiles.length === 0) {
      console.log('Keine *.data.processed.all.json Dateien gefunden.');
      return;
    }

    console.log(`Gefundene Arbeitgeber-Gesamtdateien: ${allFiles.length}`);

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

    const outputFile = path.join(this.rootDir, 'scrapedData.data.processed.ALL.json');

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
}
