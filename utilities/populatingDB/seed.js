require('dotenv').config();
let MongoClient = require('mongodb').MongoClient;
let dbName = process.env.DB_NAME;



async function run() {
  let client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  let db = client.db(dbName);
  col = db.collection(process.env.COL_NAME);

  await client.close();
  console.log('done');
}

run();
