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
      `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(targetUrl)}&render_js=false`
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `ScrapingBee error: ${response.status}` });
    }

    const html = await response.text();
    
    // Parse listings from HTML
    const listings = [];
    
    // Find all seller links with pattern /seller/USERNAME
    // and extract surrounding context for price/condition
    const sellerMatches = html.matchAll(/href="\/seller\/([^"\/]+)"[^>]*>.*?<\/a>/gs);
    const foundSellers = new Set();
    
    for (const match of sellerMatches) {
      const seller = match[1];
      if (seller && !foundSellers.has(seller) && seller !== 'undefined') {
        foundSellers.add(seller);
      }
    }
    
    // Find prices in the page - pattern like €5.00 or $10.00
    const priceMatches = [...html.matchAll(/class="price"[^>]*>([^<]+)</g)];
    const prices = priceMatches.map(m => {
      const text = m[1].trim();
      let currency = 'EUR';
      if (text.includes('$')) currency = 'USD';
      else if (text.includes('£')) currency = 'GBP';
      const value = parseFloat(text.replace(/[^0-9.,]/g, '').replace(',', '.'));
      return { value, currency };
    });
    
    // Find conditions
    const conditionMatches = [...html.matchAll(/(Mint|Near Mint|Very Good Plus|Very Good|Good Plus|Good|Fair|Poor)\s*\(/gi)];
    const conditions = conditionMatches.map(m => m[1]);
    
    // Find countries/ships from
    const countryMatches = [...html.matchAll(/Ships From:[^<]*<[^>]*>([^<]+)/gi)];
    const countries = countryMatches.map(m => m[1].trim());
    
    // Combine data - match sellers with prices
    const sellersArray = Array.from(foundSellers);
    
    for (let i = 0; i < sellersArray.length && i < 50; i++) {
      const seller = sellersArray[i];
      const price = prices[i] || { value: 0, currency: 'EUR' };
      const condition = conditions[i] || 'Unknown';
      const country = countries[i] || 'Unknown';
      
      if (price.value > 0) {
        listings.push({
          seller: {
            username: seller,
            stats: { rating: null, total: 0 }
          },
          price: price,
          condition: condition,
          sleeve_condition: 'Unknown',
          ships_from: country
        });
      }
    }

    return res.status(200).json({ 
      listings,
      count: listings.length
    });
    
  } catch (error) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
