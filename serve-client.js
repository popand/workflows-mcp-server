// serve-client.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a simple Express server
const app = express();
const PORT = 8080;

// Serve static files
app.use(express.static(__dirname));

// Handle the root request
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'mcp-client.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`HTML client available at: http://localhost:${PORT}`);
  console.log(`(Make sure the MCP server is also running on port 3000)`);
}); 