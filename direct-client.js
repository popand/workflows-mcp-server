// direct-client.js
import fetch from 'node-fetch';

// Function to get weather data
async function getWeather(city) {
  try {
    console.log(`Fetching weather for ${city}...`);
    
    // Call the direct weather API
    const response = await fetch(`http://localhost:3000/api/weather?city=${encodeURIComponent(city)}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Server error response: ${errorText}`);
      throw new Error(`Failed to fetch weather: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Weather result:', result);
    
    return result.response;
  } catch (error) {
    console.error('Error fetching weather:', error);
    throw error;
  }
}

// Run the example
async function main() {
  try {
    console.log('=== Using direct API endpoint ===');
    
    const nyWeather = await getWeather('New York');
    console.log('\nNew York weather:', nyWeather);
    
    const londonWeather = await getWeather('London');
    console.log('\nLondon weather:', londonWeather);
    
    const tokyoWeather = await getWeather('Tokyo');
    console.log('\nTokyo weather:', tokyoWeather);
    
    console.log('\nAll weather data fetched successfully!');
  } catch (error) {
    console.error('Main error:', error);
  }
}

main().catch(console.error); 