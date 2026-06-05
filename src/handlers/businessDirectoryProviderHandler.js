import mongoose from "mongoose";

const bdHealth = async (_req, res) => {
    const version = "business-directory-v1";
    res.json({
    ok: true,
    feature: "BusinessDirectoryProvider",
    databaseName: mongoose.connection.name || process.env.DB_NAME || null,
    sourceCollection: process.env.COL_NAME,
    structureVersion: version,
    message: "Business directory provider API is available",
    checkedAt: new Date().toISOString(),
  });
}

const bdSync = async (req, res) => {


}

const bdDebug = async (req, res) => {

}

export { bdHealth, bdSync, bdDebug };