import { MongoClient } from "mongodb";
import "dotenv/config";

export async function getDb() {
  const client = new MongoClient(process.env.MONGOURI);
  await client.connect();

  // simple fixed database for this beginner demo
  const db = client.db(process.env.DB_NAME);

  return { client, db };
}
