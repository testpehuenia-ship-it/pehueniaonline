const Parser = require('rss-parser');
const parser = new Parser();

const feeds = [
  'https://estudiosmax.com.ar/sistema/category/politica/feed/',
  'https://estudiosmax.com.ar/sistema/category/nacionales/feed/',
  'https://estudiosmax.com.ar/sistema/category/deportes/feed/',
  'https://estudiosmax.com.ar/sistema/category/policiales/feed/',
  'https://estudiosmax.com.ar/sistema/category/tecnologia/feed/'
];

async function testFeeds() {
  console.log('Testing feeds parsing...');
  for (const url of feeds) {
    try {
      console.log(`\nFetching: ${url}`);
      const feed = await parser.parseURL(url);
      console.log(`Success! Title: "${feed.title}". Items count: ${feed.items.length}`);
      if (feed.items.length > 0) {
        const item = feed.items[0];
        console.log(`First item title: "${item.title}"`);
        console.log(`First item link: "${item.link}"`);
        console.log(`First item media:`, {
          enclosure: item.enclosure,
          mediaContent: item.mediaContent,
          'media:content': item['media:content'],
          'media:thumbnail': item['media:thumbnail'],
          image: item.image
        });
      }
    } catch (e) {
      console.error(`Failed to parse feed "${url}":`, e.message);
    }
  }
}

testFeeds();
