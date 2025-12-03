// JobScraper.ts
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Page, ElementHandle, Browser } from 'playwright';
import { cleanJobHtml } from './cleanJobHtml';
import * as crypto from 'crypto';

export type CrawlSite = {
  name: string;
  url: string;
};

export class JobScraper {
  private crawlSites: CrawlSite[] | null;
  private outputBaseDir: string;

  constructor(
    outputBaseDir: string = path.join(process.cwd(), 'scrapedData')
  ) {
    this.outputBaseDir = outputBaseDir;
    this.crawlSites = null;
  }

  // Publicer Einstiegspunkt
  public async run(crawlSites: CrawlSite[]): Promise<void> {
    this.crawlSites = crawlSites;
    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      for (const site of this.crawlSites) {
        await this.scrapeSingleSite(page, site);
      }
    } catch (err) {
      console.error('Fehler beim Scrapen:', err);
      throw err;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async scrapeSingleSite(page: Page, site: CrawlSite): Promise<void> {
    const { name: crawlName, url } = site;
    const outDir = path.join(this.outputBaseDir, crawlName);

    console.log(`\n=== Starte Scrape für: ${crawlName} (${url}) ===`);

    await page.goto(url, { waitUntil: 'networkidle' });
    await this.handleCookieBanner(page);

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    let pageIndex = 1;
    const seenHashes = new Set<string>();

    while (true) {
      console.log(`>> Seite ${pageIndex} laden...`);

      await page.waitForLoadState('networkidle');
      await this.sleep(1500);

      const html = await page.content();
      const text = cleanJobHtml(html);
      const currentHash = this.hashText(text);

      const currentUrl = page.url();
      console.log('   URL:', currentUrl);
      console.log('   Hash:', currentHash);


      // Abbruchbedingung: Seite schon gesehen
      if (seenHashes.has(currentHash)) {
        console.log('>> Abbruch: Identische Seite bereits vorhanden.');
        break;
      }

      seenHashes.add(currentHash);

      const filePath = path.join(outDir, `page-${pageIndex}.html`);
      fs.writeFileSync(filePath, text, 'utf8');
      console.log(`   -> gespeichert: ${filePath}`);

      const nextButton = await this.getNextButton(page);
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
        await this.sleep(1000);
      } catch (err: unknown) {
        if (err instanceof Error && (err as any).name === 'TimeoutError') {
          console.error('>> Timeout beim Klick auf "Weiter" – breche nur die Seiten-Schleife ab.');
          break;
        }
        throw err;
      }
    }

    console.log(`=== Fertig für: ${crawlName} ===`);
  }

  // Hilfsfunktion: kurz schlafen, um JS/AJAX Zeit zu geben
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  }

private async getNextButton(page: Page): Promise<ElementHandle<HTMLElement> | null> {
  // 1) Generisches Pagination-Nav benutzen (sehr häufiges Pattern)
  const nav = await page.$('nav[aria-label*="pagination" i]');
  if (nav) {
    const links = await nav.$$('a, button');

    if (links.length > 0) {
      // letzter Link/Button in der Pagination = "weiter"
      const next = links[links.length - 1] as ElementHandle<HTMLElement>;
      const html = await next.evaluate(el => (el as HTMLElement).outerHTML);
      console.log('>> Next-Button aus pagination-nav:\n');
      return next;
    }
  }

  // 2) Fallback: alte Heuristik
  const candidates: string[] = [
    'a[title="Nächste Seite"]',
    'a[rel="next"]',
    'button[rel="next"]',
    'a[aria-label="Next"]',
    'a[aria-label="Nächste Seite"]',
    'button[aria-label="Next"]',
    'button[aria-label="Next »"]',
    'button[aria-label^="Next"]',
    'button[aria-label*="Next"]',
    'text=Weiter',
    'text=Next',
    'a:has(> i.icon-chevron.\\-rotate-90)',
    'button:has(> i.icon-chevron.\\-rotate-90)',
    'button[dusk="nextPage"]',
    'button.page-link[rel="next"]'
  ];

  for (const selector of candidates) {
    const el = await page.$(selector);
    if (el) {
      const html = await el.evaluate(e => (e as HTMLElement).outerHTML);
      console.log('>> Next-Button gefunden mit Selector:', selector);
      console.log('   OuterHTML:', html);
      return el as ElementHandle<HTMLElement>;
    }
  }

  console.log('>> Kein Next-Button gefunden');
  return null;
}


  // Cookies-Banner automatisch wegklicken, falls vorhanden
  private async handleCookieBanner(page: Page): Promise<void> {
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
}
