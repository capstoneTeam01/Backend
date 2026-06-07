import mongoose from "mongoose";
import { BusinessDirectoryProviderModel, colName } from "../internal/db/businessDirectoryProvider.js";
import { key, getCities, getKeys } from "../utils/cityCluster.js";
import { mapProvider } from "../utils/businessDirectoryMapper.js";

const getList = async (city = "Vancouver", cat = "plumber", limit = 20) => {
  const lim = cleanLimit(limit);
  const { q, cities, cityKeys } = makeQuery(city, cat);

  const list = await BusinessDirectoryProviderModel.find(q)
    .sort({ rating: -1, reviewCount: -1, sourceCount: -1, businessName: 1 })
    .limit(lim)
    .lean();  

  console.log(list)
  
  const providers = [];
  for (const item of list) {
    providers.push(mapProvider(item));
  }  

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
  const re = new RegExp(esc(catText), "i");

  console.log(catText);
  console.log(re);


  const list = [
    { providerType: re },
    { primaryCategory: re },
    { categories: re },
    { businessCategories: re },
    { sourceCategories: re },
    { systemTags: re },
  ];

  if (catKey === "plumber" || catKey === "plumbers" || catKey === "plumbing") {
    list.unshift({ categoryId: 1 });
  }

  return { $or: list };


};
const esc = (txt = "") => String(txt).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");