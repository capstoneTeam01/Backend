//FIXBEE-297-Formerly-FIXBEE-198-Formatting-data-as-per-the-ERD-structure
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;
const sourceColName = process.env.COL_NAME;
const targetColName = process.env.COL_NAME2;


if (!uri || !dbName || !sourceColName || !targetColName) {
  console.log('Missing .env value. Required: MONGODB_URI, DB_NAME, COL_NAME, COL_NAME2');
  process.exit(1);
}

main();

async function main() {

  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(dbName);
  const sourceCol = db.collection(sourceColName);
  const targetCol = db.collection(targetColName);

  console.log('Connected');
  console.log('DB:', dbName);
  console.log('Source collection:', sourceColName);
  console.log('Target collection:', targetColName);


  const sourceDocs = await sourceCol.find({ email: { $exists: true, $ne: "" } }).toArray();
  console.log('Total docs:', sourceDocs.length);


  const groups = {};

  for (const doc of sourceDocs) {
    const key = makeGroupKey(doc);
    if (!groups[key]) groups[key] = [];
    groups[key].push(doc);
  }



  const cleanDocs = [];

  for (const key of Object.keys(groups)) {
    const cleanDoc = makeCleanDoc(groups[key]);
    if (cleanDoc.businessName) cleanDocs.push(cleanDoc);
  }

  const withEmail = cleanDocs.filter(doc => doc.email).length;
  console.log('Docs with email: ' + withEmail)
  await client.close();

}


function makeGroupKey(doc) {
  const name = lower(doc.businessName || doc.name);
  const city = lower(cleanCity(doc.city, getAddress(doc)));
  const phone = onlyNumbers(getPhone(doc));
  const website = cleanDomain(getWebsite(doc));

  if (website) return 'web:' + website;
  if (phone) return 'phone:' + phone;
  return 'name-city:' + name + ':' + city;
}


function lower(value) {
  return text(value).toLowerCase();
}


function onlyNumbers(value) {
  return text(value).replace(/[^0-9]/g, '');
}


function cleanDomain(website) {
  return lower(website)
    .replace('https://', '')
    .replace('http://', '')
    .replace('www.', '')
    .split('/')[0];
}



function makeCleanDoc(group) {
  const best = pickBestDoc(group);
  const address = getAddress(best);
  const now = new Date();

  const createdAt = best.createdAt ? new Date(best.createdAt) : now;

  return {
    sourceProviderId: text(best._id || best.sourceProviderId || best.sourceId),
    availabilityStatus: 'available',
    businessName: text(best.businessName || best.name),
    categoryId: Number(best.categoryId || 1),
    city: cleanCity(best.city, address),
    email: getBestEmail(group),
    isDeleted: false,
    migratedAt: now,
    phoneNumber: getPhone(best),
    providerType: cleanProviderType(best.providerType || best.category || best.primaryCategory),
    province: cleanProvince(best.province),
    rating: getBestRating(group),
    reviewCount: getBestReviewCount(group),
    serviceLocation: address,
    sourceWebsite: getSources(group),
    updatedAt: now,
    websiteUrl: getWebsite(best),
    createdAt: createdAt
  };
}


function text(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}


function cleanCity(value, address) {
  const city = text(value);
  if (city) return city;

  const lowerAddress = lower(address);
  if (lowerAddress.includes('vancouver')) return 'Vancouver';
  if (lowerAddress.includes('burnaby')) return 'Burnaby';
  if (lowerAddress.includes('richmond')) return 'Richmond';
  if (lowerAddress.includes('surrey')) return 'Surrey';
  if (lowerAddress.includes('nelson')) return 'Nelson';
  if (lowerAddress.includes('north vancouver')) return 'North Vancouver';
  if (lowerAddress.includes('west vancouver')) return 'West Vancouver';
  if (lowerAddress.includes('new westminster')) return 'New Westminster';

  return '';
}



function getBestEmail(group) {
  for (const doc of group) {
    const email = getEmail(doc);
    if (email) return email;
  }
  return '';
}



function getAddress(doc) {
  return text(doc.serviceLocation || doc.address || doc.formattedAddress);
}

function getPhone(doc) {
  return text(doc.phoneNumber || doc.phone || doc.display_phone || doc.phoneDisplay);
}

function getEmail(doc) {
  return text(doc.email || doc.businessEmail || doc.selectedEmail || doc.foundEmail);
}

function getReviewCountFromDoc(doc) {
  return Number(doc.reviewCount || doc.reviewsCount || doc.userRatingCount || doc.review_count || 0);
}

function getRatingFromDoc(doc) {
  return Number(doc.rating || doc.totalScore || 0);
}


function getBestReviewCount(group) {
  let best = 0;
  for (const doc of group) {
    const reviewCount = getReviewCountFromDoc(doc);
    if (reviewCount > best) best = reviewCount;
  }
  return best;
}



function getSources(group) {
  const sources = [];

  for (const doc of group) {
    const source = lower(doc.source || doc.sourceWebsite);
    if (!source) continue;

    const sourceParts = source.split(',').map(item => item.trim()).filter(Boolean);
    for (const item of sourceParts) {
      if (!sources.includes(item)) sources.push(item);
    }
  }

  return sources.join(', ');
}



function getWebsite(doc) {
  const website = text(doc.websiteUrl || doc.website || doc.directWebsiteUrl);
  if (!website) return '';
  if (website.startsWith('/places/')) return '';
  return website;
}



function getBestRating(group) {
  let best = 0;
  for (const doc of group) {
    const rating = getRatingFromDoc(doc);
    if (rating > best) best = rating;
  }
  return best;
}


function cleanProvince(value) {
  const province = text(value);
  if (!province) return 'British Columbia';
  if (province.toLowerCase() === 'bc') return 'British Columbia';
  if (province.toLowerCase() === 'british columbia') return 'British Columbia';
  return province;
}


function cleanProviderType(value) {
  const type = lower(value);
  if (!type) return 'plumber';
  if (type.includes('plumb')) return 'plumber';
  return type;
}


function pickBestDoc(group) {
  let bestDoc = group[0];
  let bestScore = -1;

  for (const doc of group) {
    let score = 0;

    if (getEmail(doc)) score += 50;
    if (getWebsite(doc)) score += 40;
    if (getPhone(doc)) score += 30;
    if (getAddress(doc)) score += 20;
    if (getReviewCountFromDoc(doc) > 0) score += 10;
    if (getRatingFromDoc(doc) > 0) score += 5;

    if (score > bestScore) {
      bestDoc = doc;
      bestScore = score;
    }
  }

  return bestDoc;
}
