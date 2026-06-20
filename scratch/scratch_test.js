async function test() {
  const url = 'https://www.vidanimal.org.ar/categoria/noticias/feed/';
  console.log('Fetching raw XML:', url);
  try {
    const res = await fetch(url);
    if (res.ok) {
      const xml = await res.text();
      console.log('XML length:', xml.length);
      // Find the first <item> tag
      const itemStart = xml.indexOf('<item>');
      const itemEnd = xml.indexOf('</item>');
      if (itemStart !== -1 && itemEnd !== -1) {
        const itemXml = xml.substring(itemStart, itemEnd + 7);
        console.log('First item raw XML:\n', itemXml);
      } else {
        console.log('No <item> tag found.');
      }
    }
  } catch (err) {
    console.error(err);
  }
}

test();
