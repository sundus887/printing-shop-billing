const express = require("express");
const { getSubscription, updateSubscription } = require("../services/subscriptionService.js");
 
const router = express.Router();
 
router.get("/:shopId", (req, res) => {
  const { shopId } = req.params;
  res.json(getSubscription(shopId));
});
 
router.put("/:shopId", (req, res) => {
  const { shopId } = req.params;
  res.json(updateSubscription(shopId, req.body));
});
 
module.exports = router;
 