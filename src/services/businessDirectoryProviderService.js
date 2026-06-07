import mongoose from "mongoose";
import { BusinessDirectoryProviderModel, colName } from "../internal/db/businessDirectoryProvider.js";
import { key, getCities, getKeys } from "../utils/cityCluster.js";

const getList = async (city = "Vancouver", cat = "plumber", limit = 20) => {
  const lim = cleanLimit(limit);
  const { q, cities, cityKeys } = makeQuery(city, cat);

};



const cleanLimit = (limit) => {
  const n = Number(limit);

  if (!Number.isFinite(n) || n < 1) return 20;
  if (n > 100) return 100;
  return n;
};



const makeQuery = (city = "Vancouver", cat = "plumber") => {
  const cities = getCities(city);
  const cityKeys = getKeys(cities);
  console.log(cities);
  console.log(cityKeys);

  catQuery(cat);
  
};

const catQuery = (cat = "plumber") => {
  const catKey = key(cat || "plumber");
  const catText = catKey.replace(/-/g, " ");

  console.log(catText);


};
const esc = (txt = "") => String(txt).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");