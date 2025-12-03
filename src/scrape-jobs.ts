import * as fs from 'fs';
import * as path from 'path';
import { chromium, Page, ElementHandle } from 'playwright';
import { cleanJobHtml } from './cleanJobHtml';
import * as crypto from 'crypto';

type CrawlSite = [string, string];

const CRAWL_SITES: CrawlSite[] = [
  ['Uni-Goettingen', 'https://www.uni-goettingen.de/de/644546.html'],
  ['LMU', 'https://www.lmu.de/de/die-lmu/arbeiten-an-der-lmu/stellenportal/wissenschaft/'],
  ['HU-Berlin', 'https://www.hu-berlin.de/universitaet/arbeiten-an-der-hu/stellenangebote'],
  ['Uni-Hamburg', 'https://www.uni-hamburg.de/stellenangebote.html'],
  ['Rheinmetall', 'https://www.rheinmetall.com/de/karriere/aktuelle-stellenangebote']
];

// Hilfsfunktion: kurz schlafen, um JS/AJAX Zeit zu geben
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// Versucht, einen "Weiter"-Button / nächste Seite zu finden
async function getNextButton(page: Page): Promise<ElementHandle<HTMLElement> | null> {
  const candidates: string[] = [
    'a[title="Nächste Seite"]',
    'a[rel="next"]',
    'button[rel="next"]',
    'a[aria-label="Next"]',
    'a[aria-label="Nächste Seite"]',
    'button[aria-label="Next"]',
    'text=Weiter',
    'text=Next',
    // Rheinmetall: Icon-Only-Button mit Chevron
    'a:has(.icon-chevron.-rotate-90)',
    'button:has(.icon-chevron.-rotate-90)'
  ];

  for (const selector of candidates) {
    const el = await page.$(selector);
    if (el) {
      // Typ-Assert, damit TS zufrieden ist
      return el as ElementHandle<HTMLElement>;
    }
  }

  return null;
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Optional: Cookies-Banner automatisch wegklicken, falls vorhanden
  async function handleCookieBanner(): Promise<void> {
    const selectors: string[] = [
      'button:has-text("Akzeptieren")',
      'button:has-text("Zustimmen")',
      'button:has-text("Einverstanden")',
      'button:has-text("Accept")'
    ];
    for (const sel of selectors) {
      const btn = await page.$(sel);
      if (btn) {
        try {
          await btn.click();
          break;
        } catch {
          // ignorieren
        }
      }
    }
  }

  let i = 0;

  while (i < CRAWL_SITES.length) {
    const [crawlName, url] = CRAWL_SITES[i];
    const dirName = `scrapedData/${crawlName}`;

    await page.goto(url, { waitUntil: 'networkidle' });
    await handleCookieBanner();

    // Ausgabeordner vorbereiten
    const outDir = path.join(__dirname, dirName);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    let pageIndex = 1;
    const seenHashes = new Set<string>();

    while (true) {
      console.log(`>> Seite ${pageIndex} laden...`);

      await page.waitForLoadState('networkidle');
      await sleep(1500);

      const html = await page.content();
      const text = cleanJobHtml(html);

      const currentHash = hashText(text);

      // Abbruchbedingung: Seite schon gesehen
      if (seenHashes.has(currentHash)) {
        console.log('>> Abbruch: Identische Seite bereits vorhanden.');
        break;
      }

      seenHashes.add(currentHash);
      const filePath = path.join(outDir, `page-${pageIndex}.html`);
      fs.writeFileSync(filePath, text, 'utf8');
      console.log(`   -> gespeichert: ${filePath}`);

      const nextButton = await getNextButton(page);
      if (!nextButton) {
        console.log('>> Keine weitere Seite gefunden. Fertig.');
        break;
      }

      console.log('>> Weiter zur nächsten Seite...');

      try {
        await Promise.all([
          nextButton.click({ timeout: 5000 }),
          page
            .waitForLoadState('networkidle', { timeout: 30000 })
            .catch(() => {})
        ]);

        pageIndex += 1;
        await sleep(1000);
      } catch (err: unknown) {
        if (err instanceof Error && (err as any).name === 'TimeoutError') {
          console.error('>> Timeout beim Klick auf "Weiter" – breche nur die Seiten-Schleife ab.');
          break;
        }
        throw err;
      }
    }

    i++;
  }

  await browser.close();
}

main().catch(err => {
  console.error('Fehler beim Scrapen:', err);
  process.exit(1);
});
