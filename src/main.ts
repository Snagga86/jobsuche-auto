import { JobScraper, CrawlSite } from './JobScraper';

const DEFAULT_CRAWL_SITES: CrawlSite[] = [
  /**{ name: 'Uni-Goettingen', url: 'https://www.uni-goettingen.de/de/644546.html' },
  { name: 'LMU', url: 'https://www.lmu.de/de/die-lmu/arbeiten-an-der-lmu/stellenportal/wissenschaft/' },
  { name: 'HU-Berlin', url: 'https://www.hu-berlin.de/universitaet/arbeiten-an-der-hu/stellenangebote' },
  { name: 'Uni-Hamburg', url: 'https://www.uni-hamburg.de/stellenangebote.html' },
  { name: 'Rheinmetall', url: 'https://www.rheinmetall.com/de/karriere/aktuelle-stellenangebote' }
  { name: 'Uni-Koeln', url: 'https://jobportal.uni-koeln.de/' }
  { name: 'Uni-Osnabrueck', url: 'https://www.uni-osnabrueck.de/universitaet/arbeiten-an-der-uni/stellenangebote/wissenschaftliches-personal'},*/
  { name: 'Academic-Positions', url: 'https://academicpositions.com/find-jobs' }
];

const SCRAPED_DATA_FOLDER = "../scrapedData";

async function main() {
    const scraper = new JobScraper();
    await scraper.run(DEFAULT_CRAWL_SITES);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
