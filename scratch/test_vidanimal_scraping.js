const cheerio = require('cheerio');
const Parser = require('rss-parser');
const parser = new Parser();

// Mimic the helper functions from server.js
function resolverUrlAbsoluta(url, base) {
  if (!url) return '';
  try {
    return new URL(url, base).href;
  } catch (e) {
    return url;
  }
}

function optimizarUrlImagen(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=1000&output=webp&q=80`;
  }
  return url;
}

const esImagenValida = (url, type) => {
  if (!url) return false;
  if (type && (type.startsWith('audio/') || type.startsWith('video/'))) return false;
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext) || (type && type.startsWith('image/'));
};

async function testCampaign() {
  const feedUrl = 'https://www.vidanimal.org.ar/categoria/noticias/feed/';
  console.log('Fetching feed:', feedUrl);
  
  let feed;
  try {
    feed = await parser.parseURL(feedUrl);
  } catch (err) {
    console.error('Failed to parse URL directly:', err.message);
    return;
  }
  
  const items = feed.items.slice(0, 3);
  for (const item of items) {
    console.log('\n----------------------------------------');
    console.log('Title:', item.title);
    console.log('Link:', item.link);
    
    let contenidoOriginal = item['content:encoded'] || item.content || item.contentSnippet || '';
    let imagenUrl = '';
    
    // Check feed elements
    const checkMediaItem = (m) => {
      if (!m) return null;
      if (m.$ && m.$.url && esImagenValida(m.$.url, m.$.type || m.$.medium)) return m.$.url;
      if (m.url && esImagenValida(m.url, m.type || m.medium)) return m.url;
      return null;
    };

    if (item.enclosure && item.enclosure.url && esImagenValida(item.enclosure.url, item.enclosure.type)) {
      imagenUrl = item.enclosure.url;
      console.log('Found in enclosure:', imagenUrl);
    } else if (item.mediaContent && item.mediaContent.url && esImagenValida(item.mediaContent.url, item.mediaContent.type)) {
      imagenUrl = item.mediaContent.url;
      console.log('Found in mediaContent:', imagenUrl);
    } else if (item['media:content']) {
      if (Array.isArray(item['media:content'])) {
        for (const m of item['media:content']) {
          const url = checkMediaItem(m);
          if (url) { imagenUrl = url; break; }
        }
      } else {
        imagenUrl = checkMediaItem(item['media:content']) || '';
      }
      console.log('Found in media:content:', imagenUrl);
    }

    if (!imagenUrl && item['media:thumbnail']) {
      if (Array.isArray(item['media:thumbnail'])) {
        for (const m of item['media:thumbnail']) {
          const url = checkMediaItem(m);
          if (url) { imagenUrl = url; break; }
        }
      } else {
        imagenUrl = checkMediaItem(item['media:thumbnail']) || '';
      }
      console.log('Found in media:thumbnail:', imagenUrl);
    }

    if (!imagenUrl && item.image && item.image.url) {
      imagenUrl = item.image.url;
      console.log('Found in item.image.url:', imagenUrl);
    }

    if (!imagenUrl && contenidoOriginal) {
      try {
        const $ = cheerio.load(contenidoOriginal);
        const firstImg = $('img').first();
        if (firstImg.length) {
          imagenUrl = firstImg.attr('src');
          console.log('Found in content first img:', imagenUrl);
        }
      } catch (imgErr) {
        console.error('Cheerio error:', imgErr);
      }
    }

    // Scraper fallback
    if (!imagenUrl && item.link) {
      try {
        console.log(`Scraping page for og:image: ${item.link}`);
        const responsePage = await fetch(item.link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
          },
          signal: AbortSignal.timeout(5000)
        });
        console.log(`Page fetch status: ${responsePage.status}`);
        if (responsePage.ok) {
          const htmlPage = await responsePage.text();
          const $page = cheerio.load(htmlPage);
          
          // Let's print out what we find for each selector
          const ogImg = $page('meta[property="og:image"]').attr('content');
          const twImg = $page('meta[name="twitter:image"]').attr('content');
          const wpImg = $page('.wp-post-image').first().attr('src');
          const artImg = $page('article img').first().attr('src');
          
          console.log('Scraped meta og:image:', ogImg);
          console.log('Scraped meta twitter:image:', twImg);
          console.log('Scraped .wp-post-image:', wpImg);
          console.log('Scraped article img:', artImg);

          // Test lazy-load attributes specifically if .wp-post-image src is SVG
          let scrapedImg = ogImg || twImg || wpImg || artImg;
          
          if (scrapedImg && scrapedImg.startsWith('data:image/')) {
            console.log('Detected SVG placeholder. Checking data attributes...');
            const wpPostImgEl = $page('.wp-post-image').first();
            const lazySrc = wpPostImgEl.attr('data-lazy-src') || wpPostImgEl.attr('data-src') || wpPostImgEl.attr('data-original');
            console.log('Found lazy-load image:', lazySrc);
            if (lazySrc) {
              scrapedImg = lazySrc;
            }
          }

          if (scrapedImg && esImagenValida(scrapedImg)) {
            imagenUrl = scrapedImg;
            console.log(`Selected image: ${imagenUrl}`);
          } else {
            console.log(`Scraped image "${scrapedImg}" is invalid or empty.`);
          }
        }
      } catch (scrapeErr) {
        console.error(`Scrape error:`, scrapeErr.message);
      }
    }

    if (imagenUrl) {
      imagenUrl = optimizarUrlImagen(resolverUrlAbsoluta(imagenUrl, item.link || feedUrl));
      console.log('Final optimized image URL:', imagenUrl);
    } else {
      console.log('Final image URL: (empty)');
    }
  }
}

testCampaign();
