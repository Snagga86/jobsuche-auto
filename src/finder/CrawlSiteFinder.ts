import { callLLM } from "../service/callLLM";

export type CrawlSite = {
  name: string;
  url: string;
};

export class CrawlSiteFinder {
  private readonly timeoutMs = 8000;

  async expandSites(
    queryDescription: string,
    existingSites: CrawlSite[]
  ): Promise<CrawlSite[]> {

    const prompt = this.buildPrompt(queryDescription, existingSites);

    console.log("Call llm for search: " + queryDescription);
    const raw = await callLLM(prompt, "gpt-5.1");
    console.log("Parse and filter sites...");
    const newSites = this.parseCrawlSitesFromJson(raw);
    const validSites = await this.filterReachableSites(newSites);
    console.log("Merge sites...");
    return this.mergeSites(existingSites, validSites);
  }

  private buildPrompt(regionOrFilterDescription: string, existingSites: CrawlSite[]): string {
    return `
Du findest offizielle Jobportale von Arbeitgebern.

Filter:
- ${regionOrFilterDescription}

Bereits bekannt:
${JSON.stringify(existingSites, null, 2)}

Aufgabe:
- Finde weitere reale Karriere-/Stellenseiten.
- Nur HTTPS.
- Pro Institution nur eine Seite.
- Keine Duplikate (Domain).
- Direkte Stellenseiten bevorzugen ("/jobs", "/stellenangebote", "/karriere", "/vacancies").
- Nichts erfinden.
- Wichtig: Auf der Seite müssen direkt konkrete Stellen angeboten werden (also nicht meta seite mit verschachtelten unterlinks).

Antwortformat (reines JSON):
[
  { "name": "Arbeitgeber X", "url": "https://..." }
]
`.trim();
  }

  // ============================
  // JSON Parser
  // ============================

  private parseCrawlSitesFromJson(jsonText: string): CrawlSite[] {
    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error("LLM antwortete kein valides JSON");
    }

    if (!Array.isArray(parsed)) {
      throw new Error("Antwort ist kein Array");
    }

    const result: CrawlSite[] = [];

    for (const entry of parsed) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as any).name === "string" &&
        typeof (entry as any).url === "string"
      ) {
        const name = (entry as any).name.trim();
        const url = (entry as any).url.trim();

        if (!url.startsWith("https://")) continue;

        result.push({ name, url });
      }
    }

    return result;
  }

  // ============================
  // HTTP-Existenzprüfung
  // ============================

  private async filterReachableSites(sites: CrawlSite[]): Promise<CrawlSite[]> {
    const checked: CrawlSite[] = [];

    for (const site of sites) {
      const ok = await this.checkUrlExists(site.url);
      if (ok) {
        checked.push(site);
      }
    }

    return checked;
  }

  private async checkUrlExists(url: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Erst HEAD versuchen (schnell)
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal
      });

      if (res.ok) return true;

      // Fallback: GET, falls HEAD nicht erlaubt ist
      if (res.status === 405 || res.status === 403) {
        return await this.fallbackGet(url);
      }

      return false;
    } catch {
      // Netzwerkfehler, Timeout, DNS usw.
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fallbackGet(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow"
      });

      return res.ok;
    } catch {
      return false;
    }
  }

  // ============================
  // Deduplication
  // ============================

  private mergeSites(existing: CrawlSite[], incoming: CrawlSite[]): CrawlSite[] {
    const seenHosts = new Set<string>();

    const getHost = (url: string): string | null => {
      try {
        return new URL(url).hostname.toLowerCase();
      } catch {
        return null;
      }
    };

    const result: CrawlSite[] = [];

    for (const s of existing) {
      const host = getHost(s.url);
      if (host) seenHosts.add(host);
      result.push(s);
    }

    for (const s of incoming) {
      const host = getHost(s.url);
      if (!host) continue;
      if (seenHosts.has(host)) continue;
      seenHosts.add(host);
      result.push(s);
    }

    return result;
  }
}
