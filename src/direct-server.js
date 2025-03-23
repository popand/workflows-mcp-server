// src/direct-server.js
import express from 'express';
import { getWeather } from './api.js';

// Create a simple Express server
const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing for request bodies
app.use(express.json());

// Simple endpoint to get weather
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
        details: error instanceof Error ? error.message : String(error)
      });
    });
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
  console.log(`Weather API server listening on port ${PORT}`);
  console.log(`Weather API: http://localhost:${PORT}/api/weather?city=New%20York`);
  console.log(`Health check: http://localhost:${PORT}/health`);
}); 