require('dotenv').config();

let MongoClient = require('mongodb').MongoClient;

async function run() {
  let client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  let db = client.db('fixbee-db1');
  await db.createCollection('serviceproviders');

  await client.close();
  console.log('setup done');
}

run();
