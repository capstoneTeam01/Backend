const mapProvider = (item) => {
  const site = website(item);
  const sources = sourceNames(item);  
  
  

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



export { mapProvider };
