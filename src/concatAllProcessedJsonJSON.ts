import * as fs from 'fs';
import * as path from 'path';
import { concatOneFolder } from './concatProcessedJobJSON'; // oder der Name, unter dem diese Funktion bei dir liegt

const ROOT_DIR = path.join(__dirname, './scrapedData');

async function main(): Promise<void> {
  if (!fs.existsSync(ROOT_DIR)) {
    console.error('Ordner existiert nicht:', ROOT_DIR);
    process.exit(1);
  }

  const entries = fs.readdirSync(ROOT_DIR, { withFileTypes: true });

  const folders = entries
    .filter(e => e.isDirectory())
    .map(e => path.join(ROOT_DIR, e.name));

  if (folders.length === 0) {
    console.log('Keine Unterordner gefunden.');
    return;
  }

  console.log(`Gefundene Ordner: ${folders.length}`);

  for (const dir of folders) {
    console.log('\n== Verarbeite:', dir);
    concatOneFolder(dir);
  }

  console.log('\nAlle Ordner verarbeitet.');
}

main().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
