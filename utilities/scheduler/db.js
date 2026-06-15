require('dotenv').config();

const { MongoClient, ObjectId } = require('mongodb');

let client;

async function getDb() {
  client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  return client.db(process.env.DB_NAME);
}

async function closeDb() {
  await client.close();
}

module.exports = {
  getDb,
  closeDb,
  ObjectId
};
