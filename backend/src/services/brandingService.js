const fs = require("fs");
const path = require("path");
 
const BASE_DIR = process.env.DATA_DIR || process.cwd();
const SHOPS_DIR = path.join(BASE_DIR, "data", "shops");
 
const getShopBrandingPath = (shopId) => {
  const cleanShopId = shopId.trim();
  return path.join(SHOPS_DIR, cleanShopId, "branding.json");
};
 
const getBranding = (req, res) => {
  try {
    const { shopId } = req.params;
    const filePath = getShopBrandingPath(shopId);
    if (!fs.existsSync(filePath)) {
      return res.json({});
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to get branding", details: error.message });
  }
};
 
const updateBranding = (req, res) => {
  try {
    const { shopId } = req.params;
    const cleanShopId = shopId.trim();
    const shopDir = path.join(SHOPS_DIR, cleanShopId);
    const filePath = getShopBrandingPath(cleanShopId);
    if (!fs.existsSync(shopDir)) {
      fs.mkdirSync(shopDir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    res.json({ message: "Branding updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update branding", details: error.message });
  }
};
 
module.exports = { getBranding, updateBranding };
 