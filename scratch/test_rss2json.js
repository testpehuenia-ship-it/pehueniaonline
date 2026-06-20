async function test() {
  const feedUrl = 'https://www.vidanimal.org.ar/categoria/noticias/feed/';
  const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
  console.log('Fetching feed via rss2json:', proxyUrl);
  try {
    const res = await fetch(proxyUrl);
    console.log('Status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Feed status:', data.status);
      if (data.status === 'ok' && data.items && data.items.length > 0) {
        console.log('First item keys:', Object.keys(data.items[0]));
        console.log('First item title:', data.items[0].title);
        console.log('First item thumbnail:', data.items[0].thumbnail);
        console.log('First item enclosure:', data.items[0].enclosure);
        console.log('First item description:', data.items[0].description ? data.items[0].description.substring(0, 200) : null);
        console.log('First item content:', data.items[0].content ? data.items[0].content.substring(0, 200) : null);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

test();
