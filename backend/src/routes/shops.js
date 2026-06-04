const express = require("express");
const { getShop, updateShop } = require("../services/shopService.js");
 
const router = express.Router();
 
// GET shop
router.get("/", (req, res) => {
  const shop = getShop();
  res.json(shop);
});
 
// UPDATE shop
router.post("/", (req, res) => {
  const updatedShop = updateShop(req.body);
  res.json({
    message: "Shop updated successfully",
    data: updatedShop
  });
});
 
module.exports = router;
 