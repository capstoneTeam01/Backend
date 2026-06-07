import mongoose from "mongoose";

const colName = process.env.COL_NAME || "serviceprovidersTest";

const ProviderSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    collection: colName,
  }
);

const modelName = `BusinessDirectoryProvider_${colName.replace(/[^a-zA-Z0-9]/g, "_")}`;

const BusinessDirectoryProviderModel =
  mongoose.models[modelName] || mongoose.model(modelName, ProviderSchema, colName);

export { colName, BusinessDirectoryProviderModel };
