require("dotenv").config();


const mongo1 = process.env.mongo1;
const mongo2 = process.env.mongo2;

const db1Name = process.env.DB1;
const db2Name = process.env.DB2;

const col1Name = process.env.COL1;
const col2Name = process.env.COL2;

const dryRun = process.env.DRY_RUN === "true";
const limitValue = process.env.LIMIT;
const createdField = process.env.CREATED_FIELD || "createdDate";


if (!mongo1 || !mongo2 || !db1Name || !db2Name || !col1Name || !col2Name) {
  console.log("Missing .env values. Check mongo1, mongo2, DB1, DB2, COL1, COL2.");
  return;
}

run();

async function run() {

}