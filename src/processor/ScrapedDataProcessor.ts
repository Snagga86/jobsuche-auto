// ScrapedDataProcessor.ts
import * as fs from 'fs';
import * as path from 'path';
import { processScrapedFile } from './processScrapedFile';

export class ScrapedDataProcessor {
  private readonly baseDir: string;

  /**
   * @param baseDir Basis-Ordner mit den gescrapten HTML-Dateien.
   *                Default: <project-root>/scrapedData
   */
  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? path.join(process.cwd(), 'scrapedData');
  }

  /**
   * Öffentliche Methode: verarbeitet alle relevanten HTML-Dateien
   * unterhalb von this.baseDir.
   */
  public async processAll(): Promise<void> {
    if (!fs.existsSync(this.baseDir)) {
      console.error('Basis-Ordner existiert nicht:', this.baseDir);
      return;
    }

    const files = this.collectHtmlFiles(this.baseDir);

    if (files.length === 0) {
      console.log('Keine HTML-Dateien zum Verarbeiten gefunden.');
      return;
    }

    console.log(`Gefundene Dateien: ${files.length}`);

    for (const filePath of files) {
      console.log(`\n>> Verarbeite Datei: ${filePath}`);
      await processScrapedFile(filePath);
      // optionales Rate-Limit:
      // await new Promise(r => setTimeout(r, 500));
    }

    console.log('\nFertig.');
  }

  /**
   * Rekursiv alle .html-Dateien sammeln, für die noch keine
   * .processed.json existiert.
   */
  private collectHtmlFiles(dir: string, result: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.collectHtmlFiles(fullPath, result);
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
}
