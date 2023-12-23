const puppeteer = require('puppeteer');
const fs = require('fs');

async function fetchTitles(page, url, source) {
  await page.goto(url);

  // Check if there are any articles on the page
  const articlesAvailable = await page.$$eval('article', articles => articles.length > 0);
  if (!articlesAvailable) {
    return []; // Return an empty array if no articles are found
  }

  let titles = [];
  let newTitles;
  let lastLength = 0;
  try{ 
    do {
      // Pass 'source' as an argument to the callback function
      newTitles = await page.$$eval('article', (articles, src) => articles.map(article => ({
        title: article.getAttribute('data-card-title'),
        source: src
      })), source);

      titles = [...titles, ...newTitles.filter(nt => !titles.some(t => t.title === nt.title))];

      if (titles.length === lastLength) {
        break;
      }

      lastLength = titles.length;
      await page.evaluate(_ => window.scrollBy(0, window.innerHeight));
      await sleep(1000);
    } while (true);

  } catch (err) {
    console.error(err);
  }

  return titles;
}

async function findStorefrontLinks(page) {
  const links = await page.$$eval('a[href^="/storefront"]', anchorTags => anchorTags.map(anchor => anchor.href));
  return links;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function writeTitlesToCSV(titles, filename) {
  // if null values in titles, filter them out
  titles = titles.filter(t => t.title !== null);
  
  const csvHeader = 'Title,Source\n';
  const csvContent = titles.map(({ title, source }) => `"${title.replace(/"/g, '""')}",${source}`).join('\n');
  fs.writeFileSync(filename, csvHeader + csvContent, 'utf8');
}

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const initialUrl = 'https://www.primevideo.com/storefront/ref=atv_hom_offers_c_9zZ8D2_hm_mv?contentType=movie&contentId=home';
    
    let allTitles = await fetchTitles(page, initialUrl, 'home');

    const storefrontLinks = await findStorefrontLinks(page);
    for (const link of storefrontLinks) {
      console.log(`Fetching titles from ${link}`);

      const titles = await fetchTitles(page, link, link);
      allTitles = [...allTitles, ...titles.filter(t => !allTitles.some(at => at.title === t.title))];
    }
    console.log(`Found ${allTitles.length} titles`);
    // test if allTitles is not empty
    if (allTitles) {
      writeTitlesToCSV(allTitles, 'primeTitles.csv');
      console.log('Titles saved to primeTitles.csv');
      await browser.close();;
    }    
  } catch (err) {
    console.error(err);
  }
})();