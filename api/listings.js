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

  const SCRAPINGBEE_API_KEY = '8TBEWEBN66IM9QI6GHMFISN1DHQP19YW5FS7HH2W21VEU3T674CC9ATIYIRY254VDKO6TIGQWF9I53UJ';

  try {
    const targetUrl = `https://www.discogs.com/sell/release/${release_id}?sort=price%2Casc`;
    
    const response = await fetch(
      `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(targetUrl)}&render_js=false`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `ScrapingBee error: ${errorText}` });
    }

    const html = await response.text();
    
    // Parse listings from HTML
    const listings = [];
    
    // Split by listing rows
    const rows = html.split(/class="[^"]*shortcut_navigable[^"]*"/g);
    
    for (let i = 1; i < rows.length && i <= 50; i++) {
      const row = rows[i];
      
      // Get seller
      const sellerMatch = row.match(/\/seller\/([^"\/\s]+)/);
      if (!sellerMatch) continue;
      const seller = sellerMatch[1];
      
      // Get price
      const priceMatch = row.match(/(?:€|EUR|USD|\$|£|GBP)\s*([\d,\.]+)/i) ||
                        row.match(/([\d,\.]+)\s*(?:€|EUR|USD|\$|£|GBP)/i);
      
      let price = 0;
      let currency = 'EUR';
      
      if (priceMatch) {
        // Handle European number format (1.234,56) vs US format (1,234.56)
        let priceStr = priceMatch[1];
        // If has both . and ,, determine format
        if (priceStr.includes(',') && priceStr.includes('.')) {
          // European: 1.234,56 -> 1234.56
          if (priceStr.lastIndexOf(',') > priceStr.lastIndexOf('.')) {
            priceStr = priceStr.replace(/\./g, '').replace(',', '.');
          } else {
            // US: 1,234.56 -> 1234.56
            priceStr = priceStr.replace(/,/g, '');
          }
        } else if (priceStr.includes(',')) {
          // Could be European decimal (12,50) or US thousands (1,234)
          if (priceStr.match(/,\d{2}$/)) {
            priceStr = priceStr.replace(',', '.');
          } else {
            priceStr = priceStr.replace(/,/g, '');
          }
        }
        price = parseFloat(priceStr);
        
        if (row.includes('$') || row.toUpperCase().includes('USD')) currency = 'USD';
        else if (row.includes('£') || row.toUpperCase().includes('GBP')) currency = 'GBP';
      }
      
      // Get condition
      let condition = 'Unknown';
      const condMatch = row.match(/(Mint|Near Mint|Very Good Plus|Very Good|Good Plus|Good|Fair|Poor)\s*\(/i);
      if (condMatch) condition = condMatch[1];
      
      // Get country
      let country = 'Unknown';
      const countryMatch = row.match(/Ships\s*From:[^<]*<[^>]*>([^<]+)/i);
      if (countryMatch) country = countryMatch[1].trim();
      
      // Get rating
      let rating = null;
      const ratingMatch = row.match(/([\d\.]+)%/);
      if (ratingMatch) rating = parseFloat(ratingMatch[1]);
      
      if (seller && price > 0) {
        listings.push({
          seller: {
            username: seller,
            stats: { rating, total: 0 }
          },
          price: { value: price, currency },
          condition,
          sleeve_condition: 'Unknown',
          ships_from: country
        });
      }
    }

    return res.status(200).json({ listings });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
