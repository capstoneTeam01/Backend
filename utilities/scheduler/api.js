require('dotenv').config();

const { score } = require('./score');

function pickBest(item, list) {
  if (!list || list.length === 0) return null;

  let best = list[0];
  let bestScore = score(item, best);

  for (let i = 1; i < list.length; i++) {
    let pts = score(item, list[i]);
    if (pts > bestScore) {
      best = list[i];
      bestScore = pts;
    }
  }

  return best;
}

function makeGoogle(item, p) {
  let name = '';
  if (p.displayName) name = p.displayName.text;

  let lat = null;
  let lng = null;
  if (p.location) {
    lat = p.location.latitude;
    lng = p.location.longitude;
  }

  return {
    source: 'google',
    sourceId: p.id || null,
    businessName: name,
    phone: p.internationalPhoneNumber || p.nationalPhoneNumber || null,
    website: p.websiteUri || null,
    address: p.formattedAddress || null,
    city: item.city,
    rating: p.rating || null,
    reviewCount: p.userRatingCount || null,
    latitude: lat,
    longitude: lng,
    categories: p.types || [],
    sourceUrl: p.googleMapsUri || null
  };
}

async function google(item) {
  let key = process.env.GOOGLE_PLACES_API_KEY;
  let q = item.businessName + ' ' + item.city + ' ' + item.province + ' Canada';
  let url = 'https://places.googleapis.com/v1/places:searchText';

  let res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.location,places.types'
    },
    body: JSON.stringify({ textQuery: q, pageSize: 5 })
  });

  let data = await res.json();
  if (!data.places || data.places.length === 0) return null;

  let list = [];
  for (let i = 0; i < data.places.length; i++) {
    list.push(makeGoogle(item, data.places[i]));
  }

  return pickBest(item, list);
}

function makeYelp(item, p) {
  let address = '';
  if (p.location && p.location.display_address) {
    address = p.location.display_address.join(', ');
  }

  let cats = [];
  if (p.categories) {
    for (let i = 0; i < p.categories.length; i++) {
      cats.push(p.categories[i].title);
    }
  }

  let lat = null;
  let lng = null;
  if (p.coordinates) {
    lat = p.coordinates.latitude;
    lng = p.coordinates.longitude;
  }

  let city = item.city;
  if (p.location && p.location.city) city = p.location.city;

  return {
    source: 'yelp',
    sourceId: p.id || null,
    businessName: p.name || null,
    phone: p.display_phone || p.phone || null,
    website: p.url || null,
    address: address,
    city: city,
    rating: p.rating || null,
    reviewCount: p.review_count || null,
    latitude: lat,
    longitude: lng,
    categories: cats,
    sourceUrl: p.url || null
  };
}

async function yelp(item) {
  let key = process.env.YELP_API_KEY;
  let q = encodeURIComponent(item.businessName);
  let loc = encodeURIComponent(item.city + ', BC, Canada');
  let url = 'https://api.yelp.com/v3/businesses/search?term=' + q + '&location=' + loc + '&limit=5';

  let res = await fetch(url, {
    headers: {
      Authorization: 'Bearer ' + key
    }
  });

  let data = await res.json();
  if (!data.businesses || data.businesses.length === 0) return null;

  let list = [];
  for (let i = 0; i < data.businesses.length; i++) {
    list.push(makeYelp(item, data.businesses[i]));
  }

  return pickBest(item, list);
}

function makeFour(item, p) {
  let address = '';
  if (p.location && p.location.formatted_address) address = p.location.formatted_address;

  let cats = [];
  if (p.categories) {
    for (let i = 0; i < p.categories.length; i++) {
      cats.push(p.categories[i].name);
    }
  }

  let lat = null;
  let lng = null;
  if (p.geocodes && p.geocodes.main) {
    lat = p.geocodes.main.latitude;
    lng = p.geocodes.main.longitude;
  }

  let city = item.city;
  if (p.location && p.location.locality) city = p.location.locality;

  return {
    source: 'foursquare',
    sourceId: p.fsq_id || null,
    businessName: p.name || null,
    phone: p.tel || null,
    website: p.website || null,
    address: address,
    city: city,
    rating: null,
    reviewCount: null,
    latitude: lat,
    longitude: lng,
    categories: cats,
    sourceUrl: p.link || null
  };
}

async function foursquare(item) {
  let key = process.env.FOURSQUARE_API_KEY;
  let q = encodeURIComponent(item.businessName);
  let near = encodeURIComponent(item.city + ', BC, Canada');
  let fields = 'fsq_id,name,tel,website,location,geocodes,categories,link';
  let url = 'https://api.foursquare.com/v3/places/search?query=' + q + '&near=' + near + '&limit=5&fields=' + fields;

  let res = await fetch(url, {
    headers: {
      Authorization: key
    }
  });

  let data = await res.json();
  if (!data.results || data.results.length === 0) return null;

  let list = [];
  for (let i = 0; i < data.results.length; i++) {
    list.push(makeFour(item, data.results[i]));
  }

  return pickBest(item, list);
}

function makeApify(item, p) {
  let lat = null;
  let lng = null;
  if (p.location) {
    lat = p.location.lat;
    lng = p.location.lng;
  }

  let cats = [];
  if (p.categoryName) cats.push(p.categoryName);
  if (p.categories && p.categories.length > 0) cats = p.categories;

  return {
    source: 'apify',
    sourceId: p.placeId || null,
    businessName: p.title || null,
    phone: p.phone || p.phoneUnformatted || null,
    website: p.website || null,
    address: p.address || null,
    city: p.city || item.city,
    rating: p.totalScore || null,
    reviewCount: p.reviewsCount || null,
    latitude: lat,
    longitude: lng,
    categories: cats,
    sourceUrl: p.url || null
  };
}

async function apify(item) {
  let key = process.env.APIFY_TOKEN;
  let q = item.businessName + ' ' + item.city + ' ' + item.province + ' Canada';
  let actor = 'compass~google-maps-extractor';
  let url = 'https://api.apify.com/v2/acts/' + actor + '/runs?waitForFinish=90';

  let body = {
    searchStringsArray: [q],
    maxCrawledPlacesPerSearch: 3,
    maxItems: 3
  };

  let res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  let data = await res.json();
  let datasetId = data.data.defaultDatasetId;
  let itemUrl = 'https://api.apify.com/v2/datasets/' + datasetId + '/items?clean=true&limit=3';
  let res2 = await fetch(itemUrl);
  let arr = await res2.json();

  if (!arr || arr.length === 0) return null;

  let list = [];
  for (let i = 0; i < arr.length; i++) {
    list.push(makeApify(item, arr[i]));
  }

  return pickBest(item, list);
}

async function check(item, src) {
  if (src === 'google') return await google(item);
  if (src === 'yelp') return await yelp(item);
  if (src === 'foursquare') return await foursquare(item);
  if (src === 'apify') return await apify(item);
  return null;
}

module.exports = { check };
