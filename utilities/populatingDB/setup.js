require('dotenv').config();

let MongoClient = require('mongodb').MongoClient;

async function run() {
  let client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  let db = client.db(process.env.DB_NAME);
  await db.createCollection(process.env.COL_NAME);

  await client.close();
  console.log('setup done');
}

run();
