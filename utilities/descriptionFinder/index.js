import "dotenv/config";
import { getDb } from "./db.js";


const oldCol = process.env.COL_NAME;
const newCol = process.env.ENRICHED_COL_NAME;
const limit = Number(process.env.LIMIT);


run();

async function run() {

    if (!process.env.MONGOURI || !process.env.GROQ_API_KEY) {
        console.log("Please add mongoDBURI and GROQ_API_KEY in .env");
        return;
    }

  console.log("FixBee beginner business description script");
  console.log("Reading from:", oldCol);
  console.log("Saving into:", newCol);

  const { client, db } = await getDb(); 
  
  const col = db.collection(oldCol);
  const out = db.collection(newCol);

  let q = col.find({ isDeleted: { $ne: true } }).sort({ reviewCount: -1 });

  if (limit > 0) {
    q = q.limit(limit);
  }

  const list = await q.toArray();

  console.log("Providers found:", list.length);





  await client.close();
  console.log("\nDone");


}