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
  private onlyNew: boolean;

  constructor(
    outputBaseDir: string = path.join(process.cwd(), 'scrapedData')
  ) {
    this.outputBaseDir = outputBaseDir;
    this.crawlSites = null;
    this.onlyNew = false;
  }

  // Publicer Einstiegspunkt
  public async run(crawlSites: CrawlSite[], onlyNew: boolean = false): Promise<void> {
    this.crawlSites = crawlSites;
    this.onlyNew = onlyNew;
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

  if(fs.existsSync(outDir) && this.onlyNew == true)return;

  console.log(`\n=== Starte Scrape für: ${crawlName} (${url}) ===`);

  // Initialer Aufruf der Seite – KEIN networkidle mehr
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  } catch (err: unknown) {
    const e = err as any;
    if (e?.name === 'TimeoutError') {
      console.warn(`>> goto-Timeout bei ${url}, arbeite mit aktuellem DOM weiter.`);
    } else {
      console.error(`>> Fehler beim Aufruf von ${url}:`, err);
      return; // diese Site abbrechen
    }
  }

  await this.handleCookieBanner(page);
  await this.sleep(2000); // etwas Zeit für JS / Jobs

  // Output-Ordner
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let pageIndex = 1;
  const seenHashes = new Set<string>();
  const MAX_PAGES_PER_SITE = 50;

  while (true) {
    if (pageIndex > MAX_PAGES_PER_SITE) {
      console.log(`>> Max. Seitenzahl (${MAX_PAGES_PER_SITE}) erreicht, Abbruch.`);
      break;
    }

    console.log(`>> Seite ${pageIndex} laden...`);

    // KEIN waitForLoadState mehr hier – nur schlafen
    await this.sleep(1500);

    const html = await page.content();

    // Cloudflare-/Block-Erkennung (generisch)
    if (
      html.includes('You have been blocked') ||
      html.includes('You are unable to access') ||
      html.includes('Cloudflare Ray ID')
    ) {
      console.error('>> Block-/Schutzseite erkannt – breche für diese Site ab.');
      break;
    }

    const text = cleanJobHtml(html);
    const currentUrl = page.url();
    const currentHash = this.hashText(text);

    console.log('   URL:', currentUrl);
    console.log('   Hash:', currentHash);

    if (seenHashes.has(currentHash)) {
      console.log('>> Abbruch: identischer Inhalt wie auf einer vorherigen Seite (Hash).');
      break;
    }

    seenHashes.add(currentHash);

    const filePath = path.join(outDir, `page-${pageIndex}.html`);
    fs.writeFileSync(filePath, text, 'utf8');
    console.log(`   -> gespeichert: ${filePath}`);

    await this.handleCookieBanner(page);

    const nextButton = await this.getNextButton(page);

    if (!nextButton) {
      console.log('>> Keine weitere Seite gefunden. Fertig.');
      break;
    }

    console.log('>> Weiter zur nächsten Seite...');

    try {
      const urlBefore = page.url();

      await nextButton.click({ timeout: 5000 });

      // Kein networkidle – nur etwas Zeit + optional domcontentloaded,
      // aber Fehler hier sind NICHT kritisch
      await page
        .waitForLoadState('domcontentloaded', { timeout: 30000 })
        .catch(() => { /* ignorieren */ });

      const urlAfter = page.url();
      console.log('   URL vor Klick :', urlBefore);
      console.log('   URL nach Klick:', urlAfter);

      pageIndex += 1;
      await this.sleep(1500);
    } catch (err: unknown) {
      console.error('>> Fehler beim Klick auf Next, breche Seiten-Schleife ab:', err);
      break;
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
  // 1) Bisherige Next-Button-Heuristiken
  const candidates: string[] = [
    'button.page-link[rel="next"]',
    'button[dusk="nextPage"]',

    '[rel="next"]',
    '[aria-label*="next" i]',
    '[aria-label*="weiter" i]',

    'a[title="Nächste Seite"]',
    'a:has(> i.icon-chevron.\\-rotate-90)',
    'button:has(> i.icon-chevron.\\-rotate-90)',
    // deutsch mit Zahl im Text
    'a:has-text("Die nächsten")',
    'a:has-text("nächsten")',
    'a:has-text("weiteren")',
    'a:has-text(">>")',
  ];

  for (const selector of candidates) {
    const el = await page.$(selector) as ElementHandle<HTMLElement> | null;
    console.log("el")
    if (el) {
      const outer = await el.evaluate(e => (e as HTMLElement).outerHTML.slice(0, 200));
      console.log('>> Next-Button gefunden mit Selector:', selector);
      console.log('   Ausschnitt:', outer);
      return el;
    }
  }

  // 2) Fallback: numerische Pagination (erst greifen, wenn oben nichts gefunden wurde)
  const currentSelectors: string[] = [
    'ul.pagination li > a[aria-current="page"]',
    'ul.pagination li.active > a',
    '[aria-current="page"]'
  ];

  for (const sel of currentSelectors) {
    const current = await page.$(sel) as ElementHandle<HTMLElement> | null;
    if (!current) continue;

    const nextHandle = await current.evaluateHandle(el => {
      const li = (el as HTMLElement).closest('li');
      if (!li) return null;

      let next = li.nextElementSibling as HTMLElement | null;
      while (next) {
        const anchor = next.querySelector('a') as HTMLElement | null;
        if (anchor) return anchor;
        next = next.nextElementSibling as HTMLElement | null;
      }
      return null;
    });

    const element = nextHandle.asElement() as ElementHandle<HTMLElement> | null;
    if (element) {
      const outer = await element.evaluate(e => (e as HTMLElement).outerHTML.slice(0, 200));
      console.log('>> Next-Button via numerischer Pagination gefunden');
      console.log('   Ausschnitt:', outer);
      return element;
    }
  }

  console.log('>> Kein Next-Button / keine nächste Seite gefunden');
  return null;
}

private async handleCookieBanner(page: Page): Promise<void> {
  const selectors: string[] = [
    // TrustArc / SAP
    '#truste-consent-button',
    'button#truste-consent-button',
    'button:has-text("Alle annehmen")',
    'button:has-text("Alle akzeptieren")',

    // generische deutschen Varianten
    'button:has-text("Akzeptieren")',
    'button:has-text("Zustimmen")',
    'button:has-text("Einverstanden")',

    // englisch
    'button:has-text("Accept all")',
    'button:has-text("Accept")',

    // sehr generische Fallbacks in typischen Bannern
    '[role="dialog"] button:has-text("OK")',
    '[aria-label*="cookie" i] button:has-text("OK")'
  ];

  for (const sel of selectors) {
    const btn = await page.$(sel);
    if (btn) {
      try {
        console.log('>> Cookie-Banner gefunden, klicke:', sel);
        await btn.click({ timeout: 2000 });
        await this.sleep(500);
        break;
      } catch {
        // wenn der Klick fehlschlägt, einfach zum nächsten Selector
      }
    }
  }
}

}
