export default async function handler(req, res) {
  // Enable CORS
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
    const response = await fetch(
      `https://api.discogs.com/marketplace/listings?release_id=${release_id}&status=For%20Sale`,
      {
        headers: {
          'User-Agent': 'DiscogsOptimizer/1.0',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
