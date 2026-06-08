const mapProvider = (item) => {
  const site = website(item);
  const sources = sourceNames(item);  
  const cats = arr(item.categories);
  const mainCat = item.providerType || item.primaryCategory || cats[0] || null;
  console.log(mainCat)
  

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




export { mapProvider };
