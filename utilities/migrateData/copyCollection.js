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
