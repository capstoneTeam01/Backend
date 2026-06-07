import mongoose from "mongoose";
import { BusinessDirectoryProviderModel, colName } from "../internal/db/businessDirectoryProvider.js";


const getList = async (city = "Vancouver", cat = "plumber", limit = 20) => {
  const lim = cleanLimit(limit);

};



const cleanLimit = (limit) => {
  const n = Number(limit);

  if (!Number.isFinite(n) || n < 1) return 20;
  if (n > 100) return 100;
  return n;
};

