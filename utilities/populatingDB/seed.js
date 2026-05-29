require('dotenv').config();
let MongoClient = require('mongodb').MongoClient;
let dbName = process.env.DB_NAME;
let axios = require('axios');

let category = 'plumber';
let limitPerCity = 1;

let cities = [
//   { name: 'Burnaby', lat: 49.2488, lng: -122.9805 },
//   { name: 'Surrey', lat: 49.1913, lng: -122.8490 },
//   { name: 'Richmond', lat: 49.1666, lng: -123.1336 },
//   { name: 'North Vancouver', lat: 49.3199, lng: -123.0724 },
//   { name: 'West Vancouver', lat: 49.3286, lng: -123.1602 },
//   { name: 'Coquitlam', lat: 49.2838, lng: -122.7932 },
//   { name: 'Port Coquitlam', lat: 49.2628, lng: -122.7811 },
//   { name: 'New Westminster', lat: 49.2057, lng: -122.9110 },
//   { name: 'Delta', lat: 49.0847, lng: -123.0586 },
//   { name: 'Langley', lat: 49.1044, lng: -122.6604 },
//   { name: 'Abbotsford', lat: 49.0504, lng: -122.3045 },
//   { name: 'Victoria', lat: 48.4284, lng: -123.3656 },
//   { name: 'Kelowna', lat: 49.8880, lng: -119.4960 },
//   { name: 'Nanaimo', lat: 49.1659, lng: -123.9401 },
  { name: 'Vancouver', lat: 49.2827, lng: -123.1207 }
];

async function foursquare(cityInfo) {
  let response = await axios.get('https://places-api.foursquare.com/places/search', {
    headers: {
      Authorization: 'Bearer ' + process.env.FOURSQUARE_API_KEY,
      'X-Places-Api-Version': '2025-06-17'
    },
    params: {
      query: category,
      ll: cityInfo.lat + ',' + cityInfo.lng,
      radius: 50000,
      limit: limitPerCity
    }
  });

  let places = response.data.results || [];

  console.log (places)
}


async function run() {
  let client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  let db = client.db(dbName);
  col = db.collection(process.env.COL_NAME);

   for (let i = 0; i < cities.length; i++) {
    let cityInfo = cities[i];

    console.log('city: ' + cityInfo.name);
    await foursquare(cityInfo);
  }

  await client.close();
  console.log('done');
}

run();
