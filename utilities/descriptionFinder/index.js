import "dotenv/config";
import { getDb } from "./db.js";
import { getText, askGroq } from "./api.js";


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

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    console.log("\n" + (i + 1) + ". " + name(item));

    const siteData = await getText(item);
    console.log("Website status:", siteData.status);
    console.log("Pages used:", siteData.urls.length);
    let desc = {
      short: "",
      long: "",
      source: "official_website",
      sourceUrls: siteData.urls,
      generatedByAI: false,
      confidence: 0,
      status: siteData.status,
      lastCheckedAt: new Date()
    };
    console.log(desc)
    if (siteData.status === "text_found") {
      const ai = await askGroq(item, siteData.text);
      desc.short = ai.short;
      desc.long = ai.long;
      desc.confidence = ai.confidence;
      desc.generatedByAI = true;
      desc.status = "completed";      
    }
    const copy = {
      ...item,
      businessDescription: desc
    };                
  
    await out.replaceOne({ _id: item._id }, copy, { upsert: true });
    console.log("Saved description:", desc.short || "no description");
  }  

  await client.close();
  console.log("\nDone");
}