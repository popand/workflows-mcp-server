import fetch from 'node-fetch';

// Updated to use the webhook endpoint that works
const API_BASE_URL = 'https://primary-production-0ff8.up.railway.app/webhook';

/**
 * Fetches weather information for a specified city
 */
export async function getWeather(city: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/weather?city=${encodeURIComponent(city)}`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json() as { response: string };
    return data.response;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw new Error(`Failed to fetch weather data for ${city}: ${error instanceof Error ? error.message : String(error)}`);
  }
} 