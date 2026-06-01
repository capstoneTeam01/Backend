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
  await client1.connect();
  await client2.connect();

  const sourceCol = client1.db(db1Name).collection(col1Name);
  const targetCol = client2.db(db2Name).collection(col2Name);

  console.log("From:", db1Name + "." + col1Name);
  console.log("To:", db2Name + "." + col2Name);
  console.log("Dry run:", dryRun);
  console.log("Limit:", limitValue || "all");
  console.log("Changing field:", createdField, "=> now");


  let cursor = sourceCol.find({});

  if (limitValue) {
    cursor = cursor.limit(Number(limitValue));
  }


  let scanned = 0;
  let copied = 0;
  const now = new Date();

  while (await cursor.hasNext()) {
    const oldDoc = await cursor.next();

    const newDoc = {
      ...oldDoc,
      [createdField]: now
    };

    scanned++;

    if (!dryRun) {
      await targetCol.replaceOne(
        { _id: newDoc._id },
        newDoc,
        { upsert: true }
      );
    }

    copied++;
  }

  console.log("Copy Summary");
  console.log("Scanned:", scanned);
  console.log("Copied/Updated:", copied);
  console.log("Dry run:", dryRun);
  console.log("created field used:", createdField);


  await client1.close();
  await client2.close();
}