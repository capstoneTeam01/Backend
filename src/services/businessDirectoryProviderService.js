import mongoose from "mongoose";
import { BusinessDirectoryProviderModel, colName } from "../internal/db/businessDirectoryProvider.js";
import { key, getCities, getKeys } from "../utils/cityCluster.js";
import { mapProvider } from "../utils/businessDirectoryMapper.js";

const version = "business-directory-clean-provider-v2";

const getList = async (city = "Vancouver", cat = "plumber", limit = 20) => {
  const lim = cleanLimit(limit);
  const { q, cities, cityKeys } = makeQuery(city, cat);

  const list = await BusinessDirectoryProviderModel.find(q)
    .sort({ rating: -1, reviewCount: -1, sourceCount: -1, businessName: 1 })
    .limit(lim)
    .lean();  
  
  const sortedList = sortCityFirst(list, city);

  const providers = [];
  for (const item of list) {
    providers.push(mapProvider(item));
  }
  
  return {
    ok: true,
    feature: "BusinessDirectoryProvider",
    databaseName: mongoose.connection.name || process.env.DB_NAME || null,
    sourceCollection: colName,
    structureVersion: version,
    city,
    category: cat,
    clusterCities: cities,
    cityKeys,
    total: providers.length,
    limit: lim,
    syncedAt: new Date().toISOString(),
    providers,
  };  

};


const sortCityFirst = (list = [], city = "Vancouver") => {
  return [...list].sort((a, b) => {
    const cityDiff = cityPriority(a, city) - cityPriority(b, city);
    if (cityDiff !== 0) return cityDiff;

    const ratingDiff = safeNumber(b.rating) - safeNumber(a.rating);
    if (ratingDiff !== 0) return ratingDiff;

    const reviewDiff = safeNumber(b.reviewCount) - safeNumber(a.reviewCount);
    if (reviewDiff !== 0) return reviewDiff;

    const sourceDiff = safeNumber(b.sourceCount) - safeNumber(a.sourceCount);
    if (sourceDiff !== 0) return sourceDiff;

    return String(a.businessName || "").localeCompare(String(b.businessName || ""));
  });
};

const cityPriority = (item = {}, city = "Vancouver") => {
  const requestedCityKey = key(city);

  const providerCityKeys = [
    item.cityKey,
    item.searchCityKey,
    key(item.city),
    key(item.searchCity),
  ].filter(Boolean);

  if (providerCityKeys.includes(requestedCityKey)) return 0;

  return 1;
};

const safeNumber = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return n;
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
 
  const q = {
    $and: [
      { isDeleted: { $ne: true } },
      { availabilityStatus: { $ne: "unavailable" } },
      { availabilityStatus: { $ne: "deleted" } },
      { isClosed: { $ne: true } },
      catQuery(cat),
      cityQuery(cities, cityKeys),
    ],
  };

  return { q, cities, cityKeys };  
};

const catQuery = (cat = "plumber") => {
  const catKey = key(cat || "plumber");
  const catText = catKey.replace(/-/g, " ");
  const re = new RegExp(esc(catText), "i");

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


const cityQuery = (cityList, cityKeys) => {
  const regexList = [];

  for (const city of cityList) {
    regexList.push(new RegExp(`^${esc(city)}$`, "i"));
  }

  return {
    $or: [
      { cityKey: { $in: cityKeys } },
      { searchCityKey: { $in: cityKeys } },
      { searchCityKeys: { $in: cityKeys } },
      { city: { $in: regexList } },
      { searchCity: { $in: regexList } },
      { searchCities: { $in: regexList } },
    ],
  };
};


const esc = (txt = "") => String(txt).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export { getList };