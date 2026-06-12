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