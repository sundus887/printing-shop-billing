const express = require("express");
const cors = require("cors");

// Routes
const shopRoutes = require("./routes/shops.js");
const brandingRoutes = require("./routes/branding.js");
const invoiceRoutes = require("./routes/invoices.js");
const subscriptionRoutes = require("./routes/subscription.js");
const systemRoutes = require("./routes/system.js");
const localLicenseRoutes = require("./routes/localLicense.js");

const createApp = () => {
  const app = express();

  // Middlewares
  app.use(cors());
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Routes
  app.use("/api/shops", shopRoutes);
  app.use("/api/branding", brandingRoutes);
  app.use("/api/subscription", subscriptionRoutes);
  app.use("/api/invoices", invoiceRoutes);
  app.use("/api/system", systemRoutes);
  app.use("/api/license", localLicenseRoutes);

  app.get("/", (req, res) => {
    res.status(200).send("✅ Printing Shop Backend Running");
  });

  return app;
};

const startServer = (port = 3000) => {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`🚀 Backend running on http://localhost:${port}`);
  });
};

// Direct run check
if (require.main === module) {
  startServer(Number(process.env.PORT) || 3000);
}

module.exports = { createApp, startServer };