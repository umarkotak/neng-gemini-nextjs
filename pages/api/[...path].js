// pages/api/[...path].js

const EVW_HOST = "https://api.everywhere.id"

export default async function handler(req, res) {
  const { path } = req.query; // Get the requested path from query parameters

  // Construct the target URL based on the path
  const targetUrl = `${EVW_HOST}/${path.join('/')}`; // Replace with your actual target API URL

  try {
    // Forward the request to the target API
    const response = await fetch(targetUrl, {
      method: req.method,
      // headers: req.headers,
    });

    // Forward the response headers and body to the client
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(await response.text());
  } catch (error) {
    // Handle any errors that occur during forwarding
    console.error(targetUrl, error);
    res.status(500).json({ error: 'Failed to forward request' });
  }
}
