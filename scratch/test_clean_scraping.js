const cheerio = require('cheerio');

const esImagenValida = (url, type) => {
  if (!url) return false;
  if (type && (type.startsWith('audio/') || type.startsWith('video/'))) return false;
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext) || (type && type.startsWith('image/'));
};

async function test() {
  const targetUrl = 'https://www.vidanimal.org.ar/por-que-jerarquizamos-a-los-demas-animales/';
  const proxyUrl = `https://translate.google.com/translate?sl=es&tl=en&u=${encodeURIComponent(targetUrl)}`;
  console.log('Fetching:', proxyUrl);
  try {
    const res = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const html = await res.text();
    const $page = cheerio.load(html);
    
    // 1. Scrape image
    let scrapedImg = $page('meta[property="og:image"]').attr('content') 
      || $page('meta[name="twitter:image"]').attr('content')
      || $page('meta[property="twitter:image"]').attr('content');
      
    if (!scrapedImg) {
      const wpPostImg = $page('.wp-post-image').first();
      if (wpPostImg.length) {
        scrapedImg = wpPostImg.attr('data-lazy-src') 
          || wpPostImg.attr('data-src') 
          || wpPostImg.attr('data-original') 
          || wpPostImg.attr('src');
      }
    }
    
    console.log('Scraped Image URL:', scrapedImg);
    
    // 2. Scrape full body
    let bodyHtml = '';
    const bodySelectors = ['.entry-content', '.post-content', '.entry-body', '.post-body', 'article', '.content'];
    for (const selector of bodySelectors) {
      const element = $page(selector).first();
      if (element.length && element.text().trim().length > 100) {
        bodyHtml = element.html();
        console.log(`Matched selector: ${selector}`);
        break;
      }
    }
    
    if (!bodyHtml) {
      console.log('Failed to extract body via selectors.');
      return;
    }
    
    console.log('Original Body HTML Length:', bodyHtml.length);
    
    // 3. Clean body
    const $ = cheerio.load(bodyHtml);
    
    // Check initial counts
    const initialImgCount = $('img').length;
    const initialLinkCount = $('a').length;
    console.log(`Before cleaning: ${initialImgCount} images, ${initialLinkCount} links.`);
    
    // Clean
    $('script').remove();
    $('iframe').remove();
    $('ins.adsbygoogle, .ads, .publicidad, .anuncio, .advertisement, .sharedaddy, .wpcnt, .social-share, .jp-relatedposts').remove();
    $('img').remove();
    $('a').each((i, el) => {
      const text = $(el).text();
      $(el).replaceWith(text);
    });
    
    let cleanedHtml = $.html();
    cleanedHtml = cleanedHtml.replace(/<p[^>]*>La entrada.*?se publicó primero en.*?<\/p>/gi, '');
    cleanedHtml = cleanedHtml.replace(/seguir leyendo/gi, '');
    cleanedHtml = cleanedHtml.replace(/leer más/gi, '');
    cleanedHtml = cleanedHtml.replace(/continúa leyendo/gi, '');
    
    const cleaned = cleanedHtml.trim();
    
    console.log('Cleaned Body Length:', cleaned.length);
    
    const $clean = cheerio.load(cleaned);
    const finalImgCount = $clean('img').length;
    const finalLinkCount = $clean('a').length;
    console.log(`After cleaning: ${finalImgCount} images, ${finalLinkCount} links.`);
    
    console.log('\n--- Cleaned Body Snippet ---');
    console.log(cleaned.substring(0, 1000));
    console.log('-----------------------------');
    
  } catch (err) {
    console.error(err);
  }
}

test();
