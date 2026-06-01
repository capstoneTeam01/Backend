import 'dotenv/config';

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;
const sourceColName = process.env.COL_NAME;
const targetColName = process.env.COL_NAME2;


if (!uri || !dbName || !sourceColName || !targetColName) {
  console.log('Missing .env value. Required: MONGODB_URI, DB_NAME, COL_NAME, COL_NAME2');
  process.exit(1);
}

main();

async function main() {

  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(dbName);
  const sourceCol = db.collection(sourceColName);
  const targetCol = db.collection(targetColName);

  console.log('Connected');
  console.log('DB:', dbName);
  console.log('Source collection:', sourceColName);
  console.log('Target collection:', targetColName);


  const sourceDocs = await sourceCol.find({ email: { $exists: true, $ne: "" } }).toArray();
  console.log('Source docs:', sourceDocs.length);

  await client.close();

}