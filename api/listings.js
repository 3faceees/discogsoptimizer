export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { release_id } = req.query;

  if (!release_id) {
    return res.status(400).json({ error: 'release_id is required' });
  }

  try {
    // Scrape the Discogs sell page
    const response = await fetch(
      `https://www.discogs.com/sell/release/${release_id}?sort=price%2Casc`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `HTTP ${response.status}` });
    }

    const html = await response.text();
    
    // Parse listings from HTML
    const listings = [];
    
    // Split by listing items
    const itemBlocks = html.split(/class="shortcut_navigable/g);
    
    for (let i = 1; i < itemBlocks.length; i++) {
      const block = itemBlocks[i];
      
      // Extract seller username
      const sellerMatch = block.match(/href="\/seller\/([^\/?"]+)/);
      const seller = sellerMatch ? sellerMatch[1] : null;
      
      // Extract price - look for span with currency symbol
      const priceMatch = block.match(/(?:€|£|\$|¥)\s*[\d,]+\.?\d*/);
      let currency = 'EUR';
      let priceValue = 0;
      
      if (priceMatch) {
        const priceText = priceMatch[0];
        if (priceText.includes('$')) currency = 'USD';
        else if (priceText.includes('£')) currency = 'GBP';
        else if (priceText.includes('¥')) currency = 'JPY';
        priceValue = parseFloat(priceText.replace(/[€$£¥,\s]/g, ''));
      }
      
      // Extract condition from item condition text
      const conditionMatch = block.match(/(?:Media|Condition)[^>]*>([^<]*(?:Mint|Near Mint|Very Good|Good|Fair|Poor)[^<]*)/i);
      const condition = conditionMatch ? conditionMatch[1].trim() : 'Unknown';
      
      // Extract ships from country
      const shipsMatch = block.match(/Ships\s*From[^>]*>[^>]*>([^<]+)/i) || 
                        block.match(/flag-([a-z]{2})/i);
      let shipsFrom = 'Unknown';
      if (shipsMatch) {
        shipsFrom = shipsMatch[1].trim();
      }
      
      // Extract seller rating
      const ratingMatch = block.match(/([\d.]+)%/);
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
      
      if (seller && priceValue > 0) {
        listings.push({
          seller: {
            username: seller,
            stats: {
              rating: rating,
              total: 0
            }
          },
          price: {
            value: priceValue,
            currency: currency
          },
          condition: condition,
          sleeve_condition: 'Unknown',
          ships_from: shipsFrom
        });
      }
    }

    return res.status(200).json({ listings });
    
  } catch (error) {
    console.error('Scraping error:', error);
    return res.status(500).json({ error: error.message });
  }
}
