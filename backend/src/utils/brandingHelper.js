import fs from "fs";
import path from "path";

const BASE_DIR = process.env.DATA_DIR || process.cwd();

export const getBranding = (shopId) => {
  const brandingPath = path.join(
    BASE_DIR,
    "data",
    "shops",
    shopId,
    "branding.json"
  );

  if (!fs.existsSync(brandingPath)) {
    return {
      layout: "classic",
      paper: "A4",
      font: "Helvetica",
      header: "Invoice",
      footer: "",
      logo: null
    };
  }

  return JSON.parse(fs.readFileSync(brandingPath, "utf8"));
};

