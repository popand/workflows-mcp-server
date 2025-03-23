// mcp-direct-server.js
import express from 'express';
import fetch from 'node-fetch';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';

// Function to get weather data from the specified API
async function getWeather(city) {
  try {
    console.log(`Fetching real weather data for ${city}...`);
    
    // Use the specific API endpoint requested
    const apiUrl = `https://primary-production-0ff8.up.railway.app/webhook/weather?city=${encodeURIComponent(city)}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw new Error(`Failed to fetch weather data for ${city}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Create an MCP server instance
const server = new McpServer({
  name: 'weather-mcp-server',
  version: '1.0.0'
});

// Register the weather tool
server.tool(
  'get-weather',
  { 
    city: z.string().describe('The name of the city to get weather information for')
  },
  async ({ city }) => {
    try {
      const weatherInfo = await getWeather(city);
      
      return {
        content: [{ 
          type: 'text', 
          text: weatherInfo
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        content: [{ 
          type: 'text', 
          text: `Error fetching weather data: ${errorMessage}`
        }],
        isError: true
      };
    }
  }
);

// Add a sample prompt to demonstrate how to use the tool
server.prompt(
  'check-weather',
  { 
    city: z.string().describe('The name of the city to check weather for')
  },
  ({ city }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Please use the get-weather tool to check the current weather in ${city} and summarize it for me.`
      }
    }]
  })
);

// Create a simple Express server
const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing for request bodies
app.use(express.json());

// Add CORS support for the HTML client
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Simple endpoint to get weather (direct API)
app.get('/api/weather', function(req, res) {
  const city = req.query.city;
  
  if (!city) {
    return res.status(400).json({ error: 'City parameter is required' });
  }
  
  getWeather(String(city))
    .then(function(weatherInfo) {
      res.json({ response: weatherInfo });
    })
    .catch(function(error) {
      console.error('Error fetching weather:', error);
      res.status(500).json({ 
        error: 'Failed to fetch weather data',
        details: error.message || String(error)
      });
    });
});

// Store active SSE connections
const connections = new Map();

// SSE connection for MCP clients
app.get('/sse', function(req, res) {
  const connectionId = req.query.connectionId || Date.now().toString();
  
  console.log(`Setting up SSE connection for client ${connectionId}`);
  
  // Set up SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  // Send initial connection message
  res.write(`event: connection\ndata: {"connectionId": "${connectionId}"}\n\n`);
  
  // Create transport
  const transport = new SSEServerTransport('/messages', res);
  
  // Store the connection
  connections.set(connectionId, { 
    res, 
    transport,
    connected: false
  });
  
  // Handle client disconnect
  req.on('close', function() {
    console.log(`Client ${connectionId} disconnected`);
    connections.delete(connectionId);
  });
  
  // Connect server to transport without waiting
  Promise.resolve().then(async () => {
    try {
      await server.connect(transport);
      const conn = connections.get(connectionId);
      if (conn) {
        conn.connected = true;
        console.log(`MCP server connected for client ${connectionId}`);
        res.write(`event: ready\ndata: {"status": "ready"}\n\n`);
      }
    } catch (err) {
      console.error(`Error connecting server to transport: ${err}`);
    }
  });
});

// Handle messages from clients
app.post('/messages', function(req, res) {
  const connectionId = req.query.connectionId;
  
  if (!connectionId || !connections.has(connectionId)) {
    return res.status(400).json({ 
      error: 'Invalid or missing connection ID' 
    });
  }
  
  try {
    const connection = connections.get(connectionId);
    
    if (!connection) {
      return res.status(400).json({ error: 'Connection not found' });
    }
    
    if (!connection.connected) {
      return res.status(400).json({ error: 'SSE connection not established yet' });
    }
    
    console.log(`Received message request:`, req.body);
    
    // Just acknowledge receipt - the response will go via SSE
    res.status(200).json({ received: true });
    
    // Process the request asynchronously
    if (typeof server.handleMessage === 'function') {
      server.handleMessage(req.body, connection.transport)
        .catch(err => {
          console.error(`Error handling message: ${err}`);
        });
    } else {
      console.error('Error: handleMessage function not found on server');
      // Try to respond with an error through the transport
      try {
        connection.res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'Server does not support handleMessage'
        })}\n\n`);
      } catch (err) {
        console.error('Error sending error message:', err);
      }
    }
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ 
      error: 'Failed to process message', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Add a simple health check endpoint
app.get('/health', function(req, res) {
  res.json({
    status: 'ok', 
    uptime: process.uptime(),
    serverName: 'weather-api-server',
    version: '1.0.0'
  });
});

// Start the server
app.listen(PORT, function() {
  console.log(`Weather MCP server listening on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Messages endpoint: http://localhost:${PORT}/messages?connectionId=YOUR_CONNECTION_ID`);
  console.log(`Weather API: http://localhost:${PORT}/api/weather?city=New%20York`);
  console.log(`Health check: http://localhost:${PORT}/health`);
}); 