import mongoose from "mongoose";
import { colName } from "../internal/db/businessDirectoryProvider.js";
import { getList } from "../services/businessDirectoryProviderService.js";

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

    try {
    const city = req.query.city || "Vancouver";
    const cat = req.query.category || "plumber";
    const limit = req.query.limit || 20;

    const data = await getList(city, cat, limit);
    res.json(data);
    } catch (error) {
    res.status(500).json({
      ok: false,
      feature: "BusinessDirectoryProvider",
      sourceCollection: colName,
      message: "Could not load providers",
      error: error.message,
      });
    }  


}

const bdDebug = async (req, res) => {

}

export { bdHealth, bdSync, bdDebug };