import 'dotenv/config';

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;
const sourceColName = process.env.COL_NAME;
const cacheColName = process.env.COL_CACHE;


if (!uri || !dbName || !sourceColName || !targetColName) {
  console.log('Missing .env value. Required: MONGODB_URI, DB_NAME, COL_NAME, COL_NAME2');
  process.exit(1);
}
