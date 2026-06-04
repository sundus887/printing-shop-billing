const fs = require("fs");
const path = require("path");
const readline = require("readline");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeFilePart(s) {
  return String(s || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);
}

function parseDurationChoice(input) {
  const v = String(input || "").trim().toLowerCase();
  if (v === "1" || v === "1m" || v.includes("1") || v.includes("month")) return { months: 1, plan: "monthly" };
  if (v === "2" || v === "6" || v === "6m" || v.includes("6") || v.includes("6 month")) return { months: 6, plan: "6months" };
  if (v === "3" || v === "12" || v === "12m" || v.includes("12") || v.includes("12 month") || v.includes("year")) return { months: 12, plan: "yearly" };
  return null;
}

function addMonthsUTC(date, monthsToAdd) {
  const d = new Date(date.getTime());
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();

  const targetMonthIndex = m + Number(monthsToAdd);
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Clamp day to last day of target month
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);

  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    clampedDay,
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds()
  ));
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  try {
    const machineId = String(await ask("Enter Machine ID: ")).trim();
    if (!machineId) {
      console.error("Machine ID is required.");
      process.exitCode = 1;
      return;
    }

    console.log("Select plan duration:");
    console.log("  1) 1 month");
    console.log("  2) 6 months");
    console.log("  3) 12 months");

    const choiceRaw = await ask("Enter choice (1/2/3): ");
    const choice = parseDurationChoice(choiceRaw);
    if (!choice) {
      console.error("Invalid choice. Please enter 1, 2, or 3.");
      process.exitCode = 1;
      return;
    }

    const now = new Date();
    const expiryDate = addMonthsUTC(now, choice.months);

    const license = {
      type: "subscription",
      machineId,
      activatedAt: now.toISOString(),
      expiry: expiryDate.toISOString(),
      plan: choice.plan,
    };

    const outDir = path.join(__dirname, "output");
    ensureDir(outDir);

    const safeId = sanitizeFilePart(machineId);
    const outPath = path.join(outDir, `license-${safeId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(license, null, 2), "utf-8");

    console.log("\nLicense file generated:");
    console.log(outPath);
    console.log("Expiry:");
    console.log(license.expiry);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
