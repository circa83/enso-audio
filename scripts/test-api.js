// src/scripts/test-api.js
const fetch = require('node-fetch');

// Base URL for the API
const API_BASE_URL = 'http://localhost:3000/api';

// Helper function to make API requests
async function apiRequest(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  };
  
  console.log(`Making ${method} request to ${url}`);
  if (body) console.log('Request body:', JSON.stringify(body, null, 2));
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    console.log(`Response status: ${response.status}`);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    return { status: response.status, data };
  } catch (error) {
    console.error(`Error with request to ${url}:`, error);
    return { error: error.message };
  }
}

// Test functions for each endpoint
async function testListCollections() {
  console.log('\n=== Testing List Collections ===');
  await apiRequest('/collections');
}

async function testCreateCollection() {
  console.log('\n=== Testing Create Collection ===');
  const collection = {
    id: "ambient-waves",
    name: "Ambient Waves",
    description: "Gentle ambient soundscapes with flowing textures",
    coverImage: "/collections/ambient-waves/cover/main.png",
    metadata: {
      artist: "Ensō Audio",
      year: 2025,
      tags: ["ambient", "waves", "meditation"]
    }
  };
  await apiRequest('/collections', 'POST', collection);
}

async function testGetCollection(id) {
  console.log(`\n=== Testing Get Collection ${id} ===`);
  await apiRequest(`/collections/${id}`);
}

async function testUpdateCollection(id) {
  console.log(`\n=== Testing Update Collection ${id} ===`);
  const updates = {
    name: "Ambient Waves (Updated)",
    description: "Updated description with new details"
  };
  await apiRequest(`/collections/${id}`, 'PUT', updates);
}

async function testAddTrack(collectionId) {
  console.log(`\n=== Testing Add Track to Collection ${collectionId} ===`);
  const track = {
    id: "drone-wave-01",
    title: "Ocean Drone",
    audioUrl: `/collections/${collectionId}/Layer_1/drone.mp3`,
    layerType: "drone",
    variations: [
      {
        id: "drone-wave-01-var1",
        title: "Ocean Drone Variation 1",
        audioUrl: `/collections/${collectionId}/Layer_1/drone_01.mp3`
      }
    ]
  };
  await apiRequest(`/collections/${collectionId}/tracks`, 'POST', track);
}

async function testListTracks(collectionId) {
  console.log(`\n=== Testing List Tracks for Collection ${collectionId} ===`);
  await apiRequest(`/collections/${collectionId}/tracks`);
}

async function testUpdateTrack(trackId) {
  console.log(`\n=== Testing Update Track ${trackId} ===`);
  const updates = {
    title: "Deep Ocean Drone",
    variations: [
      {
        id: "drone-wave-01-var1",
        title: "Deep Ocean Drone Variation 1",
        audioUrl: "/collections/ambient-waves/Layer_1/drone_01.mp3"
      },
      {
        id: "drone-wave-01-var2",
        title: "Deep Ocean Drone Variation 2",
        audioUrl: "/collections/ambient-waves/Layer_1/drone_02.mp3"
      }
    ]
  };
  await apiRequest(`/tracks/${trackId}`, 'PUT', updates);
}

// Run all tests
async function runTests() {
  try {
    // Test collections endpoints
    await testListCollections();
    await testCreateCollection();
    await testGetCollection('ambient-waves');
    await testUpdateCollection('ambient-waves');
    
    // Test tracks endpoints
    await testAddTrack('ambient-waves');
    await testListTracks('ambient-waves');
    await testUpdateTrack('drone-wave-01');
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Test execution error:', error);
  }
}

// Run the tests
runTests();