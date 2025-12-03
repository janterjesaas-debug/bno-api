// routes/mewsAvailability.js
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

// Hjelpefunksjon: bygg First/LastTimeUnitStartUtc slik vi fant ut i PowerShell
function buildTimeRange(fromStr, toStr) {
  // fromStr, toStr: "YYYY-MM-DD"
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);

  // First = (From - 1 dag) kl 23:00Z
  const firstDate = new Date(Date.UTC(fy, fm - 1, fd - 1, 23, 0, 0));
  // Last  = (To   - 1 dag) kl 23:00Z
  const lastDate = new Date(Date.UTC(ty, tm - 1, td - 1, 23, 0, 0));

  const first = firstDate.toISOString().replace(/\.\d{3}Z$/, ".000Z");
  const last = lastDate.toISOString().replace(/\.\d{3}Z$/, ".000Z");

  return { first, last };
}

// Konfig for alle områder
const SERVICE_CONFIG = [
  {
    label: "Trysil Turistsenter",
    envKey: "MEWS_SERVICE_ID_TRYSIL_TURISTSENTER",
  },
  {
    label: "Trysil Høyfjellssenter",
    envKey: "MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER",
  },
  {
    label: "Trysilfjell Hytteområde",
    envKey: "MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE",
  },
  {
    label: "Tandådalen Sälen",
    envKey: "MEWS_SERVICE_ID_TANDADALEN_SALEN",
  },
  {
    label: "Högfjället Sälen",
    envKey: "MEWS_SERVICE_ID_HOGFJALLET_SALEN",
  },
  {
    label: "Lindvallen Sälen",
    envKey: "MEWS_SERVICE_ID_LINDVALLEN_SALEN",
  },
];

router.get("/", async (req, res) => {
  try {
    const from = req.query.from;       // "YYYY-MM-DD"
    const to = req.query.to;           // "YYYY-MM-DD"
    const serviceIdParam = req.query.serviceId || null; // kan være tom

    if (!from || !to) {
      return res.status(400).json({
        error: "Missing required query params: from, to (YYYY-MM-DD)",
      });
    }

    const {
      MEWS_BASE_URL,
      MEWS_CLIENT_NAME,
      MEWS_CLIENT_TOKEN,
      MEWS_ACCESS_TOKEN,
      MEWS_ENTERPRISE_ID,
    } = process.env;

    if (!MEWS_BASE_URL || !MEWS_CLIENT_TOKEN || !MEWS_ACCESS_TOKEN) {
      return res.status(500).json({
        error: "Missing MEWS config in environment variables.",
      });
    }

    const { first, last } = buildTimeRange(from, to);

    // --- 1) Hent alle resource categories (for navngiving + kapasitet) ---
    const rcBody = {
      ClientToken: MEWS_CLIENT_TOKEN.trim(),
      AccessToken: MEWS_ACCESS_TOKEN.trim(),
      Client: MEWS_CLIENT_NAME,
      EnterpriseIds: [MEWS_ENTERPRISE_ID],
      ActivityStates: ["Active"],
      Limitation: { Count: 1000 },
    };

    const rcResp = await fetch(
      `${MEWS_BASE_URL}/api/connector/v1/resourceCategories/getAll`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rcBody),
      }
    );

    if (!rcResp.ok) {
      const text = await rcResp.text();
      return res.status(502).json({
        error: "Mews resourceCategories call failed",
        details: text,
      });
    }

    const rc = await rcResp.json();

    const categoryLookup = {};
    for (const cat of rc.ResourceCategories || []) {
      categoryLookup[cat.Id] = {
        serviceId: cat.ServiceId,
        nameNbNO: cat.Names?.["nb-NO"] || null,
        capacity: cat.Capacity ?? null,
      };
    }

    // --- 2) Finn hvilke services vi faktisk skal spørre ---
    let servicesToQuery = [];

    if (serviceIdParam) {
      // Brukeren har valgt område
      // Finn label basert på env
      let label = "Ukjent område";
      for (const cfg of SERVICE_CONFIG) {
        const sid = process.env[cfg.envKey];
        if (sid === serviceIdParam) {
          label = cfg.label;
          break;
        }
      }
      servicesToQuery = [
        {
          label,
          serviceId: serviceIdParam,
        },
      ];
    } else {
      // "Søk generelt" – alle områder vi har satt opp
      servicesToQuery = SERVICE_CONFIG
        .map((cfg) => {
          const sid = process.env[cfg.envKey];
          if (!sid) return null;
          return { label: cfg.label, serviceId: sid };
        })
        .filter(Boolean);
    }

    // --- 3) Hent availability for hver service ---
    const allRows = [];

    for (const s of servicesToQuery) {
      const availBody = {
        ClientToken: MEWS_CLIENT_TOKEN.trim(),
        AccessToken: MEWS_ACCESS_TOKEN.trim(),
        Client: MEWS_CLIENT_NAME,
        ServiceId: s.serviceId,
        FirstTimeUnitStartUtc: first,
        LastTimeUnitStartUtc: last,
      };

      const availResp = await fetch(
        `${MEWS_BASE_URL}/api/connector/v1/services/getAvailability`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(availBody),
        }
      );

      if (!availResp.ok) {
        const text = await availResp.text();
        console.error(
          `Availability failed for service ${s.serviceId}: ${text}`
        );
        // hopp til neste service, ikke stopp hele svaret
        continue;
      }

      const availability = await availResp.json();

      if (
        !availability.CategoryAvailabilities ||
        availability.CategoryAvailabilities.length === 0
      ) {
        continue;
      }

      const dates = availability.TimeUnitStartsUtc || [];

      for (const ca of availability.CategoryAvailabilities) {
        const info = categoryLookup[ca.CategoryId] || {};
        for (let i = 0; i < dates.length; i++) {
          allRows.push({
            dateUtc: dates[i],
            serviceId: info.serviceId || s.serviceId,
            serviceName: s.label,
            categoryId: ca.CategoryId,
            categoryName: info.nameNbNO,
            capacity: info.capacity,
            availableCount: ca.Availabilities?.[i] ?? null,
          });
        }
      }
    }

    // Sorter for lesbarhet
    allRows.sort((a, b) => {
      if (a.dateUtc < b.dateUtc) return -1;
      if (a.dateUtc > b.dateUtc) return 1;
      if (a.serviceName < b.serviceName) return -1;
      if (a.serviceName > b.serviceName) return 1;
      if ((a.categoryName || "") < (b.categoryName || "")) return -1;
      if ((a.categoryName || "") > (b.categoryName || "")) return 1;
      return 0;
    });

    return res.json(allRows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Server error",
      details: String(err),
    });
  }
});

module.exports = router;
