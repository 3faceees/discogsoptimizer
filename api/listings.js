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
    const targetUrl = `https://www.discogs.com/sell/release/${release_id}?sort=price%2Casc`;
    
    // Use allorigins.win as CORS proxy
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `HTTP ${response.status}` });
    }

    const html = await response.text();
    
    // Parse listings from HTML
    const listings = [];
    
    // Look for seller links and prices in the HTML
    // Pattern: seller username appears in links like /seller/USERNAME
    const sellerPattern = /href="\/seller\/([^"\/]+)"/g;
    const sellers = new Set();
    let match;
    
    while ((match = sellerPattern.exec(html)) !== null) {
      sellers.add(match[1]);
    }
    
    // For each seller found, create a listing entry
    // We'll extract more details with better regex
    const rows = html.split(/class="[^"]*shortcut_navigable[^"]*"/g);
    
    for (let i = 1; i < rows.length && i <= 50; i++) {
      const row = rows[i];
      
      // Get seller
      const sellerMatch = row.match(/\/seller\/([^"\/]+)/);
      if (!sellerMatch) continue;
      const seller = sellerMatch[1];
      
      // Get price - look for currency symbols followed by numbers
      const priceMatch = row.match(/(?:€|EUR|USD|\$|£|GBP)\s*([\d,.]+)/i) ||
                        row.match(/([\d,.]+)\s*(?:€|EUR|USD|\$|£|GBP)/i);
      
      let price = 0;
      let currency = 'EUR';
      
      if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(/,/g, '.').replace(/\.(?=.*\.)/g, ''));
        if (row.includes('$') || row.includes('USD')) currency = 'USD';
        else if (row.includes('£') || row.includes('GBP')) currency = 'GBP';
      }
      
      // Get condition
      let condition = 'Unknown';
      const condMatch = row.match(/(Mint|Near Mint|Very Good Plus|Very Good|Good Plus|Good|Fair|Poor)\s*\(/i);
      if (condMatch) condition = condMatch[1];
      
      // Get country - look for flag or country name
      let country = 'Unknown';
      const countryMatch = row.match(/Ships From:.*?>([^<]+)</i) ||
                          row.match(/title="([^"]+)"[^>]*class="[^"]*flag/i);
      if (countryMatch) country = countryMatch[1].trim();
      
      // Get rating
      let rating = null;
      const ratingMatch = row.match(/([\d.]+)%/);
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

    return res.status(200).json({ 
      listings,
      debug: {
        sellersFound: sellers.size,
        rowsFound: rows.length - 1
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
