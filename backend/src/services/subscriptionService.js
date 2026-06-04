const fs = require("fs");
const path = require("path");
 
const BASE_DIR = process.env.DATA_DIR || process.cwd();
 
const getFilePath = (shopId) =>
  path.join(BASE_DIR, "data", "shops", shopId, "subscription.json");
 
function getSubscription(shopId) {
  const filePath = getFilePath(shopId);
  if (!fs.existsSync(filePath)) {
    return { status: "inactive" };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
 
function updateSubscription(shopId, data) {
  const filePath = getFilePath(shopId);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return data;
}
 
module.exports = { getSubscription, updateSubscription };
 