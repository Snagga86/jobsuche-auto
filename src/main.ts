import { JobScraper, CrawlSite } from './scraper/JobScraper';
import { ScrapedDataProcessor } from './processor/ScrapedDataProcessor';
import { DataAggregator } from './aggregator/DataAggregator';
import { CrawlSiteFinder } from './finder/CrawlSiteFinder';
import * as fs from 'fs';

async function main() {

    /*const CRAWL_SITES_URL = "./src/crawlSites.json"

    console.log("Load crawlSites.Json...")
    let raw = fs.readFileSync(CRAWL_SITES_URL, 'utf8');
    let data = JSON.parse(raw);
    console.log("CrawlSites.Json loaded... Length: " + data.length)

    console.log("Init expander...")
    const expander = new CrawlSiteFinder();
    const expanded = await expander.expandSites(
        "Universitäten in Deutschland",
        data
    );

    console.log("Save new crawlSites.Json...")
    fs.writeFileSync(CRAWL_SITES_URL, JSON.stringify(expanded, null, 2), 'utf8');

    console.log("Reload new crawlSites.Json...")
    raw = fs.readFileSync(CRAWL_SITES_URL, 'utf8');
    data = JSON.parse(raw);*/

    const data = [{
        "name": "TU-Muenchen",
        "url": "https://portal.mytum.de/jobs/wissenschaftler"
    }]

    console.log("Start Scraping...");
    const scraper = new JobScraper();
    const processor = new ScrapedDataProcessor(); // nutzt ./scrapedData unter project root
    const aggregator = new DataAggregator();

    console.log("Start Scraping...");
    await scraper.run(data, true)

    console.log("Start Processing...");
    await processor.processAll();

    console.log("Aggregate...");
    aggregator.concatAllEmployers();
    aggregator.concatGlobal();

    console.log("Finished!");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
