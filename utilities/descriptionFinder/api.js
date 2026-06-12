export async function getText(item) {
  const site = getSite(item);

  if (!site) {
    return { status: "no_website", urls: [], text: "" };
  }


  return { status: "testing"};
}

function getSite(item) {
  const arr = [
    item.websiteUrl,
    item.website,
    item.websiteDomain,
    item.businessWebsite,
    item.sourceUrl
  ];

  for (let i = 0; i < arr.length; i++) {
    const url = fixUrl(arr[i]);
    if (url && !isBadSite(url)) return url;
  }

  return "";
}


function fixUrl(url) {
  url = val(url);
  if (!url) return "";
  if (url.startsWith("mailto:")) return "";
  if (url.startsWith("tel:")) return "";
  if (!url.startsWith("http")) url = "https://" + url;
  return url;
}

function isBadSite(url) {
  const h = host(url);
  const bad = [
    "yelp.com",
    "facebook.com",
    "instagram.com",
    "google.com",
    "foursquare.com",
    "wheree.com",
    "bbb.org",
    "yellowpages.ca",
    "homestars.com"
  ];

  for (let i = 0; i < bad.length; i++) {
    if (h.includes(bad[i])) return true;
  }

  return false;
}

function val(x) {
  if (!x) return "";
  return String(x).trim();
}

function host(url) {
  try {
    return new URL(url).hostname.replace("www.", "").toLowerCase();
  } catch {
    return "";
  }
}

export async function askGroq(item, text) {


}