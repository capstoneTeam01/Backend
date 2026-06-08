import { colName } from "../internal/db/businessDirectoryProvider.js";

const mapProvider = (item) => {
  const site = website(item);
  const sources = sourceNames(item);  
  const cats = arr(item.categories);
  const mainCat = item.providerType || item.primaryCategory || cats[0] || null;
  console.log(mainCat)
  
    return {
    id: String(item._id),
    mongoId: String(item._id),
    sourceProviderId: item.sourceProviderId || item.sourceId || null,

    businessName: item.businessName || item.name || "Unknown Provider",
    nameKey: item.nameKey || null,

    categoryId: num(item.categoryId),
    primaryCategory: mainCat,
    providerType: mainCat,
    categories: cats,
    businessCategories: arr(item.businessCategories),
    sourceCategories: arr(item.sourceCategories),
    systemTags: arr(item.systemTags),

    email: item.email || null,
    phoneDisplay: phone(item),
    phoneNormalized: item.phoneNormalized || item.phoneNumber || null,

    websiteUrl: site,
    directWebsiteUrl: item.directWebsiteUrl || site,
    websiteDomain: item.websiteDomain || null,
    listingUrl: item.listingUrl || item.sourceUrl || site,
    hasDirectWebsite: Boolean(site),

    imageUrl: item.imageUrl || null,
    address: address(item),
    serviceLocation: address(item),
    addressKey: item.addressKey || null,

    city: item.city || item.searchCity || null,
    cityKey: item.cityKey || null,
    searchCity: item.searchCity || item.city || null,
    searchCities: arr(item.searchCities),
    province: item.province || "British Columbia",
    provinceCode: item.provinceCode || "BC",
    countryCode: item.countryCode || item.country || "CA",

    rating: rating(item),
    reviewCount: reviewCount(item),
    reviewCountSourceField: reviewSource(item),

    availabilityStatus: item.availabilityStatus || null,
    isClosed: bool(item.isClosed) || item.availabilityStatus === "closed",
    isDeleted: bool(item.isDeleted),

    latitude: coord(item, 1),
    longitude: coord(item, 0),

    sourceWebsite: item.sourceWebsite || null,
    sourceNames: sources,
    sourceCount: num(item.sourceCount) ?? sources.length,
    sourceTrustScore: num(item.sourceTrustScore),

    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    migratedAt: item.migratedAt || null,
    lastSyncedAt: item.updatedAt || item.migratedAt || item.createdAt || null,
    lastVerifiedAt: item.lastVerifiedAt || item.updatedAt || null,
  };
}



const website = (item) =>
  item.websiteUrl || item.website || item.websiteUri || item.directWebsiteUrl || null;


const sourceNames = (item) => {
  const list = [...arr(item.sourceWebsite), ...arr(item.sourceNames), ...arr(item.source)];
  const out = [];

  for (const name of list) {
    const clean = String(name).trim().toLowerCase();
    if (clean && !out.includes(clean)) out.push(clean);
  }

  return out;
};

const arr = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);

  return String(val)
    .split(/[,|;/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};


const num = (val) => {
  if (val === null || val === undefined || val === "") return null;

  const n = Number(val);
  if (Number.isNaN(n)) return null;
  return n;
};


const bool = (val) => val === true || val === "true" || val === 1;

const address = (item) =>
  item.serviceLocation || item.address || item.locationText || item.formattedAddress || null;

const phone = (item) =>
  item.phoneNumber || item.phoneDisplay || item.phone || item.displayPhone || item.display_phone || null;

const rating = (item) => num(item.rating ?? item.totalScore ?? item.googleRating);

const reviewCount = (item) =>
  num(
    item.reviewCount ??
      item.reviewsCount ??
      item.googleReviewCount ??
      item.userRatingCount ??
      item.review_count
  );

const reviewSource = (item) => {
  if (item.reviewCount !== undefined && item.reviewCount !== null) return `${colName}.reviewCount`;
  if (item.reviewsCount !== undefined && item.reviewsCount !== null) return `${colName}.reviewsCount`;
  if (item.googleReviewCount !== undefined && item.googleReviewCount !== null) return `${colName}.googleReviewCount`;
  if (item.userRatingCount !== undefined && item.userRatingCount !== null) return `${colName}.userRatingCount`;
  if (item.review_count !== undefined && item.review_count !== null) return `${colName}.review_count`;
  return null;
};

const coord = (item, index) => {
  if (item.location && Array.isArray(item.location.coordinates)) {
    return num(item.location.coordinates[index]);
  }

  if (index === 0) return num(item.longitude ?? item.lng);
  return num(item.latitude ?? item.lat);
};


export { mapProvider };
