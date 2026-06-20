const cheerio = require('cheerio');

const url = 'https://estudiosmax.com.ar/sistema/villarruel-aviso-que-va-el-sabado-a-rosario-por-el-dia-de-la-bandera-se-cruzara-con-milei/';

async function testPage() {
  console.log(`Fetching page: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    console.log(`Response status: ${res.status} ${res.statusText}`);
    const html = await res.text();
    console.log(`HTML length: ${html.length}`);

    const $ = cheerio.load(html);
    const ogImage = $('meta[property="og:image"]').attr('content');
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    const firstImg = $('img').first().attr('src');
    const articleImg = $('article img').first().attr('src');
    const wpImage = $('.wp-post-image').first().attr('src');

    console.log('Extracted details:', {
      ogImage,
      twitterImage,
      firstImg,
      articleImg,
      wpImage
    });
  } catch (error) {
    console.error('Fetch failed:', error.message);
  }
}

testPage();
