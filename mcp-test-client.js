// mcp-test-client.js
import fetch from 'node-fetch';

async function main() {
  try {
    console.log('Starting MCP test client...');
    
    // Step 1: Connect to the SSE endpoint to get a connection ID
    const sseUrl = 'http://localhost:3000/sse';
    console.log(`Connecting to SSE endpoint: ${sseUrl}`);
    
    // We'll use the manual approach since we can't connect to SSE properly in Node.js without extra libraries
    const connectionId = Date.now().toString();
    console.log(`Using connection ID: ${connectionId}`);
    
    // Step 2: Call the tool via the messages endpoint
    const messagesUrl = `http://localhost:3000/messages?connectionId=${connectionId}`;
    const toolRequest = {
      id: connectionId,
      type: 'request',
      method: 'callTool',
      params: {
        name: 'get-weather',
        arguments: {
          city: 'New York'
        }
      }
    };
    
    console.log(`Sending tool request to: ${messagesUrl}`);
    console.log('Request:', JSON.stringify(toolRequest, null, 2));
    
    const response = await fetch(messagesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(toolRequest)
    });
    
    const responseData = await response.json();
    console.log('Response:', JSON.stringify(responseData, null, 2));
    
    // Step 3: As a fallback, also try the direct API
    console.log('\nTrying direct API as fallback...');
    const directApiUrl = 'http://localhost:3000/api/weather?city=New%20York';
    const directResponse = await fetch(directApiUrl);
    const directData = await directResponse.json();
    console.log('Direct API response:', JSON.stringify(directData, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 