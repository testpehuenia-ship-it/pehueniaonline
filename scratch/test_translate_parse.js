const cheerio = require('cheerio');

async function test() {
  const targetUrl = 'https://www.vidanimal.org.ar/por-que-jerarquizamos-a-los-demas-animales/';
  const proxyUrl = `https://translate.google.com/translate?sl=es&tl=en&u=${encodeURIComponent(targetUrl)}`;
  console.log('Fetching Google Translate page:', proxyUrl);
  try {
    const res = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    console.log('HTML length:', html.length);
    const $ = cheerio.load(html);
    
    // Find all meta og:image tags
    const ogImg = $('meta[property="og:image"]').attr('content') 
      || $('meta[property="twitter:image"]').attr('content')
      || $('meta[name="twitter:image"]').attr('content');
    console.log('og:image content:', ogImg);
    
    // Check if the original URL is there
    const hasOriginalImage = html.includes('ojo-de-vaca-triste.jpg');
    console.log('Contains "ojo-de-vaca-triste.jpg":', hasOriginalImage);
    
    if (hasOriginalImage) {
      // Find where it is
      const index = html.indexOf('ojo-de-vaca-triste.jpg');
      console.log('Surrounding text:', html.substring(index - 100, index + 100));
    }
  } catch (err) {
    console.error(err);
  }
}

test();
