import * as cheerio from 'cheerio';

/**
 * Nimmt ein komplettes HTML-Dokument und gibt einen bereinigten Text zurück,
 * ohne Meta-Tags, JS, Styles, Bilder usw.
 */
export function cleanJobHtml(html: string): string {
  const $ = cheerio.load(html);

  // Offensichtlich irrelevante Tags entfernen
  $('script, style, noscript, template, canvas, svg, iframe, meta, link').remove();
  $('img, picture, video, audio, source').remove();

  // Layout-/Chrome-Bereiche entfernen (navigation, header/footer, aside)
  $('nav, header, footer, aside').remove();

  // Nur Body-Text betrachten
  const rawText = $('body').text() || '';

  // Whitespace bereinigen:
  // - Zeilenumbrüche normalisieren
  // - Mehrfach-Spaces zu einem Space
  // - Leere Zeilen entfernen
  const cleaned = rawText
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0)
    .join('\n');

  return cleaned;
}
