import "dotenv/config";

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


}