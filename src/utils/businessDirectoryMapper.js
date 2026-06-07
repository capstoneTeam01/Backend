const mapProvider = (item) => {
    const site = website(item);

}



const website = (item) =>
  item.websiteUrl || item.website || item.websiteUri || item.directWebsiteUrl || null;






export { mapProvider };
