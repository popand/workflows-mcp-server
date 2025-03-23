import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { getWeather } from './api.js';

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

// Set up the Express server for HTTP transport
const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing for request bodies
app.use(express.json());

// Add a direct weather API endpoint (simpler alternative to MCP)
app.get('/api/weather', (req: Request, res: Response) => {
  const city = req.query.city;
  
  if (!city) {
    return res.status(400).json({ error: 'City parameter is required' });
  }
  
  getWeather(String(city))
    .then((weatherInfo) => {
      res.json({ response: weatherInfo });
    })
    .catch((error) => {
      console.error('Error fetching weather:', error);
      res.status(500).json({ 
        error: 'Failed to fetch weather data',
        details: error instanceof Error ? error.message : String(error)
      });
    });
});

// Store active SSE connections
const connections = new Map<string, { res: Response, transport: SSEServerTransport }>();

// SSE connection for MCP clients
app.get('/sse', (req: Request, res: Response) => {
  const connectionId = (req.query.connectionId as string) || Date.now().toString();
  
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
    transport 
  });
  
  // Handle client disconnect
  req.on('close', () => {
    console.log(`Client ${connectionId} disconnected`);
    connections.delete(connectionId);
  });
  
  // Connect server to transport
  server.connect(transport)
    .then(() => {
      console.log(`MCP server connected for client ${connectionId}`);
      // Send ready event
      res.write(`event: ready\ndata: {"status": "ready"}\n\n`);
    })
    .catch((err: Error) => {
      console.error(`Error connecting server to transport: ${err}`);
    });
});

// Handle messages from clients
app.post('/messages', (req: Request, res: Response) => {
  const connectionId = req.query.connectionId as string;
  
  if (!connectionId || !connections.has(connectionId)) {
    return res.status(400).json({ 
      error: 'Invalid or missing connection ID' 
    });
  }
  
  try {
    console.log(`Received message request: ${JSON.stringify(req.body)}`);
    
    // Get the SSE connection for this client
    const connection = connections.get(connectionId);
    
    if (!connection) {
      return res.status(400).json({ error: 'Connection not found' });
    }
    
    // Just acknowledge receipt - the response will go via SSE
    res.status(200).json({ received: true });
    
    // Get the message handler from the server
    const messageHandler = (server as any).handleMessage;
    if (typeof messageHandler === 'function') {
      // Handle the message asynchronously
      messageHandler.call(server, req.body, connection.transport)
        .catch((err: Error) => {
          console.error(`Error handling message: ${err}`);
        });
    } else {
      console.error('handleMessage method not found on server');
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
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok', 
    uptime: process.uptime(),
    serverName: 'weather-mcp-server',
    version: '1.0.0'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Weather MCP server listening on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Messages endpoint: http://localhost:${PORT}/messages?connectionId=YOUR_CONNECTION_ID`);
  console.log(`Direct weather API: http://localhost:${PORT}/api/weather?city=New%20York`);
}); 