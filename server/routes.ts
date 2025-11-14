import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { cacheMiddleware } from "./middleware/cache";
import { searchLimiter } from "./middleware/rate-limit";
import multer from "multer";
import path from "path";
import crypto from "crypto";

// PKCE (Proof Key for Code Exchange) store for OAuth
// Maps state parameter -> { codeVerifier, expiresAt }
const pkceStore = new Map<string, { codeVerifier: string; expiresAt: number }>();

// Helper: Generate PKCE code verifier (random string)
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// Helper: Generate PKCE code challenge from verifier (SHA256)
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export async function registerRoutes(app: Express): Promise<Server> {
  console.log("🚀 REGISTERING ROUTES - SERVER STARTING");
  // Import necessary modules
  const { authenticateUser } = await import("./auth-middleware");
  const { requireAuth, optionalAuth } = await import("./middleware/auth");
  const { db } = await import("./db");
  const { storage } = await import("./storage");
  const { openaiChat, generateContextualSuggestions } = await import(
    "./openai-chat"
  );

  // Register auth routes FIRST (before other routes)
  const authRoutes = (await import("./routes/auth")).default;
  app.use("/api/auth", authRoutes);
  console.log("✅ Auth routes registered at /api/auth");

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "bjork-homes-real-estate",
    });
  });

  // Test endpoint for debugging
  app.get("/api/test-logging", (req, res) => {
    console.log("🧪 TEST LOGGING ENDPOINT HIT!");
    res.json({
      message: "Logging test successful",
      timestamp: new Date().toISOString(),
    });
  });

  // CMA Real Estate API Integration - Using Production API
  // Apply caching (5 min) and rate limiting (30 req/15min) to reduce external API costs
  app.get(
    "/api/paragon/properties",
    searchLimiter,
    cacheMiddleware(300),
    async (req, res) => {
      try {
        console.log(
          "🏠 Fetching properties from CMA API with filters:",
          req.query
        );

        // Extract all possible query parameters (maintaining backward compatibility)
        const {
          city = "omaha",
          state = "NE",
          status = "Active",
          limit = "100",
          page = "1",
          min_price,
          minPrice,
          max_price,
          maxPrice,
          beds,
          min_beds,
          minBeds,
          max_beds,
          maxBeds,
          baths,
          min_baths,
          minBaths,
          max_baths,
          maxBaths,
          sqft,
          min_sqft,
          minSqft,
          max_sqft,
          maxSqft,
          property_type,
          propertyType,
          address,
          zipCode,
          zip_code,
          subdivision,
          agent,
          mls_number,
          mlsNumber,
          garage,
          min_year_built,
          minYearBuilt,
          max_year_built,
          maxYearBuilt,
          yearBuilt,
          new_construction,
          newConstruction,
          sort_by = "price",
          sortBy,
          sort_order = "desc",
          sortOrder,
        } = req.query as { [key: string]: any };

        let cmaUrl =
          "http://gbcma.us-east-2.elasticbeanstalk.com/api/property-search?";
        const params = new URLSearchParams();

        const freeQuery = (req.query as any).query?.toString().trim();
        console.log("🔍 Property search - free query:", freeQuery);
        let skipCityAppend = false;
        if (freeQuery) {
          if (/^\d{5}$/.test(freeQuery)) {
            if (!zipCode && !zip_code) params.append("zip_code", freeQuery);
            if (!(req.query as any).city) skipCityAppend = true;
          } else if (/^\d+\s+/.test(freeQuery)) {
            if (!address) params.append("address", freeQuery);
            if (!(req.query as any).city) skipCityAppend = true;
          } else if (!(req.query as any).city) {
            params.append("city", freeQuery.toLowerCase());
            skipCityAppend = true;
          }
        }

        if (!skipCityAppend) params.append("city", city);

        const finalPropType = propertyType || property_type;
        if (finalPropType && finalPropType.toLowerCase() !== "any") {
          params.append("property_type", finalPropType);
        }

        if (status && status !== "For Sale") {
          params.append("status", status);
        } else {
          params.append("status", "Active");
        }

        const priceMin = minPrice || min_price;
        const priceMax = maxPrice || max_price;
        if (priceMin) params.append("min_price", priceMin);
        if (priceMax) params.append("max_price", priceMax);

        const bedsMin = minBeds || min_beds || beds;
        const bedsMax = maxBeds || max_beds;
        if (bedsMin) params.append("beds", bedsMin);
        if (bedsMax) params.append("max_beds", bedsMax);

        const bathsMin = minBaths || min_baths || baths;
        const bathsMax = maxBaths || max_baths;
        if (bathsMin) params.append("baths", bathsMin);
        if (bathsMax) params.append("max_baths", bathsMax);

        const sqftMin = minSqft || min_sqft;
        const sqftMax = maxSqft || max_sqft;
        if (sqftMin) params.append("min_sqft", sqftMin);
        if (sqftMax) params.append("max_sqft", sqftMax);

        const yearMin = minYearBuilt || min_year_built;
        const yearMax = maxYearBuilt || max_year_built;
        if (yearBuilt) {
          params.append("year_built", yearBuilt);
        } else {
          if (yearMin) params.append("min_year_built", yearMin);
          if (yearMax) params.append("max_year_built", yearMax);
        }

        const propTypeFilter = propertyType || property_type;
        if (propTypeFilter && propTypeFilter.toLowerCase() !== "any") {
          params.append("property_type", propTypeFilter);
        }

        if (address) params.append("address", address);

        const subdivisionAlias =
          subdivision ||
          (req.query as any).community ||
          (req.query as any).communityName ||
          (req.query as any).Community ||
          (req.query as any).SubdivisionName ||
          (req.query as any).subdivisionName;
        if (subdivisionAlias) {
          params.append("subdivision", subdivisionAlias);
          if (!subdivision) {
            console.log(
              "📍 Using community/subdivision alias param:",
              subdivisionAlias
            );
          }
        }

        const zip = zipCode || zip_code;
        if (zip) params.append("zip_code", zip);

        const mlsNum = mlsNumber || mls_number;
        if (mlsNum) params.append("mls_number", mlsNum);

        if (agent) params.append("agent", agent);
        if (garage) params.append("garage", garage);

        const isNewConstruction = newConstruction || new_construction;
        if (isNewConstruction === "true")
          params.append("new_construction", "true");

        const finalSortBy = sortBy || sort_by || "price";
        const finalSortOrder = sortOrder || sort_order || "desc";
        params.append("sort_by", finalSortBy);
        params.append("sort_order", finalSortOrder);

        params.append("limit", limit);
        if (page !== "1") params.append("page", page);

        cmaUrl += params.toString();
        console.log("🌐 Final CMA API URL:", cmaUrl);

        const response = await fetch(cmaUrl, {
          headers: {
            "User-Agent": "NebraskaHomeHub/1.0",
            Accept: "application/json",
          },
        });
        if (!response.ok)
          throw new Error(
            `CMA API error: ${response.status} ${response.statusText}`
          );

        const cmaData = await response.json();
        console.log(
          `✅ Got ${cmaData?.properties?.length || 0} properties from CMA API`
        );

        let finalProperties = cmaData.properties || [];
        if (finalProperties.length === 0 && status === "For Sale") {
          console.log(
            "🔄 No Active properties found, trying recent Closed properties..."
          );
          const fallbackParams = new URLSearchParams(params);
          fallbackParams.set("status", "Closed");
          const fallbackUrl =
            "http://gbcma.us-east-2.elasticbeanstalk.com/api/property-search?" +
            fallbackParams.toString();
          try {
            const fallbackResponse = await fetch(fallbackUrl, {
              headers: {
                "User-Agent": "NebraskaHomeHub/1.0",
                Accept: "application/json",
              },
            });
            if (fallbackResponse.ok) {
              const fallbackData = await response.json();
              finalProperties = fallbackData.properties || [];
              console.log(
                `✅ Fallback: Got ${finalProperties.length} closed properties`
              );
            }
          } catch (fallbackError) {
            console.warn("⚠️ Fallback request failed:", fallbackError);
          }
        }

        const transformedProperties = (finalProperties || []).map(
          (property: any) => ({
            id: property.id || Math.random().toString(),
            // Prefer actual MLS fields when present
            mlsId:
              property.mlsId ||
              property.mls_number ||
              property.ListingId ||
              property.id,
            title: `${property.beds || "?"} Bed ${
              property.baths || "?"
            } Bath in ${property.city || "Omaha"}`,
            price:
              property.listPrice || property.soldPrice || property.price || 0,
            address:
              property.address ||
              property.fullAddress ||
              "Address not available",
            city: property.city || "Omaha",
            state: property.state || "NE",
            zipCode: property.zipCode || property.PostalCode || "",
            beds: property.beds || property.BedroomsTotal || 0,
            baths: property.baths || property.BathroomsTotalInteger || 0,
            sqft: property.sqft || property.LivingArea || 0,
            yearBuilt: property.yearBuilt || property.YearBuilt,
            garage: property.garage || property.GarageSpaces || 0,
            propertyType:
              property.propertyType || property.PropertyType || "Single Family",
            status: property.status || property.StandardStatus || "Unknown",
            standardStatus:
              property.status || property.StandardStatus || "Unknown",
            subdivision: property.subdivision || property.SubdivisionName || "",
            waterfront: property.waterfront || false,
            newConstruction: property.newConstruction || false,
            featured:
              (property.listPrice ||
                property.soldPrice ||
                property.price ||
                0) > 500000,
            luxury:
              (property.listPrice ||
                property.soldPrice ||
                property.price ||
                0) > 800000,
            images: property.imageUrl
              ? [property.imageUrl]
              : Array.isArray(property.images)
              ? property.images.filter((x: any) => !!x)
              : [],
            coordinates: {
              lat: property.latitude || 41.2565,
              lng: property.longitude || -95.9345,
            },
            description: `${property.propertyType || "Property"} in ${
              property.subdivision || property.city
            }`,
            photoCount: property.imageUrl ? 1 : 0,
            listAgent: property.listAgent?.name || "Unknown Agent",
            listOffice: property.listOffice?.name || "Unknown Office",
          })
        );

        res.json({
          data: transformedProperties,
          source: "cma-api-production",
          total: cmaData.totalAvailable || transformedProperties.length,
          cached: false,
          searchCriteria: cmaData.searchCriteria || req.query,
          apiUrl: cmaData.apiUrl || cmaUrl,
        });
      } catch (error) {
        console.error("❌ CMA API error:", error);
        const mockProperties = [] as any[]; // keep empty to avoid dummy data confusion here
        res.json({
          data: mockProperties,
          source: "cma-api-error",
          total: 0,
          cached: false,
          error: error instanceof Error ? error.message : "CMA API unavailable",
        });
      }
    }
  );

  /**
   * Advanced Property Search
   * Supports multi-status (comma-separated), advanced numeric filters, boolean flags, and simple cursor pagination.
   * Query params (subset):
   * - query, city, subdivision
   * - status (single or comma-separated list)
   * - min_price, max_price, beds, baths, property_type
   * - min_sqft, max_sqft, min_year_built, max_year_built, min_garage
   * - waterfront(1), new_construction(1), photo_only(1)
   * - sort_by (ListPrice|YearBuilt|ModificationTimestamp|price), sort_order (asc|desc)
   * - limit (default 100), cursor (page number as string)
   */

  // Proxy endpoint for property-search-new (used by communities page)
  app.get("/api/property-search-new", async (req, res) => {
    console.log("Route called with query:", req.query);
    console.log("🏘️ Property search new proxy called with query:", req.query);
    try {
      const baseUrl =
        process.env.CMA_API_BASE ||
        "http://gbcma.us-east-2.elasticbeanstalk.com";

      // Forward all query parameters to the external API (with normalization)
      const params = new URLSearchParams(req.query as any);
      // Remove internal-only flags
      if (params.has("_v")) params.delete("_v");
      // Normalize paging (1-based)
      const inPage = Number(params.get("page") || "1");
      if (!Number.isFinite(inPage) || inPage < 1) params.set("page", "1");
      // Ensure state default
      if (!params.has("state")) params.set("state", "NE");
      // Map legacy status→StandardStatus
      if (params.has("status") && !params.has("StandardStatus")) {
        const s = params.get("status")!;
        params.delete("status");
        params.set("StandardStatus", s);
      }
      // If school filters are present but no status specified, default to Active
      const hasSchoolFilterInitial =
        params.has("school_district") ||
        params.has("elementary_district") ||
        params.has("middle_district") ||
        params.has("high_district") ||
        params.has("school_level");
      if (hasSchoolFilterInitial && !params.has("StandardStatus")) {
        params.set("StandardStatus", "Active");
      }
      // 'school_level' is internal-only; drop before forwarding
      if (params.has("school_level")) params.delete("school_level");
      // If a school district is provided, add compatible aliases based on level for broader upstream matching
      if (
        params.has("school_district") ||
        params.has("elementary_district") ||
        params.has("middle_district") ||
        params.has("high_district")
      ) {
        // Read the level from the raw query so we can safely drop it before forwarding
        const level = ((req.query as any)["school_level"] || "").toLowerCase();
        const rawDistrictValue =
          params.get("school_district") ||
          params.get("elementary_district") ||
          params.get("middle_district") ||
          params.get("high_district") ||
          "";
        const normalizeDistrict = (s: string) => {
          const base = s.trim();
          const lower = base.toLowerCase();
          const strip = (suffix: string) =>
            lower.endsWith(suffix)
              ? base.slice(0, base.length - suffix.length).trim()
              : base;
          let out = base;
          out = strip(" public schools");
          out = strip(" public school district");
          out = strip(" school district");
          out = strip(" schools");
          return out;
        };
        const districtValue = rawDistrictValue
          ? normalizeDistrict(rawDistrictValue)
          : "";
        if (districtValue) {
          // Prefer explicit RESO field based on level
          params.delete("ElementarySchoolDistrict");
          params.delete("MiddleOrJuniorSchoolDistrict");
          params.delete("HighSchoolDistrict");
          if (level === "elementary") {
            params.set("ElementarySchoolDistrict", districtValue);
          } else if (level === "middle") {
            params.set("MiddleOrJuniorSchoolDistrict", districtValue);
          } else if (level === "high") {
            params.set("HighSchoolDistrict", districtValue);
          } else {
            // If level unknown, default to elementary field for broader match
            params.set("ElementarySchoolDistrict", districtValue);
          }

          // Compatibility: include generic alias too for upstreams that don't honor RESO fields
          // Keep only one generic key to avoid duplication ambiguity
          params.delete("school_district");
          params.delete("elementary_district");
          params.delete("middle_district");
          params.delete("high_district");
          params.set("school_district", districtValue);
        }
      }
      const url = `${baseUrl}/api/property-search-new?${params.toString()}`;

      console.log("🌐 Proxying to:", url);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`External API returned ${response.status}`);
      }

      const data = await response.json();
      let propertiesArr: any[] = Array.isArray(data?.properties)
        ? data.properties
        : [];
      // Enforce school-district filtering server-side if upstream ignored it
      const reqHasSchoolFilter =
        (req.query as any)["school_district"] ||
        (req.query as any)["elementary_district"] ||
        (req.query as any)["middle_district"] ||
        (req.query as any)["high_district"] ||
        (req.query as any)["ElementarySchoolDistrict"] ||
        (req.query as any)["MiddleOrJuniorSchoolDistrict"] ||
        (req.query as any)["HighSchoolDistrict"];
      if (reqHasSchoolFilter) {
        console.log(
          "Applying server-side school filter, value:",
          reqHasSchoolFilter
        );
        const level = String(
          (req.query as any)["school_level"] || ""
        ).toLowerCase();
        const rawDistrict =
          String((req.query as any)["school_district"]) ||
          String((req.query as any)["elementary_district"]) ||
          String((req.query as any)["middle_district"]) ||
          String((req.query as any)["high_district"]) ||
          String((req.query as any)["ElementarySchoolDistrict"]) ||
          String((req.query as any)["MiddleOrJuniorSchoolDistrict"]) ||
          String((req.query as any)["HighSchoolDistrict"]) ||
          "";
        const normalize = (s: string) => {
          const base = (s || "").trim();
          const lower = base.toLowerCase();
          const strip = (suffix: string) =>
            lower.endsWith(suffix)
              ? base.slice(0, base.length - suffix.length).trim()
              : base;
          let out = base;
          out = strip(" public schools");
          out = strip(" public school district");
          out = strip(" school district");
          out = strip(" schools");
          out = strip(" public");
          return out.toLowerCase();
        };
        const target = normalize(rawDistrict);
        if (target) {
          const matchDistrict = (p: any, field: string) => {
            const val = (p?.[field] ||
              p?.[field.charAt(0).toUpperCase() + field.slice(1)]) as
              | string
              | undefined;
            return val ? normalize(val) === target : false;
          };
          console.log(
            "Before filter, propertiesArr.length:",
            propertiesArr.length
          );
          propertiesArr = propertiesArr.filter((p) => {
            if (level === "elementary")
              return matchDistrict(p, "schoolElementaryDistrict");
            if (level === "middle")
              return matchDistrict(p, "schoolMiddleDistrict");
            if (level === "high") return matchDistrict(p, "schoolHighDistrict");
            // If no explicit level, accept a match on any level
            return (
              matchDistrict(p, "schoolElementaryDistrict") ||
              matchDistrict(p, "schoolMiddleDistrict") ||
              matchDistrict(p, "schoolHighDistrict")
            );
          });
          console.log(
            "After filter, propertiesArr.length:",
            propertiesArr.length
          );
          console.log(
            `🎓 Applied server-side school filter level='${level}' district='${rawDistrict}' -> ${propertiesArr.length} matches`
          );
        }
      }

      const initialCount = Array.isArray(propertiesArr)
        ? data.properties.length
        : Number(data?.count || 0);
      console.log(`✅ Proxied ${initialCount} properties`);

      // School filter compatibility fallback:
      // If caller used school filters and got 0 results, retry without city and
      // add alternative upstream param names to maximize match.
      const hasSchoolFilter =
        params.has("school_district") ||
        params.has("elementary_district") ||
        params.has("middle_district") ||
        params.has("high_district") ||
        params.has("ElementarySchoolDistrict") ||
        params.has("MiddleOrJuniorSchoolDistrict") ||
        params.has("HighSchoolDistrict");

      if (initialCount === 0 && hasSchoolFilter) {
        const fallbackParams = new URLSearchParams(params);
        const level = (
          (req.query["school_level"] as string) || ""
        ).toLowerCase();

        // Widen geography: some upstream filters conflict with city
        if (fallbackParams.has("city")) {
          console.log(
            "🔁 School filter: removing city constraint for fallback"
          );
          fallbackParams.delete("city");
        }
        // Ensure state present (defaults to NE for our app)
        if (!fallbackParams.has("state")) fallbackParams.set("state", "NE");

        // Duplicate district into alternative names that upstream may accept
        const district =
          fallbackParams.get("school_district") ||
          fallbackParams.get("elementary_district") ||
          fallbackParams.get("middle_district") ||
          fallbackParams.get("high_district") ||
          "";
        if (district) {
          const normalizeDistrict = (s: string) => {
            const base = s.trim();
            const lower = base.toLowerCase();
            const strip = (suffix: string) =>
              lower.endsWith(suffix)
                ? base.slice(0, base.length - suffix.length).trim()
                : base;
            let out = base;
            out = strip(" public schools");
            out = strip(" public school district");
            out = strip(" school district");
            out = strip(" schools");
            return out;
          };
          const normDistrict = normalizeDistrict(district);
          // Prefer explicit RESO fields; remove generic aliases
          fallbackParams.delete("school_district");
          fallbackParams.delete("elementary_district");
          fallbackParams.delete("middle_district");
          fallbackParams.delete("high_district");
          fallbackParams.delete("ElementarySchoolDistrict");
          fallbackParams.delete("MiddleOrJuniorSchoolDistrict");
          fallbackParams.delete("HighSchoolDistrict");
          if (level === "elementary") {
            fallbackParams.set("ElementarySchoolDistrict", normDistrict);
          } else if (level === "middle") {
            fallbackParams.set("MiddleOrJuniorSchoolDistrict", normDistrict);
          } else if (level === "high") {
            fallbackParams.set("HighSchoolDistrict", normDistrict);
          } else {
            fallbackParams.set("ElementarySchoolDistrict", normDistrict);
          }
        }

        // Normalize status to StandardStatus if legacy status provided
        if (
          fallbackParams.has("status") &&
          !fallbackParams.has("StandardStatus")
        ) {
          const s = fallbackParams.get("status")!;
          fallbackParams.delete("status");
          fallbackParams.set("StandardStatus", s);
        }
        if (!fallbackParams.has("StandardStatus")) {
          fallbackParams.set("StandardStatus", "Active");
        }
        // Ensure 'school_level' not forwarded
        fallbackParams.delete("school_level");

        // Ensure valid paging for upstream (use 1-based page index)
        const currentPage = Number(fallbackParams.get("page") || "1");
        if (!Number.isFinite(currentPage) || currentPage < 1) {
          fallbackParams.set("page", "1");
        }

        const fallbackUrl = `${baseUrl}/api/property-search-new?${fallbackParams.toString()}`;
        console.log("🌐 Fallback (school filters) proxying to:", fallbackUrl);

        const fbController = new AbortController();
        const fbTimeout = setTimeout(() => fbController.abort(), 15000);
        try {
          const fbResp = await fetch(fallbackUrl, {
            headers: { Accept: "application/json" },
            signal: fbController.signal,
          });
          clearTimeout(fbTimeout);
          if (fbResp.ok) {
            const fbData = await fbResp.json();
            const fbCount = Array.isArray(fbData?.properties)
              ? fbData.properties.length
              : Number(fbData?.count || 0);
            console.log(`✅ Fallback returned ${fbCount} properties`);
            // Return fallback if it yielded anything; else try variants; else return original response
            if (fbCount > 0) {
              return res.json({
                ...fbData,
                meta: { ...(fbData.meta || {}), fallbackApplied: true },
              });
            }
          } else {
            console.warn("⚠️ Fallback request non-OK:", fbResp.status);
          }
        } catch (e) {
          clearTimeout(fbTimeout);
          console.warn("⚠️ Fallback request failed:", e);
        }

        // Variant attempts: try relaxed district names (strip common suffixes) if still zero
        if (district) {
          const mkVariants = (s: string): string[] => {
            const variants = new Set<string>();
            const base = s.trim();
            variants.add(base);
            const lower = base.toLowerCase();
            const stripSuffixes = [
              " public schools",
              " public school district",
              " school district",
              " schools",
            ];
            for (const suf of stripSuffixes) {
              if (lower.endsWith(suf)) {
                variants.add(base.slice(0, base.length - suf.length).trim());
              }
            }
            // Also try first token before comma
            const commaIdx = base.indexOf(",");
            if (commaIdx > 0) variants.add(base.slice(0, commaIdx).trim());
            // Also try single first word
            const firstSpace = base.indexOf(" ");
            if (firstSpace > 0) variants.add(base.slice(0, firstSpace).trim());
            return Array.from(variants).filter(Boolean).slice(0, 4);
          };
          const variants = mkVariants(district);
          for (const variant of variants) {
            if (!variant || variant === district) continue;
            const vParams = new URLSearchParams(fallbackParams);
            // Use explicit RESO field for variant value
            vParams.delete("school_district");
            vParams.delete("elementary_district");
            vParams.delete("middle_district");
            vParams.delete("high_district");
            vParams.delete("ElementarySchoolDistrict");
            vParams.delete("MiddleOrJuniorSchoolDistrict");
            vParams.delete("HighSchoolDistrict");
            if (level === "elementary") {
              vParams.set("ElementarySchoolDistrict", variant);
            } else if (level === "middle") {
              vParams.set("MiddleOrJuniorSchoolDistrict", variant);
            } else if (level === "high") {
              vParams.set("HighSchoolDistrict", variant);
            } else {
              vParams.set("ElementarySchoolDistrict", variant);
            }
            vParams.delete("school_level");
            const vUrl = `${baseUrl}/api/property-search-new?${vParams.toString()}`;
            console.log("🌐 Fallback variant trying:", vUrl);
            const vController = new AbortController();
            const vTimeout = setTimeout(() => vController.abort(), 15000);
            try {
              const vResp = await fetch(vUrl, {
                headers: { Accept: "application/json" },
                signal: vController.signal,
              });
              clearTimeout(vTimeout);
              if (!vResp.ok) continue;
              const vData = await vResp.json();
              const vCount = Array.isArray(vData?.properties)
                ? vData.properties.length
                : Number(vData?.count || 0);
              console.log(
                `✅ Variant '${variant}' returned ${vCount} properties`
              );
              if (vCount > 0) {
                return res.json({
                  ...vData,
                  meta: {
                    ...(vData.meta || {}),
                    fallbackApplied: true,
                    districtVariant: variant,
                  },
                });
              }
            } catch (err) {
              clearTimeout(vTimeout);
            }
          }
        }
      }

      // If we applied post-filtering, override properties/count in response
      if (reqHasSchoolFilter) {
        const patched = {
          ...data,
          properties: propertiesArr,
          count: Array.isArray(propertiesArr)
            ? propertiesArr.length
            : data.count,
          meta: { ...(data.meta || {}), serverSideSchoolFilter: true },
        };
        return res.json(patched);
      }

      res.json(data);
    } catch (error: any) {
      console.error("❌ Property search new proxy error:", error);
      res.status(500).json({
        error: "Failed to fetch properties",
        message: error.message,
        properties: [],
        count: 0,
      });
    }
  });

  app.get("/api/property-search-advanced", async (req, res) => {
    console.log("🔍🔍🔍 ADVANCED SEARCH API HIT! 🔍🔍🔍");
    console.log("🔍 Advanced search API called with query:", req.query);
    try {
      const q = req.query as Record<string, string | string[] | undefined>;
      const limit = Math.min(Number(q.limit ?? 100) || 100, 500);
      const pageStr = (q.cursor as string) || (q.page as string) || "1";
      const page = Math.max(parseInt(pageStr, 10) || 1, 1);

      // Normalize sort fields to our local semantics
      // We use 'price' locally, but upstream expects 'ListPrice' in sort_by
      const sortByRaw = (q.sort_by as string) || "price";
      const sortBy =
        sortByRaw === "ListPrice" || sortByRaw === "price"
          ? "price"
          : sortByRaw;
      const sortOrder = (q.sort_order as string) || "desc";

      // Build base params shared by all upstream calls
      const baseParams = new URLSearchParams();

      // Default to Nebraska state for all searches
      baseParams.set("state", "NE");

      // Free-text query handling: map to zip/address/city when obvious
      const freeQuery = (q.query as string)?.trim();
      if (freeQuery) {
        if (/^\d{5}$/.test(freeQuery)) {
          baseParams.set("zip_code", freeQuery);
        } else if (/^\d+\s+/.test(freeQuery)) {
          baseParams.set("address", freeQuery);
        } else if (q.city == null) {
          baseParams.set("city", freeQuery.toLowerCase());
        }
      }

      const city = (q.city as string) || undefined;
      if (city) baseParams.set("city", city);
      const subdivision =
        (q.subdivision as string) || (q.community as string) || undefined;
      if (subdivision) baseParams.set("subdivision", subdivision);

      const mapNumber = (v: any) => (v == null ? undefined : Number(v));
      const addNum = (k: string, v: any) => {
        const n = mapNumber(v);
        if (typeof n === "number" && !isNaN(n) && n > 0)
          baseParams.set(k, String(n));
      };
      addNum("min_price", q.min_price ?? q.minPrice);
      addNum("max_price", q.max_price ?? q.maxPrice);
      addNum("beds", q.beds);
      addNum("baths", q.baths);
      if (q.property_type || q.propertyType) {
        const t = String(q.property_type || q.propertyType);
        if (t && t.toLowerCase() !== "any") baseParams.set("property_type", t);
      }
      addNum("min_sqft", q.min_sqft ?? q.minSqft);
      addNum("max_sqft", q.max_sqft ?? q.maxSqft);
      addNum("min_year_built", q.min_year_built ?? q.minYearBuilt);
      addNum("max_year_built", q.max_year_built ?? q.maxYearBuilt);
      // Upstream doesn't support min_garage directly — filter post-fetch
      const minGarage = mapNumber(q.min_garage ?? q.minGarage);

      // Boolean flags (presence means true)
      if (q.waterfront) baseParams.set("waterfront", "true");
      if (q.new_construction || q.newConstruction)
        baseParams.set("new_construction", "true");
      const photoOnly = !!(q.photo_only || q.photoOnly);

      baseParams.set("sort_by", sortBy);
      baseParams.set("sort_order", sortOrder);
      baseParams.set("limit", String(limit));
      if (page > 1) baseParams.set("page", String(page));

      // Status handling (single or CSV)
      const statusRaw = (q.status as string) || "";
      const statuses = statusRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const statusList =
        statuses.length > 0 ? statuses : ["Active", "Pending", "Closed"]; // Include more statuses by default

      const baseUrl =
        process.env.CMA_API_BASE ||
        "http://gbcma.us-east-2.elasticbeanstalk.com/api";

      // Collect debug info for upstream fetches
      const debugFetches: Array<{
        status: string;
        url: string;
        ok?: boolean;
        count?: number;
        error?: string;
      }> = [];

      // Fetch all statuses in parallel, then merge
      const fetchForStatus = async (status: string) => {
        const params = new URLSearchParams(baseParams);
        params.set("StandardStatus", status);
        // Upstream sort_by must be ListPrice when our local sort is price
        const upstreamSortBy = sortBy === "price" ? "ListPrice" : sortBy;
        params.set("sort_by", upstreamSortBy);
        params.set("sort_order", sortOrder);
        const url = `${baseUrl.replace(
          /\/$/,
          ""
        )}/property-search-new?${params.toString()}`;
        console.log(`🌐 Fetching for status ${status}:`, url);
        debugFetches.push({ status, url });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const r = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const json = await r.json();
          console.log(
            `✅ Got ${
              json?.properties?.length || 0
            } properties for status ${status}`
          );
          const last = debugFetches[debugFetches.length - 1];
          if (last && last.status === status && last.url === url) {
            last.ok = true;
            last.count = Array.isArray(json?.properties)
              ? json.properties.length
              : Number(json?.count || 0);
          }
          const list: any[] = json?.properties || [];
          return list.map((p) => ({ ...p, __status: status }));
        } catch (error) {
          console.error(`❌ Error fetching for status ${status}:`, error);
          const last = debugFetches[debugFetches.length - 1];
          if (last && last.status === status && last.url === url) {
            last.ok = false;
            last.error = error instanceof Error ? error.message : String(error);
          }
          return [];
        } finally {
          clearTimeout(timeout);
        }
      };

      const resultsByStatus = await Promise.all(
        statusList.map((s) => fetchForStatus(s))
      );
      let combined: any[] = resultsByStatus.flat();

      // Post-filters not supported upstream
      if (typeof minGarage === "number" && minGarage > 0) {
        combined = combined.filter((p) => (p.garage || 0) >= minGarage);
      }
      if (photoOnly) {
        combined = combined.filter((p) => !!(p.imageUrl || p.images?.length));
      }

      // Filter combined results to ensure only requested statuses are included
      const statusFiltered = combined.filter((p) => {
        const propStatus = p.status || p.StandardStatus || p.__status || "";
        return statusList.includes(propStatus);
      });

      // De-duplicate by MLS ID or id
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const p of statusFiltered) {
        const key = String(
          p.id || p.mlsId || p.mls_number || p.ListingKey || Math.random()
        );
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(p);
      }

      // Sorting (client may also resort, but we keep deterministic order)
      const getPrice = (p: any) =>
        Number(p.price || p.listPrice || p.ListPrice || p.soldPrice || 0);
      const getYear = (p: any) => Number(p.yearBuilt || p.YearBuilt || 0);
      const getMod = (p: any) =>
        new Date(p.ModificationTimestamp || p.updatedAt || 0).getTime();
      const dir = sortOrder === "asc" ? 1 : -1;

      // Filter out properties with invalid prices for price-based sorting
      let sortedData = [...deduped];
      if (sortBy === "price" || sortBy === "ListPrice") {
        if (sortOrder === "asc") {
          // For ascending price sort, keep $0 properties but sort them to the end
          sortedData = sortedData.sort((a, b) => {
            const priceA = getPrice(a);
            const priceB = getPrice(b);

            // Put $0 properties at the end for ascending sort
            if (priceA === 0 && priceB === 0) return 0;
            if (priceA === 0) return 1;
            if (priceB === 0) return -1;
            return priceA - priceB;
          });
        }
      }

      const sorted =
        sortBy === "price" || sortBy === "ListPrice"
          ? sortOrder === "asc"
            ? sortedData
            : sortedData.sort((a, b) => (getPrice(a) - getPrice(b)) * -1)
          : sortedData.sort((a, b) => {
              switch (sortBy) {
                case "YearBuilt":
                  return (getYear(a) - getYear(b)) * dir;
                case "ModificationTimestamp":
                  return (getMod(a) - getMod(b)) * dir;
                default:
                  return 0;
              }
            });

      // Pagination indicator (simple heuristic)
      const pageSlice = sorted.slice(0, limit);
      const nextCursor = sorted.length > limit ? String(page + 1) : undefined;

      // Normalize minimal fields expected by client cards
      const normalized = pageSlice.map((property: any) => ({
        id: property.id || property.ListingKey || Math.random().toString(),
        mlsId: property.id || property.mlsId || property.mls_number,
        price: property.listPrice || property.ListPrice || property.price || 0,
        soldPrice: property.soldPrice || property.SoldPrice,
        address:
          property.address ||
          property.fullAddress ||
          [
            property.StreetNumber,
            property.StreetName,
            property.City,
            property.StateOrProvince,
          ]
            .filter(Boolean)
            .join(" "),
        city: property.city || property.City || city || "",
        state: property.state || property.StateOrProvince || "NE",
        zipCode: property.zipCode || property.PostalCode || "",
        beds: property.beds || property.BedroomsTotal || 0,
        baths: property.baths || property.BathroomsTotalInteger || 0,
        sqft: property.sqft || property.LivingArea || 0,
        yearBuilt: property.yearBuilt || property.YearBuilt,
        garage: property.garage || property.GarageSpaces || 0,
        propertyType:
          property.propertyType || property.PropertyType || "Residential",
        status: property.status || property.StandardStatus || "Unknown",
        subdivision:
          property.subdivision || property.SubdivisionName || subdivision || "",
        imageUrl:
          (Array.isArray(property.images) && property.images[0]) ||
          property.imageUrl ||
          property.Media?.[0]?.MediaURL ||
          null,
        images:
          property.images ||
          (property.Media?.map((m: any) => m.MediaURL).filter(Boolean) ?? []),
        waterfront: property.waterfront || false,
        newConstruction: property.newConstruction || false,
        // ✅ SCHOOL DISTRICT FIELDS RESTORED:
        schoolElementary:
          property.schoolElementary || property.ElementarySchool || "",
        schoolElementaryDistrict:
          property.schoolElementaryDistrict ||
          property.ElementarySchoolDistrict ||
          "",
        schoolMiddle:
          property.schoolMiddle || property.MiddleOrJuniorSchool || "",
        schoolMiddleDistrict:
          property.schoolMiddleDistrict ||
          property.MiddleOrJuniorSchoolDistrict ||
          property.MiddleSchoolDistrict ||
          "",
        schoolHigh: property.schoolHigh || property.HighSchool || "",
        schoolHighDistrict:
          property.schoolHighDistrict || property.HighSchoolDistrict || "",
      }));

      res.json({
        success: true,
        properties: normalized,
        count: normalized.length,
        meta: {
          nextCursor,
          appliedFilters: {
            city,
            subdivision,
            statuses: statusList,
            limit,
            page,
          },
          sort: { by: sortBy, order: sortOrder },
          source: "property-search-advanced",
          debug: {
            upstreamBase: baseUrl,
            fetches: debugFetches,
            combinedBeforeFilters: combined.length,
            afterStatusFilter: statusFiltered.length,
            afterDedupe: deduped.length,
            totalSorted: sorted.length,
          },
        },
      });
    } catch (error) {
      console.error("/api/property-search-advanced error", error);
      res.status(500).json({
        success: false,
        properties: [],
        count: 0,
        error:
          error instanceof Error
            ? error.message
            : "Failed to run advanced search",
      });
    }
  });

  // Clean, separate /api/properties/by-mls route (no DB fallback, no dummy data)
  app.get("/api/properties/by-mls", async (req, res) => {
    try {
      const idsParam = String(req.query.ids || "").trim();
      if (!idsParam) return res.json({ properties: [], count: 0 });
      const rawIds = idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s, i, arr) => arr.indexOf(s) === i);
      console.log("🔎 [by-mls] Looking up IDs (no fallback):", rawIds);
      const baseUrl =
        process.env.CMA_API_BASE ||
        "http://gbcma.us-east-2.elasticbeanstalk.com/api";
      const results: any[] = [];
      for (const mlsId of rawIds) {
        const url = `${baseUrl.replace(
          /\/$/,
          ""
        )}/property-search-new?mls_number=${encodeURIComponent(mlsId)}`;
        try {
          console.log("🌐 [by-mls] Fetching", url);
          const r = await fetch(url, {
            headers: { Accept: "application/json" },
          });
          if (!r.ok) {
            console.warn("⚠️ [by-mls] Non-OK", r.status, url);
            continue;
          }
          const data = await r.json();
          const prop = Array.isArray(data?.properties)
            ? data.properties[0]
            : data?.properties;
          if (!prop) {
            console.log("ℹ️ [by-mls] No property for", mlsId);
            continue;
          }
          results.push({
            id: prop.id || prop.ListingKey || mlsId,
            mlsId: prop.mlsId || prop.mls_number || mlsId,
            listPrice: prop.listPrice || prop.ListPrice || 0,
            address:
              prop.address ||
              prop.fullAddress ||
              [
                prop.StreetNumber,
                prop.StreetName,
                prop.City,
                prop.StateOrProvince,
              ]
                .filter(Boolean)
                .join(" "),
            city: prop.city || prop.City,
            state: prop.state || prop.StateOrProvince,
            beds: prop.beds || prop.BedroomsTotal,
            baths: prop.baths || prop.BathroomsTotalInteger,
            sqft: prop.sqft || prop.LivingArea,
            status: prop.status || prop.StandardStatus,
            image:
              (Array.isArray(prop.images) && prop.images[0]) ||
              prop.imageUrl ||
              prop.Media?.[0]?.MediaURL ||
              null,
            featured: true,
            source: "external",
          });
        } catch (e) {
          console.warn("⚠️ [by-mls] Fetch failed", mlsId, e);
        }
      }
      const ordered = rawIds
        .map((id) => results.find((r) => r.mlsId == id || r.id == id))
        .filter(Boolean);
      console.log(`✅ [by-mls] Resolved ${ordered.length}/${rawIds.length}`);
      res.json({ properties: ordered, count: ordered.length });
    } catch (error) {
      console.error("/api/properties/by-mls error", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  // Team Properties API - Get properties for team members
  app.get("/api/team-properties", async (req, res) => {
    try {
      console.log("🏠 Fetching team properties...");

      // Import team-related schemas
      const { teams, teamMembers } = await import("../shared/schema");

      // Support explicit agent_ids from query; if not provided, pull from DB team members
      const queryAgentIds = (req.query.agent_ids as string | undefined)?.trim();
      let allTeamMembers: Array<{
        agentName: string | null;
        agentMlsId: string | null;
      }> = [];
      let mlsIds: string = "";

      if (queryAgentIds && queryAgentIds.length > 0) {
        // Use agent IDs from query directly
        mlsIds = queryAgentIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(",");
        // Create a synthetic members list for response context
        allTeamMembers = mlsIds.split(",").map((id) => ({
          agentName: null,
          agentMlsId: id,
        }));
        console.log(`Using agent_ids from query: ${mlsIds}`);
      } else {
        // Get all active team members with their MLS IDs from DB
        allTeamMembers = await db
          .select({
            agentName: teamMembers.agentName,
            agentMlsId: teamMembers.agentMlsId,
          })
          .from(teamMembers)
          .where(teamMembers.agentMlsId !== null);

        if (allTeamMembers.length === 0) {
          console.log("No team members with MLS IDs found");
          return res.json({
            data: [],
            source: "team-properties",
            total: 0,
            message: "No team members found",
          });
        }

        // Build MLS IDs from DB
        mlsIds = allTeamMembers
          .map((member) => member.agentMlsId)
          .filter((id) => id) // Remove null/undefined
          .join(",");
      }

      console.log(`Found team members with MLS IDs: ${mlsIds}`);

      // Build API URL
      const { status = "Active", limit = "20" } = req.query;
      const teamApiUrl = `http://gbcma.us-east-2.elasticbeanstalk.com/api/team-properties?agent_ids=${mlsIds}&status=${status}&limit=${limit}`;

      console.log("🌐 Team Properties API URL:", teamApiUrl);

      // Fetch team properties with a timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(teamApiUrl, {
        headers: {
          "User-Agent": "NebraskaHomeHub/1.0",
          Accept: "application/json",
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(
          `Team Properties API error: ${response.status} ${response.statusText}`
        );
      }

      const teamData = await response.json().catch((e) => {
        console.error("Failed parsing team-properties JSON:", e);
        throw new Error("Invalid JSON from team-properties upstream");
      });
      console.log(
        `✅ Got ${teamData?.properties?.length || 0} team properties`
      );

      // Transform properties to match frontend expectations
      const transformedProperties = (teamData.properties || []).map(
        (property: any) => ({
          id: property.id || Math.random().toString(),
          mlsId: property.id,
          title: `${property.beds || "?"} Bed ${
            property.baths || "?"
          } Bath in ${property.city || "Omaha"}`,
          price: property.listPrice || property.soldPrice || 0,
          address: property.address || "Address not available",
          city: property.city || "Omaha",
          state: property.state || "NE",
          zipCode: property.zipCode || "",
          beds: property.beds || 0,
          baths: property.baths?.toString() || "0",
          sqft: property.sqft || 0,
          yearBuilt: property.yearBuilt,
          garage: property.garage || 0,
          propertyType: property.propertyType || "Single Family",
          status: property.status || "Unknown",
          standardStatus: property.status || "Unknown",
          subdivision: property.subdivision || "",
          waterfront: property.waterfront || false,
          newConstruction: property.newConstruction || false,
          featured: true, // All team properties are featured
          luxury: (property.listPrice || property.soldPrice || 0) > 800000,
          images: property.imageUrl
            ? [property.imageUrl]
            : [
                "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80",
              ],
          coordinates: {
            lat: property.latitude || 41.2565,
            lng: property.longitude || -95.9345,
          },
          description: `${property.propertyType || "Property"} in ${
            property.subdivision || property.city
          }`,
          photoCount: property.imageUrl ? 1 : 0,
          listAgent: property.listAgent?.name || "Team Member",
          listOffice: property.listOffice?.name || "Bjork Group",
          teamProperty: true, // Mark as team property
        })
      );

      res.json({
        data: transformedProperties,
        source: "team-properties-api",
        total: teamData.totalAvailable || transformedProperties.length,
        teamMembers: allTeamMembers,
        agentIds: mlsIds,
        cached: false,
      });
    } catch (error) {
      console.error("❌ Team Properties API error:", error);

      // Return empty data instead of mock data for team properties
      res.json({
        data: [],
        source: "team-properties-error",
        total: 0,
        error:
          error instanceof Error
            ? error.message
            : "Team Properties API unavailable",
      });
    }
  });

  // POST endpoint for properties with JSON body (for featured listings)
  app.post("/api/paragon/properties", async (req, res) => {
    try {
      console.log("🏠 POST request to properties with body:", req.body);

      const { cities = ["Omaha"], limit = 24, filters = {} } = req.body;

      // Convert POST body to GET parameters
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        status: filters.status || "Active",
      });

      // Add cities as a comma-separated list or use first city
      if (cities.length > 0) {
        queryParams.set("city", cities[0].toLowerCase());
      }

      // If looking for featured properties, focus on higher-priced listings
      if (filters.isFeatured) {
        queryParams.set("minPrice", "500000");
      }

      // Build CMA API URL
      let cmaUrl =
        "http://gbcma.us-east-2.elasticbeanstalk.com/api/property-search?" +
        queryParams.toString();
      console.log("🌐 POST->GET CMA API URL:", cmaUrl);

      const response = await fetch(cmaUrl, {
        headers: {
          "User-Agent": "NebraskaHomeHub/1.0",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `CMA API error: ${response.status} ${response.statusText}`
        );
      }

      const cmaData = await response.json();
      console.log(
        `✅ POST: Got ${
          cmaData?.properties?.length || 0
        } properties from CMA API`
      );

      // Transform properties (same as GET endpoint with MLS preference)
      const transformedProperties = (cmaData.properties || []).map(
        (property: any) => ({
          id: property.id || Math.random().toString(),
          mlsId:
            property.mlsId ||
            property.mls_number ||
            property.ListingId ||
            property.id,
          title: `${property.beds || "?"} Bed ${
            property.baths || "?"
          } Bath in ${property.city || "Omaha"}`,
          price:
            property.listPrice || property.soldPrice || property.price || 0,
          address:
            property.address || property.fullAddress || "Address not available",
          city: property.city || "Omaha",
          state: property.state || "NE",
          zipCode: property.zipCode || property.PostalCode || "",
          beds: property.beds || property.BedroomsTotal || 0,
          baths: property.baths || property.BathroomsTotalInteger || 0,
          sqft: property.sqft || property.LivingArea || 0,
          yearBuilt: property.yearBuilt || property.YearBuilt,
          garage: property.garage || property.GarageSpaces || 0,
          propertyType:
            property.propertyType || property.PropertyType || "Single Family",
          status: property.status || property.StandardStatus || "Unknown",
          standardStatus:
            property.status || property.StandardStatus || "Unknown",
          subdivision: property.subdivision || property.SubdivisionName || "",
          waterfront: property.waterfront || false,
          newConstruction: property.newConstruction || false,
          featured:
            filters.isFeatured ||
            (property.listPrice || property.soldPrice || property.price || 0) >
              500000,
          luxury:
            (property.listPrice || property.soldPrice || property.price || 0) >
            800000,
          images: property.imageUrl
            ? [property.imageUrl]
            : Array.isArray(property.images)
            ? property.images.filter((x: any) => !!x)
            : [],
          coordinates: {
            lat: property.latitude || 41.2565,
            lng: property.longitude || -95.9345,
          },
          description: `${property.propertyType || "Property"} in ${
            property.subdivision || property.city
          }`,
          photoCount: property.imageUrl ? 1 : 0,
          listAgent: property.listAgent?.name || "Unknown Agent",
          listOffice: property.listOffice?.name || "Unknown Office",
        })
      );

      res.json({
        data: transformedProperties,
        source: "cma-api-post",
        total: cmaData.totalAvailable || transformedProperties.length,
        cached: false,
        searchCriteria: req.body,
      });
    } catch (error) {
      console.error("❌ POST Properties API error:", error);

      res.status(500).json({
        data: [],
        source: "post-error",
        total: 0,
        error:
          error instanceof Error ? error.message : "Properties API unavailable",
      });
    }
  });

  // Location suggestions (basic static list for autocomplete)
  app.get("/api/location-suggestions", async (req, res) => {
    const raw = (req.query.query as string) || "";
    const q = raw.toLowerCase().trim();
    if (!q || q.length < 2) return res.json({ suggestions: [] });

    // Core Nebraska metros & suburbs (expanded list for better coverage)
    const cities = [
      "Omaha, NE",
      "Lincoln, NE",
      "Papillion, NE",
      "La Vista, NE",
      "Bellevue, NE",
      "Bennington, NE",
      "Gretna, NE",
      "Elkhorn, NE",
      "Ralston, NE",
      "Fremont, NE",
      "Ashland, NE",
      "Valley, NE",
      "Springfield, NE",
      "Waverly, NE",
      "Seward, NE",
      "Council Bluffs, IA",
      "Millard, NE",
      "Benson, NE",
      "Florence, NE",
      "Irvington, NE",
      "Chalco, NE",
      "Boys Town, NE",
      "Waterloo, NE",
      "Yutan, NE",
      "Blair, NE",
      "Tekamah, NE",
      "Arlington, NE",
      "Kennard, NE",
      "Plattsmouth, NE",
      "Louisville, NE",
      "Cedar Creek, NE",
      "Murdock, NE",
      "Weeping Water, NE",
      "Eagle, NE",
      "Hickman, NE",
      "Bennet, NE",
      "Palmyra, NE",
      "Utica, NE",
      "Garland, NE",
      "Pleasant Dale, NE",
      "Malcolm, NE",
      "Denton, NE",
      "Roca, NE",
      "Firth, NE",
      "Cortland, NE",
      "Clatonia, NE",
      "Hallam, NE",
      "Martell, NE",
      "Grand Island, NE",
      "Kearney, NE",
      "Norfolk, NE",
      "North Platte, NE",
      "Columbus, NE",
      "Hastings, NE",
      "York, NE",
      "Nebraska City, NE",
      "Beatrice, NE",
    ];
    const zips = [
      "68022",
      "68118",
      "68130",
      "68144",
      "68116",
      "68124",
      "68007",
      "68028",
      "68138",
      "68154",
      "68516",
      "68506",
      "68510",
      "68502",
      "68505",
      "68164",
      "68114",
      "68111",
      "68104",
      "68105",
      "68106",
      "68107",
      "68108",
      "68110",
      "68112",
      "68117",
      "68122",
      "68127",
      "68131",
      "68132",
      "68134",
      "68135",
      "68137",
      "68142",
      "68152",
      "68157",
      "68164",
      "68178",
      "68182",
      "68198",
      "68501",
      "68503",
      "68504",
      "68507",
      "68508",
      "68512",
      "68514",
      "68517",
      "68520",
      "68521",
      "68522",
      "68523",
      "68524",
      "68526",
      "68527",
      "68528",
      "68529",
      "68531",
      "68532",
      "68588",
      "68025",
      "68015",
      "68046",
      "68064",
      "68069",
      "68133",
      "68010",
      "68017",
      "68019",
      "68020",
      "68050",
      "68058",
      "68059",
      "68005",
      "68123",
      "68128",
      "68136",
      "68147",
      "68339",
      "68347",
      "68349",
      "68372",
      "68014",
      "68023",
      "68065",
      "68003",
      "68933",
      "68847",
      "68827",
      "68370",
      "68901",
      "68803",
      "68701",
      "69101",
      "68601",
      "68901",
      "68467",
      "68310",
      "68310",
      "68005",
    ];

    const cityMatches = cities
      .filter((c) => c.toLowerCase().includes(q))
      .map((c) => ({
        label: c,
        value: c.replace(/, NE|, IA/, "").trim(),
        type: "city",
      }));
    const zipMatches = zips
      .filter((z) => z.startsWith(q))
      .map((z) => ({ label: `${z} (Zip)`, value: z, type: "zip" }));

    let suggestions: any[] = [...cityMatches, ...zipMatches];

    // Filter out any suggestions that look like MLS numbers (8+ digits)
    suggestions = suggestions.filter((suggestion) => {
      const value = suggestion.value.toString();
      // Remove suggestions that are 8+ digit numbers (likely MLS IDs)
      return !value.match(/^\d{8,}$/);
    });

    // If it looks like a street address (starts with number + word), attempt quick address resolution for suggestion
    if (/^\d+\s+\S+/.test(q)) {
      try {
        // Generate simplified variants similar to address-property route
        const cleaned = raw.trim();
        const noUSA = cleaned.replace(/,?\s*USA$/i, "").trim();
        const noZip = noUSA
          .replace(/,\s*[A-Z]{2}\s*\d{5}(-\d{4})?$/i, "")
          .trim();
        const baseNoCityState = noZip.split(/,/)[0].trim();
        const variants = Array.from(new Set([cleaned, baseNoCityState])).filter(
          (v) => v.length >= 5
        );

        let foundAddress: any = null;
        for (const variant of variants) {
          try {
            const resp = await fetch(
              "http://gbcma.us-east-2.elasticbeanstalk.com/api/property-details-from-address",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address: variant }),
              }
            );
            if (resp.ok) {
              const data = await resp.json();
              const label = data.fullAddress || data.address || variant;
              foundAddress = {
                label,
                value: label,
                type: "address",
              };
              break;
            }
          } catch (e) {
            // ignore individual variant errors
          }
        }
        if (foundAddress) {
          // Prepend address suggestion with priority
          suggestions.unshift(foundAddress);
        }
      } catch (e) {
        console.log("location-suggestions address probe error", e);
      }
    }

    res.json({ suggestions: suggestions.slice(0, 12) });
  });

  // Address -> single property quick lookup (user enters a full street address)
  app.post("/api/address-property", async (req, res) => {
    try {
      const address = (req.body?.address || "").trim();
      console.log("🏠 Address property lookup request:", address);
      if (!address) return res.status(400).json({ error: "address required" });
      const debugEnabled =
        (req.query.debug as string) === "1" ||
        (req.query.debug as string)?.toLowerCase() === "true";

      const photoFieldReport = (data: any) => {
        if (!data || typeof data !== "object") return {};
        const fields = [
          "Media",
          "photos",
          "PhotoUrls",
          "photoUrls",
          "images",
          "Images",
          "Photos",
          "photoURLs",
          "imageURLs",
          "photoUrl",
          "primaryPhoto",
          "imageUrl",
          "primaryImage",
          "mainPhoto",
        ];
        const report: Record<string, any> = {};
        for (const f of fields) {
          if (f in data) {
            const v: any = (data as any)[f];
            if (Array.isArray(v))
              report[f] = { type: "array", length: v.length };
            else if (v && typeof v === "object") report[f] = { type: "object" };
            else report[f] = { type: typeof v, value: v };
          }
        }
        return report;
      };

      const triedVariants: string[] = [];

      // Helper to safely pick numeric value from several keys
      const pickFirst = (...vals: any[]) =>
        vals.find(
          (v) => v !== undefined && v !== null && v !== "" && !Number.isNaN(v)
        );
      const coerceNumber = (v: any) => {
        if (v === undefined || v === null || v === "") return undefined;
        const n =
          typeof v === "string" ? parseFloat(v.replace(/[^0-9.]/g, "")) : v;
        return Number.isFinite(n) ? n : undefined;
      };
      const buildProperty = (data: any, addr: string) => {
        const beds =
          coerceNumber(
            pickFirst(
              data.beds,
              data.Beds,
              data.bedroomsTotal,
              data.BedroomsTotal,
              data.bedroomsTotalInteger,
              data.BedroomsTotalInteger
            )
          ) || 0;
        const fullBaths = coerceNumber(
          pickFirst(
            data.baths,
            data.Baths,
            data.bathroomsTotalInteger,
            data.BathroomsTotalInteger,
            data.fullBaths,
            data.FullBaths
          )
        );
        const halfBaths = coerceNumber(
          pickFirst(
            data.halfBaths,
            data.HalfBaths,
            data.bathroomsHalf,
            data.BathroomsHalf
          )
        );
        let bathsNumeric: number | undefined = fullBaths;
        if (fullBaths !== undefined && halfBaths !== undefined)
          bathsNumeric = fullBaths + halfBaths * 0.5;
        if (bathsNumeric === undefined)
          bathsNumeric = coerceNumber(data.bathrooms) || 0;
        // ABOVE / BASEMENT / TOTAL SQFT NORMALIZATION
        const aboveGradeSqft = coerceNumber(
          pickFirst(
            data.aboveGradeFinishedArea,
            data.AboveGradeFinishedArea,
            data.livingArea,
            data.LivingArea,
            data.sqft
          )
        );
        const basementSqft = coerceNumber(
          pickFirst(
            data.belowGradeFinishedArea,
            data.BelowGradeFinishedArea,
            data.basementFinishedArea,
            data.BasementFinishedArea
          )
        );
        const totalProvided = coerceNumber(
          pickFirst(
            data.totalArea,
            data.TotalArea,
            data.buildingAreaTotal,
            data.BuildingAreaTotal,
            data.SqFtTotal
          )
        );
        const totalSqft =
          totalProvided ||
          (aboveGradeSqft || 0) + (basementSqft || 0) ||
          undefined;
        const sqft = aboveGradeSqft || totalProvided || 0; // expose above grade as primary sqft like legacy UI
        const garageSpaces = coerceNumber(
          pickFirst(
            data.garageSpaces,
            data.GarageSpaces,
            data.garage,
            data.Garage,
            data.parkingTotal,
            data.ParkingTotal
          )
        );
        const style = pickFirst(
          data.style,
          data.Style,
          data.architecturalStyle,
          data.ArchitecturalStyle
        );
        // Enhanced photo normalization: gather from many potential fields
        const mediaPhotos = Array.isArray(data.Media)
          ? data.Media.filter(
              (m: any) =>
                m &&
                (m.MediaURL || m.mediaURL) && // accept if category missing or clearly photo
                (!m.MediaCategory ||
                  !m.mediaCategory ||
                  [
                    (m.MediaCategory || "").toLowerCase(),
                    (m.mediaCategory || "").toLowerCase(),
                  ].includes("photo"))
            )
              .sort(
                (a: any, b: any) =>
                  (a.Order || a.order || 0) - (b.Order || b.order || 0)
              )
              .map((m: any) => m.MediaURL || m.mediaURL)
          : [];
        const rawPhotos = Array.isArray(data.photos)
          ? data.photos.filter(Boolean)
          : [];
        const photoUrlsArr = Array.isArray(data.PhotoUrls || data.photoUrls)
          ? (data.PhotoUrls || data.photoUrls).filter(Boolean)
          : typeof data.PhotoUrls === "string"
          ? [data.PhotoUrls]
          : typeof data.photoUrls === "string"
          ? [data.photoUrls]
          : [];
        // Additional single-value or alt-field candidates
        const singleCandidates = [
          data.photoUrl,
          data.primaryPhoto,
          data.imageUrl,
          data.primaryImage,
          data.mainPhoto,
        ].filter(Boolean);
        // Alternate array style fields
        const altArrays: any[] = [];
        if (Array.isArray(data.images)) altArrays.push(...data.images);
        if (Array.isArray(data.Images)) altArrays.push(...data.Images);
        if (Array.isArray(data.Photos)) altArrays.push(...data.Photos);
        if (Array.isArray(data.photoURLs)) altArrays.push(...data.photoURLs);
        if (Array.isArray(data.imageURLs)) altArrays.push(...data.imageURLs);
        const altFiltered = altArrays.filter(Boolean);
        const photos = Array.from(
          new Set([
            ...mediaPhotos,
            ...rawPhotos,
            ...photoUrlsArr,
            ...singleCandidates,
            ...altFiltered,
          ])
        ).filter(
          (url: any) => typeof url === "string" && /https?:\/\//i.test(url)
        );
        if (photos.length === 0) {
          console.log("[image-normalization] no photos resolved for property", {
            mlsId: data.mlsId || data.ListingId || data.listingKey,
            providedKeys: Object.keys(data || {}),
          });
        }
        return {
          id: Date.now(),
          mlsId: data.mlsId || data.ListingId || data.listingKey || undefined,
          listingKey: data.listingKey || data.mlsId || undefined,
          title: data.publicRemarks || data.description || addr,
          description: data.PublicRemarks || "Details coming soon.",
          price: (
            pickFirst(
              data.listPrice,
              data.price,
              data.currentPrice,
              data.ListPrice
            ) || 0
          ).toString(),
          address: addr,
          city: data.city || data.City || "",
          state: data.state || data.State || "NE",
          zipCode: data.postalCode || data.PostalCode || data.zipCode || "",
          beds,
          baths: bathsNumeric?.toString() || "0",
          sqft,
          aboveGradeSqft: aboveGradeSqft || undefined,
          basementSqft: basementSqft || undefined,
          totalSqft: totalSqft || undefined,
          garage: garageSpaces || 0,
          garageSpaces: garageSpaces || 0,
          yearBuilt: pickFirst(data.yearBuilt, data.YearBuilt) || null,
          propertyType:
            pickFirst(data.propertyType, data.PropertyType) || "Residential",
          status: (
            pickFirst(data.status, data.StandardStatus, data.standardStatus) ||
            "unknown"
          ).toLowerCase(),
          standardStatus: pickFirst(data.StandardStatus, data.standardStatus),
          featured: false,
          luxury: false,
          images: photos,
          neighborhood:
            pickFirst(
              data.neighborhood,
              data.SubdivisionName,
              data.subdivision,
              data.Subdivision
            ) || undefined,
          schoolDistrict:
            pickFirst(
              // Try NEW field names first (from updated API)
              data.schoolElementaryDistrict,
              data.schoolMiddleDistrict,
              data.schoolHighDistrict,
              // Fallback to OLD field names (legacy support)
              data.schoolDistrict,
              data.SchoolDistrict
            ) || undefined,
          // Individual school names
          schoolElementary:
            pickFirst(data.schoolElementary, data.ElementarySchool) ||
            undefined,
          schoolMiddle:
            pickFirst(data.schoolMiddle, data.MiddleOrJuniorSchool) ||
            undefined,
          schoolHigh: pickFirst(data.schoolHigh, data.HighSchool) || undefined,
          style: style || undefined,
          coordinates:
            data.latitude && data.longitude
              ? {
                  lat: parseFloat(data.latitude),
                  lng: parseFloat(data.longitude),
                }
              : undefined,
          features: [],
          architecturalStyle:
            data.architecturalStyle || data.ArchitecturalStyle || undefined,
          secondaryStyle: undefined,
          styleConfidence: undefined,
          styleFeatures: undefined,
          styleAnalyzed: false,
          listingAgentKey:
            pickFirst(
              data.ListAgentMlsId,
              data.listAgentMlsId,
              data.listingAgentId
            ) || undefined,
          listingOfficeName:
            pickFirst(data.ListOfficeName, data.listOfficeName) || undefined,
          listingContractDate:
            pickFirst(data.ListingContractDate, data.listingContractDate) ||
            undefined,
          daysOnMarket:
            pickFirst(data.DaysOnMarket, data.daysOnMarket) || undefined,
          originalListPrice:
            pickFirst(data.OriginalListPrice, data.originalListPrice) ||
            undefined,
          mlsStatus:
            pickFirst(
              data.MLSStatus,
              data.mlsStatus,
              data.StandardStatus,
              data.standardStatus
            ) || undefined,
          modificationTimestamp:
            pickFirst(data.ModificationTimestamp, data.modificationTimestamp) ||
            undefined,
          photoCount:
            pickFirst(data.photoCount, data.PhotosCount) ||
            (Array.isArray(data.photos) ? data.photos.length : undefined),
          virtualTourUrl:
            pickFirst(data.VirtualTourURLUnbranded, data.virtualTourUrl) ||
            undefined,
          isIdxListing: true,
          idxSyncedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      };

      // Strategy 1: direct lookup with full address
      try {
        console.log("🏠 Trying direct address lookup...");
        const resp = await fetch(
          "http://gbcma.us-east-2.elasticbeanstalk.com/api/property-details-from-address",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address }),
          }
        );
        console.log("🏠 Direct lookup response status:", resp.status);
        if (resp.ok) {
          const data = await resp.json();
          const rawKeys = Object.keys(data || {});

          // Debug: Check if PublicRemarks exists
          console.log("🏠 PublicRemarks exists:", !!data.PublicRemarks);
          if (data.PublicRemarks) {
            console.log("🏠 PublicRemarks length:", data.PublicRemarks.length);
            console.log(
              "🏠 PublicRemarks preview:",
              data.PublicRemarks.substring(0, 100)
            );
          }

          const property = buildProperty(data, address);
          return res.json({
            property,
            raw: data,
            method: "direct",
            triedVariants,
            ...(debugEnabled
              ? {
                  debug: {
                    rawKeys,
                    photoFields: photoFieldReport(data),
                    photosResolved: property.images.length,
                  },
                }
              : {}),
          });
        }
      } catch (err) {
        console.log("🏠 Direct lookup error (continuing):", err);
      }

      // Strategy 1b: variant lookups (progressively simplified address forms)
      const normalized = address.replace(/\s+/g, " ").trim();
      const variantsSet = new Set<string>();
      const pushVariant = (v: string) => {
        const t = v.trim();
        if (t && t.toLowerCase() !== normalized.toLowerCase())
          variantsSet.add(t);
      };
      const withoutCountry = normalized.replace(/,?\s*USA$/i, "").trim();
      const withoutZip = withoutCountry
        .replace(/,?\s*\d{5}(?:-\d{4})?$/i, "")
        .trim();
      const withoutState = withoutZip.replace(/,?\s+NE$/i, "").trim();
      // Remove trailing city if present (keep number + street)
      const coreParts = withoutState.split(",");
      if (coreParts.length > 1) {
        pushVariant(coreParts[0]);
      }
      pushVariant(withoutCountry);
      pushVariant(withoutZip);
      pushVariant(withoutState);
      // Remove common street suffix abbreviations (e.g., St, Street) to try raw number + name
      const streetCore = withoutState
        .replace(
          /\b(Street|St|Avenue|Ave|Road|Rd|Court|Ct|Drive|Dr|Lane|Ln)\.?$/i,
          ""
        )
        .trim();
      pushVariant(streetCore);

      const variants = Array.from(variantsSet).slice(0, 8); // safety cap
      for (const variant of variants) {
        triedVariants.push(variant);
        try {
          const vResp = await fetch(
            "http://gbcma.us-east-2.elasticbeanstalk.com/api/property-details-from-address",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address: variant }),
            }
          );
          if (vResp.ok) {
            const data = await vResp.json();
            const rawKeys = Object.keys(data || {});
            const property = buildProperty(data, variant);
            return res.json({
              property,
              raw: data,
              method: "variant",
              triedVariants,
              ...(debugEnabled
                ? {
                    debug: {
                      rawKeys,
                      photoFields: photoFieldReport(data),
                      photosResolved: property.images.length,
                      publicRemarksExists: !!data.PublicRemarks,
                      publicRemarksPreview: data.PublicRemarks
                        ? data.PublicRemarks.substring(0, 100)
                        : null,
                      propertyDescription: property.description,
                    },
                  }
                : {}),
            });
          }
        } catch (variantErr) {
          console.log("🏠 Variant lookup failed for", variant, variantErr);
        }
      }

      // Strategy 2: broader search fallback
      console.log("🏠 Trying broader property search fallback...");
      const searchAddress = address.replace(/,.*$/, "").trim();
      try {
        const searchParams = new URLSearchParams({
          address: searchAddress,
          limit: "50",
          status: "both", // Include both active and sold for address matching
          exclude_zero_price: "true", // Filter out incomplete data
        });
        const searchResp = await fetch(
          `http://gbcma.us-east-2.elasticbeanstalk.com/api/cma-comparables?${searchParams}`
        );
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          console.log("🏠 Search response:", {
            activeCount: searchData.active?.length || 0,
            soldCount: searchData.sold?.length || 0,
          });
          const allProperties = [
            ...(searchData.active || []),
            ...(searchData.sold || []),
          ];
          const addressMatch = allProperties.find((prop: any) => {
            const propAddress = prop.address || prop.unparsedAddress || "";
            const searchTerms = searchAddress.toLowerCase().split(" ");
            const propAddressLower = propAddress.toLowerCase();
            return searchTerms.every((term: string) =>
              propAddressLower.includes(term)
            );
          });
          if (addressMatch) {
            console.log(
              "🏠 Found matching property via search:",
              addressMatch.address || addressMatch.unparsedAddress
            );
            // Reuse numeric helpers (defined earlier in same scope)
            const beds =
              coerceNumber(
                (addressMatch as any).bedroomsTotal ??
                  (addressMatch as any).beds
              ) || 0;
            const fullBaths = coerceNumber(
              (addressMatch as any).bathroomsTotalInteger ??
                (addressMatch as any).baths
            );
            const sqft =
              coerceNumber(
                (addressMatch as any).livingArea ?? (addressMatch as any).sqft
              ) || 0;
            const garageSpaces =
              coerceNumber(
                (addressMatch as any).garageSpaces ??
                  (addressMatch as any).GarageSpaces ??
                  (addressMatch as any).garage
              ) || 0;
            const property = {
              id: Date.now(),
              mlsId:
                addressMatch.mlsId ||
                addressMatch.listingId ||
                addressMatch.listingKey,
              listingKey: addressMatch.listingKey || addressMatch.mlsId,
              title:
                addressMatch.publicRemarks ||
                addressMatch.address ||
                addressMatch.unparsedAddress ||
                address,
              description:
                addressMatch.PublicRemarks ||
                addressMatch.publicRemarks ||
                "Property found via search",
              price: (
                addressMatch.listPrice ||
                addressMatch.price ||
                0
              ).toString(),
              address:
                addressMatch.address || addressMatch.unparsedAddress || address,
              city: addressMatch.city || "",
              state: addressMatch.state || addressMatch.stateOrProvince || "NE",
              zipCode: addressMatch.postalCode || addressMatch.zipCode || "",
              beds,
              baths: (fullBaths ?? 0).toString(),
              sqft,
              garage: garageSpaces,
              garageSpaces: garageSpaces,
              yearBuilt: addressMatch.yearBuilt || null,
              propertyType: addressMatch.propertyType || "Residential",
              status: (
                addressMatch.standardStatus ||
                addressMatch.status ||
                "unknown"
              ).toLowerCase(),
              standardStatus: addressMatch.standardStatus,
              featured: false,
              luxury: false,
              images: addressMatch.media?.map((m: any) => m.mediaURL) || [],
              neighborhood: addressMatch.subdivisionName || undefined,
              coordinates:
                addressMatch.latitude && addressMatch.longitude
                  ? {
                      lat: parseFloat(addressMatch.latitude),
                      lng: parseFloat(addressMatch.longitude),
                    }
                  : undefined,
              isIdxListing: true,
              idxSyncedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            return res.json({
              property,
              raw: addressMatch,
              method: "search",
              triedVariants,
              ...(debugEnabled
                ? {
                    debug: {
                      rawKeys: Object.keys(addressMatch || {}),
                      photoFields: photoFieldReport(addressMatch),
                      photosResolved: property.images.length,
                    },
                  }
                : {}),
            });
          }
        }
      } catch (searchErr) {
        console.log("🏠 Search fallback error:", searchErr);
      }

      // Not found
      console.log("🏠 No property found for address:", address);
      return res.status(404).json({
        error: "property_not_found",
        message: "No property found for this address in our database",
        address,
        triedVariants,
        ...(debugEnabled
          ? { debug: { triedVariants, note: "No variants produced a match" } }
          : {}),
      });
    } catch (e) {
      console.error("/api/address-property error", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // Property detail endpoint: supports
  // - address fast-path via ?address=...
  // - MLS fast-path via ?mls=... (legacy) or numeric :id treated as MLS
  // - fallback: search + details by address
  app.get("/api/property/:id", async (req, res) => {
    const { id } = req.params;
    const verbose = process.env.VERBOSE_PROPERTY_LOGS === "true";
    const log = (...a: any[]) => {
      if (verbose) console.log("[property-detail]", ...a);
    };
    log("request", { id, query: req.query });
    try {
      // Shared lightweight helpers (mirrors logic in address-property buildProperty)
      const pickFirst = (...vals: any[]) =>
        vals.find(
          (v) => v !== undefined && v !== null && v !== "" && !Number.isNaN(v)
        );
      const coerceNumber = (v: any) => {
        if (v === undefined || v === null || v === "") return undefined;
        const n =
          typeof v === "string" ? parseFloat(v.replace(/[^0-9.]/g, "")) : v;
        return Number.isFinite(n) ? n : undefined;
      };
      const extractPhotos = (data: any): string[] => {
        if (!data) return [];
        const mediaPhotos = Array.isArray(data.Media)
          ? data.Media.filter(
              (m: any) =>
                (m.MediaURL || m.mediaURL) && // accept if category missing or photo
                (!m.MediaCategory ||
                  !m.mediaCategory ||
                  [
                    (m.MediaCategory || "").toLowerCase(),
                    (m.mediaCategory || "").toLowerCase(),
                  ].includes("photo"))
            )
              .sort(
                (a: any, b: any) =>
                  (a.Order || a.order || 0) - (b.Order || b.order || 0)
              )
              .map((m: any) => m.MediaURL || m.mediaURL)
          : [];
        const rawPhotos = Array.isArray(data.photos)
          ? data.photos.filter(Boolean)
          : [];
        const photoUrls = Array.isArray(data.PhotoUrls)
          ? data.PhotoUrls.filter(Boolean)
          : Array.isArray(data.photoUrls)
          ? data.photoUrls.filter(Boolean)
          : [];
        const singleCandidates = [
          data.photoUrl,
          data.primaryPhoto,
          data.imageUrl,
          data.primaryImage,
          data.mainPhoto,
        ].filter(Boolean);
        const altArrays: any[] = [];
        if (Array.isArray(data.images)) altArrays.push(...data.images);
        if (Array.isArray(data.Images)) altArrays.push(...data.Images);
        if (Array.isArray(data.Photos)) altArrays.push(...data.Photos);
        if (Array.isArray(data.photoURLs)) altArrays.push(...data.photoURLs);
        if (Array.isArray(data.imageURLs)) altArrays.push(...data.imageURLs);
        const altFiltered = altArrays.filter(Boolean);
        const merged = Array.from(
          new Set([
            ...mediaPhotos,
            ...rawPhotos,
            ...photoUrls,
            ...singleCandidates,
            ...altFiltered,
          ])
        ).filter((u: any) => typeof u === "string" && /https?:\/\//i.test(u));
        if (merged.length === 0) {
          console.log("[image-normalization] (detail) no photos resolved", {
            mlsId: data.mlsId || data.ListingId || data.listingKey,
            keys: Object.keys(data || {}),
          });
        }
        return merged;
      };
      // Fast path resolution (address or mls)
      let directAddress = (req.query.address as string | undefined)?.trim();
      let mlsParamFast = (req.query.mls as string | undefined)?.trim();
      // If mls not explicitly provided, attempt to infer from :id
      if (!mlsParamFast) {
        if (/^\d{6,}$/.test(id)) {
          mlsParamFast = id; // pure numeric id
          log("treat numeric :id as MLS", id);
        } else if (/\d{6,}/.test(id)) {
          // Extract first 6+ digit run inside a slug e.g. some-address-1234567
          const match = id.match(/(\d{6,})/);
          if (match) {
            mlsParamFast = match[1];
            log("extracted embedded MLS from slug", id, "=>", mlsParamFast);
          }
        }
      }
      if (!directAddress && mlsParamFast) {
        try {
          console.log(`🔍 Attempting MLS fast lookup for: ${mlsParamFast}`);
          const lookupResp = await fetch(
            `http://gbcma.us-east-2.elasticbeanstalk.com/api/cma-comparables?mls_number=${encodeURIComponent(
              mlsParamFast
            )}&status=active&limit=1`
          );
          if (lookupResp.ok) {
            const lookupJson = await lookupResp.json();
            console.log(`MLS lookup response:`, {
              hasProperties: !!lookupJson.properties,
              propertiesLength: lookupJson.properties?.length || 0,
              hasData: !!lookupJson.data,
              dataLength: lookupJson.data?.length || 0,
            });

            const first = Array.isArray(lookupJson.properties)
              ? lookupJson.properties[0]
              : Array.isArray(lookupJson.data)
              ? lookupJson.data[0]
              : null;
            if (first) {
              console.log("🏠 Found MLS property:", first.address);
              log("mls property found", first.address);
              let actualMLSNumber = mlsParamFast; // default to requested MLS
              if (first.imageUrl) {
                log("inspect imageUrl for MLS", first.imageUrl);
                const mlsMatch = first.imageUrl.match(/\/GPRMLS\/(\d+)\//);
                if (mlsMatch) {
                  actualMLSNumber = mlsMatch[1];
                  log("extracted MLS from imageUrl", actualMLSNumber);
                }
              }
              const property = {
                id: actualMLSNumber,
                mlsId: actualMLSNumber,
                listingKey: actualMLSNumber,
                mlsNumber: actualMLSNumber,
                title: `${first.beds} Bed ${first.baths} Bath in ${first.city}`,
                description: `${first.propertyType || "Residential"} in ${
                  first.subdivision || first.city
                }`,
                price: (first.listPrice || 0).toString(),
                address: first.address,
                city: first.city || "",
                state: first.state || "NE",
                zipCode: first.zipCode || "",
                beds: first.beds || 0,
                baths: (first.baths ?? 0).toString(),
                sqft: first.sqft || 0,
                aboveGradeSqft: first.sqft || undefined,
                basementSqft: first.basementSqft || undefined,
                totalSqft: first.totalSqft || first.sqft || undefined,
                garage: first.garage || 0,
                garageSpaces: first.garage || 0,
                yearBuilt: first.yearBuilt || null,
                propertyType: first.propertyType || "Residential",
                status: (first.status || "unknown").toLowerCase(),
                standardStatus: first.status || undefined,
                featured: false,
                luxury: first.listPrice >= 750000,
                images: first.imageUrl ? [first.imageUrl] : [],
                neighborhood: first.subdivision || undefined,
                style: first.style || undefined,
                coordinates:
                  first.latitude && first.longitude
                    ? { lat: first.latitude, lng: first.longitude }
                    : undefined,
                pricePerSqft: first.pricePerSqft || undefined,
                lotSizeAcres: first.lotSizeAcres || undefined,
                waterfront: first.waterfront || false,
                newConstruction: first.newConstruction || false,
              };
              return res.json({ success: true, property });
            } else {
              console.log(
                `❌ MLS ${mlsParamFast} not found in CMA API response`
              );
            }
            if (first?.address) directAddress = first.address;
          } else {
            console.log(
              `CMA API returned status ${lookupResp.status} for MLS lookup`
            );
          }
        } catch (e) {
          console.warn("MLS fast lookup failed", e);
        }
      }
      if (directAddress) {
        try {
          const resp = await fetch(
            "http://gbcma.us-east-2.elasticbeanstalk.com/api/property-details-from-address",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address: directAddress }),
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            const beds = coerceNumber(
              pickFirst(
                data.beds,
                data.Beds,
                data.bedroomsTotal,
                data.BedroomsTotal
              )
            );
            const fullBaths = coerceNumber(
              pickFirst(
                data.baths,
                data.Baths,
                data.bathroomsTotalInteger,
                data.BathroomsTotalInteger,
                data.fullBaths,
                data.FullBaths
              )
            );
            const halfBaths = coerceNumber(
              pickFirst(
                data.halfBaths,
                data.HalfBaths,
                data.bathroomsHalf,
                data.BathroomsHalf
              )
            );
            let bathsNumeric: number | undefined = fullBaths;
            if (fullBaths !== undefined && halfBaths !== undefined)
              bathsNumeric = fullBaths + halfBaths * 0.5;
            if (bathsNumeric === undefined)
              bathsNumeric = coerceNumber(data.bathrooms);
            const aboveGradeSqft = coerceNumber(
              pickFirst(
                data.aboveGradeFinishedArea,
                data.AboveGradeFinishedArea,
                data.livingArea,
                data.LivingArea,
                data.sqft
              )
            );
            const basementSqft = coerceNumber(
              pickFirst(
                data.belowGradeFinishedArea,
                data.BelowGradeFinishedArea,
                data.basementFinishedArea,
                data.BasementFinishedArea
              )
            );
            const totalProvided = coerceNumber(
              pickFirst(
                data.totalArea,
                data.TotalArea,
                data.buildingAreaTotal,
                data.BuildingAreaTotal,
                data.SqFtTotal
              )
            );
            const totalSqft =
              totalProvided ||
              (aboveGradeSqft || 0) + (basementSqft || 0) ||
              undefined;
            const sqft = aboveGradeSqft || totalProvided || 0;
            const garageSpaces = coerceNumber(
              pickFirst(
                data.garageSpaces,
                data.GarageSpaces,
                data.garage,
                data.Garage,
                data.parkingTotal,
                data.ParkingTotal
              )
            );
            const photos = extractPhotos(data);
            const property = {
              id: id,
              mlsId: data.mlsId || data.ListingId || data.listingKey || id,
              listingKey: data.listingKey || data.mlsId || id,
              title: data.publicRemarks || data.description || directAddress,
              description:
                data.PublicRemarks ||
                data.publicRemarks ||
                data.description ||
                data.PrivateRemarks ||
                data.MarketingRemarks ||
                data.Remarks ||
                data.PropertyDescription ||
                data.propertyDescription ||
                data.listingDescription ||
                data.ListingDescription ||
                data.summary ||
                data.Summary ||
                "Details coming soon.",
              price: (
                pickFirst(
                  data.listPrice,
                  data.price,
                  data.currentPrice,
                  data.ListPrice
                ) || 0
              ).toString(),
              address: directAddress,
              city: data.city || data.City || "",
              state: data.state || data.State || "NE",
              zipCode: data.postalCode || data.PostalCode || data.zipCode || "",
              beds: beds || 0,
              baths: (bathsNumeric ?? 0).toString(),
              sqft: sqft || 0,
              aboveGradeSqft: aboveGradeSqft || undefined,
              basementSqft: basementSqft || undefined,
              totalSqft: totalSqft || undefined,
              garage: garageSpaces || 0,
              garageSpaces: garageSpaces || 0,
              yearBuilt: pickFirst(data.yearBuilt, data.YearBuilt) || null,
              propertyType:
                pickFirst(data.propertyType, data.PropertyType) ||
                "Residential",
              status: (
                pickFirst(
                  data.status,
                  data.StandardStatus,
                  data.standardStatus
                ) || "unknown"
              ).toLowerCase(),
              standardStatus:
                pickFirst(data.StandardStatus, data.standardStatus) ||
                undefined,
              featured: false,
              luxury: false,
              images: photos,
              neighborhood:
                pickFirst(
                  data.neighborhood,
                  data.SubdivisionName,
                  data.subdivision,
                  data.Subdivision
                ) || undefined,
              schoolDistrict: (() => {
                const schoolData = {
                  // OLD field names (legacy support)
                  schoolDistrict: data.schoolDistrict,
                  SchoolDistrict: data.SchoolDistrict,
                  ElementarySchoolDistrict: data.ElementarySchoolDistrict,
                  MiddleOrJuniorSchoolDistrict:
                    data.MiddleOrJuniorSchoolDistrict,
                  HighSchoolDistrict: data.HighSchoolDistrict,
                  // NEW field names (from updated API)
                  schoolElementary: data.schoolElementary,
                  schoolElementaryDistrict: data.schoolElementaryDistrict,
                  schoolMiddle: data.schoolMiddle,
                  schoolMiddleDistrict: data.schoolMiddleDistrict,
                  schoolHigh: data.schoolHigh,
                  schoolHighDistrict: data.schoolHighDistrict,
                  city: data.city || data.City,
                };
                console.log(`🏫 School data for property ${id}:`, schoolData);
                const actualSchoolDistrict = pickFirst(
                  // Try NEW field names first (from updated API)
                  data.schoolElementaryDistrict,
                  data.schoolMiddleDistrict,
                  data.schoolHighDistrict,
                  // Fallback to OLD field names (legacy support)
                  data.schoolDistrict,
                  data.SchoolDistrict,
                  data.ElementarySchoolDistrict,
                  data.MiddleOrJuniorSchoolDistrict,
                  data.HighSchoolDistrict
                );
                return actualSchoolDistrict || null; // Return null if no actual data available
              })(),
              // Individual school names
              schoolElementary:
                pickFirst(data.schoolElementary, data.ElementarySchool) || null,
              schoolMiddle:
                pickFirst(data.schoolMiddle, data.MiddleOrJuniorSchool) || null,
              schoolHigh: pickFirst(data.schoolHigh, data.HighSchool) || null,
              style:
                pickFirst(
                  data.style,
                  data.Style,
                  data.architecturalStyle,
                  data.ArchitecturalStyle
                ) || undefined,
              coordinates:
                data.latitude && data.longitude
                  ? {
                      lat: parseFloat(data.latitude),
                      lng: parseFloat(data.longitude),
                    }
                  : undefined,
              features: [],
              architecturalStyle:
                data.architecturalStyle || data.ArchitecturalStyle || undefined,
              secondaryStyle: undefined,
              styleConfidence: undefined,
              styleFeatures: undefined,
              styleAnalyzed: false,
              listingAgentKey:
                pickFirst(
                  data.ListAgentMlsId,
                  data.listAgentMlsId,
                  data.listingAgentId
                ) || undefined,
              listingOfficeName:
                pickFirst(data.ListOfficeName, data.listOfficeName) ||
                undefined,
              listingContractDate:
                pickFirst(data.ListingContractDate, data.listingContractDate) ||
                undefined,
              daysOnMarket:
                pickFirst(data.DaysOnMarket, data.daysOnMarket) || undefined,
              originalListPrice:
                pickFirst(data.OriginalListPrice, data.originalListPrice) ||
                undefined,
              mlsStatus:
                pickFirst(
                  data.MLSStatus,
                  data.mlsStatus,
                  data.StandardStatus,
                  data.standardStatus
                ) || undefined,
              modificationTimestamp:
                pickFirst(
                  data.ModificationTimestamp,
                  data.modificationTimestamp
                ) || undefined,
              photoCount: photos.length,
              virtualTourUrl:
                pickFirst(data.VirtualTourURLUnbranded, data.virtualTourUrl) ||
                undefined,
              isIdxListing: true,
              idxSyncedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            return res.json({ success: true, property, source: "direct" });
          }
          // if not ok fall through to legacy strategy
        } catch (addrErr) {
          console.log(
            "Direct address param detail lookup failed, falling back",
            addrErr
          );
        }
      }
      // Strategy:
      // 1. Try to find property in recent CMA search cache (optional future optimization)
      // 2. Fallback: perform a broad search (city from address or default) to locate the property record to extract address
      // 3. Use the address with external details endpoint

      // Extract city from directAddress if available, else default to Lincoln
      let searchCity = "lincoln"; // default
      if (directAddress) {
        const cityMatch = directAddress.match(/,\s*([^,]+),\s*NE/i);
        if (cityMatch) {
          searchCity = cityMatch[1].trim().toLowerCase();
        }
      }

      // We'll attempt a search call similar to featured listings to gather context
      let searchUrl = `http://gbcma.us-east-2.elasticbeanstalk.com/api/cma-comparables?city=${encodeURIComponent(
        searchCity
      )}&limit=100&status=active&exclude_zero_price=true`;
      let baseProperty: any | null = null;
      let triedBroadSearch = false;

      try {
        const resp = await fetch(searchUrl);
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.data)) {
            baseProperty = data.data.find(
              (p: any) => p.id === id || p.mlsId === id || p.listingKey === id
            );
          } else if (Array.isArray(data.properties)) {
            baseProperty = data.properties.find(
              (p: any) => p.id === id || p.mlsId === id || p.listingKey === id
            );
          } else if (Array.isArray(data)) {
            baseProperty = data.find(
              (p: any) => p.id === id || p.mlsId === id || p.listingKey === id
            );
          }

          // If no property found with city-specific search, try broader search
          if (!baseProperty && !triedBroadSearch) {
            console.log(
              `No property found for ${id} in ${searchCity}, trying broader search...`
            );
            triedBroadSearch = true;
            const broadSearchUrl = `http://gbcma.us-east-2.elasticbeanstalk.com/api/cma-comparables?limit=200&status=active&exclude_zero_price=true`;
            const broadResp = await fetch(broadSearchUrl);
            if (broadResp.ok) {
              const broadData = await broadResp.json();
              if (Array.isArray(broadData.data)) {
                baseProperty = broadData.data.find(
                  (p: any) =>
                    p.id === id || p.mlsId === id || p.listingKey === id
                );
              } else if (Array.isArray(broadData.properties)) {
                baseProperty = broadData.properties.find(
                  (p: any) =>
                    p.id === id || p.mlsId === id || p.listingKey === id
                );
              } else if (Array.isArray(broadData)) {
                baseProperty = broadData.find(
                  (p: any) =>
                    p.id === id || p.mlsId === id || p.listingKey === id
                );
              }
              if (baseProperty) {
                console.log(`Found property ${id} in broader search`);
              }
            }
          }
        }
      } catch (e) {
        console.warn("Property search during detail lookup failed", e);
      }

      // If still no property found, try team properties endpoint as final fallback
      if (!baseProperty) {
        console.log(`Trying team properties endpoint for property ${id}...`);
        try {
          const teamPropsResp = await fetch(
            `http://gbcma.us-east-2.elasticbeanstalk.com/api/team-properties?limit=500&status=Active`
          );
          if (teamPropsResp.ok) {
            const teamData = await teamPropsResp.json();
            const teamProperties = teamData.properties || [];
            baseProperty = teamProperties.find(
              (p: any) => p.id === id || p.mlsId === id || p.listingKey === id
            );
            if (baseProperty) {
              console.log(`Found property ${id} in team properties`);
            }
          }
        } catch (teamErr) {
          console.warn("Team properties fallback failed", teamErr);
        }
      }

      // If still no property found, check if we have a direct address and create a minimal property object
      if (!baseProperty && directAddress) {
        console.log(
          `Creating minimal property object for ${id} with address: ${directAddress}`
        );
        baseProperty = {
          id: id,
          mlsId: id,
          listingKey: id,
          address: directAddress,
          city: searchCity,
          state: "NE",
          title: `Property at ${directAddress}`,
          description: "Property details are being processed.",
          price: 0,
          beds: 0,
          baths: 0,
          sqft: 0,
          propertyType: "Residential",
          status: "active",
          standardStatus: "Active",
          images: [],
        };
      }

      if (!baseProperty) {
        console.log(`❌ Property ${id} not found after all searches`);
        console.log(`Search details:`, {
          id,
          directAddress,
          mlsParamFast,
          searchCity,
          triedBroadSearch,
        });
        return res.status(404).json({
          success: false,
          message: "Property not found in search results",
          searchedSources: [
            "CMA API city search",
            "CMA API broad search",
            "Team Properties API",
          ],
          searchCity: searchCity,
          mlsId: id,
          directAddress: directAddress,
          debug: {
            mlsParamFast,
            triedBroadSearch,
          },
        });
      }

      const address =
        baseProperty.address ||
        baseProperty.fullAddress ||
        baseProperty.displayAddress;
      if (!address) {
        return res.status(404).json({
          success: false,
          message: "Address not available for property",
        });
      }

      // Call external property details endpoint by address
      const detailsResp = await fetch(
        "http://gbcma.us-east-2.elasticbeanstalk.com/api/property-details-from-address",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        }
      );

      let details: any = null;
      if (detailsResp.ok) {
        try {
          details = await detailsResp.json();
        } catch {}
      }

      // Merge basic + detail data into unified property object expected by frontend
      // Derive enhanced numeric + photo fields from details where available
      const detailAbove = coerceNumber(
        pickFirst(
          details?.aboveGradeFinishedArea,
          details?.AboveGradeFinishedArea,
          details?.livingArea,
          details?.LivingArea,
          details?.sqft
        )
      );
      const detailBasement = coerceNumber(
        pickFirst(
          details?.belowGradeFinishedArea,
          details?.BelowGradeFinishedArea,
          details?.basementFinishedArea,
          details?.BasementFinishedArea
        )
      );
      const detailTotal = coerceNumber(
        pickFirst(
          details?.totalArea,
          details?.TotalArea,
          details?.buildingAreaTotal,
          details?.BuildingAreaTotal,
          details?.SqFtTotal
        )
      );
      const totalSqftMerged =
        detailTotal ||
        (detailAbove || 0) + (detailBasement || 0) ||
        baseProperty.totalSqft ||
        undefined;
      const photosMerged = (() => {
        const detailPhotos = extractPhotos(details || {});
        const basePhotos = Array.isArray(baseProperty.images)
          ? baseProperty.images.filter(Boolean)
          : [];
        return detailPhotos.length ? detailPhotos : basePhotos;
      })();
      const merged = {
        id: baseProperty.id || id,
        mlsId: baseProperty.mlsId || baseProperty.listingKey || id,
        listingKey: baseProperty.listingKey || baseProperty.mlsId || id,
        title:
          baseProperty.title ||
          `${baseProperty.beds || "?"} Bed ${baseProperty.baths || "?"} ${
            baseProperty.propertyType || "Home"
          }`,
        description:
          baseProperty.description ||
          details?.description ||
          details?.publicRemarks ||
          "Details coming soon.",
        price: (baseProperty.price || details?.listPrice || 0).toString(),
        address,
        city: baseProperty.city || details?.city || "",
        state: baseProperty.state || details?.state || "NE",
        zipCode: baseProperty.zipCode || details?.postalCode || "",
        beds: baseProperty.beds || details?.beds || 0,
        baths: (baseProperty.baths || details?.baths || 0).toString(),
        sqft:
          baseProperty.sqft ||
          detailAbove ||
          detailTotal ||
          details?.livingArea ||
          0,
        aboveGradeSqft: detailAbove || undefined,
        basementSqft: detailBasement || undefined,
        totalSqft: totalSqftMerged || undefined,
        yearBuilt: baseProperty.yearBuilt || details?.yearBuilt || null,
        propertyType:
          baseProperty.propertyType || details?.propertyType || "Residential",
        status: (
          baseProperty.status ||
          details?.status ||
          "active"
        ).toLowerCase(),
        standardStatus:
          baseProperty.standardStatus || details?.standardStatus || "Active",
        featured: baseProperty.featured || false,
        luxury: baseProperty.luxury || false,
        images: photosMerged,
        neighborhood: baseProperty.neighborhood || details?.subdivision || null,
        schoolDistrict: details?.schoolDistrict || null,
        style: baseProperty.style || details?.style || null,
        coordinates:
          baseProperty.coordinates ||
          (details?.lat && details?.lng
            ? { lat: details.lat, lng: details.lng }
            : null),
        features: details?.features || [],
        architecturalStyle: details?.architecturalStyle || null,
        secondaryStyle: null,
        styleConfidence: null,
        styleFeatures: [],
        styleAnalyzed: false,
        listingAgentKey: details?.listAgentKey || null,
        listingOfficeName: details?.listOfficeName || null,
        listingContractDate: details?.listingContractDate || null,
        daysOnMarket: details?.daysOnMarket || null,
        originalListPrice: details?.originalListPrice || null,
        mlsStatus:
          details?.mlsStatus ||
          details?.standardStatus ||
          baseProperty.standardStatus ||
          "Active",
        modificationTimestamp: details?.modificationTimestamp || null,
        photoCount: photosMerged.length,
        virtualTourUrl: details?.virtualTourUrl || null,
        isIdxListing: true,
        idxSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return res.json({ success: true, property: merged });
    } catch (e) {
      console.error("Property detail fetch error", e);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve property",
        error: (e as any)?.message,
      });
    }
  });

  // Property history stub endpoint (to be implemented with real price/status history)
  app.get("/api/property/:id/history", async (req, res) => {
    const { id } = req.params;
    res.json({
      success: true,
      propertyId: id,
      history: [],
      message: "History integration pending",
    });
  });

  // Tour / Info request persistence with validation
  app.post("/api/tour-requests", async (req: any, res: any) => {
    // If body not parsed, attempt to parse raw body
    if (
      req.headers["content-type"]?.includes("application/json") &&
      typeof req.body === "undefined"
    ) {
      let raw = "";
      await new Promise((resolve) => {
        req.on("data", (c: any) => (raw += c));
        req.on("end", resolve);
      });
      try {
        req.body = JSON.parse(raw || "{}");
      } catch {
        req.body = {};
      }
    }
    try {
      const {
        type,
        name,
        email,
        phone,
        message,
        date,
        timeSlot,
        propertyId,
        address,
        agentName,
      } = req.body || {};
      const fields: string[] = [];
      if (!type || !["tour", "info"].includes(type)) fields.push("type");
      if (!name || typeof name !== "string" || !name.trim())
        fields.push("name");
      const emailRegex = /.+@.+\..+/;
      if (!email || !emailRegex.test(String(email))) fields.push("email");
      if (phone) {
        const phoneRegex =
          /^(\+?1[\s.-]?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})$/;
        if (!phoneRegex.test(String(phone))) fields.push("phone");
      }
      if (type === "tour") {
        if (!date) fields.push("date");
        if (!timeSlot) fields.push("timeSlot");
      }
      if (fields.length)
        return res
          .status(400)
          .json({ success: false, error: "validation_failed", fields });

      try {
        const { tourRequests } = await import("@shared/schema");
        const { db } = await import("./db");
        const inserted = await db
          .insert(tourRequests)
          .values({
            type,
            name: name.trim(),
            email: email.trim(),
            phone: phone ? String(phone).trim() : null,
            message: message ? String(message).trim() : null,
            date: date || null,
            timeSlot: timeSlot || null,
            propertyId: propertyId || null,
            address: address || null,
            agentName: agentName || null,
          })
          .returning();

        // Send email notifications if configured
        try {
          const { emailService } = await import("./email-service");

          if (emailService.isConfigured()) {
            // Create a lead-like object for email notifications
            const requestData = {
              id: inserted[0].id,
              firstName: name.trim().split(" ")[0] || name.trim(),
              lastName: name.trim().split(" ").slice(1).join(" ") || "",
              email: email.trim(),
              phone: phone ? String(phone).trim() : null,
              propertyAddress: address || "",
              message:
                type === "tour"
                  ? `🏠 IN-PERSON TOUR REQUEST${
                      address ? ` for ${address}` : ""
                    }

📅 Requested Date: ${date || "Not specified"}
⏰ Preferred Time: ${timeSlot || "Not specified"}

${
  message
    ? `📝 Customer Message:\n${message}`
    : "No additional message provided."
}

🎯 This is a tour request - please contact the customer to schedule their property visit.`
                  : `📋 PROPERTY INFORMATION REQUEST${
                      address ? ` for ${address}` : ""
                    }

${
  message
    ? `📝 Customer Message:\n${message}`
    : "No additional message provided."
}

💡 This is an information request - please provide the customer with detailed property information, pricing, and availability.`,
              interest:
                type === "tour"
                  ? "In-Person Property Tour"
                  : "Property Information & Details",
              source: "property_detail_widget",
              createdAt: inserted[0].createdAt,
              // Add missing required fields for email service
              companyName: null,
              budgetRange: null,
              preferredContactTime: null,
              leadSourceDetails: null,
              leadStatus: "new",
              propertyTypePreference: null,
              preferredLocation: null,
              agentId: null,
              agentSlug: null,
            };

            // Send notification to the agent/business owner
            await emailService.sendLeadNotification(
              requestData,
              "mygoldenbrick1@gmail.com"
            );
            console.log(
              `📧 ${
                type === "tour" ? "Tour" : "Info"
              } request notification sent to mygoldenbrick1@gmail.com`
            );

            // Send confirmation to the customer
            await emailService.sendLeadConfirmation(requestData);
            console.log(
              `📧 ${
                type === "tour" ? "Tour" : "Info"
              } request confirmation sent to ${email}`
            );
          } else {
            console.log(
              "📧 Email service not configured - skipping notifications"
            );
          }
        } catch (emailError) {
          console.error("❌ Failed to send email notifications:", emailError);
          // Don't fail the request if email fails
        }

        return res.json({ success: true, request: inserted[0] });
      } catch (dbErr) {
        console.warn("tour-requests: DB insert failed", dbErr);
        return res.json({
          success: true,
          request: {
            type,
            name,
            email,
            phone: phone || null,
            message: message || null,
            date: date || null,
            timeSlot: timeSlot || null,
            propertyId,
            address,
            agentName,
            createdAt: new Date().toISOString(),
            transient: true,
          },
        });
      }
    } catch (e) {
      console.error("/api/tour-requests error", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // Featured Properties Endpoint - Optimized for homepage
  app.get("/api/featured-properties", async (req, res) => {
    try {
      console.log("🏠 Fetching featured properties from CMA API");

      // Use CMA API's cma-comparables endpoint for better Nebraska data
      const cmaUrl =
        "http://gbcma.us-east-2.elasticbeanstalk.com/api/cma-comparables?property_type=Residential&limit=8&status=active&exclude_zero_price=true";

      const response = await fetch(cmaUrl, {
        headers: {
          "User-Agent": "NebraskaHomeHub/1.0",
          Accept: "application/json",
        },
      });

      // (legacy nested position removed: /api/properties/by-mls now defined top-level below)

      // Simple MLS autocomplete suggestions - naive search by partial match against external API if available
      app.get("/api/properties/mls-suggest", async (req, res) => {
        try {
          const q = String(req.query.q || "").trim();
          if (q.length < 2) return res.json({ suggestions: [] });
          const baseUrl = process.env.CMA_API_BASE || "";
          if (!baseUrl) return res.json({ suggestions: [] });
          const url = `${baseUrl}/properties?mlsNumber_like=${encodeURIComponent(
            q
          )}&limit=5`;
          const r = await fetch(url);
          if (!r.ok) return res.json({ suggestions: [] });
          const json = await r.json();
          const props = Array.isArray(json.results)
            ? json.results
            : json.results
            ? [json.results]
            : [];
          const suggestions = props.slice(0, 5).map((p: any) => ({
            mlsId: p.MlsNumber || p.ListingId || p.ListingKey,
            address: [p.StreetNumber, p.StreetName, p.City]
              .filter(Boolean)
              .join(" "),
            listPrice: p.ListPrice || 0,
          }));
          res.json({ suggestions });
        } catch (error) {
          console.error("/api/properties/mls-suggest error", error);
          res.status(500).json({ suggestions: [] });
        }
      });

      if (!response.ok) {
        throw new Error(
          `CMA API error: ${response.status} ${response.statusText}`
        );
      }

      const cmaData = await response.json();
      const properties = cmaData || [];

      console.log(
        `✅ Got ${properties.length} properties from CMA API for featured section`
      );

      // Transform CMA response to match our Property schema
      const featuredProperties = properties
        .slice(0, 8)
        .map((property: any) => ({
          id: property.id || Math.random().toString(),
          mlsId: property.id,
          title: `${property.beds || "?"} Bed ${
            property.baths || "?"
          } Bath in ${property.city || "Omaha"}`,
          price: property.listPrice || property.soldPrice || 0,
          address: property.address || "Address not available",
          city: property.city || "Omaha",
          state: property.state || "NE",
          zipCode: property.zipCode || "",
          beds: property.beds || 0,
          baths: property.baths?.toString() || "0",
          sqft: property.sqft || 0,
          yearBuilt: property.yearBuilt,
          garage: property.garage || 0,
          propertyType: property.propertyType || "Single Family",
          status: property.status === "Closed" ? "sold" : "active",
          standardStatus: property.status || "Active",
          subdivision: property.subdivision || "",
          featured: true, // All properties in this endpoint are featured
          luxury: (property.listPrice || property.soldPrice || 0) > 500000,
          images: property.imageUrl
            ? [property.imageUrl]
            : [
                "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80",
              ],
          coordinates: {
            lat: property.latitude || 41.2565,
            lng: property.longitude || -95.9345,
          },
          description: `Beautiful ${property.propertyType || "property"} in ${
            property.subdivision || property.city
          }`,
          photoCount: property.imageUrl ? 1 : 0,
          listAgent: property.listAgent?.name || "Nebraska Agent",
          listOffice: property.listOffice?.name || "Nebraska Realty",
        }));

      res.json({
        data: featuredProperties,
        source: "cma-featured",
        total: featuredProperties.length,
        cached: false,
      });
    } catch (error) {
      console.error("❌ Featured properties API error:", error);

      // Return fallback mock data for featured properties
      const mockFeatured = [
        {
          id: "FEATURED1",
          mlsId: "FEATURED1",
          title: "4 Bed 3 Bath in Omaha",
          price: 485000,
          address: "2234 Dodge Street",
          city: "Omaha",
          state: "NE",
          zipCode: "68102",
          beds: 4,
          baths: "3",
          sqft: 2850,
          yearBuilt: 2018,
          propertyType: "Single Family",
          status: "active",
          standardStatus: "Active",
          featured: true,
          luxury: false,
          images: [
            "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80",
          ],
          coordinates: { lat: 41.2565, lng: -95.9345 },
          description: "Beautiful modern home in downtown Omaha",
          photoCount: 1,
        },
        {
          id: "FEATURED2",
          mlsId: "FEATURED2",
          title: "5 Bed 4 Bath in Lincoln",
          price: 625000,
          address: "1456 Pine Lake Road",
          city: "Lincoln",
          state: "NE",
          zipCode: "68510",
          beds: 5,
          baths: "4",
          sqft: 3200,
          yearBuilt: 2020,
          propertyType: "Single Family",
          status: "active",
          standardStatus: "Active",
          featured: true,
          luxury: true,
          images: [
            "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
          ],
          coordinates: { lat: 40.8192, lng: -96.6905 },
          description: "Luxury home with modern amenities",
          photoCount: 1,
        },
      ];

      res.json({
        data: mockFeatured,
        source: "mock-featured-fallback",
        total: mockFeatured.length,
        cached: false,
        error:
          error instanceof Error ? error.message : "Featured API unavailable",
      });
    }
  });

  // TOP-LEVEL: Fetch properties by MLS IDs with external API + DB fallback
  app.get("/api/properties/by-mls", async (req, res) => {
    const started = Date.now();
    try {
      const idsParam = String(req.query.ids || "").trim();
      if (!idsParam) return res.json({ properties: [], count: 0, tookMs: 0 });
      const rawIds = idsParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => !!s)
        .filter((s, i, arr) => arr.indexOf(s) === i);

      console.log("🔎 [by-mls] Requested IDs:", rawIds);

      const baseUrl = process.env.CMA_API_BASE || "";
      const results: any[] = [];
      const unresolved: string[] = [];

      // External API attempt per ID
      for (const mlsId of rawIds) {
        let resolved = false;
        if (baseUrl) {
          const url = `${baseUrl}/properties?mlsNumber=${encodeURIComponent(
            mlsId
          )}`;
          try {
            console.log("🌐 [by-mls] Fetching", url);
            const r = await fetch(url, {
              headers: { Accept: "application/json" },
            });
            if (r.ok) {
              const json = await r.json();
              const first = Array.isArray(json.results)
                ? json.results[0]
                : json.results || json;
              if (first) {
                results.push({
                  id: first.ListingKey || first.Id || mlsId,
                  mlsId: first.MlsNumber || first.ListingId || mlsId,
                  listPrice: first.ListPrice || first.Price || 0,
                  address: [
                    first.StreetNumber,
                    first.StreetName,
                    first.City,
                    first.StateOrProvince,
                  ]
                    .filter(Boolean)
                    .join(" "),
                  city: first.City,
                  state: first.StateOrProvince,
                  beds: first.BedroomsTotal,
                  baths: first.BathroomsTotalInteger,
                  sqft: first.LivingArea,
                  status: first.StandardStatus,
                  image: first.Media?.[0]?.MediaURL,
                  featured: true,
                  source: baseUrl ? "external" : "unknown",
                });
                resolved = true;
              }
            } else {
              console.warn("⚠️ [by-mls] Non-OK response", r.status, url);
            }
          } catch (e) {
            console.warn("⚠️ [by-mls] External fetch failed", mlsId, e);
          }
        }
        if (!resolved) unresolved.push(mlsId);
      }

      // DB fallback for unresolved
      if (unresolved.length) {
        console.log("🗄️ [by-mls] Falling back to DB for", unresolved);
        try {
          const { db } = await import("./db");
          // Basic direct SQL; ensure escaping
          const idList = unresolved
            .map((id) => `'${id.replace(/'/g, "''")}'`)
            .join(",");
          const rawSql = `select * from properties where mls_id in (${idList}) limit ${unresolved.length}`;
          console.log("🗄️ [by-mls] DB query:", rawSql);
          const rows: any = await (db as any).execute(rawSql);
          const list: any[] = Array.isArray(rows?.rows)
            ? rows.rows
            : Array.isArray(rows)
            ? rows
            : [];
          for (const row of list) {
            results.push({
              id: row.listing_key || row.id || row.mls_id,
              mlsId: row.mls_id,
              listPrice: Number(row.price) || 0,
              address: row.address,
              city: row.city,
              state: row.state,
              beds: row.beds,
              baths: Number(row.baths),
              sqft: row.sqft,
              status: row.standard_status || row.status,
              image: Array.isArray(row.images) ? row.images[0] : null,
              featured: true,
              source: "db",
            });
          }
        } catch (e) {
          console.warn("⚠️ [by-mls] DB fallback failed", e);
        }
      }

      // Re-order according to original rawIds
      const ordered = rawIds
        .map((id) => results.find((r) => r.mlsId == id || r.id == id))
        .filter(Boolean);
      const tookMs = Date.now() - started;
      console.log(
        `✅ [by-mls] Resolved ${ordered.length}/${rawIds.length} in ${tookMs}ms`
      );
      res.json({ properties: ordered, count: ordered.length, tookMs });
    } catch (error) {
      console.error("/api/properties/by-mls error", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  /**
   * New Construction Properties Endpoint
   * Leverages CMA comparables API with new_construction=true flag (and optional year built floor)
   * Query params (optional): city, min_year_built, limit (default 40)
   */
  app.get("/api/new-construction", async (req, res) => {
    try {
      const rawQuery = req.query as Record<string, string | undefined>;
      const city = rawQuery.city;
      const min_year_built = rawQuery.min_year_built;
      const limit = rawQuery.limit ?? "40";
      const pageRaw = rawQuery.page ?? "1";

      const parseNumber = (value: string | undefined, fallback: number) => {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? n : fallback;
      };

      const requestedLimit = parseNumber(limit, 40);
      const requestedPage = parseNumber(pageRaw, 1);

      const extractComparables = (payload: any): any[] => {
        if (!payload) return [];
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload.data)) return payload.data;
        if (Array.isArray(payload.properties)) return payload.properties;
        if (Array.isArray(payload.active)) return payload.active;
        if (payload.data && typeof payload.data === "object") {
          if (Array.isArray(payload.data.properties))
            return payload.data.properties;
          if (Array.isArray(payload.data.active)) return payload.data.active;
        }
        if (payload.combined && typeof payload.combined === "object") {
          if (Array.isArray(payload.combined.active))
            return payload.combined.active;
          if (Array.isArray(payload.combined.properties))
            return payload.combined.properties;
        }
        return [];
      };

      const baseParamsPrimary = new URLSearchParams();
      baseParamsPrimary.set("new_construction", "true");
      baseParamsPrimary.set("limit", String(requestedLimit));
      baseParamsPrimary.set("status", "active");
      baseParamsPrimary.set("exclude_zero_price", "true");
      if (city) baseParamsPrimary.set("city", city);
      if (min_year_built)
        baseParamsPrimary.set("min_year_built", min_year_built);
      else baseParamsPrimary.set("min_year_built", "2020");

      const primaryUrl = `http://gbcma.us-east-2.elasticbeanstalk.com/api/cma-comparables?${baseParamsPrimary.toString()}`;
      console.log(
        "🏗️ Fetching new construction properties (primary):",
        primaryUrl
      );

      let note: string | undefined;
      let list: any[] = [];
      let upstreamCount = 0;
      try {
        const r = await fetch(primaryUrl, {
          headers: { "User-Agent": "NebraskaHomeHub/1.0" },
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw new Error(`Upstream responded ${r.status}`);
        const raw = await r.json();
        list = extractComparables(raw);
        upstreamCount =
          Number(
            (raw?.counts && (raw.counts.active || raw.counts.total)) ??
              raw?.total ??
              raw?.totalAvailable ??
              list.length
          ) || list.length;
        if (Array.isArray(raw?.properties) && !list.length) {
          list = raw.properties;
          upstreamCount = raw.properties.length;
        }
      } catch (err) {
        note = `primary fetch error: ${(err as any)?.message || err}`;
      }

      if (!list.length) {
        const fallbackParams = new URLSearchParams();
        fallbackParams.set("limit", String(requestedLimit));
        fallbackParams.set("status", "active");
        fallbackParams.set("exclude_zero_price", "true");
        if (min_year_built)
          fallbackParams.set("min_year_built", min_year_built);
        else fallbackParams.set("min_year_built", "2020");
        const fallbackUrl = `http://gbcma.us-east-2.elasticbeanstalk.com/api/cma-comparables?${fallbackParams.toString()}`;
        console.log("🏗️ New construction fallback fetch (broad):", fallbackUrl);
        try {
          const r2 = await fetch(fallbackUrl, {
            headers: { "User-Agent": "NebraskaHomeHub/1.0" },
            signal: AbortSignal.timeout(15000),
          });
          if (r2.ok) {
            const raw2 = await r2.json();
            const broadList: any[] = extractComparables(raw2);
            const keywordRegex =
              /(new construction|to be built|under construction|proposed|spec home|model home|custom build|just built)/i;
            const negativeRegex = /not new/i;
            const minYear = Number(min_year_built) || 2020;
            const currentYear = new Date().getFullYear();
            const filtered: any[] = [];
            for (const p of broadList) {
              const cond = (p.condition ||
                p.Condition ||
                p.propertyCondition ||
                "") as string;
              const remarks = (p.publicRemarks ||
                p.PublicRemarks ||
                p.remarks ||
                p.RemarksPublic ||
                "") as string;
              const yb = (p.yearBuilt || p.YearBuilt || 0) as number;
              const positive =
                keywordRegex.test(cond) ||
                keywordRegex.test(remarks) ||
                yb >= minYear;
              if (!positive) continue;
              const neg =
                negativeRegex.test(cond) || negativeRegex.test(remarks);
              const recentOverride = yb >= currentYear - 1;
              if (neg && !recentOverride && !/model home/i.test(cond)) continue;
              filtered.push(p);
            }
            list = filtered;
            upstreamCount =
              Number(
                (raw2?.counts && (raw2.counts.active || raw2.counts.total)) ??
                  raw2?.total ??
                  raw2?.totalAvailable ??
                  broadList.length
              ) || broadList.length;
            note = note
              ? `${note}; broadened without new_construction flag`
              : "broadened without new_construction flag";
          } else {
            note = note
              ? `${note}; fallback status ${r2.status}`
              : `fallback status ${r2.status}`;
          }
        } catch (err2) {
          note = note
            ? `${note}; fallback error ${(err2 as any)?.message || err2}`
            : `fallback error ${(err2 as any)?.message || err2}`;
        }
      }

      const yearBuiltHistogram: Record<string, number> = {};
      list.forEach((p) => {
        const y = p.yearBuilt || p.YearBuilt;
        if (y) yearBuiltHistogram[y] = (yearBuiltHistogram[y] || 0) + 1;
      });

      const collectImages = (payload: any): string[] => {
        const urls = new Set<string>();
        const push = (value?: string) => {
          if (!value || typeof value !== "string") return;
          const trimmed = value.trim();
          if (!trimmed) return;
          urls.add(trimmed);
        };
        const pickObjectUrl = (obj: any) =>
          obj?.url ||
          obj?.Url ||
          obj?.URL ||
          obj?.mediaUrl ||
          obj?.MediaUrl ||
          obj?.mediaURL ||
          obj?.MediaURL ||
          obj?.thumbnail ||
          obj?.Thumbnail ||
          obj?.href;

        if (Array.isArray(payload?.photos)) {
          payload.photos.forEach((v: any) =>
            push(typeof v === "string" ? v : pickObjectUrl(v))
          );
        }
        if (Array.isArray(payload?.images)) {
          payload.images.forEach((v: any) =>
            push(typeof v === "string" ? v : pickObjectUrl(v))
          );
        }
        if (Array.isArray(payload?.PhotoUrls))
          payload.PhotoUrls.forEach((v: any) => push(v));
        if (Array.isArray(payload?.PhotoURLS))
          payload.PhotoURLS.forEach((v: any) => push(v));
        if (Array.isArray(payload?.Media)) {
          payload.Media.forEach((m: any) =>
            push(
              m?.MediaURL ||
                m?.mediaUrl ||
                m?.MediaUrl ||
                m?.mediaURL ||
                pickObjectUrl(m)
            )
          );
        }
        push(payload?.imageUrl || payload?.ImageUrl);
        push(payload?.primaryPhoto);
        push(payload?.thumbnail);
        push(payload?.primaryImage);
        push(payload?.mainPhoto);
        return Array.from(urls);
      };

      const transformed = list.map((p, idx) => {
        const images = collectImages(p);
        return {
          id: p.id || p.mlsNumber || p.mls_number || idx,
          mlsNumber: p.mlsNumber || p.mls_number || null,
          address: p.address || p.fullAddress || null,
          city: p.city || null,
          subdivision: p.subdivision || p.neighborhood || null,
          listPrice: p.listPrice || p.ListPrice || null,
          price: p.price || p.listPrice || p.ListPrice || null,
          sqft: p.sqft || p.SqFtTotal || p.squareFeet || null,
          yearBuilt: p.yearBuilt || p.YearBuilt || null,
          beds: p.bedrooms || p.BedroomsTotal || null,
          baths: p.bathrooms || p.BathroomsTotalInteger || null,
          condition: p.condition || p.Condition || null,
          closeDate: p.closeDate || p.CloseDate || null,
          images,
          imageUrl: images.length ? images[0] : null,
          newConstruction: true,
          latitude: p.latitude || p.Latitude || null,
          longitude: p.longitude || p.Longitude || null,
        };
      });

      res.json({
        data: transformed,
        total: transformed.length,
        source: "cma-new-construction",
        upstreamCount,
        filters: {
          city: city || null,
          min_year_built: min_year_built || "2020",
        },
        note,
        meta: {
          yearBuiltHistogram,
          limit: requestedLimit,
          page: requestedPage,
          hasMore: transformed.length >= requestedLimit,
        },
      });
    } catch (e) {
      console.error("❌ New construction endpoint error", e);
      res.status(500).json({
        message: "Failed to load new construction properties",
        error: (e as any)?.message || String(e),
      });
    }
  });

  /**
   * Open Houses Endpoint
   * Updated to use proper CMA API endpoints with real open house data fields
   * First tries dedicated open house endpoint, falls back to advanced search with open house filters
   */
  app.get("/api/open-houses", async (req, res) => {
    try {
      const { city, limit = "50" } = req.query as Record<
        string,
        string | undefined
      >;

      // First try: Use property-search-advanced with open house specific filters
      const params = new URLSearchParams();
      params.set("status", "Active");
      params.set("limit", limit);
      params.set("property_type", "Residential");
      params.set("min_beds", "1");

      // Temporarily disabled: hasOpenHouse filter returns no results
      // params.set("hasOpenHouse", "true"); // Filter for properties with open houses

      if (city) params.set("city", city);

      // Try the advanced search endpoint first with open house filters
      const primaryUrl = `http://gbcma.us-east-2.elasticbeanstalk.com/api/property-search-advanced?${params.toString()}`;
      console.log("🏠 Trying CMA API with hasOpenHouse filter:", primaryUrl);

      let raw: any;
      let source = "advanced-search-with-openhouse-filter";

      try {
        const r = await fetch(primaryUrl, {
          headers: {
            "User-Agent": "NebraskaHomeHub/1.0",
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!r.ok) throw new Error(`Primary endpoint responded ${r.status}`);
        raw = await r.json();
        console.log("✅ Primary CMA API call successful");
      } catch (primaryError) {
        console.log(
          "⚠️ Primary endpoint failed, trying fallback approach:",
          primaryError
        );

        // Fallback: Use advanced search without hasOpenHouse filter, then filter by remarks
        const fallbackParams = new URLSearchParams();
        fallbackParams.set("status", "Active");
        fallbackParams.set("limit", "100"); // Get more to filter from
        fallbackParams.set("property_type", "Residential");
        fallbackParams.set("min_beds", "1");
        if (city) fallbackParams.set("city", city);

        const fallbackUrl = `http://gbcma.us-east-2.elasticbeanstalk.com/api/property-search-advanced?${fallbackParams.toString()}`;
        console.log("� Using fallback approach:", fallbackUrl);

        const fallbackR = await fetch(fallbackUrl, {
          headers: {
            "User-Agent": "NebraskaHomeHub/1.0",
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!fallbackR.ok)
          throw new Error(`Fallback endpoint responded ${fallbackR.status}`);
        raw = await fallbackR.json();
        source = "advanced-search-remarks-filter";
      }
      // Normalize upstream payload to an array of properties
      const propertiesArr: any[] = Array.isArray(raw?.properties)
        ? raw.properties
        : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw)
        ? raw
        : [];

      console.log(
        `📊 Retrieved ${propertiesArr.length} properties from CMA API`
      );

      // Since hasOpenHouse filter isn't reliable, return all properties
      // The frontend will handle any additional filtering
      const result = propertiesArr;

      // Count properties with actual open house flags (for debugging)
      const actualOpenHouses = result.filter(
        (p) => p.hasOpenHouse === true || p.OpenHouse === true
      ).length;

      console.log(
        `🏠 Returning ${result.length} properties (${actualOpenHouses} with explicit open house flags)`
      );

      // Limit results
      const limitedResult = result.slice(0, parseInt(limit));

      const transformed = limitedResult.map((p, idx) => {
        // Debug logging for first few properties to understand the data structure
        if (idx < 2) {
          console.log(
            `🔍 Property ${idx + 1} ALL fields:`,
            Object.keys(p).sort()
          );
          console.log(`🔍 Property ${idx + 1} Open House fields:`, {
            hasOpenHouse: p.hasOpenHouse,
            OpenHouse: p.OpenHouse,
            openHouseDate: p.openHouseDate,
            openHouseTime: p.openHouseTime,
            openHouseInstructions: p.openHouseInstructions,
          });
        }

        // Extract open house information from various possible fields
        const hasActualOpenHouse =
          p.hasOpenHouse === true || p.OpenHouse === true;
        const openHouseDate = p.openHouseDate || p.OpenHouseDate || null;
        const openHouseTime = p.openHouseTime || p.OpenHouseTime || null;
        const openHouseInstructions =
          p.openHouseInstructions || p.OpenHouseInstructions || null;

        return {
          id: p.id || p.mlsNumber || idx,
          mlsNumber: p.mlsNumber || null,
          mlsId: p.mlsNumber || p.mlsId || null,
          address: p.address || null,
          city: p.city || null,
          state: p.state || "NE",
          zipCode: p.zipCode || p.postalCode || null,
          subdivision: p.subdivision || null,
          listPrice: p.listPrice || null,
          sqft: p.livingArea || p.sqft || 0,
          livingArea: p.livingArea || p.sqft || 0,
          beds: p.beds || 0,
          baths: p.baths || 0,
          images: p.images || [p.image].filter(Boolean),
          image: (p.images && p.images[0]) || p.image || null,

          // Enhanced open house data
          hasOpenHouse: hasActualOpenHouse,
          openHouseDate: openHouseDate,
          openHouseTime: openHouseTime,
          openHouseInstructions: openHouseInstructions,
          openHouseDetected: hasActualOpenHouse || result.length > 0,

          // Additional useful fields
          propertyType: p.propertyType || "Residential",
          garageSpaces: p.garageSpaces || 0,
          yearBuilt: p.yearBuilt,
          daysOnMarket: p.daysOnMarket,
          architecturalStyle: p.architecturalStyle || null,
          isNewConstruction: p.isNewConstruction || false,
          publicRemarks: p.publicRemarks || p.RemarksPublic || null,
          description: p.publicRemarks || p.RemarksPublic || null,
        };
      });

      res.json({
        data: transformed,
        total: transformed.length,
        actualOpenHouses: actualOpenHouses,
        source: source,
        upstreamCount: propertiesArr.length,
        city: city || undefined,
        debug: {
          hasOpenHouseFilter:
            source === "advanced-search-with-openhouse-filter",
          remarksFiltered: source === "advanced-search-remarks-filter",
          propertiesWithOpenHouseFlags: actualOpenHouses,
        },
      });
    } catch (e) {
      console.error("❌ Open houses endpoint error", e);
      res.status(500).json({
        message: "Failed to load open houses",
        error: (e as any)?.message || String(e),
      });
    }
  });

  // **TEMPLATE ROUTES** - Multi-tenant customization with user authentication
  // Helper: map community names to curated images (server-side reuse with communities endpoints)
  function getImageForCommunity(name: string): string | null {
    const map: Record<string, string> = {
      "Downtown Omaha":
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80",
      "West Omaha":
        "https://images.unsplash.com/photo-1600047509807-ba8f99b501cc?auto=format&fit=crop&w=800&q=80",
      Bellevue:
        "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
      Omaha:
        "https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?auto=format&fit=crop&w=800&q=80",
      Lincoln:
        "https://images.unsplash.com/photo-1573547429441-d7ef62e04ea2?auto=format&fit=crop&w=800&q=80",
      Gretna:
        "https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?auto=format&fit=crop&w=800&q=80",
      Elkhorn:
        "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=800&q=80",
      Papillion:
        "https://images.unsplash.com/photo-1600047509807-ba8f99b501cc?auto=format&fit=crop&w=800&q=80",
    };
    return map[name] || null;
  }
  // Communities (dynamic data from GBCMA API)
  app.get("/api/communities", async (req, res) => {
    // Extract and normalize supported params per GBCMA v2.9.2
    const state = (req.query.state as string) || "NE";
    const property_type = (req.query.property_type as string) || "Residential";
    const status = (req.query.status as string) || "active"; // default active
    const minProperties = (req.query.min_properties as string) || "3";
    const sortBy = (req.query.sort_by as string) || "count";
    const maxRecords = (req.query.max_records as string) || undefined;
    const q = (req.query.q as string) || undefined;
    const debugStatuses = (req.query.debugStatuses as string) || undefined;

    try {
      console.log("🏘️ Fetching communities from GBCMA API");

      // Build URL with parameters as per working API documentation
      const sp = new URLSearchParams();
      if (state) sp.set("state", state);
      if (property_type) sp.set("property_type", property_type);
      if (status) sp.set("status", status);
      if (minProperties) sp.set("min_properties", String(minProperties));
      if (sortBy) sp.set("sort_by", sortBy);
      if (maxRecords) sp.set("max_records", String(maxRecords));
      if (q) sp.set("q", q);
      if (debugStatuses) sp.set("debugStatuses", debugStatuses);
      const gbcmaUrl = `http://gbcma.us-east-2.elasticbeanstalk.com/api/communities?${sp.toString()}`;

      console.log(`📡 GBCMA Communities URL: ${gbcmaUrl}`);

      const response = await fetch(gbcmaUrl);
      if (!response.ok) {
        throw new Error(
          `GBCMA API responded with ${response.status}: ${response.statusText}`
        );
      }

      const gbcmaData = await response.json();

      if (!gbcmaData.success || !gbcmaData.communities) {
        throw new Error(`Invalid GBCMA response: ${JSON.stringify(gbcmaData)}`);
      }

      console.log(
        `✅ Retrieved ${gbcmaData.communities.length} communities from GBCMA`
      );

      // Transform GBCMA data to match frontend format (augment but keep upstream fields)
      const transformedCommunities = gbcmaData.communities.map(
        (community: any, index: number) => ({
          id: index + 1,
          name: community.name,
          slug: community.name
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, ""),
          description: `Explore ${community.name} community`,
          image:
            getImageForCommunity(community.name) ||
            `https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80`,
          propertyCount: community.activeProperties, // backward compat
          averagePrice: "0", // Will be calculated separately if needed
          highlights:
            community.cities.length > 1
              ? [
                  `Multi-city`,
                  `${community.cities.join(", ")}`,
                  `${community.activeProperties} Active`,
                ]
              : [
                  `${community.primaryCity}`,
                  `${community.activeProperties} Active`,
                  "Properties",
                ],
          primaryCity: community.primaryCity,
          cities: community.cities,
          totalProperties: community.totalProperties,
          activeProperties: community.activeProperties,
          inactiveProperties:
            community.inactiveProperties ??
            community.totalProperties - community.activeProperties,
        })
      );
      // Return upstream style root envelope
      res.json({
        success: true,
        count: transformedCommunities.length,
        total_properties_analyzed:
          gbcmaData.total_properties_analyzed || undefined,
        cache: gbcmaData.cache || undefined,
        filters: gbcmaData.filters || {
          status,
          min_properties: minProperties,
          sort_by: sortBy,
        },
        communities: transformedCommunities,
      });
    } catch (error) {
      console.error("❌ Failed to fetch communities from GBCMA:", error);

      // Enhanced fallback data based on real Nebraska communities
      const fallbackDummy = [
        {
          id: 1,
          name: "Elkhorn",
          slug: "elkhorn",
          description:
            "Highly rated school district with new construction and family-friendly amenities in growing western Omaha suburb",
          image:
            "https://images.unsplash.com/photo-1600047509807-ba8f99b501cc?auto=format&fit=crop&w=800&q=80",
          propertyCount: 156,
          averagePrice: "425000.00",
          highlights: ["Top Schools", "New Construction", "Family-Friendly"],
          primaryCity: "Elkhorn",
          cities: ["Elkhorn"],
          totalProperties: 180,
          activeProperties: 156,
          inactiveProperties: 24,
        },
        {
          id: 2,
          name: "West Omaha",
          slug: "west-omaha",
          description:
            "Established neighborhoods with mature trees, excellent schools, and premier shopping destinations",
          image:
            "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
          propertyCount: 284,
          averagePrice: "385000.00",
          highlights: ["Established", "Top Schools", "Shopping"],
          primaryCity: "Omaha",
          cities: ["Omaha"],
          totalProperties: 320,
          activeProperties: 284,
          inactiveProperties: 36,
        },
        {
          id: 3,
          name: "Bellevue",
          slug: "bellevue",
          description:
            "Affordable family community with parks, recreation, and convenient access to Offutt Air Force Base",
          image:
            "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
          propertyCount: 97,
          averagePrice: "275000.00",
          highlights: ["Affordable", "Military-Friendly", "Recreation"],
          primaryCity: "Bellevue",
          cities: ["Bellevue"],
          totalProperties: 115,
          activeProperties: 97,
          inactiveProperties: 18,
        },
        {
          id: 4,
          name: "Papillion",
          slug: "papillion",
          description:
            "Award-winning school district and master-planned communities in southwest metro area",
          image:
            "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=800&q=80",
          propertyCount: 178,
          averagePrice: "365000.00",
          highlights: [
            "Award-Winning Schools",
            "Master-Planned",
            "Southwest Metro",
          ],
          primaryCity: "Papillion",
          cities: ["Papillion"],
          totalProperties: 205,
          activeProperties: 178,
          inactiveProperties: 27,
        },
        {
          id: 5,
          name: "Downtown Omaha",
          slug: "downtown-omaha",
          description:
            "Urban living with condos, lofts, dining, arts, and Old Market entertainment district",
          image:
            "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80",
          propertyCount: 89,
          averagePrice: "320000.00",
          highlights: ["Urban Living", "Old Market", "Entertainment"],
          primaryCity: "Omaha",
          cities: ["Omaha"],
          totalProperties: 105,
          activeProperties: 89,
          inactiveProperties: 16,
        },
        {
          id: 6,
          name: "Gretna",
          slug: "gretna",
          description:
            "Small town charm with excellent schools and easy commute to Omaha metro area",
          image:
            "https://images.unsplash.com/photo-1600047509807-ba8f99b501cc?auto=format&fit=crop&w=800&q=80",
          propertyCount: 67,
          averagePrice: "345000.00",
          highlights: ["Small Town", "Excellent Schools", "Easy Commute"],
          primaryCity: "Gretna",
          cities: ["Gretna"],
          totalProperties: 82,
          activeProperties: 67,
          inactiveProperties: 15,
        },
      ];

      // Return fallback data with success=true so frontend works normally
      console.warn(
        "⚠️ GBCMA API experiencing Paragon API field mapping issues. Using enhanced fallback data."
      );
      res.json({
        success: true,
        error: "upstream_api_unavailable",
        message:
          "External communities API temporarily unavailable. Showing curated Nebraska communities data.",
        count: fallbackDummy.length,
        total_properties_analyzed: 1234, // Placeholder
        cache: {
          source: "fallback",
          generated_at: new Date().toISOString(),
          reason: "External API field mapping errors",
        },
        filters: {
          status,
          min_properties: minProperties,
          sort_by: sortBy,
        },
        communities: fallbackDummy,
      });
    }
  });

  // Create community endpoint (authenticated)
  app.post("/api/communities", authenticateUser, async (req: any, res) => {
    try {
      const {
        name,
        slug,
        description,
        image,
        propertyCount,
        averagePrice,
        highlights,
      } = req.body;

      if (!name || !slug) {
        return res.status(400).json({
          success: false,
          message: "Name and slug are required",
        });
      }

      const newCommunity = await storage.createCommunity({
        name,
        slug,
        description: description || null,
        image: image || null,
        propertyCount: propertyCount || null,
        averagePrice: averagePrice || null,
        highlights: highlights || null,
      });

      res.json({
        success: true,
        community: newCommunity,
      });
    } catch (error) {
      console.error("❌ Failed to create community:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create community",
        error: (error as any)?.message || String(error),
      });
    }
  });

  // Full communities passthrough (no min_properties restriction, minimal validation)
  app.get("/api/communities/all", async (req, res) => {
    try {
      console.log(
        "🏘️ [ALL] Fetching full communities list (passthrough) start"
      );
      res.type("application/json");
      const searchParams = new URLSearchParams();
      // Pass through known optional filters if provided
      if (req.query.status)
        searchParams.set("status", String(req.query.status));
      if (req.query.min_properties)
        searchParams.set("min_properties", String(req.query.min_properties));
      if (req.query.sort_by)
        searchParams.set("sort_by", String(req.query.sort_by));

      const baseUrl =
        "http://gbcma.us-east-2.elasticbeanstalk.com/api/communities";
      const fullUrl = searchParams.toString()
        ? `${baseUrl}?${searchParams.toString()}`
        : baseUrl;
      console.log("📡 [ALL] Full GBCMA URL:", fullUrl);

      const upstream = await fetch(fullUrl);
      if (!upstream.ok) {
        return res
          .status(upstream.status)
          .json({ error: `Upstream responded ${upstream.status}` });
      }
      const data = await upstream.json();

      // Accept either { success, communities } or direct array fallback
      const rawCommunities: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data.communities)
        ? data.communities
        : [];

      console.log(
        `✅ [ALL] Upstream raw communities count: ${rawCommunities.length}`
      );

      const transformed = rawCommunities.map(
        (community: any, index: number) => ({
          id: index + 1,
          name: community.name,
          slug: community.name
            ? community.name
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-]/g, "")
            : `community-${index + 1}`,
          description: community.name
            ? `Explore ${community.name} community`
            : undefined,
          image:
            getImageForCommunity(community.name) ||
            "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
          propertyCount:
            community.activeProperties || community.propertyCount || 0,
          averagePrice: community.averagePrice
            ? String(community.averagePrice)
            : "0",
          highlights: Array.isArray(community.cities)
            ? community.cities.slice(0, 3)
            : [],
          primaryCity: community.primaryCity,
          cities: community.cities || [],
          totalProperties: community.totalProperties || 0,
          activeProperties:
            community.activeProperties || community.propertyCount || 0,
          inactiveProperties:
            community.inactiveProperties ??
            (community.totalProperties && community.activeProperties
              ? community.totalProperties - community.activeProperties
              : undefined),
        })
      );

      console.log(
        "✅ [ALL] Returning transformed communities count:",
        transformed.length
      );
      return res.json({
        success: true,
        count: transformed.length,
        communities: transformed,
      });
    } catch (err) {
      console.error("❌ [ALL] Failed full passthrough communities fetch:", err);
      return res.status(500).json({
        success: false,
        error: "failed_full_list",
        message: "Failed to load full communities list",
        communities: [],
      });
    }
  });

  // School Districts API Endpoint (proxy to GBCMA)
  app.get("/api/districts", async (req, res) => {
    try {
      const state = (req.query.state as string) || "NE";
      const status = (req.query.status as string) || "active";
      const level = (req.query.level as string) || "elementary";
      const min_properties = (req.query.min_properties as string) || "3";
      const max_records = (req.query.max_records as string) || "2000";
      const q = req.query.q as string | undefined;

      console.log(`🏫 Fetching ${level} school districts from GBCMA API`);

      // Build URL with parameters
      const params = new URLSearchParams({
        state,
        status,
        level,
        min_properties,
        max_records,
      });

      if (q) {
        params.set("q", q);
      }

      console.log(
        `🏫 Using local city-to-district mapping for ${level} districts`
      );

      // Import school district mapping function
      const { getSchoolDistrictForCity } = await import("./external-api");

      // Get communities from GBCMA to map to districts
      const communitiesUrl = `http://gbcma.us-east-2.elasticbeanstalk.com/api/communities?state=${state}&status=${status}&min_properties=0&max_records=5000`;

      const communitiesResponse = await fetch(communitiesUrl);
      if (!communitiesResponse.ok) {
        throw new Error(
          `Communities API returned ${communitiesResponse.status}`
        );
      }

      const communitiesData = await communitiesResponse.json();
      const communities = Array.isArray(communitiesData)
        ? communitiesData
        : Array.isArray(communitiesData.communities)
        ? communitiesData.communities
        : [];

      console.log(`✅ Retrieved ${communities.length} communities from GBCMA`);

      // Map communities to school districts
      const districtMap = new Map<string, any>();

      communities.forEach((community: any) => {
        if (community.cities && Array.isArray(community.cities)) {
          community.cities.forEach((city: string) => {
            const district = getSchoolDistrictForCity(city);
            if (district && district !== "Local School District") {
              const key = `${district}_${level}`;
              if (!districtMap.has(key)) {
                districtMap.set(key, {
                  name: district,
                  level: level,
                  state: state,
                  propertyCount: 0,
                  communities: [],
                });
              }
              const districtData = districtMap.get(key);
              districtData.propertyCount += community.activeProperties || 0;
              districtData.communities.push({
                name: community.name,
                city: city,
                propertyCount: community.activeProperties || 0,
              });
            }
          });
        }
      });

      const districts = Array.from(districtMap.values())
        .filter((d) => d.propertyCount >= parseInt(min_properties))
        .sort((a, b) => b.propertyCount - a.propertyCount)
        .slice(0, parseInt(max_records))
        .map((district) => {
          // Extract unique cities from communities
          const cities = Array.from(
            new Set(district.communities.map((c: any) => c.city))
          );
          return {
            ...district,
            cities: cities,
            totalCommunities: district.communities.length,
            totalActiveProperties: district.propertyCount,
          };
        });

      console.log(
        `🎯 Mapped ${districts.length} districts with ${level} level data`
      );

      const data = {
        success: true,
        count: districts.length,
        totalCommunities: districts.reduce(
          (sum, d) => sum + d.communities.length,
          0
        ),
        districts: districts,
      };

      console.log(
        `✅ Districts API returned ${data.count || 0} districts with ${
          data.totalCommunities || 0
        } total communities`
      );

      res.json(data);
    } catch (error) {
      console.error("❌ Districts API error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch school districts",
        message: (error as any)?.message || String(error),
      });
    }
  });

  // User-specific communities endpoint (respects template customizations)
  app.get(
    "/api/user/:userId/communities",
    authenticateUser,
    async (req: any, res) => {
      try {
        console.log("🏘️👤 Fetching user-specific communities");
        const userId = req.params.userId;

        // Get user's template data
        const template = await db
          .select()
          .from(templates)
          .where(eq(templates.userId, parseInt(userId)))
          .limit(1);

        if (!template[0]) {
          console.log("❌ Template not found for user:", userId);
          return res.status(404).json({ error: "Template not found" });
        }

        const templateData = template[0];

        // Check if communities are enabled
        if (!templateData.communitiesEnabled) {
          console.log("🚫 Communities disabled for user:", userId);
          return res.json([]);
        }

        // Get featured communities list
        const featuredCommunities = templateData.featuredCommunities || [];
        const communityCustomizations =
          templateData.communityCustomizations || {};
        const communitySettings = templateData.communitySettings || {};

        if (featuredCommunities.length === 0) {
          console.log("📭 No featured communities set for user:", userId);
          return res.json([]);
        }

        // Fetch all communities from GBCMA API
        const gbcmaUrl = `http://gbcma.us-east-2.elasticbeanstalk.com/api/communities?status=active&min_properties=1&sort_by=count`;

        let allCommunities = [];
        try {
          const response = await fetch(gbcmaUrl);
          if (response.ok) {
            const gbcmaData = await response.json();
            if (gbcmaData.success && gbcmaData.communities) {
              allCommunities = gbcmaData.communities;
            }
          }
        } catch (error) {
          console.log("⚠️ GBCMA API failed, using fallback data");
        }

        // If GBCMA fails, use fallback
        if (allCommunities.length === 0) {
          allCommunities = [
            {
              name: "Omaha",
              primaryCity: "Omaha",
              activeProperties: 450,
              totalProperties: 500,
              cities: ["Omaha"],
            },
            {
              name: "Lincoln",
              primaryCity: "Lincoln",
              activeProperties: 280,
              totalProperties: 300,
              cities: ["Lincoln"],
            },
            {
              name: "Elkhorn",
              primaryCity: "Elkhorn",
              activeProperties: 180,
              totalProperties: 200,
              cities: ["Elkhorn"],
            },
            {
              name: "Papillion",
              primaryCity: "Papillion",
              activeProperties: 140,
              totalProperties: 150,
              cities: ["Papillion"],
            },
            {
              name: "Gretna",
              primaryCity: "Gretna",
              activeProperties: 110,
              totalProperties: 120,
              cities: ["Gretna"],
            },
            {
              name: "Bellevue",
              primaryCity: "Bellevue",
              activeProperties: 160,
              totalProperties: 180,
              cities: ["Bellevue"],
            },
          ];
        }

        // Filter and customize communities based on user's selection
        const userCommunities = featuredCommunities
          .map((communityName: string, index: number) => {
            const community = allCommunities.find(
              (c: any) => c.name === communityName
            );
            const customization = communityCustomizations[communityName] || {};

            if (!community) {
              // Return a basic entry if community not found in GBCMA
              return {
                id: index + 1,
                name: communityName,
                slug: communityName
                  .toLowerCase()
                  .replace(/\s+/g, "-")
                  .replace(/[^a-z0-9-]/g, ""),
                description:
                  customization.customDescription ||
                  `Explore ${communityName} community`,
                image:
                  customization.customImage ||
                  getImageForCommunity(communityName) ||
                  `https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80`,
                propertyCount: 0,
                averagePrice: "0",
                highlights: ["Contact Us", "For Details"],
              };
            }

            return {
              id: index + 1,
              name: community.name,
              slug: community.name
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-]/g, ""),
              description:
                customization.customDescription ||
                `Explore ${community.name} community`,
              image:
                customization.customImage ||
                getImageForCommunity(community.name) ||
                `https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80`,
              propertyCount: community.activeProperties || 0,
              averagePrice: "0", // Will be calculated separately if needed
              highlights:
                community.cities.length > 1
                  ? [
                      `Multi-city`,
                      `${community.cities.join(", ")}`,
                      `${community.activeProperties} Active`,
                    ]
                  : [
                      `${community.primaryCity}`,
                      `${community.activeProperties} Active`,
                      "Properties",
                    ],
              primaryCity: community.primaryCity,
              cities: community.cities,
              totalProperties: community.totalProperties,
              activeProperties: community.activeProperties,
            };
          })
          .filter(Boolean);

        console.log(
          `✅ Returning ${userCommunities.length} customized communities for user ${userId}`
        );
        res.json(userCommunities);
      } catch (error) {
        console.error("❌ Failed to fetch user communities:", error);
        res.status(500).json({ error: "Failed to fetch user communities" });
      }
    }
  );

  // Blog posts (temporary dummy data / fallback)
  app.get("/api/blog", async (_req, res) => {
    try {
      // Attempt DB fetch first (optional, ignore errors silently)
      let dbPosts: any[] = [];
      try {
        if (db) {
          const { blogPosts } = await import("@shared/schema");
          const { desc } = await import("drizzle-orm");
          dbPosts = await db
            .select()
            .from(blogPosts)
            .orderBy(desc(blogPosts.id))
            .limit(6);
        }
      } catch {}

      if (dbPosts.length > 0) {
        // Return plain array so frontend expecting BlogPost[] works
        return res.json(dbPosts);
      }

      const dummy = [
        {
          id: 1,
          title: "Navigating Nebraska's 2025 Housing Market",
          slug: "nebraska-housing-market-2025",
          excerpt:
            "Key trends buyers & sellers should watch across Omaha, Lincoln, and growing suburbs.",
          content: "Full article coming soon.",
          image:
            "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
          category: "Market",
          author: "Bjork Group",
          published: true,
          createdAt: new Date(),
        },
        {
          id: 2,
          title: "Top Communities for New Construction in 2025",
          slug: "top-new-construction-communities-2025",
          excerpt:
            "Elkhorn, Gretna, and Bennington lead the way with lifestyle and value.",
          content: "Full article coming soon.",
          // Swapped image to a more reliable Unsplash asset (previous one intermittently failed)
          image:
            "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=800&q=80",
          category: "Communities",
          author: "Bjork Group",
          published: true,
          createdAt: new Date(),
        },
        {
          id: 3,
          title: "Preparing Your Home for Spring Listing",
          slug: "prepare-home-for-spring",
          excerpt:
            "Simple upgrades and staging tactics that maximize sale price.",
          content: "Full article coming soon.",
          image:
            "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80",
          category: "Selling",
          author: "Bjork Group",
          published: true,
          createdAt: new Date(),
        },
        {
          id: 4,
          title: "Why Relocation Buyers Are Targeting Omaha",
          slug: "relocation-buyers-omaha",
          excerpt:
            "Affordability + quality of life continue to attract out-of-state migration.",
          content: "Full article coming soon.",
          image:
            "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80",
          category: "Market",
          author: "Bjork Group",
          published: true,
          createdAt: new Date(),
        },
      ];
      // Return dummy posts as plain array to match frontend expectation
      res.json(dummy);
    } catch (e) {
      res.status(500).json({ message: "Failed to load blog posts" });
    }
  });

  // Get single blog post by slug
  app.get("/api/blog/:slug", async (req, res) => {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.status(400).json({ message: "Slug is required" });
      }

      if (db) {
        const { blogPosts } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        const posts = await db
          .select()
          .from(blogPosts)
          .where(eq(blogPosts.slug, slug))
          .limit(1);

        if (posts.length > 0) {
          return res.json(posts[0]);
        }
      }

      // If not found in database, return 404
      return res.status(404).json({
        message: "Blog post not found",
        slug,
      });
    } catch (error) {
      console.error("Error fetching blog post:", error);
      res.status(500).json({ message: "Failed to load blog post" });
    }
  });

  // Generate market insight posts from property data
  app.post("/api/blog/generate", authenticateUser, async (req: any, res) => {
    try {
      if (!db) {
        return res.status(503).json({ message: "Database not available" });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Fetch recent properties for analysis
      let properties: any[] = [];

      // Try to get properties from CMA API
      try {
        const cmaApiKey = process.env.CMA_API_KEY;
        const cmaApiUrl = process.env.CMA_API_URL;

        if (cmaApiKey && cmaApiUrl) {
          const response = await fetch(`${cmaApiUrl}/properties?limit=100`, {
            headers: { Authorization: `Bearer ${cmaApiKey}` },
          });
          if (response.ok) {
            const data = await response.json();
            properties = data.properties || data || [];
          }
        }
      } catch (error) {
        console.log("Could not fetch from CMA API, using sample data");
      }

      // Generate sample posts if no real data
      if (properties.length === 0) {
        properties = Array.from({ length: 50 }, (_, i) => ({
          listPrice: 200000 + Math.random() * 400000,
          sqft: 1200 + Math.random() * 2000,
          city: ["Omaha", "Lincoln", "Elkhorn", "Gretna"][
            Math.floor(Math.random() * 4)
          ],
          subdivision: `${
            ["Oak", "Maple", "Pine", "Cedar"][Math.floor(Math.random() * 4)]
          } Heights`,
        }));
      }

      // Generate posts using the helper function
      const generatedPosts = generateMarketInsightPosts(properties);

      // Save to database
      const { blogPosts } = await import("@shared/schema");

      // Delete old auto-generated posts
      const { eq } = await import("drizzle-orm");
      await db.delete(blogPosts).where(eq(blogPosts.author, "Bjork Group"));

      // Insert new posts
      const insertedPosts = await db
        .insert(blogPosts)
        .values(
          generatedPosts.map((post: any) => ({
            ...post,
            userId,
            id: undefined, // Let DB generate IDs
          }))
        )
        .returning();

      res.json({
        success: true,
        count: insertedPosts.length,
        posts: insertedPosts,
      });
    } catch (error) {
      console.error("Error generating blog posts:", error);
      res.status(500).json({ message: "Failed to generate blog posts" });
    }
  });

  // Helper function to generate market insight posts
  function generateMarketInsightPosts(properties: any[]) {
    if (!properties || properties.length === 0) return [];

    const posts = [];
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Calculate market statistics
    const totalProperties = properties.length;
    const averagePrice =
      properties.reduce(
        (sum, prop) => sum + (prop.listPrice || prop.soldPrice || 0),
        0
      ) / totalProperties;
    const averageSqft =
      properties.reduce((sum, prop) => sum + (prop.sqft || 0), 0) /
      totalProperties;
    const pricePerSqft = averagePrice / averageSqft;

    // Group by neighborhoods
    const neighborhoods = properties.reduce((acc: any, prop) => {
      const neighborhood = prop.subdivision || prop.city;
      if (!acc[neighborhood]) acc[neighborhood] = [];
      acc[neighborhood].push(prop);
      return acc;
    }, {});

    // Market Overview Post
    posts.push({
      title: `Nebraska Real Estate Market Report - ${formattedDate}`,
      slug: "nebraska-market-report-" + currentDate.toISOString().split("T")[0],
      excerpt: `Current market analysis of ${totalProperties} properties showing average price of $${Math.round(
        averagePrice
      ).toLocaleString()}`,
      content: `# Nebraska Real Estate Market Analysis

**Market Overview for ${formattedDate}**

Our latest analysis of ${totalProperties} properties reveals important market trends:

## Key Market Statistics
- **Average List Price**: $${Math.round(averagePrice).toLocaleString()}
- **Average Square Footage**: ${Math.round(averageSqft).toLocaleString()} sq ft
- **Average Price Per Square Foot**: $${Math.round(pricePerSqft)}
- **Properties Analyzed**: ${totalProperties}

## Market Insights
The real estate market continues to show strong fundamentals with properties ranging from $${Math.min(
        ...properties.map((p) => p.listPrice || p.soldPrice || 0)
      ).toLocaleString()} to $${Math.max(
        ...properties.map((p) => p.listPrice || p.soldPrice || 0)
      ).toLocaleString()}.

${
  Object.keys(neighborhoods).length > 1
    ? `## Neighborhood Highlights
${Object.entries(neighborhoods)
  .slice(0, 5)
  .map(
    ([name, props]) =>
      `- **${name}**: ${(props as any[]).length} properties, avg $${Math.round(
        (props as any[]).reduce(
          (sum: number, p: any) => sum + (p.listPrice || p.soldPrice || 0),
          0
        ) / (props as any[]).length
      ).toLocaleString()}`
  )
  .join("\n")}`
    : ""
}

*Data sourced from current MLS listings and recent sales.*`,
      category: "Market Analysis",
      image:
        "https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      published: true,
      featured: true,
      author: "Bjork Group",
      createdAt: currentDate,
      updatedAt: currentDate,
    });

    // Price Range Analysis Post
    const priceRanges = {
      "Under $200k": properties.filter(
        (p) => (p.listPrice || p.soldPrice || 0) < 200000
      ).length,
      "$200k-$300k": properties.filter((p) => {
        const price = p.listPrice || p.soldPrice || 0;
        return price >= 200000 && price < 300000;
      }).length,
      "$300k-$400k": properties.filter((p) => {
        const price = p.listPrice || p.soldPrice || 0;
        return price >= 300000 && price < 400000;
      }).length,
      "Over $400k": properties.filter(
        (p) => (p.listPrice || p.soldPrice || 0) >= 400000
      ).length,
    };

    posts.push({
      title: "Understanding Home Price Ranges: Where to Find Value",
      slug: "price-ranges-analysis-" + currentDate.toISOString().split("T")[0],
      excerpt:
        "Comprehensive breakdown of property availability across different price segments.",
      content: `# Understanding Home Price Ranges

Finding the right home at the right price requires understanding the current market distribution. Here's what our latest data shows:

## Price Distribution Analysis
${Object.entries(priceRanges)
  .map(
    ([range, count]) =>
      `- **${range}**: ${count} properties (${Math.round(
        (count / totalProperties) * 100
      )}% of market)`
  )
  .join("\n")}

## What This Means for Buyers
- **First-time buyers**: ${
        priceRanges["Under $200k"]
      } homes available under $200k
- **Move-up buyers**: Strong selection in the $200k-$400k range with ${
        priceRanges["$200k-$300k"] + priceRanges["$300k-$400k"]
      } properties
- **Luxury buyers**: ${priceRanges["Over $400k"]} premium properties available

The current market offers opportunities across all price points, with particularly strong inventory in the middle price ranges.

*Contact our team to explore properties in your preferred price range.*`,
      category: "Buyer Guide",
      image:
        "https://images.unsplash.com/photo-1582407947304-fd86f028f716?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      published: true,
      featured: false,
      author: "Bjork Group",
      createdAt: new Date(currentDate.getTime() - 86400000),
      updatedAt: new Date(currentDate.getTime() - 86400000),
    });

    // Investment Opportunities Post
    const investmentProperties = properties.filter(
      (p) => (p.listPrice || p.soldPrice || 0) < averagePrice
    );

    posts.push({
      title: "Investment Opportunities in Real Estate",
      slug:
        "investment-opportunities-" + currentDate.toISOString().split("T")[0],
      excerpt: `Discover ${investmentProperties.length} potential investment properties below market average pricing.`,
      content: `# Investment Opportunities

The real estate market presents compelling investment opportunities for both new and experienced investors.

## Current Investment Landscape
- **Below-Average Pricing**: ${
        investmentProperties.length
      } properties priced below the market average of $${Math.round(
        averagePrice
      ).toLocaleString()}
- **Average Price Per Square Foot**: $${Math.round(
        pricePerSqft
      )} provides good value
- **Diverse Property Types**: Options ranging from single-family homes to multi-unit properties

## Key Investment Metrics
- **Market Average Price**: $${Math.round(averagePrice).toLocaleString()}
- **Value Properties**: Properties starting at $${Math.min(
        ...investmentProperties.map((p) => p.listPrice || p.soldPrice || 0)
      ).toLocaleString()}

*Ready to explore investment opportunities? Contact us for a personalized market analysis.*`,
      category: "Investment",
      image:
        "https://images.unsplash.com/photo-1494526585095-c41746248156?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      published: true,
      featured: false,
      author: "Bjork Group",
      createdAt: new Date(currentDate.getTime() - 172800000),
      updatedAt: new Date(currentDate.getTime() - 172800000),
    });

    return posts;
  }

  // Generate AI-powered blog articles about local news and events
  app.post(
    "/api/blog/generate-ai-articles",
    authenticateUser,
    async (req: any, res) => {
      try {
        if (!db) {
          return res.status(503).json({ message: "Database not available" });
        }

        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { topics, city = "Omaha" } = req.body;

        // Use unified AI service with fallback support
        const { getAvailableProviders, getProviderStatus } = await import(
          "./ai-service"
        );

        const availableProviders = getAvailableProviders();
        const providerStatus = getProviderStatus();

        console.log("🤖 AI Provider Status:", providerStatus);
        console.log("✅ Available providers:", availableProviders);

        if (availableProviders.length === 0) {
          return res.status(503).json({
            message:
              "No AI service configured. Please set one of: OPENAI_API_KEY, GITHUB_TOKEN (for Copilot), or ANTHROPIC_API_KEY environment variable.",
            providerStatus,
          });
        }

        const generatedArticles = []; // Default topics if none provided
        const articleTopics = topics || [
          "Local Development & Business",
          "Community Events & Activities",
          "Real Estate Market Update",
          "New Construction & Housing",
          "Lifestyle & Entertainment",
        ];

        // Generate articles for each topic
        for (const topic of articleTopics.slice(0, 5)) {
          try {
            const prompt = `Write a comprehensive blog article about "${topic}" in ${city}, Nebraska.

Include:
- An engaging title
- A compelling excerpt (2-3 sentences)
- Full article content (500-800 words) in Markdown format
- Recent developments, statistics, or updates
- Local insights and community impact
- Practical information for residents and newcomers

Format the response as JSON with these fields:
{
  "title": "Article title",
  "excerpt": "Brief excerpt",
  "content": "Full markdown content",
  "category": "Category name (Market/Community/Development/Lifestyle)",
  "tags": ["tag1", "tag2", "tag3"]
}`;

            const systemPrompt =
              "You are a professional real estate and local news writer specializing in Nebraska markets. Write engaging, informative articles with a friendly, professional tone.";

            // Use unified AI service with automatic fallback
            const { generateAIJSON } = await import("./ai-service");
            const preferredProvider = (process.env.PREFERRED_AI_PROVIDER ||
              "github-copilot") as "openai" | "github-copilot" | "anthropic";

            const result = await generateAIJSON<{
              title: string;
              excerpt: string;
              content: string;
              category: string;
              tags: string[];
            }>(prompt, systemPrompt, {
              temperature: 0.7,
              preferredProvider,
            });

            const articleData = result.data;
            console.log(
              `✅ Generated article with ${result.provider} (${result.model}): ${articleData.title}`
            );

            // Generate slug from title
            const slug = articleData.title
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, "")
              .replace(/\s+/g, "-")
              .replace(/-+/g, "-")
              .trim();

            // Generate context-aware image query for Unsplash
            const getImageQuery = (title: string, category: string) => {
              const lowerTitle = title.toLowerCase();

              // Check for specific keywords
              if (
                lowerTitle.includes("omaha") ||
                lowerTitle.includes("nebraska")
              ) {
                if (
                  lowerTitle.includes("downtown") ||
                  lowerTitle.includes("skyline")
                ) {
                  return "omaha-skyline-cityscape";
                }
                if (
                  lowerTitle.includes("restaurant") ||
                  lowerTitle.includes("dining")
                ) {
                  return "restaurant-dining-food";
                }
                if (
                  lowerTitle.includes("sports") ||
                  lowerTitle.includes("volleyball") ||
                  lowerTitle.includes("athletics")
                ) {
                  return "volleyball-sports-arena";
                }
                if (
                  lowerTitle.includes("construction") ||
                  lowerTitle.includes("building") ||
                  lowerTitle.includes("development")
                ) {
                  return "modern-building-construction";
                }
                if (
                  lowerTitle.includes("community") ||
                  lowerTitle.includes("event") ||
                  lowerTitle.includes("festival")
                ) {
                  return "community-gathering-festival";
                }
                if (
                  lowerTitle.includes("tower") ||
                  lowerTitle.includes("skyscraper")
                ) {
                  return "modern-skyscraper-architecture";
                }
              }

              // Category-based defaults
              if (category === "Market") return "real-estate-market-home";
              if (category === "Development")
                return "modern-architecture-building";
              if (category === "Community") return "community-people-gathering";
              if (category === "Lifestyle") return "lifestyle-city-life";

              return "modern-home-real-estate";
            };

            const imageQuery = getImageQuery(
              articleData.title,
              articleData.category || "Community"
            );

            generatedArticles.push({
              title: articleData.title,
              slug: `${slug}-${Date.now()}`,
              excerpt: articleData.excerpt,
              content: articleData.content,
              category: articleData.category || "Community",
              author: "Bjork Group",
              image: `https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80`,
              published: true,
              featured: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              userId,
            });
          } catch (error) {
            console.error(
              `Error generating article for topic "${topic}":`,
              error
            );
          }
        }

        if (generatedArticles.length === 0) {
          return res.status(500).json({
            message: "Failed to generate any articles. Please try again.",
          });
        }

        // Save to database
        const { blogPosts } = await import("@shared/schema");

        const insertedPosts = await db
          .insert(blogPosts)
          .values(
            generatedArticles.map((post) => ({
              ...post,
              id: undefined, // Let DB generate IDs
            }))
          )
          .returning();

        res.json({
          success: true,
          count: insertedPosts.length,
          posts: insertedPosts,
          message: `Successfully generated ${insertedPosts.length} AI-powered articles about ${city}`,
        });
      } catch (error) {
        console.error("Error generating AI articles:", error);
        res.status(500).json({
          message: "Failed to generate AI articles",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Import necessary modules for template routes
  const { templates, users } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");

  // Type for authenticated requests
  interface AuthenticatedRequest extends Request {
    user?: {
      id: number;
      username: string;
      email: string;
      firstName?: string;
      lastName?: string;
    };
    body: any;
  }

  // Get public template endpoint moved to index.ts to avoid auth middleware

  // Get user's template (requires authentication)
  app.get("/api/template", authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user!.id;

      if (!db) {
        return res.status(503).json({ message: "Database not available" });
      }

      // Get user-specific template
      let template = await db
        .select()
        .from(templates)
        .where(eq(templates.userId, userId))
        .limit(1);

      // If no template exists for user, create one with default values
      if (!template || template.length === 0) {
        // Get user's customSlug to use as template publicSlug
        const userInfo = await db
          .select({ customSlug: users.customSlug })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const defaultTemplate = {
          userId: userId,
          companyName: `${
            req.user!.firstName || req.user!.username
          }'s Real Estate Company`,
          agentName: `${req.user!.firstName || req.user!.username} ${
            req.user!.lastName || ""
          }`.trim(),
          agentTitle: "Principal Broker",
          agentEmail: req.user!.email,
          companyDescription:
            "We believe that luxury is not a price point but an experience.",
          homesSold: 0,
          totalSalesVolume: "$0",
          serviceAreas: ["Your Primary City", "Your Secondary City"],
          phone: "",
          address: {
            street: "123 Main Street",
            city: "Your City",
            state: "Your State",
            zip: "12345",
          },
          // Set publicSlug to match user's customSlug for consistency
          publicSlug: userInfo[0]?.customSlug || null,
        };

        const result = await db
          .insert(templates)
          .values(defaultTemplate)
          .returning();
        template = result;
      }

      res.json(template[0]);
    } catch (error) {
      console.error("Error fetching user template:", error);
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  // Update user's account profile (requires authentication)
  // This route syncs profile changes to the template automatically
  app.put("/api/account/profile", authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { firstName, lastName, phoneNumber } = req.body;

      console.log(`📝 [Account Profile] Updating profile for user ${userId}`);
      console.log(`📦 [Account Profile] Data:`, {
        firstName,
        lastName,
        phoneNumber,
      });

      if (!db) {
        return res.status(503).json({ message: "Database not available" });
      }

      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      // Update user profile
      const [updatedUser] = await db
        .update(users)
        .set({
          firstName,
          lastName,
          phoneNumber,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      console.log(`✅ [Account Profile] User profile updated`);

      // Sync profile changes to template
      try {
        const { syncProfileToTemplate } = await import("./utils/profile-sync");
        await syncProfileToTemplate(userId, {
          firstName,
          lastName,
          phoneNumber,
        });
        console.log(
          `🔄 [Account Profile] Template synced with profile updates`
        );
      } catch (syncError) {
        console.warn(
          `⚠️ [Account Profile] Template sync failed but profile updated:`,
          syncError
        );
        // Don't fail the request if template sync fails
      }

      res.json({
        message: "Profile updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("❌ [Account Profile] Profile update error:", error);
      res.status(500).json({
        message: "Failed to update profile",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Update user's template (requires authentication)
  app.post("/api/template", authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user!.id;

      console.log(`🚀 Template update request started`);
      console.log(`👤 User ID: ${userId}`);
      console.log(`📝 Request body:`, JSON.stringify(req.body, null, 2));

      if (!db) {
        return res.status(503).json({ message: "Database not available" });
      }

      // Validate required fields
      const requiredFields = ["companyName", "agentName"];
      for (const field of requiredFields) {
        if (!req.body[field]) {
          console.log(`❌ Missing required field: ${field}`);
          return res.status(400).json({
            message: `Missing required field: ${field}`,
            received: req.body,
          });
        }
      }

      console.log(`✅ Required fields validation passed`);

      // Create a mutable copy of incoming body & sanitize
      let incoming: any = { ...req.body };
      if (incoming.id) {
        console.log("ℹ️ Ignoring client-supplied template id", incoming.id);
        delete incoming.id;
      }
      if (incoming.userId && incoming.userId !== userId) {
        console.log(
          "ℹ️ Ignoring mismatched userId",
          incoming.userId,
          "expected",
          userId
        );
      }
      delete incoming.userId;

      const allowedKeys = new Set([
        "companyName",
        "agentName",
        "agentTitle",
        "agentEmail",
        "phone",
        "address",
        "heroTitle",
        "heroSubtitle",
        // Draggable hero layout positions
        "heroLayout",
        // Hero text background/typography settings
        "heroTextOverlayEnabled",
        "heroTextOverlayColor",
        "heroTextOverlayOpacity",
        "heroTitleFontSize",
        "heroSubtitleFontSize",
        "heroOverlayPadding",
        // Hero text colors
        "heroTitleTextColor",
        "heroSubtitleTextColor",
        // Page layout / section ordering
        "sectionOrder",
        // Per-page hero images
        "aboutHeroImageUrl",
        "servicesHeroImageUrl",
        "communitiesHeroImageUrl",
        "contactHeroImageUrl",
        "buyingHeroImageUrl",
        "sellingHeroImageUrl",
        "contactPhone",
        "contactPhoneText",
        "officeAddress",
        "officeCity",
        "officeState",
        "officeZip",
        "companyDescription",
        "facebookUrl",
        "twitterUrl",
        "linkedinUrl",
        "instagramUrl",
        "youtubeUrl",
        "tiktokUrl",
        "agentBio",
        // Private Listings Form Text
        "privateListingsTitle",
        "privateListingsDescription",
        "privateListingsDisclaimer",
        "privateListingsConsent",
        "homesSold",
        "totalSalesVolume",
        "yearsExperience",
        "clientSatisfaction",
        "serviceAreas",
        "primaryColor",
        "accentColor",
        "beigeColor",
        "section4Color",
        "fontFamily",
        "customFontFamily",
        "headingSize",
        "bodySize",
        "serviceIcons",
        "achievementIcons",
        "featureIcons",
        "marketingIcons",
        "processIcons",
        "logoUrl",
        "heroImageUrl",
        "agentImageUrl",
        "heroVideoUrl",
        "heroVideoUrls",
        "heroMode",
        "mlsId",
        "mlsApiKey",
        "mlsRegion",
        // External link field for iframe nav tab
        "externalLinkUrl",
        // Hero layout configuration for drag-and-drop positions
        "heroLayout",
        // Manual featured MLS IDs list
        "manualFeaturedMlsIds",
        // Community customization fields (were previously excluded)
        "communitiesEnabled",
        "featuredCommunities",
        "communitySettings",
        "communityCustomizations",
        "zipCodeMappings",
        // School Districts fields
        "districtsEnabled",
        "featuredDistricts",
        "districtLevel",
        "districtSettings",
        "subdomain",
        "customDomain",
        "isActive",
        "status",
        "completedAt",
        "publicSlug",
        // Navigation & UI customization
        "navigationConfig",
        "actionButtonsConfig",
        "dropdownMenusConfig",
        // Service page configurations
        "sellerServicesConfig",
        "buyerServicesConfig",
      ]);
      for (const k of Object.keys(incoming)) {
        if (!allowedKeys.has(k)) {
          console.log("🧹 Dropping unknown template field:", k);
          delete incoming[k];
        }
      }
      const cleanedData = Object.entries(incoming).reduce((acc, [k, v]) => {
        acc[k] = v === "" ? null : v;
        return acc;
      }, {} as any);
      cleanedData.userId = userId;

      // Debug: Log per-page hero image fields being saved
      console.log("🖼️ Incoming per-page hero images:", {
        buyingHeroImageUrl: incoming.buyingHeroImageUrl,
        sellingHeroImageUrl: incoming.sellingHeroImageUrl,
        servicesHeroImageUrl: incoming.servicesHeroImageUrl,
        aboutHeroImageUrl: incoming.aboutHeroImageUrl,
        communitiesHeroImageUrl: incoming.communitiesHeroImageUrl,
        contactHeroImageUrl: incoming.contactHeroImageUrl,
      });

      // Server-side safeguard: if phone provided but contactPhone missing, copy it
      if (cleanedData.phone && !cleanedData.contactPhone) {
        cleanedData.contactPhone = cleanedData.phone;
        console.log(
          "📞 Server sync: set contactPhone from phone:",
          cleanedData.contactPhone
        );
      }

      // Normalize community related fields
      if (Array.isArray(cleanedData.featuredCommunities)) {
        cleanedData.featuredCommunities = cleanedData.featuredCommunities
          .map((c: any) => (typeof c === "string" ? c.trim() : ""))
          .filter((c: string) => !!c)
          .filter(
            (c: string, i: number, arr: string[]) => arr.indexOf(c) === i
          );
      }
      // Light validation for sectionOrder if provided
      if (Array.isArray(cleanedData.sectionOrder)) {
        const allowedSections = new Set([
          "hero",
          "featuredListings",
          "communities",
          "privateListings",
          "callToAction",
          "about",
          "videoShowcase",
          "marketInsights",
          "contact",
          // Accept schools section ids if used anywhere
          "schoolDistricts",
        ]);
        cleanedData.sectionOrder = cleanedData.sectionOrder
          .map((s: any) => (typeof s === "string" ? s.trim() : ""))
          .filter((s: string) => !!s && allowedSections.has(s))
          .filter(
            (s: string, i: number, arr: string[]) => arr.indexOf(s) === i
          );
      }
      if (
        cleanedData.communitySettings &&
        typeof cleanedData.communitySettings !== "object"
      ) {
        delete cleanedData.communitySettings; // prevent invalid types
      }
      if (
        cleanedData.communityCustomizations &&
        typeof cleanedData.communityCustomizations !== "object"
      ) {
        delete cleanedData.communityCustomizations;
      }

      console.log(
        `Cleaned template data for user ${userId}:`,
        JSON.stringify(cleanedData, null, 2)
      );

      // Check if template exists for user
      const existingTemplate = await db
        .select()
        .from(templates)
        .where(eq(templates.userId, userId))
        .limit(1);

      // Normalize & verify publicSlug uniqueness if provided
      if (cleanedData.publicSlug) {
        cleanedData.publicSlug = String(cleanedData.publicSlug)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/--+/g, "-")
          .replace(/^-+|-+$/g, "");
        if (cleanedData.publicSlug.length < 3) {
          return res.status(400).json({
            message: "Public URL must be at least 3 characters",
            field: "publicSlug",
          });
        }
        const slugOwner = await db
          .select({ id: templates.id, userId: templates.userId })
          .from(templates)
          .where(eq(templates.publicSlug, cleanedData.publicSlug))
          .limit(1);
        if (slugOwner.length > 0 && slugOwner[0].userId !== userId) {
          console.log(
            `🚫 Conflict: publicSlug '${cleanedData.publicSlug}' already owned by user ${slugOwner[0].userId}`
          );
          return res.status(409).json({
            message: "Public URL already in use. Please choose another.",
            field: "publicSlug",
            value: cleanedData.publicSlug,
          });
        }
      }

      let result;
      if (existingTemplate && existingTemplate.length > 0) {
        // Update existing template
        result = await db
          .update(templates)
          .set(cleanedData)
          .where(eq(templates.userId, userId))
          .returning();
      } else {
        // Create new template with default featured communities
        const defaultFeaturedCommunities = [
          "Omaha",
          "Westside / District 66",
          "Elkhorn",
          "Bellevue",
          "Gretna",
          "Millard",
          "Valley",
          "Ashland",
        ];

        // Add default communities if not already set
        if (
          !cleanedData.featuredCommunities ||
          cleanedData.featuredCommunities.length === 0
        ) {
          cleanedData.featuredCommunities = defaultFeaturedCommunities;
        }

        result = await db.insert(templates).values(cleanedData).returning();
      }
      // (Sanitization already performed above before DB write)

      console.log("User template updated successfully:", result[0]);
      console.log("🧩 Saved sectionOrder:", result[0]?.sectionOrder);
      res.json(result[0]);
    } catch (error) {
      console.error("Error updating user template:", error);
      console.error("› name:", (error as any)?.name);
      console.error("› message:", (error as any)?.message);
      console.error("› detail:", (error as any)?.detail);
      console.error("› code:", (error as any)?.code);
      console.error(
        "› incoming body keys:",
        Object.keys((req as any).body || {})
      );
      if (
        (error as any)?.code === "23505" &&
        /(templates_public_slug_key)/.test((error as any)?.detail || "")
      ) {
        return res.status(409).json({
          message: "Public URL already in use. Please choose another.",
          field: "publicSlug",
        });
      }
      res.status(500).json({
        message: "Failed to update template",
        error: error instanceof Error ? error.message : "Unknown error",
        details: req.body,
      });
    }
  });

  // Get template by agent slug (no authentication required - for agent custom URLs)
  app.get("/api/agent/:slug/template", async (req, res) => {
    try {
      const { slug } = req.params;
      console.log(`🔍 Getting template for agent slug: ${slug}`);

      if (!db) {
        return res.status(503).json({ message: "Database not available" });
      }

      // Import users table to join with templates
      const { users } = await import("@shared/schema");

      // Get template by user's customSlug from database
      let result = await db
        .select({
          template: templates,
          user: users,
        })
        .from(templates)
        .innerJoin(users, eq(templates.userId, users.id))
        .where(eq(users.customSlug, slug))
        .limit(1);

      // If no match by customSlug, try by username as fallback
      if (!result || result.length === 0) {
        console.log(
          `🔍 No agent found for customSlug: ${slug}, trying username...`
        );
        result = await db
          .select({
            template: templates,
            user: users,
          })
          .from(templates)
          .innerJoin(users, eq(templates.userId, users.id))
          .where(eq(users.username, slug))
          .limit(1);
      }

      if (!result || result.length === 0) {
        console.log(
          `❌ No agent found for slug: ${slug} (tried customSlug and username), falling back to public template`
        );

        // Fall back to public template if no specific agent template found
        const publicTemplateResult = await db
          .select()
          .from(templates)
          .where(eq(templates.isActive, true))
          .limit(1);

        if (publicTemplateResult && publicTemplateResult.length > 0) {
          const publicTemplate = publicTemplateResult[0];
          console.log(
            `✅ Using public template as fallback for agent slug: ${slug}`
          );

          // Return public template with agent context
          const templateWithFallbacks = {
            ...publicTemplate,
            // Override agent-specific fields to show it's a fallback
            agentName: publicTemplate.agentName || "Real Estate Professional",
            logoUrl:
              publicTemplate.logoUrl || "/assets/defaults/default-logo.png",
            heroImageUrl:
              publicTemplate.heroImageUrl ||
              "/assets/defaults/default-hero-image.jpg",
            agentImageUrl:
              publicTemplate.agentImageUrl ||
              "/assets/defaults/default-agent-image.jpg",
            heroVideoUrl:
              publicTemplate.heroVideoUrl ||
              "/assets/defaults/default-hero-video.gif",
          };

          return res.json(templateWithFallbacks);
        }

        // If no public template either, return 404
        return res.status(404).json({
          message: "Agent not found",
          slug,
        });
      }

      const template = result[0].template;
      console.log(`✅ Template found for agent slug ${slug}:`, {
        id: template.id,
        agentName: template.agentName,
        companyName: template.companyName,
      });

      // Return the template with media fallbacks
      const templateWithFallbacks = {
        ...template,
        logoUrl: template.logoUrl || "/assets/defaults/default-logo.png",
        heroImageUrl:
          template.heroImageUrl || "/assets/defaults/default-hero-image.jpg",
        agentImageUrl:
          template.agentImageUrl || "/assets/defaults/default-agent-image.jpg",
        heroVideoUrl:
          template.heroVideoUrl || "/assets/defaults/default-hero-video.gif",
      };

      res.json(templateWithFallbacks);
    } catch (error) {
      console.error("Error fetching template by agent slug:", error);
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  // Get team members by agent slug (public endpoint - no authentication required)
  app.get("/api/agent/:slug/team-members", async (req, res) => {
    try {
      const rawSlug = req.params.slug;
      const decodedSlug = decodeURIComponent(rawSlug || "");
      const normalizedSlug = decodedSlug.trim().toLowerCase();
      console.log(
        `🔍 Public team-members lookup slug raw='${rawSlug}' decoded='${decodedSlug}'`
      );

      if (!db) {
        return res.status(503).json({ message: "Database not available" });
      }

      const {
        users,
        teams: teamsTable,
        teamMembers,
      } = await import("@shared/schema");
      const { eq, or, inArray } = await import("drizzle-orm");

      // 1. Locate user by (a) customSlug match OR (b) email match (decoded), fallback to early exit
      let userRecord = await db.query.users.findFirst({
        where: (u: any, { eq, or }: any) =>
          or(eq(u.customSlug, normalizedSlug), eq(u.email, normalizedSlug)),
      });

      // Build fallback variants if not found
      if (!userRecord) {
        const variants = new Set<string>();
        // spaces -> dashes
        variants.add(normalizedSlug.replace(/\s+/g, "-"));
        // trim trailing numeric segment (e.g., slug-1, slug123)
        variants.add(normalizedSlug.replace(/-?\d+$/, ""));
        // drop last hyphen section
        const parts = normalizedSlug.split("-");
        if (parts.length > 1) variants.add(parts.slice(0, -1).join("-"));
        for (const v of Array.from(variants).filter(Boolean)) {
          if (v && v !== normalizedSlug) {
            userRecord = await db.query.users.findFirst({
              where: (u: any, { eq, or }: any) =>
                or(eq(u.customSlug, v), eq(u.email, v)),
            });
            if (userRecord) {
              console.log(`🔁 Fallback slug match succeeded variant='${v}'`);
              break;
            }
          }
        }
      }

      if (!userRecord) {
        console.log(
          `❌ No user found for slug/email '${normalizedSlug}' (after variants)`
        );
        return res.json({ success: true, teams: [], members: [] });
      }

      // 2. Fetch (or create) team(s) for this user
      let teamsForUser = await db.query.teams.findMany({
        where: eq(teamsTable.userId, userRecord.id),
      });

      let createdTeam: any | null = null;
      if (teamsForUser.length === 0) {
        try {
          const teamNameBase =
            userRecord.customSlug ||
            userRecord.username ||
            (userRecord.email ? userRecord.email.split("@")[0] : "agent");
          const inserted = await db
            .insert(teamsTable)
            .values({
              name: `${teamNameBase} Team`,
              description: `Auto-created team for ${teamNameBase}`,
              userId: userRecord.id,
            })
            .returning();
          createdTeam = inserted[0];
          console.log(
            `✅ Auto-created public team ${createdTeam.id} for user ${userRecord.id}`
          );
        } catch (e) {
          console.warn("⚠️ Public team auto-create failed (race?)", e);
        }
        teamsForUser = createdTeam ? [createdTeam] : teamsForUser;
      }

      // 3. (Changed) Do NOT auto-create default members; teams should remain empty until user action

      // 4. Fetch members for all teams (may be empty which is valid)
      const teamIds = teamsForUser.map((t: any) => t.id);
      let members: any[] = [];
      if (teamIds.length) {
        members = await db
          .select()
          .from(teamMembers)
          .where(inArray(teamMembers.teamId, teamIds));
      }

      console.log(
        `✅ Public team-members result user=${userRecord.id} teams=${teamsForUser.length} members=${members.length}`
      );

      // 5. Shape response to include teams list for UI consistency
      const shapedTeams = teamsForUser.map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        createdAt: t.createdAt,
      }));
      return res.json({
        success: true,
        teams: shapedTeams,
        members: members.map((m) => ({
          id: m.id,
          teamId: m.teamId,
          agentName: (m as any).agentName,
          agentMlsId: (m as any).agentMlsId,
          agentPhone: (m as any).agentPhone,
          agentImageUrl: (m as any).agentImageUrl,
          createdAt: (m as any).createdAt,
        })),
      });
    } catch (error) {
      console.error(
        "Error fetching team members by agent slug (public):",
        error
      );
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  // Auto-generate customSlug for current user
  app.post("/api/user/generate-slug", authenticateUser, async (req, res) => {
    try {
      const { generateUniqueSlug } = await import("./utils/slug-generator");
      const { db } = await import("./db");
      const { users, templates } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const userId = (req as any).user!.id;
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || user.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentUser = user[0];

      // Try to generate from first name + last name, fallback to username
      const fullName = currentUser.firstName
        ? `${currentUser.firstName} ${currentUser.lastName || ""}`.trim()
        : undefined;

      const newSlug = await generateUniqueSlug(
        currentUser.firstName,
        currentUser.lastName,
        currentUser.username
      );

      // Update user's customSlug
      const updatedUser = await db
        .update(users)
        .set({ customSlug: newSlug })
        .where(eq(users.id, userId))
        .returning();

      // Also update the user's template publicSlug if they have one
      try {
        const userTemplate = await db
          .select()
          .from(templates)
          .where(eq(templates.userId, userId))
          .limit(1);

        if (userTemplate.length > 0) {
          // Always update the template's publicSlug to match the new customSlug
          await db
            .update(templates)
            .set({ publicSlug: newSlug })
            .where(eq(templates.id, userTemplate[0].id));
          console.log(
            `Updated publicSlug for user ${userId} template: ${newSlug}`
          );
        }
      } catch (templateError) {
        console.warn(
          `Could not update template publicSlug for user ${userId}:`,
          templateError
        );
        // Don't fail the whole operation if template update fails
      }

      res.json({
        message: "Custom slug generated successfully",
        customSlug: newSlug,
        user: updatedUser[0],
      });
    } catch (error) {
      console.error("Error generating custom slug:", error);
      res.status(500).json({ message: "Failed to generate custom slug" });
    }
  });

  // Auto-generate URL for current user (for automatic clean URL generation)
  app.post(
    "/api/user/auto-generate-slug",
    authenticateUser,
    async (req, res) => {
      try {
        const { generateUniqueSlug } = await import("./utils/slug-generator");
        const { db } = await import("./db");
        const { users } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        const userId = (req as any).user!.id;
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user || user.length === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        const currentUser = user[0];
        console.log(
          `🔍 Auto-generation check for user ${currentUser.username}:`,
          {
            username: currentUser.username,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            customSlug: currentUser.customSlug,
          }
        );

        // Only auto-generate if user has generic username and real name data
        const hasGenericUsername =
          currentUser.username &&
          (currentUser.username.includes("office") ||
            currentUser.username.includes("test") ||
            currentUser.username.match(/^user\d+$/i));

        const hasRealNameData = currentUser.firstName && currentUser.lastName;

        console.log(`🔍 Auto-generation conditions:`, {
          hasGenericUsername,
          hasRealNameData,
          willAutoGenerate: hasGenericUsername && hasRealNameData,
        });

        if (!hasGenericUsername || !hasRealNameData) {
          return res.json({
            message:
              "Auto-generation not needed - user already has a professional URL",
            customSlug: currentUser.customSlug,
            skipped: true,
          });
        }

        // Use the same slug generator as registration
        const newSlug = await generateUniqueSlug(
          currentUser.firstName,
          currentUser.lastName,
          currentUser.username
        );

        // Update user's customSlug
        const updatedUser = await db
          .update(users)
          .set({ customSlug: newSlug })
          .where(eq(users.id, userId))
          .returning();

        console.log(
          `🔄 Auto-generated clean URL for ${currentUser.firstName} ${currentUser.lastName}: ${newSlug}`
        );

        res.json({
          message: "Clean URL automatically generated",
          customSlug: newSlug,
          user: updatedUser[0],
          autoGenerated: true,
        });
      } catch (error) {
        console.error("Error auto-generating custom slug:", error);
        res
          .status(500)
          .json({ message: "Failed to auto-generate custom slug" });
      }
    }
  );

  // Test endpoint for auto URL generation
  app.post("/api/test/auto-generate", async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: "username required" });
      }

      const { generateUniqueSlug } = await import("./utils/slug-generator");
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      // Find user by username
      const user = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!user || user.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const currentUser = user[0];
      console.log(`🧪 Testing auto-generation for user:`, currentUser);

      // Generate new slug
      const newSlug = await generateUniqueSlug(
        currentUser.firstName,
        currentUser.lastName,
        currentUser.username
      );

      // Update user's customSlug
      const updatedUser = await db
        .update(users)
        .set({ customSlug: newSlug })
        .where(eq(users.id, currentUser.id))
        .returning();

      res.json({
        message: "Test auto-generation completed",
        oldSlug: currentUser.customSlug,
        newSlug: newSlug,
        user: updatedUser[0],
      });
    } catch (error) {
      console.error("Test auto-generation error:", error);
      res.status(500).json({ error: "Test failed" });
    }
  });

  // CMA Comparables Proxy - proxy requests to external CMA API
  app.get("/api/cma-comparables", optionalAuth, async (req, res) => {
    try {
      console.log("🏘️ CMA Comparables proxy request with params:", req.query);

      // Type helper for global cache
      // @ts-ignore
      interface GlobalWithCache extends NodeJS.Global {
        __cmaCache?: Map<string, { timestamp: number; payload: any }>;
      }
      // @ts-ignore
      const g: GlobalWithCache = global;

      // Simple in-memory cache for subdivision-filtered queries
      // Keyed by sorted query string (excluding page if includeMlsDetails to reduce churn)
      const CMA_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
      // Initialize cache store once
      if (!g.__cmaCache) {
        g.__cmaCache = new Map();
      }
      const cmaCache = g.__cmaCache;

      // Build external API URL with all query parameters
      const queryParams = new URLSearchParams();
      Object.entries(req.query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          queryParams.append(key, value.toString());
        }
      });

      // Normalize zip_code: if a single param contains comma-separated list, expand to multiple zip_code params
      if (queryParams.has("zip_code")) {
        const combined = queryParams.getAll("zip_code");
        let needsExpansion = false;
        const expanded: string[] = [];
        combined.forEach((v) => {
          if (v.includes(",")) {
            needsExpansion = true;
            v.split(",")
              .map((z) => z.trim())
              .filter(Boolean)
              .forEach((z) => expanded.push(z));
          } else {
            expanded.push(v.trim());
          }
        });
        if (needsExpansion) {
          queryParams.delete("zip_code");
          // De-dupe while preserving order
          const seen = new Set<string>();
          expanded.forEach((z) => {
            if (!seen.has(z)) {
              seen.add(z);
              queryParams.append("zip_code", z);
            }
          });
          console.log(
            "🔧 Expanded comma zip_code list into separate params:",
            Array.from(seen)
          );
        }
      }

      // Alias: community -> subdivision (only if subdivision not already provided)
      if (!queryParams.has("subdivision") && queryParams.has("community")) {
        queryParams.set("subdivision", queryParams.get("community") || "");
      }

      // Subdivision normalization & filter injection (server authoritative)
      if (queryParams.has("subdivision")) {
        const rawSub = queryParams.get("subdivision") || "";
        const normalized = rawSub.trim().toLowerCase();
        queryParams.set("subdivision", normalized); // normalized for caching and upstream param (if supported)
        // If upstream API does NOT natively filter by subdivision param, we add an OData $filter
        // Only add if not already present to avoid stacking
        const filterClause = `(contains(tolower(SubdivisionName),'${normalized.replace(
          /'/g,
          "''"
        )}') or contains(tolower(Subdivision),'${normalized.replace(
          /'/g,
          "''"
        )}'))`;
        if (!queryParams.has("$filter")) {
          queryParams.append("$filter", filterClause);
        } else if (!queryParams.get("$filter")!.includes("Subdivision")) {
          queryParams.set(
            "$filter",
            `${queryParams.get("$filter")} and ${filterClause}`
          );
        }
      }

      // Build a stable cache key (sorted params)
      const sortedEntries = Array.from(queryParams.entries()).sort(([a], [b]) =>
        a.localeCompare(b)
      );
      const cacheKey = sortedEntries.map(([k, v]) => `${k}=${v}`).join("&");
      const now = Date.now();
      if (cmaCache.has(cacheKey)) {
        const cached = cmaCache.get(cacheKey)!;
        if (now - cached.timestamp < CMA_CACHE_TTL_MS) {
          console.log("⚡ CMA cache HIT for key:", cacheKey);
          return res.json({ ...cached.payload, cached: true });
        } else {
          cmaCache.delete(cacheKey);
        }
      }

      // Add new CMA API v2.3.0 parameters for clean active data only
      // status=active ensures only active listings are returned
      // exclude_zero_price=true filters out auction properties and incomplete data
      // city=Omaha is the default when no city is specified
      // property_type=Residential filters out land and commercial properties
      // Allow client to pass either property_type or propertyType; unify to property_type
      if (
        !queryParams.has("property_type") &&
        queryParams.has("propertyType")
      ) {
        const val = queryParams.get("propertyType");
        if (val) queryParams.set("property_type", val);
      }
      if (!queryParams.has("status")) {
        queryParams.append("status", "active");
      } else {
        // Normalize status to lowercase for CMA API compatibility
        const statusValue = queryParams.get("status")?.toLowerCase();
        if (statusValue && ["active", "closed", "both"].includes(statusValue)) {
          queryParams.set("status", statusValue);
        }
      }
      if (!queryParams.has("exclude_zero_price")) {
        queryParams.append("exclude_zero_price", "true");
      }
      if (!queryParams.has("city")) {
        queryParams.append("city", "Omaha");
      }
      if (!queryParams.has("property_type")) {
        queryParams.append("property_type", "Residential");
      }
      // Support disabling forced residential filtering with residential_only=false
      const residentialOnlyParam =
        (req.query.residential_only as string) ||
        (req.query.residentialOnly as string) ||
        "true";
      const residentialOnly = ["1", "true", "yes"].includes(
        residentialOnlyParam.toLowerCase()
      );
      // Optional stricter: house_only (single family detached focus)
      const houseOnlyParam =
        (req.query.house_only as string) ||
        (req.query.houseOnly as string) ||
        "false";
      const houseOnly = ["1", "true", "yes"].includes(
        houseOnlyParam.toLowerCase()
      );

      const externalUrl = `http://gbcma.us-east-2.elasticbeanstalk.com/api/cma-comparables?${queryParams}`;
      console.log("🌐 Proxying to external CMA API:", externalUrl);

      const response = await fetch(externalUrl, {
        headers: {
          "User-Agent": "NebraskaHomeHub/1.0",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.error(
          "❌ External CMA API error:",
          response.status,
          response.statusText
        );
        throw new Error(
          `CMA API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("✅ CMA API response received, processing...");

      // Handle CMA API response format - it returns a flat array of properties
      let processedData: any = {};

      if (Array.isArray(data)) {
        // CMA API returns a flat array of properties
        console.log(`📊 CMA API returned ${data.length} properties`);

        // Split properties into active and sold based on status field
        const activeProperties = data.filter(
          (property: any) =>
            property.status === "Active" ||
            property.StandardStatus === "Active" ||
            property.isActive === true
        );

        const soldProperties = data.filter(
          (property: any) =>
            property.status === "Closed" ||
            property.StandardStatus === "Closed" ||
            property.isActive === false
        );

        // Filter out properties with zero or invalid price
        const filterValidPrice = (property: any) => {
          const price =
            property.ListPrice || property.listPrice || property.price || 0;
          return price > 0;
        };

        let activePropertiesFiltered =
          activeProperties.filter(filterValidPrice);
        let soldPropertiesFiltered = soldProperties.filter(filterValidPrice);

        // Apply residential-only filtering (server-side) to further exclude land / lots even if upstream returns them.
        if (residentialOnly || houseOnly) {
          const isResidential = (p: any) => {
            const type = (
              p.propertyType ||
              p.PropertyType ||
              p.property_type ||
              ""
            )
              .toString()
              .toLowerCase();
            const sub = (
              p.propertySubType ||
              p.PropertySubType ||
              p.SubPropertyType ||
              ""
            )
              .toString()
              .toLowerCase();
            // Exclusion first: if it clearly indicates land / lot / commercial, drop it
            const negativeTokens = [
              "land",
              "lot",
              "lots",
              "farm",
              "commercial",
              "industrial",
              "multi-family",
              "multifamily",
              "hospitality",
              "retail",
            ];
            if (
              negativeTokens.some(
                (tok) => type.includes(tok) || sub.includes(tok)
              )
            )
              return false;
            // Positive signals (broad residential)
            const positiveTokens = [
              "residential",
              "single family",
              "sfh",
              "condo",
              "townhouse",
              "town home",
              "townhome",
            ];
            if (
              positiveTokens.some(
                (tok) => type.includes(tok) || sub.includes(tok)
              )
            )
              return true;
            // If no positive signal but no negative token and original query forced property_type=Residential, keep it
            return (
              queryParams.get("property_type")?.toLowerCase() === "residential"
            );
          };
          const isHouse = (p: any) => {
            const type = (
              p.propertyType ||
              p.PropertyType ||
              p.property_type ||
              ""
            )
              .toString()
              .toLowerCase();
            const sub = (
              p.propertySubType ||
              p.PropertySubType ||
              p.SubPropertyType ||
              ""
            )
              .toString()
              .toLowerCase();
            const positiveHouse = [
              "single family",
              "detached",
              "sfh",
              "residential",
            ];
            const excludeCondoTown = [
              "condo",
              "town",
              "townhouse",
              "townhome",
              "multi",
              "duplex",
              "triplex",
              "quad",
            ];
            if (
              excludeCondoTown.some((t) => type.includes(t) || sub.includes(t))
            )
              return false;
            return positiveHouse.some(
              (t) => type.includes(t) || sub.includes(t)
            );
          };
          const beforeActive = activePropertiesFiltered.length;
          activePropertiesFiltered = activePropertiesFiltered.filter(
            (p) => isResidential(p) && (!houseOnly || isHouse(p))
          );
          const beforeSold = soldPropertiesFiltered.length;
          soldPropertiesFiltered = soldPropertiesFiltered.filter(
            (p) => isResidential(p) && (!houseOnly || isHouse(p))
          );
          console.log("🏡 Applied residential-only filter", {
            beforeActive,
            afterActive: activePropertiesFiltered.length,
            beforeSold,
            afterSold: soldPropertiesFiltered.length,
            houseOnly,
          });
        }

        processedData = {
          active: activePropertiesFiltered,
          sold: soldPropertiesFiltered,
          properties: data, // Keep original array for backward compatibility
          residentialOnlyApplied: residentialOnly,
          houseOnlyApplied: houseOnly,
        };

        console.log("✅ CMA API response processed:", {
          activeCount: activePropertiesFiltered.length,
          soldCount: soldPropertiesFiltered.length,
          total: data.length,
          filteredOut:
            activeProperties.length +
            soldProperties.length -
            activePropertiesFiltered.length -
            soldPropertiesFiltered.length,
        });
      } else {
        // Fallback for other response formats
        // Filter out properties with zero or invalid price
        const filterValidPrice = (property: any) => {
          const price =
            property.ListPrice || property.listPrice || property.price || 0;
          return price > 0;
        };

        if (data.active) {
          data.active = data.active.filter(filterValidPrice);
        }
        if (data.sold) {
          data.sold = data.sold.filter(filterValidPrice);
        }

        processedData = data;
        console.log("✅ CMA API response (existing format):", {
          activeCount: data.active?.length || 0,
          soldCount: data.sold?.length || 0,
          total: (data.active?.length || 0) + (data.sold?.length || 0),
        });
      }

      // Fallback: if subdivision + multiple zip_code params produced zero results, retry without subdivision filter
      const hadSubdivision = queryParams.has("subdivision");
      const zipParamsCount = queryParams.getAll("zip_code").length;
      if (
        hadSubdivision &&
        zipParamsCount > 1 &&
        (!processedData.active || processedData.active.length === 0) &&
        (!processedData.sold || processedData.sold.length === 0)
      ) {
        console.warn(
          "🔁 Empty result for subdivision with multi-zip; retrying without subdivision filter to broaden results."
        );
        const retryParams = new URLSearchParams(
          Array.from(queryParams.entries()).filter(
            ([k]) => !["subdivision", "$filter"].includes(k)
          )
        );
        const retryUrl = `http://gbcma.us-east-2.elasticbeanstalk.com/api/cma-comparables?${retryParams}`;
        try {
          const retryResp = await fetch(retryUrl, {
            headers: {
              "User-Agent": "NebraskaHomeHub/1.0",
              Accept: "application/json",
            },
          });
          if (retryResp.ok) {
            const retryData = await retryResp.json();
            console.log("✅ Retry without subdivision returned counts:", {
              active: retryData.active?.length || 0,
              sold: retryData.sold?.length || 0,
              url: retryUrl,
            });
            // Use retry data but keep meta note
            if (
              (retryData.active?.length || 0) + (retryData.sold?.length || 0) >
              0
            ) {
              processedData.active = retryData.active;
              processedData.sold = retryData.sold;
              processedData.retryWithoutSubdivision = true;
            }
          }
        } catch (retryErr) {
          console.warn("⚠️ Retry without subdivision failed:", retryErr);
        }
      }

      // Meta enrichment only; do NOT remove records here (let upstream filtering + client handle)
      const subdivisionApplied = queryParams.get("subdivision") || null;
      const activeArr: any[] = Array.isArray(processedData.active)
        ? processedData.active
        : [];
      const soldArr: any[] = Array.isArray(processedData.sold)
        ? processedData.sold
        : [];
      const metaDebug = {
        subdivisionApplied,
        activeOriginal: activeArr.length,
        soldOriginal: soldArr.length,
        activeFinal: activeArr.length,
        soldFinal: soldArr.length,
        removedActive: 0,
        removedSold: 0,
        cacheKey,
        cached: false,
        note: "Post-filter disabled to prevent empty UI.",
      };

      // Optional MLS details enrichment (expensive: 1 extra fetch per property)
      const includeMlsDetails = ["1", "true", "yes"].includes(
        ((req.query.includeMlsDetails as string) || "").toLowerCase()
      );

      if (!includeMlsDetails) {
        const addMlsId = (arr: any[]) =>
          Array.isArray(arr)
            ? arr.map((p) => ({
                ...p,
                mlsId:
                  p.mlsId ||
                  p.listingKey ||
                  p.ListingId ||
                  p.id ||
                  p.listingId ||
                  null,
              }))
            : arr;
        const activeWithIds = addMlsId(activeArr);
        const soldWithIds = addMlsId(soldArr);
        const payload = {
          ...processedData,
          active: activeWithIds,
          sold: soldWithIds,
          mlsDetailsIncluded: false,
          meta: metaDebug,
        };
        // Cache result
        cmaCache.set(cacheKey, { timestamp: now, payload });
        return res.json(payload);
      }

      const activeProps: any[] = Array.isArray(activeArr) ? activeArr : [];
      // Limit to first 15 to cap latency unless override requested
      const limitParam = parseInt(
        (req.query.detailsLimit as string) || "15",
        10
      );
      const detailSlice = activeProps.slice(0, Math.max(1, limitParam));

      const detailResults: Record<string, any> = {};
      await Promise.all(
        detailSlice.map(async (p) => {
          const addr = p?.address || p?.fullAddress || p?.displayAddress;
          if (!addr) return;
          try {
            const dResp = await fetch(
              "http://gbcma.us-east-2.elasticbeanstalk.com/api/property-details-from-address",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address: addr }),
                // Basic 6s timeout race
                signal: AbortSignal.timeout?.(6000),
              } as any
            );
            if (dResp.ok) {
              const det = await dResp.json();
              detailResults[addr] = {
                listingKey: det.listingKey || det.mlsId || det.ListingId,
                status: det.standardStatus || det.status,
                listPrice: det.listPrice || det.price,
                beds: det.beds || det.Beds,
                baths: det.baths || det.Baths || det.bathrooms,
                sqft:
                  det.totalArea ||
                  det.TotalArea ||
                  det.buildingAreaTotal ||
                  det.BuildingAreaTotal ||
                  det.livingArea ||
                  det.LivingArea,
                yearBuilt: det.yearBuilt || det.YearBuilt,
                photoCount:
                  (Array.isArray(det.Media) && det.Media.length) ||
                  (Array.isArray(det.photos) && det.photos.length) ||
                  (Array.isArray(det.PhotoUrls) && det.PhotoUrls.length) ||
                  0,
              };
            }
          } catch (e) {
            console.warn("⚠️ MLS detail fetch failed for", addr, e);
          }
        })
      );

      res.json({
        ...processedData,
        mlsDetailsIncluded: true,
        mlsDetailsCount: Object.keys(detailResults).length,
        mlsDetails: detailResults,
      });
    } catch (error) {
      console.error("❌ CMA Comparables proxy error:", error);

      // Return mock data as fallback
      const mockResponse = {
        active: [],
        sold: [],
        error: "CMA API temporarily unavailable",
      };

      res.status(502).json(mockResponse);
    }
  });

  // Advanced Search Proxy - supports sortBy values and normalizes params
  app.get("/api/advanced-search", async (req, res) => {
    try {
      console.log("🔎 Advanced search request with params:", req.query);

      // Extract and normalize params
      const {
        city = "",
        state = "NE",
        status = "Active",
        limit = "50",
        offset = "0",
        sortBy: sortByRaw,
        sort_by: legacySortBy,
      } = req.query as Record<string, any>;

      // Map UI values to valid advanced search sort options
      const sortMap: Record<string, string> = {
        newest: "newest",
        price_low: "price_low",
        price_high: "price_high",
        sqft_low: "sqft_low",
        sqft_high: "sqft_high",
        dom_low: "dom_low",
        dom_high: "dom_high",
      };

      let sortBy = (sortByRaw || legacySortBy || "newest").toString();
      if (!sortMap[sortBy]) {
        console.warn(
          "⚠️ Invalid sortBy provided, defaulting to 'newest':",
          sortBy
        );
        sortBy = "newest";
      }

      const ext = new URL(
        "http://gbcma.us-east-2.elasticbeanstalk.com/api/advanced-search"
      );
      const params = new URLSearchParams();

      // Basic
      if (city) params.append("city", city.toString());
      params.append("state", state.toString());
      params.append("status", status.toString());
      params.append("limit", limit.toString());
      if (offset && offset !== "0") params.append("offset", offset.toString());

      // Convert known min/max keys from our client format to upstream format
      const q = req.query as Record<string, any>;
      const mapping: Record<string, string> = {
        price_min: "min_price",
        price_max: "max_price",
        beds_min: "min_beds",
        beds_max: "max_beds",
        baths_min: "min_baths",
        baths_max: "max_baths",
        sqft_min: "min_sqft",
        sqft_max: "max_sqft",
        garage_min: "garage",
        mls_id: "mls_id",
        search: "search",
      };

      for (const [key, val] of Object.entries(q)) {
        if (val === undefined || val === null || val === "") continue;
        if (key in mapping) {
          params.append(mapping[key], val.toString());
        }
      }

      // Property type
      if (q.property_type && q.property_type !== "any") {
        params.append("property_type", q.property_type.toString());
      }

      // Feature booleans
      ["pool", "fireplace", "basement", "waterfront", "deck", "patio"].forEach(
        (flag) => {
          const v = q[flag];
          if (v === true || v === "true") params.append(flag, "true");
        }
      );

      // Sorting: external expects sortBy with specific values (camelCase key)
      params.append("sortBy", sortBy);

      const finalUrl = `${ext.toString()}?${params.toString()}`;
      console.log("🌐 Advanced search CMA API URL:", finalUrl);

      const response = await fetch(finalUrl, {
        headers: {
          "User-Agent": "NebraskaHomeHub/1.0",
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(
          `CMA API error: ${response.status} ${response.statusText}`
        );
      }
      const cmaData = await response.json();
      const properties = cmaData.properties || [];
      console.log(`✅ Advanced search found ${properties.length} properties`);

      // Light transformation to match frontend expectations
      const enhanced = properties.map((p: any) => ({
        id: p.id || Math.random().toString(),
        mlsId: p.id,
        listingKey: p.listingKey || null,
        title: `${p.beds || "?"} Bed ${p.baths || 1} Bath in ${
          p.city || "Omaha"
        }`,
        description:
          p.description ||
          `${p.propertyType || "Property"} in ${p.subdivision || p.city}`,
        price: p.listPrice || p.soldPrice || 0,
        address: p.address || "Address not available",
        city: p.city || "Omaha",
        state: p.state || "NE",
        zipCode: p.zipCode || "",
        beds: p.beds || 0,
        baths: p.baths ? parseFloat(p.baths.toString()) : 1,
        sqft: p.sqft || 0,
        yearBuilt: p.yearBuilt,
        propertyType: p.propertyType || p.property_type || "Single Family",
        status: p.status || "active",
        standardStatus: p.standardStatus || p.status,
        featured: (p.listPrice || p.soldPrice || 0) > 500000,
        luxury: (p.listPrice || p.soldPrice || 0) > 800000,
        images: p.photoUrl
          ? [p.photoUrl]
          : p.photos?.length > 0
          ? p.photos
          : [
              "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            ],
        neighborhood: p.neighborhood || p.subdivision,
        schoolDistrict: p.schoolDistrict || p.school_district,
        style: p.style,
        coordinates: {
          lat: p.latitude || 41.2565,
          lng: p.longitude || -95.9345,
        },
        features: [
          ...(p.pool || p.features?.pool ? ["pool"] : []),
          ...(p.fireplace || p.features?.fireplace ? ["fireplace"] : []),
          ...(p.basement || p.features?.basement ? ["basement"] : []),
          ...(p.waterfront || p.features?.waterfront ? ["waterfront"] : []),
          ...(p.deck || p.features?.deck ? ["deck"] : []),
          ...(p.patio || p.features?.patio ? ["patio"] : []),
          ...((p.garage || 0) > 0 ? ["garage"] : []),
        ],
        photoCount: p.photoCount || p.photos?.length || 1,
        virtualTourUrl: p.virtualTourUrl,
        isIdxListing: true,
        idxSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      res.json({ success: true, count: enhanced.length, properties: enhanced });
    } catch (error) {
      console.error("❌ Advanced search error:", error);
      res.status(404).json({ success: false, error: (error as Error).message });
    }
  });

  // Newsletter Subscription Endpoints
  app.post("/api/subscribe", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { users, subscriptions } = await import("@shared/schema");
      const { eq, and, isNull } = await import("drizzle-orm");

      const { email, agentSlug, source = "newsletter" } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Find agent by slug if provided
      let agentId = null;
      if (agentSlug) {
        const agent = await db
          .select()
          .from(users)
          .where(eq(users.customSlug, agentSlug))
          .limit(1);
        if (agent.length > 0) {
          agentId = agent[0].id;
        }
      }

      // Check if already subscribed
      const existingSubscription = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.email, email),
            agentId
              ? eq(subscriptions.agentId, agentId)
              : isNull(subscriptions.agentId)
          )
        )
        .limit(1);

      if (existingSubscription.length > 0) {
        if (existingSubscription[0].status === "active") {
          return res.status(200).json({
            message: "Already subscribed",
            subscription: existingSubscription[0],
          });
        } else {
          // Reactivate subscription
          await db
            .update(subscriptions)
            .set({
              status: "active",
              subscribedAt: new Date(),
              unsubscribedAt: null,
            })
            .where(eq(subscriptions.id, existingSubscription[0].id));

          return res.status(200).json({ message: "Subscription reactivated" });
        }
      }

      // Create new subscription
      const newSubscription = await db
        .insert(subscriptions)
        .values({
          email,
          agentId,
          source,
          status: "active",
        })
        .returning();

      // Send welcome email (non-blocking)
      try {
        const { emailService } = await import("./email-service");
        if (emailService.isConfigured()) {
          await emailService.sendNewsletterWelcomeEmail(
            email,
            (req as any).template
          );
          console.log(`📧 Newsletter welcome email sent to ${email}`);
        }
      } catch (emailError) {
        console.error("Failed to send newsletter welcome email:", emailError);
        // Don't fail subscription if email fails
      }

      res.status(201).json({
        message: "Successfully subscribed",
        subscription: newSubscription[0],
      });
    } catch (error) {
      console.error("Subscription error:", error);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  // Get subscriptions for an agent (authenticated)
  app.get("/api/subscriptions", authenticateUser, async (req: any, res) => {
    try {
      const { db } = await import("./db");
      const { subscriptions } = await import("@shared/schema");
      const { eq, desc, or, isNull } = await import("drizzle-orm");

      const agentId = req.user.id;

      // Get only agent-specific subscriptions
      const subscriptionsData = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.agentId, agentId))
        .orderBy(desc(subscriptions.subscribedAt));

      res.json({ subscriptions: subscriptionsData });
    } catch (error) {
      console.error("Get subscriptions error:", error);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  // Unsubscribe endpoint (public)
  app.post("/api/unsubscribe", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { subscriptions } = await import("@shared/schema");
      const { eq, and, isNull } = await import("drizzle-orm");

      const { email, agentId } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const whereCondition = agentId
        ? and(
            eq(subscriptions.email, email),
            eq(subscriptions.agentId, agentId)
          )
        : and(eq(subscriptions.email, email), isNull(subscriptions.agentId));

      await db
        .update(subscriptions)
        .set({
          status: "unsubscribed",
          unsubscribedAt: new Date(),
        })
        .where(whereCondition);

      res.json({ message: "Successfully unsubscribed" });
    } catch (error) {
      console.error("Unsubscribe error:", error);
      res.status(500).json({ error: "Failed to unsubscribe" });
    }
  });

  // ===== LEGACY TEAM MANAGEMENT APIs REMOVED =====
  // Duplicate team endpoints have been removed in favor of unified implementation in team-routes.ts.
  // This block intentionally left blank to prevent accidental re-introduction.

  // Agent suggestions for team building (proxy to CMA API)
  app.get("/api/agents/suggestions", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      const limit = parseInt(req.query.limit as string) || 10;

      // Use existing CMA API
      const cmaResponse = await fetch(
        `http://gbcma.us-east-2.elasticbeanstalk.com/api/agents/suggestions?q=${encodeURIComponent(
          query
        )}&limit=${limit}`
      );

      if (!cmaResponse.ok) {
        throw new Error("CMA API error");
      }

      const data = await cmaResponse.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching agent suggestions:", error);
      res.status(500).json({ error: "Failed to fetch agent suggestions" });
    }
  });

  // Health check for API
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // AI Chat endpoint (mirrors main behavior, auth optional here for local UX)
  app.post("/api/ai-chat", async (req: any, res: any) => {
    try {
      const { message, context } = req.body || {};

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({
          success: false,
          error: "A valid message is required for AI chat",
        });
      }

      const enhancedPrompt = `You are an expert real estate AI assistant for "My Golden Brick Real Estate" in Nebraska.
User Question: "${message.trim()}"
Context: ${context ? JSON.stringify(context) : "General inquiry"}

Provide a helpful, professional response that:
1. Directly answers their question
2. Offers relevant real estate advice
3. Suggests next steps they can take
4. Maintains a friendly, knowledgeable tone
5. Includes specific Nebraska/Omaha market insights when relevant
6. Keeps responses concise but informative (2-4 paragraphs max)

If the question is about:
- Property details: Provide analysis and suggest tours/contact
- Market trends: Share current Nebraska market insights
- Navigation: Help them find what they need on the website
- Services: Explain My Golden Brick's offerings
- General real estate: Provide educational, actionable advice

Always end with a helpful suggestion or call-to-action.`;

      const aiResponse = await openaiChat(enhancedPrompt);
      const suggestions = generateContextualSuggestions(
        context?.currentPage ? { page: context.currentPage } : context
      );

      return res.json({ success: true, response: aiResponse, suggestions });
    } catch (error) {
      console.error("Error in AI chat endpoint:", error);
      res.status(500).json({
        success: false,
        error:
          "AI chat service temporarily unavailable. Please try again or contact our team directly.",
      });
    }
  });

  // Fix S3 permissions for existing images (admin endpoint)
  app.post(
    "/api/admin/fix-s3-permissions",
    authenticateUser,
    async (req, res) => {
      try {
        const { fixExistingImagePermissions } = await import(
          "./fix-s3-permissions"
        );
        await fixExistingImagePermissions();
        res.json({ message: "S3 permissions fixed successfully" });
      } catch (error) {
        console.error("Error fixing S3 permissions:", error);
        res.status(500).json({
          message: "Failed to fix S3 permissions",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Logo generation endpoint using Gemini API
  app.post(
    "/api/generate-logo",
    authenticateUser,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { prompt } = req.body;

        if (
          !prompt ||
          typeof prompt !== "string" ||
          prompt.trim().length === 0
        ) {
          return res.status(400).json({
            success: false,
            error: "A valid prompt is required for logo generation",
          });
        }

        console.log(
          `🎨 Logo generation request from user ${req.user!.id}:`,
          prompt
        );

        const { geminiGenerateImage } = await import("./gemini");
        const result = await geminiGenerateImage(prompt.trim());

        if (result.success) {
          console.log(`✅ Logo generated successfully:`, result.imageUrl);
          res.json({
            success: true,
            imageUrl: result.imageUrl,
          });
        } else {
          console.log(`❌ Logo generation failed:`, result.error);
          res.status(500).json({
            success: false,
            error: result.error || "Logo generation failed",
          });
        }
      } catch (error) {
        console.error("Error in logo generation endpoint:", error);
        res.status(500).json({
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    }
  );

  // Image proxy endpoint for DALL-E images to handle CORS
  app.get("/api/proxy-image", async (req, res) => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "Image URL is required" });
      }

      // Only allow proxying DALL-E Azure blob URLs for security
      if (!url.includes("oaidalleapiprodscus.blob.core.windows.net")) {
        return res.status(403).json({ error: "Unauthorized image source" });
      }

      console.log("🖼️ Proxying image:", url);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      // Get the image as a buffer
      const imageBuffer = await response.arrayBuffer();

      // Set appropriate headers
      res.set({
        "Content-Type": response.headers.get("content-type") || "image/png",
        "Content-Length": imageBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "Access-Control-Allow-Origin": "*",
      });

      // Send the image
      res.send(Buffer.from(imageBuffer));
    } catch (error) {
      console.error("Error proxying image:", error);
      res.status(500).json({
        error: "Failed to load image",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Neighborhood Explorer API endpoints
  app.get("/api/neighborhood", async (req, res) => {
    try {
      const { lat, lng, address, city, state, zip } = req.query;

      if (!lat || !lng) {
        return res
          .status(400)
          .json({ error: "Latitude and longitude are required" });
      }

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);

      // For now, return mock data
      // In production, this would call external APIs for real data
      const neighborhoodData = {
        demographics: {
          population: 45000,
          medianIncome: 75000,
          medianAge: 35.5,
          householdSize: 2.8,
          employmentRate: 94.5,
          medianHomeValue: 425000,
          crimeRate: 15.2,
          walkScore: 72,
          transitScore: 45,
          bikeScore: 68,
        },
        schools: [
          {
            name: "Lincoln Elementary School",
            type: "Elementary",
            rating: 8,
            distance: 0.5,
            gradeRange: "K-5",
            enrollment: 450,
            studentTeacherRatio: 18,
            latitude: latitude + 0.005,
            longitude: longitude + 0.003,
          },
          {
            name: "Washington Middle School",
            type: "Middle",
            rating: 7,
            distance: 1.2,
            gradeRange: "6-8",
            enrollment: 650,
            studentTeacherRatio: 20,
            latitude: latitude - 0.008,
            longitude: longitude + 0.006,
          },
          {
            name: "Roosevelt High School",
            type: "High",
            rating: 9,
            distance: 2.1,
            gradeRange: "9-12",
            enrollment: 1200,
            studentTeacherRatio: 22,
            latitude: latitude + 0.012,
            longitude: longitude - 0.009,
          },
        ],
        amenities: [
          {
            name: "Whole Foods Market",
            category: "shopping",
            distance: 0.8,
            rating: 4.5,
            latitude: latitude + 0.007,
            longitude: longitude - 0.004,
          },
          {
            name: "Target",
            category: "shopping",
            distance: 1.2,
            rating: 4.2,
            latitude: latitude - 0.009,
            longitude: longitude + 0.008,
          },
          {
            name: "Central Park",
            category: "park",
            distance: 0.3,
            rating: 4.8,
            latitude: latitude + 0.003,
            longitude: longitude + 0.002,
          },
          {
            name: "Memorial Park",
            category: "park",
            distance: 1.5,
            rating: 4.6,
            latitude: latitude - 0.011,
            longitude: longitude - 0.007,
          },
          {
            name: "City Medical Center",
            category: "hospital",
            distance: 1.5,
            rating: 4.2,
            latitude: latitude + 0.01,
            longitude: longitude + 0.005,
          },
          {
            name: "The Coffee House",
            category: "restaurant",
            distance: 0.2,
            rating: 4.7,
            priceLevel: 2,
            latitude: latitude - 0.002,
            longitude: longitude + 0.001,
          },
          {
            name: "Italian Bistro",
            category: "restaurant",
            distance: 0.5,
            rating: 4.5,
            priceLevel: 3,
            latitude: latitude + 0.004,
            longitude: longitude - 0.003,
          },
          {
            name: "Sushi Bar",
            category: "restaurant",
            distance: 0.7,
            rating: 4.6,
            priceLevel: 3,
            latitude: latitude - 0.005,
            longitude: longitude + 0.004,
          },
          {
            name: "Metro Station North",
            category: "transit",
            distance: 0.4,
            latitude: latitude + 0.003,
            longitude: longitude,
          },
          {
            name: "Bus Stop Central",
            category: "transit",
            distance: 0.1,
            latitude: latitude,
            longitude: longitude + 0.001,
          },
        ],
        scores: {
          neighborhoodScore: 85,
          livabilityScore: 82,
          safetyScore: 88,
        },
      };

      res.json(neighborhoodData);
    } catch (error) {
      console.error("Error fetching neighborhood data:", error);
      res.status(500).json({ error: "Failed to fetch neighborhood data" });
    }
  });

  // Google Places API proxy for amenities
  app.get("/api/places/nearby", async (req, res) => {
    try {
      const { lat, lng, type, radius = "1500" } = req.query;

      if (!lat || !lng) {
        return res
          .status(400)
          .json({ error: "Latitude and longitude are required" });
      }

      const googleApiKey =
        process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

      if (!googleApiKey) {
        console.warn("Google Maps API key not found, returning mock data");
        return res.json({ results: [], status: "NO_API_KEY" });
      }

      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${
        type || "restaurant"
      }&key=${googleApiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      res.json(data);
    } catch (error) {
      console.error("Error fetching places:", error);
      res.status(500).json({ error: "Failed to fetch places data" });
    }
  });

  // ====== SAVED SEARCHES & PROPERTY ALERTS ENDPOINTS ======
  // Middleware to get public user from session
  async function getPublicUser(req: Request) {
    const token = req.cookies?.publicUserToken;
    if (!token) return null;

    const { publicUserSessions, publicUsers } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    const [session] = await db
      .select({
        userId: publicUserSessions.publicUserId,
        expiresAt: publicUserSessions.expiresAt,
      })
      .from(publicUserSessions)
      .where(eq(publicUserSessions.token, token))
      .limit(1);

    if (!session || new Date(session.expiresAt) < new Date()) {
      return null;
    }

    const [user] = await db
      .select()
      .from(publicUsers)
      .where(eq(publicUsers.id, session.userId))
      .limit(1);

    return user || null;
  }

  // Save a new search with alert preferences
  app.post("/api/saved/search", async (req, res) => {
    try {
      const user = await getPublicUser(req);
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { publicSavedSearches } = await import("@shared/schema");
      const {
        title,
        searchParams,
        searchUrl,
        alertsEnabled = true,
        alertFrequency = "daily",
      } = req.body;

      if (!title || !searchParams || !searchUrl) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Extract agent slug from the URL or use default
      const agentSlugMatch = searchUrl.match(/\/agent\/([^\/]+)\//);
      const agentSlug = agentSlugMatch ? agentSlugMatch[1] : user.agentSlug;

      const [savedSearch] = await db
        .insert(publicSavedSearches)
        .values({
          publicUserId: user.id,
          name: title,
          searchCriteria: searchParams,
          searchUrl,
          agentSlug,
          alertsEnabled,
          alertFrequency,
        })
        .returning();

      res.json({ success: true, savedSearch });
    } catch (error) {
      console.error("Error saving search:", error);
      res.status(500).json({ error: "Failed to save search" });
    }
  });

  // Get all saved searches for the current user
  app.get("/api/saved/searches", async (req, res) => {
    try {
      const user = await getPublicUser(req);
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { publicSavedSearches } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const searches = await db
        .select()
        .from(publicSavedSearches)
        .where(eq(publicSavedSearches.publicUserId, user.id))
        .orderBy(publicSavedSearches.createdAt);

      res.json({
        savedSearches: searches.map((s: any) => ({
          id: s.id,
          title: s.name,
          searchUrl: s.searchUrl, // Use stored URL with query params
          searchParams: s.searchCriteria,
          alertsEnabled: s.alertsEnabled,
          alertFrequency: s.alertFrequency,
          lastAlertSent: s.lastAlertSent,
          createdAt: s.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ error: "Failed to fetch saved searches" });
    }
  });

  // Update a saved search (alert settings)
  app.put("/api/saved/search/:id", async (req, res) => {
    try {
      const user = await getPublicUser(req);
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { publicSavedSearches } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const searchId = parseInt(req.params.id);
      const { alertsEnabled, alertFrequency, name } = req.body;

      const updateData: any = {};
      if (alertsEnabled !== undefined) updateData.alertsEnabled = alertsEnabled;
      if (alertFrequency) updateData.alertFrequency = alertFrequency;
      if (name) updateData.name = name;

      const [updatedSearch] = await db
        .update(publicSavedSearches)
        .set(updateData)
        .where(
          and(
            eq(publicSavedSearches.id, searchId),
            eq(publicSavedSearches.publicUserId, user.id)
          )
        )
        .returning();

      if (!updatedSearch) {
        return res.status(404).json({ error: "Search not found" });
      }

      res.json({ success: true, savedSearch: updatedSearch });
    } catch (error) {
      console.error("Error updating saved search:", error);
      res.status(500).json({ error: "Failed to update search" });
    }
  });

  // Delete a saved search
  app.delete("/api/saved/search/:id", async (req, res) => {
    try {
      const user = await getPublicUser(req);
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { publicSavedSearches } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const searchId = parseInt(req.params.id);

      const [deleted] = await db
        .delete(publicSavedSearches)
        .where(
          and(
            eq(publicSavedSearches.id, searchId),
            eq(publicSavedSearches.publicUserId, user.id)
          )
        )
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Search not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved search:", error);
      res.status(500).json({ error: "Failed to delete search" });
    }
  });

  // Contact Form Endpoint - Send to your email
  app.post("/api/contact", async (req, res) => {
    try {
      // Import what we need
      const { contactFormSchema } = await import("@shared/schema");
      const { emailService } = await import("./email-service");

      console.log("📝 Raw contact form data received:", req.body);

      // Try private listings schema first (more lenient), fall back to contact schema
      let contactData;
      const { privateListingsSchema } = await import("@shared/schema");

      try {
        // Try the more lenient private listings schema first
        const privateData = privateListingsSchema.parse(req.body);
        // Convert to contact data format
        contactData = {
          ...privateData,
          lastName: privateData.lastName || "", // Fill empty lastName
          phone: privateData.phone || "", // Fill empty phone
          message: privateData.message || req.body.message || "Contact inquiry",
        };
      } catch (privateError) {
        // Fall back to strict contact schema validation
        contactData = contactFormSchema.parse(req.body);
      }

      console.log("📝 Contact form submission validated:", {
        name: `${contactData.firstName} ${contactData.lastName}`,
        email: contactData.email,
        interest: contactData.interest,
        referrer: req.get("Referer"),
      });

      // Determine which agent this lead belongs to based on referrer URL
      let agentId: number | undefined;
      let agentSlug: string | undefined;

      const referrer = req.get("Referer") || "";
      const agentMatch = referrer.match(/\/agent\/([^\/]+)/);

      if (agentMatch) {
        agentSlug = agentMatch[1];
        // Find the agent by slug to get their ID
        try {
          const agentUser = await storage.getUserByUsername(
            agentSlug.split("-")[0]
          ); // Assuming slug format is username-something
          if (agentUser) {
            agentId = agentUser.id;
            console.log(
              `🎯 Lead assigned to agent: ${agentUser.username} (ID: ${agentId})`
            );
          }
        } catch (error) {
          console.log(
            "ℹ️ Could not determine specific agent, lead will be unassigned"
          );
        }
      }

      // Create lead record in database with all enhanced fields
      const lead = await storage.createLead({
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        email: contactData.email,
        phone: contactData.phone,
        propertyAddress: contactData.propertyAddress,
        interest: contactData.interest,
        message: contactData.message,
        source: "website_contact_form",

        // Agent association
        agentId,
        agentSlug,

        // Enhanced lead capture fields
        companyName: (contactData as any).companyName,
        budgetRange: (contactData as any).budgetRange,
        preferredContactTime: (contactData as any).preferredContactTime,
        leadSourceDetails: (contactData as any).leadSourceDetails,
        leadStatus: "new", // Always set new leads as 'new'
        propertyTypePreference: (contactData as any).propertyTypePreference,
        preferredLocation: (contactData as any).preferredLocation,
      });

      console.log(`✅ Lead ${lead.id} created successfully`);

      // Send email notifications if configured
      if (emailService.isConfigured()) {
        try {
          // Send notification to YOU (the business owner) at mygoldenbrick1@gmail.com
          const ownerResult = await emailService.sendLeadNotification(
            lead,
            "mygoldenbrick1@gmail.com"
          );
          console.log("📧 Lead notification sent to mygoldenbrick1@gmail.com");

          // Send confirmation to the customer
          const confirmResult = await emailService.sendLeadConfirmation(
            lead,
            (req as any).template
          );
          console.log(`📧 Confirmation email sent to ${lead.email}`);

          // Persist outbound email logs when possible
          try {
            const { leadMessages } = await import("@shared/schema");
            const { db } = await import("./db");
            if (db) {
              if (ownerResult?.success && ownerResult.messageId) {
                await db.insert(leadMessages).values({
                  leadId: lead.id as any,
                  direction: "outbound",
                  subject: `New Lead: ${lead.firstName} ${lead.lastName}`,
                  toEmail: "mygoldenbrick1@gmail.com",
                  fromEmail: process.env.EMAIL_USER || null,
                  provider: "smtp",
                  messageId: ownerResult.messageId,
                });
              }
              if (confirmResult?.success && confirmResult.messageId) {
                await db.insert(leadMessages).values({
                  leadId: lead.id as any,
                  direction: "outbound",
                  subject: `Thank you for your interest - BjorkHomes.com`,
                  toEmail: lead.email,
                  fromEmail: process.env.EMAIL_USER || null,
                  provider: "smtp",
                  messageId: confirmResult.messageId,
                });
              }
            }
          } catch (logErr) {
            console.warn("Email log insert failed:", (logErr as any)?.message);
          }
        } catch (emailError) {
          console.error("❌ Failed to send email notifications:", emailError);
          // Don't fail the request if email fails
        }
      } else {
        console.log("📧 Email service not configured - skipping notifications");
      }

      res.status(201).json({
        success: true,
        message:
          "Contact form submitted successfully! We'll get back to you within 24 hours.",
        leadId: lead.id,
      });
    } catch (error) {
      console.error("❌ Contact form error:", error);

      if ((error as any).name === "ZodError") {
        return res.status(400).json({
          success: false,
          message: "Invalid form data",
          errors: (error as any).errors,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to process contact form. Please try again.",
      });
    }
  });

  // Personalized Search Preferences Endpoint
  app.post("/api/personalized-search", async (req, res) => {
    try {
      console.log("🔍 Personalized search preferences received:", req.body);

      const { firstName, lastName, email, phone, preferences } = req.body;

      // Validate required fields
      if (!firstName || !email || !preferences) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: firstName, email, and preferences are required",
        });
      }

      const { personalizedSearchPreferences, users, publicUsers } =
        await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");

      console.log(`🔍 [PERSONALIZED SEARCH POST] Looking up user: ${email}`);

      // Try to find user in users table first (authenticated agents)
      let user = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      let userId: number;

      if (user.length === 0) {
        console.log(
          `📋 [PERSONALIZED SEARCH POST] User not found in 'users' table, checking 'public_users'...`
        );

        // User not in users table, check public_users
        const publicUser = await db
          .select()
          .from(publicUsers)
          .where(eq(publicUsers.email, email))
          .limit(1);

        if (publicUser.length > 0) {
          console.log(
            `📋 [PERSONALIZED SEARCH POST] Found in 'public_users' (ID: ${publicUser[0].id}), creating 'users' entry...`
          );

          // Public user exists, create corresponding users entry for preferences
          const newUser = await db
            .insert(users)
            .values({
              username: email.split("@")[0] + "_" + Date.now(),
              email: email,
              password: "", // No password for public users converted to users
              firstName: firstName,
              lastName: lastName || "",
              phoneNumber: phone || "",
              isActive: true,
            })
            .returning();
          userId = newUser[0].id;
          console.log(
            `✅ [PERSONALIZED SEARCH POST] Created users entry for public user, ID: ${userId}`
          );
        } else {
          console.log(
            `📋 [PERSONALIZED SEARCH POST] New user - creating entries in both 'public_users' and 'users'...`
          );

          // Neither users nor public_users, create both
          const newPublicUser = await db
            .insert(publicUsers)
            .values({
              email,
              password: "", // No password needed for public users
              firstName,
              lastName: lastName || "",
              phone: phone || "",
              agentSlug: "site",
            })
            .returning();

          const newUser = await db
            .insert(users)
            .values({
              username: email.split("@")[0] + "_" + Date.now(),
              email: email,
              password: "",
              firstName: firstName,
              lastName: lastName || "",
              phoneNumber: phone || "",
              isActive: true,
            })
            .returning();
          userId = newUser[0].id;
          console.log(
            `✅ [PERSONALIZED SEARCH POST] Created new public user (ID: ${newPublicUser[0].id}) and users entry (ID: ${userId})`
          );
        }
      } else {
        userId = user[0].id;
        console.log(
          `✅ [PERSONALIZED SEARCH POST] Existing authenticated user found (ID: ${userId})`
        );
      }

      // Also create a lead for tracking
      console.log(
        `📝 [PERSONALIZED SEARCH POST] Creating lead for tracking...`
      );
      await storage.createLead({
        firstName,
        lastName: lastName || "",
        email,
        phone: phone || "",
        propertyAddress: "",
        interest: "buying",
        message: "Personalized home search preferences submission",
        source: "personalized_search_form",
        leadStatus: "new",
      });

      // Create personalized search preferences record
      console.log(
        `💾 [PERSONALIZED SEARCH POST] Saving preferences for user ${userId}...`
      );
      console.log(`📊 [PERSONALIZED SEARCH POST] Preferences data:`, {
        userId,
        minBeds: preferences.minBeds,
        maxBeds: preferences.maxBeds,
        minBaths: preferences.minBaths,
        garageSpaces: preferences.garageSpaces,
        propertyTypes: preferences.propertyTypes,
        minPrice: preferences.minPrice,
        maxPrice: preferences.maxPrice,
        minSqft: preferences.minSqft,
        maxSqft: preferences.maxSqft,
        preferredCities: preferences.preferredCities,
        preferredNeighborhoods: preferences.preferredNeighborhoods,
        emailFrequency: preferences.emailFrequency,
        alertsEnabled: preferences.alertsEnabled,
      });

      const searchPreferences = await db
        .insert(personalizedSearchPreferences)
        .values({
          userId: userId,
          minBeds: preferences.minBeds,
          maxBeds: preferences.maxBeds,
          minBaths: preferences.minBaths,
          maxBaths: preferences.maxBaths,
          propertyTypes: preferences.propertyTypes,
          minPrice: preferences.minPrice,
          maxPrice: preferences.maxPrice,
          minSqft: preferences.minSqft,
          maxSqft: preferences.maxSqft,
          garageSpaces: preferences.garageSpaces,
          preferredNeighborhoods: preferences.preferredNeighborhoods,
          preferredCities: preferences.preferredCities,
          emailFrequency: preferences.emailFrequency || "weekly",
          alertsEnabled: preferences.alertsEnabled !== false,
          lastAlertSent: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      console.log(
        `✅ [PERSONALIZED SEARCH POST] Preferences saved successfully! Preference ID: ${searchPreferences[0]?.id}`
      );

      // Send email notifications if configured
      const { emailService } = await import("./email-service");
      if (emailService.isConfigured()) {
        try {
          // Create a lead object for email notifications
          const leadForEmail = {
            id: userId,
            firstName,
            lastName: lastName || "",
            email,
            phone: phone || "",
          };

          // Send notification to business owner
          await emailService.sendLeadNotification(
            leadForEmail,
            "mygoldenbrick1@gmail.com"
          );
          console.log(
            "📧 Personalized search lead notification sent to mygoldenbrick1@gmail.com"
          );

          // Send confirmation to the customer with their preferences
          const confirmResult =
            await emailService.sendPersonalizedSearchConfirmation(
              leadForEmail,
              preferences,
              (req as any).template
            );
          console.log(`📧 Personalized search confirmation sent to ${email}`);
        } catch (emailError) {
          console.error(
            "❌ Failed to send personalized search email notifications:",
            emailError
          );
          // Don't fail the request if email fails
        }
      }

      res.status(201).json({
        success: true,
        message:
          "Your personalized home search preferences have been saved! You'll start receiving matching properties soon.",
        userId: userId,
        preferencesId: searchPreferences[0]?.id,
        emailFrequency: preferences.emailFrequency || "weekly",
      });
    } catch (error) {
      console.error("❌ Personalized search preferences error:", error);

      if ((error as any).name === "ZodError") {
        return res.status(400).json({
          success: false,
          message: "Invalid preferences data",
          errors: (error as any).errors,
        });
      }

      res.status(500).json({
        success: false,
        message:
          "Failed to save personalized search preferences. Please try again.",
      });
    }
  });

  // Get personalized search preferences for authenticated user
  app.get("/api/personalized-search-preferences", async (req, res) => {
    try {
      // For now, we'll use the email from session/cookies to identify user
      // This should be replaced with proper authentication
      const userEmail = req.headers["x-user-email"] || req.query.email;

      if (!userEmail) {
        console.log(
          `⚠️ [PERSONALIZED SEARCH GET] No email provided in request`
        );
        return res.status(400).json({
          success: false,
          message: "User identification required",
        });
      }

      console.log(
        `🔍 [PERSONALIZED SEARCH GET] Fetching preferences for: ${userEmail}`
      );

      const { personalizedSearchPreferences, users } = await import(
        "@shared/schema"
      );
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");

      // Find user by email in the users table
      console.log(
        `🔍 [PERSONALIZED SEARCH GET] Looking up user in 'users' table...`
      );
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, userEmail as string))
        .limit(1);

      if (user.length === 0) {
        console.log(
          `⚠️ [PERSONALIZED SEARCH GET] User not found in 'users' table for email: ${userEmail}`
        );
        return res.json({
          success: true,
          preferences: [],
          userInfo: null,
        });
      }

      const userId = user[0].id;
      console.log(
        `✅ [PERSONALIZED SEARCH GET] User found (ID: ${userId}), fetching preferences...`
      );

      // Get all preferences for this user
      const preferences = await db
        .select()
        .from(personalizedSearchPreferences)
        .where(eq(personalizedSearchPreferences.userId, userId))
        .orderBy(personalizedSearchPreferences.createdAt);

      console.log(
        `✅ [PERSONALIZED SEARCH GET] Found ${preferences.length} preference(s) for user ${userId}`
      );

      if (preferences.length > 0) {
        console.log(
          `📊 [PERSONALIZED SEARCH GET] Preferences summary:`,
          preferences.map((p: any) => ({
            id: p.id,
            minBeds: p.minBeds,
            maxBeds: p.maxBeds,
            emailFrequency: p.emailFrequency,
            alertsEnabled: p.alertsEnabled,
            createdAt: p.createdAt,
          }))
        );
      }

      const userInfo = {
        firstName: user[0].firstName || "",
        lastName: user[0].lastName || "",
        email: user[0].email,
        phone: user[0].phoneNumber || "",
      };

      res.json({
        success: true,
        preferences,
        userInfo,
      });
    } catch (error) {
      console.error(
        "❌ [PERSONALIZED SEARCH GET] Failed to fetch personalized search preferences:",
        error
      );
      res.status(500).json({
        success: false,
        message: "Failed to fetch preferences",
      });
    }
  });

  // Update personalized search preference
  app.put("/api/personalized-search-preferences/:id", async (req, res) => {
    try {
      const preferenceId = parseInt(req.params.id);
      const preferences = req.body;

      console.log(
        `🔄 Updating personalized search preference ${preferenceId}:`,
        preferences
      );

      const { personalizedSearchPreferences } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");

      // Update the preference
      const updatedPreference = await db
        .update(personalizedSearchPreferences)
        .set({
          minBeds: preferences.minBeds,
          maxBeds: preferences.maxBeds,
          minBaths: preferences.minBaths,
          maxBaths: preferences.maxBaths,
          propertyTypes: preferences.propertyTypes,
          minPrice: preferences.minPrice,
          maxPrice: preferences.maxPrice,
          minSqft: preferences.minSqft,
          maxSqft: preferences.maxSqft,
          garageSpaces: preferences.garageSpaces,
          preferredNeighborhoods: preferences.preferredNeighborhoods,
          preferredCities: preferences.preferredCities,
          emailFrequency: preferences.emailFrequency || "weekly",
          alertsEnabled: preferences.alertsEnabled !== false,
          updatedAt: new Date(),
        })
        .where(eq(personalizedSearchPreferences.id, preferenceId))
        .returning();

      if (updatedPreference.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Preference not found",
        });
      }

      console.log(`✅ Updated personalized search preference ${preferenceId}`);

      res.json({
        success: true,
        message: "Preference updated successfully",
        preference: updatedPreference[0],
      });
    } catch (error) {
      console.error(
        "❌ Failed to update personalized search preference:",
        error
      );
      res.status(500).json({
        success: false,
        message: "Failed to update preference",
      });
    }
  });

  // Delete personalized search preference
  app.delete("/api/personalized-search-preferences/:id", async (req, res) => {
    try {
      const preferenceId = parseInt(req.params.id);

      console.log(`🗑️ Deleting personalized search preference ${preferenceId}`);

      const { personalizedSearchPreferences } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");

      // Delete the preference
      const deletedPreference = await db
        .delete(personalizedSearchPreferences)
        .where(eq(personalizedSearchPreferences.id, preferenceId))
        .returning();

      if (deletedPreference.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Preference not found",
        });
      }

      console.log(`✅ Deleted personalized search preference ${preferenceId}`);

      res.json({
        success: true,
        message: "Preference deleted successfully",
      });
    } catch (error) {
      console.error(
        "❌ Failed to delete personalized search preference:",
        error
      );
      res.status(500).json({
        success: false,
        message: "Failed to delete preference",
      });
    }
  });

  // Toggle email alerts for personalized search preference
  app.patch(
    "/api/personalized-search-preferences/:id/toggle-alerts",
    async (req, res) => {
      try {
        const preferenceId = parseInt(req.params.id);
        const { alertsEnabled } = req.body;

        console.log(
          `🔔 Toggling alerts for personalized search preference ${preferenceId}: ${alertsEnabled}`
        );

        const { personalizedSearchPreferences } = await import(
          "@shared/schema"
        );
        const { db } = await import("./db");
        const { eq } = await import("drizzle-orm");

        // Update the alerts setting
        const updatedPreference = await db
          .update(personalizedSearchPreferences)
          .set({
            alertsEnabled,
            updatedAt: new Date(),
          })
          .where(eq(personalizedSearchPreferences.id, preferenceId))
          .returning();

        if (updatedPreference.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Preference not found",
          });
        }

        console.log(`✅ Updated alerts setting for preference ${preferenceId}`);

        res.json({
          success: true,
          message: `Alerts ${
            alertsEnabled ? "enabled" : "disabled"
          } successfully`,
          preference: updatedPreference[0],
        });
      } catch (error) {
        console.error("❌ Failed to toggle alerts:", error);
        res.status(500).json({
          success: false,
          message: "Failed to update alerts setting",
        });
      }
    }
  );

  // Send property matches email to selected personalized search preferences
  app.post("/api/personalized-search/send-emails", async (req, res) => {
    try {
      const { preferenceIds } = req.body;

      if (
        !preferenceIds ||
        !Array.isArray(preferenceIds) ||
        preferenceIds.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Preference IDs array is required",
        });
      }

      console.log(
        `📧 Sending property match emails to ${preferenceIds.length} preference(s)`
      );

      const { personalizedSearchPreferences, users } = await import(
        "@shared/schema"
      );
      const { db } = await import("./db");
      const { eq, inArray } = await import("drizzle-orm");
      const { propertyAlertService } = await import("./property-alert-service");

      // Fetch preferences with user details
      const preferences = await db
        .select({
          id: personalizedSearchPreferences.id,
          userId: personalizedSearchPreferences.userId,
          minBeds: personalizedSearchPreferences.minBeds,
          maxBeds: personalizedSearchPreferences.maxBeds,
          minBaths: personalizedSearchPreferences.minBaths,
          maxBaths: personalizedSearchPreferences.maxBaths,
          propertyTypes: personalizedSearchPreferences.propertyTypes,
          minPrice: personalizedSearchPreferences.minPrice,
          maxPrice: personalizedSearchPreferences.maxPrice,
          minSqft: personalizedSearchPreferences.minSqft,
          maxSqft: personalizedSearchPreferences.maxSqft,
          garageSpaces: personalizedSearchPreferences.garageSpaces,
          preferredCities: personalizedSearchPreferences.preferredCities,
          preferredNeighborhoods:
            personalizedSearchPreferences.preferredNeighborhoods,
          emailFrequency: personalizedSearchPreferences.emailFrequency,
          alertsEnabled: personalizedSearchPreferences.alertsEnabled,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(personalizedSearchPreferences)
        .innerJoin(users, eq(personalizedSearchPreferences.userId, users.id))
        .where(inArray(personalizedSearchPreferences.id, preferenceIds));

      if (preferences.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No preferences found for the given IDs",
        });
      }

      console.log(`✅ Found ${preferences.length} preference(s) to process`);

      // Send emails for each preference
      const results = [];
      for (const pref of preferences) {
        try {
          console.log(
            `📤 Sending property matches to ${pref.user.email} (Preference #${pref.id})`
          );

          // Query properties matching this preference
          const { properties } = await import("@shared/schema");
          const { and, gte, lte, sql } = await import("drizzle-orm");

          const conditions = [];

          if (pref.minBeds) conditions.push(gte(properties.beds, pref.minBeds));
          if (pref.maxBeds) conditions.push(lte(properties.beds, pref.maxBeds));

          // Note: baths is decimal in DB
          if (pref.minBaths)
            conditions.push(gte(properties.baths, pref.minBaths.toString()));
          if (pref.maxBaths)
            conditions.push(lte(properties.baths, pref.maxBaths.toString()));

          if (pref.minSqft) conditions.push(gte(properties.sqft, pref.minSqft));
          if (pref.maxSqft) conditions.push(lte(properties.sqft, pref.maxSqft));

          // Price range filter (price is stored as decimal/string)
          if (pref.minPrice || pref.maxPrice) {
            const minPrice = pref.minPrice || "0";
            const maxPrice = pref.maxPrice || "999999999";
            conditions.push(
              and(
                gte(properties.price, minPrice),
                lte(properties.price, maxPrice)
              )
            );
          }

          // City filter
          if (pref.preferredCities && pref.preferredCities.length > 0) {
            conditions.push(inArray(properties.city, pref.preferredCities));
          }

          const matchingProperties = await db
            .select()
            .from(properties)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .limit(20); // Limit to 20 properties per email

          console.log(
            `🏠 Found ${matchingProperties.length} matching properties for ${pref.user.email}`
          );

          if (matchingProperties.length > 0) {
            // Format properties for email
            const propertyList = matchingProperties.map((prop: any) => ({
              id: prop.id,
              title: `${prop.beds} bed, ${parseFloat(prop.baths)} bath ${
                prop.propertyType || "Home"
              }`,
              price: parseFloat(prop.price),
              address: prop.address,
              city: prop.city,
              state: prop.state || "NE",
              beds: prop.beds,
              baths: parseFloat(prop.baths),
              sqft: prop.sqft,
              images: Array.isArray(prop.images) ? prop.images : [],
              mlsId: prop.mlsId || prop.id,
            }));

            // Prepare search data similar to saved searches
            const searchData = {
              name: `Personalized Search #${pref.id}`,
              user: pref.user,
              agentSlug: "default", // You may want to add agentSlug to personalized preferences
            };

            // Get branding context (template)
            const { templates } = await import("@shared/schema");
            const templateResult = await db.select().from(templates).limit(1);
            const template =
              templateResult.length > 0 ? templateResult[0] : undefined;

            const branding = {
              template,
              agentEmail: template?.agentEmail?.trim() || undefined,
              agentName: template?.agentName?.trim() || undefined,
            };

            // Generate and send email HTML using property alert service method
            const emailService = (await import("./email-service")).emailService;
            const { propertyAlertService } = await import(
              "./property-alert-service"
            );

            // Access the generateEmailHTML method
            const subject = `${propertyList.length} Properties Match Your Criteria`;
            const html = (propertyAlertService as any).generateEmailHTML(
              searchData,
              propertyList,
              pref.user,
              branding
            );

            const emailResult = await emailService.sendEmail({
              to: pref.user.email,
              subject,
              html,
              template: branding.template,
              ...(branding.agentEmail ? { replyTo: branding.agentEmail } : {}),
            });

            if (emailResult.success) {
              // Update last alert sent timestamp
              await db
                .update(personalizedSearchPreferences)
                .set({
                  lastAlertSent: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(personalizedSearchPreferences.id, pref.id));

              results.push({
                preferenceId: pref.id,
                email: pref.user.email,
                success: true,
                propertiesCount: matchingProperties.length,
              });

              console.log(`✅ Email sent successfully to ${pref.user.email}`);
            } else {
              results.push({
                preferenceId: pref.id,
                email: pref.user.email,
                success: false,
                error: emailResult.error || "Failed to send email",
              });
              console.log(
                `❌ Failed to send email to ${pref.user.email}: ${emailResult.error}`
              );
            }
          } else {
            results.push({
              preferenceId: pref.id,
              email: pref.user.email,
              success: false,
              error: "No matching properties found",
            });
            console.log(`⚠️ No matching properties for ${pref.user.email}`);
          }
        } catch (emailError) {
          console.error(
            `❌ Error sending email for preference ${pref.id}:`,
            emailError
          );
          results.push({
            preferenceId: pref.id,
            email: pref.user.email,
            success: false,
            error:
              emailError instanceof Error
                ? emailError.message
                : "Unknown error",
          });
        }

        // Add delay between emails to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;
      const noPropertiesCount = results.filter(
        (r) => !r.success && r.error === "No matching properties found"
      ).length;

      console.log(
        `📊 Email send results: ${successCount} successful, ${failureCount} failed`
      );

      // Build a detailed message
      let message = "";
      if (successCount > 0) {
        message = `Successfully sent ${successCount} email(s) with property matches. `;
      }
      if (noPropertiesCount > 0) {
        message += `${noPropertiesCount} preference(s) have no matching properties currently. Emails will be sent automatically when properties matching the criteria become available. `;
      }
      const otherFailures = failureCount - noPropertiesCount;
      if (otherFailures > 0) {
        message += `${otherFailures} email(s) failed to send due to errors.`;
      }

      res.json({
        success: true,
        message: message.trim() || "No emails were sent",
        results,
        stats: {
          total: results.length,
          sent: successCount,
          noProperties: noPropertiesCount,
          failed: otherFailures,
        },
      });
    } catch (error) {
      console.error("❌ Failed to send property match emails:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send emails",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get leads for current authenticated agent
  app.get(
    "/api/leads",
    authenticateUser,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Authentication required" });
        }

        // Get leads for this specific agent
        const agentLeads = await storage.getLeadsByAgent(req.user.id);
        res.json(agentLeads);
      } catch (error) {
        console.error("❌ Failed to fetch agent leads:", error);
        res.status(500).json({ message: "Failed to fetch leads" });
      }
    }
  );

  // ========================
  // ENGAGEMENT TRACKING API ENDPOINTS
  // ========================

  // Helper function to get client info
  const getClientInfo = (req: Request) => ({
    ipAddress: req.ip || req.connection.remoteAddress || null,
    userAgent: req.get("User-Agent") || null,
    referrerUrl: req.get("Referer") || null,
    sessionId:
      req.cookies?.session_id ||
      (req.headers["x-session-id"] as string) ||
      `session_${Date.now()}_${Math.random()}`,
  });

  // Helper function to detect device info from User-Agent
  const parseUserAgent = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    const deviceType = /mobile|android|iphone|ipad|tablet/.test(ua)
      ? /tablet|ipad/.test(ua)
        ? "tablet"
        : "mobile"
      : "desktop";

    const browserName = ua.includes("chrome")
      ? "Chrome"
      : ua.includes("firefox")
      ? "Firefox"
      : ua.includes("safari")
      ? "Safari"
      : ua.includes("edge")
      ? "Edge"
      : "Unknown";

    const operatingSystem = ua.includes("windows")
      ? "Windows"
      : ua.includes("mac")
      ? "macOS"
      : ua.includes("linux")
      ? "Linux"
      : ua.includes("android")
      ? "Android"
      : ua.includes("ios")
      ? "iOS"
      : "Unknown";

    return { deviceType, browserName, operatingSystem };
  };

  // Track property like/unlike
  app.post("/api/track/property-like", async (req, res) => {
    try {
      const { propertyId, agentSlug, liked, publicUserId } = req.body;
      const clientInfo = getClientInfo(req);

      if (!propertyId || !agentSlug) {
        return res
          .status(400)
          .json({ error: "Property ID and agent slug are required" });
      }

      if (liked) {
        // Add like
        await (storage as any).addPropertyLike({
          publicUserId: publicUserId || null,
          propertyId,
          agentSlug,
          ...clientInfo,
        });
      } else {
        // Remove like
        await (storage as any).removePropertyLike(
          propertyId,
          clientInfo.sessionId,
          agentSlug
        );
      }

      // Update session stats
      await (storage as any).updateSessionStats(
        clientInfo.sessionId,
        agentSlug,
        {
          propertyLiked: liked,
        }
      );

      res.json({ success: true, liked });
    } catch (error) {
      console.error("❌ Error tracking property like:", error);
      res.status(500).json({ error: "Failed to track property like" });
    }
  });

  // Track property interaction (view, click, time spent, etc.)
  app.post("/api/track/property-interaction", async (req, res) => {
    try {
      const {
        propertyId,
        agentSlug,
        interactionType,
        interactionValue,
        timeSpentSeconds,
        publicUserId,
      } = req.body;

      if (!agentSlug || !interactionType) {
        return res.status(400).json({
          error: "Agent slug and interaction type are required",
        });
      }

      const clientInfo = getClientInfo(req);
      const validPropertyId =
        propertyId && propertyId.trim() ? propertyId : null;

      // Store the interaction in database
      await (storage as any).addPropertyInteraction({
        publicUserId: publicUserId || null,
        propertyId: validPropertyId,
        agentSlug,
        interactionType,
        interactionValue: interactionValue || null,
        timeSpentSeconds: timeSpentSeconds || null,
        currentUrl: req.body.currentUrl || null,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        sessionId: clientInfo.sessionId,
      });

      console.log("✅ Property interaction stored:", {
        propertyId: validPropertyId || "page-interaction",
        agentSlug,
        interactionType,
        interactionValue,
        timeSpentSeconds,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("❌ Error tracking property interaction:", error);
      res.status(500).json({ error: "Failed to track property interaction" });
    }
  });

  // Initialize or update user session
  app.post("/api/track/session", async (req, res) => {
    try {
      const { agentSlug, pageVisited, publicUserId } = req.body;
      const clientInfo = getClientInfo(req);

      if (!agentSlug) {
        return res.status(400).json({ error: "Agent slug is required" });
      }

      const deviceInfo = clientInfo.userAgent
        ? parseUserAgent(clientInfo.userAgent)
        : {};

      // Create or update session in database
      const session = await (storage as any).upsertUserSession({
        sessionId: clientInfo.sessionId,
        publicUserId: publicUserId || null,
        agentSlug,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        firstPageVisited: pageVisited || "/",
        lastPageVisited: pageVisited || "/",
        ...deviceInfo,
      });

      console.log(
        "✅ Session stored for agent:",
        agentSlug,
        "session:",
        clientInfo.sessionId
      );

      res.json({
        success: true,
        sessionId: clientInfo.sessionId,
        session,
      });
    } catch (error) {
      console.error("❌ Error tracking session:", error);
      res.status(500).json({ error: "Failed to track session" });
    }
  });

  // Get engagement analytics for an agent
  app.get("/api/analytics/engagement/:agentSlug", async (req, res) => {
    try {
      const { agentSlug } = req.params;
      const { timeframe = "7d" } = req.query;

      // Get real analytics data from database
      const analytics = await (storage as any).getEngagementAnalytics(
        agentSlug,
        timeframe as string
      );

      console.log(
        "📊 Returning real engagement analytics for:",
        agentSlug,
        ":",
        analytics
      );
      res.json(analytics);
    } catch (error) {
      console.error("❌ Error fetching engagement analytics:", error);
      res.status(500).json({ error: "Failed to fetch engagement analytics" });
    }
  });

  // Get per-property engagement breakdown for an agent
  app.get(
    "/api/analytics/engagement/:agentSlug/properties",
    async (req, res) => {
      try {
        const { agentSlug } = req.params;
        const { timeframe = "7d" } = req.query;

        const list = await (storage as any).getPropertyEngagementByAgent(
          agentSlug,
          timeframe as string
        );

        res.json({ timeframe, properties: list });
      } catch (error) {
        console.error(
          "❌ Error fetching property engagement breakdown:",
          error
        );
        res.status(500).json({ error: "Failed to fetch property engagement" });
      }
    }
  );

  // Get sessions with timings and pages for an agent
  app.get("/api/analytics/engagement/:agentSlug/sessions", async (req, res) => {
    try {
      const { agentSlug } = req.params;
      const { timeframe = "7d" } = req.query;

      const sessions = await (storage as any).getSessionsWithPages(
        agentSlug,
        timeframe as string
      );

      res.json({ timeframe, sessions });
    } catch (error) {
      console.error("❌ Error fetching sessions with pages:", error);
      res.status(500).json({ error: "Failed to fetch session details" });
    }
  });

  // Get top pages across sessions for an agent
  app.get("/api/analytics/engagement/:agentSlug/pages", async (req, res) => {
    try {
      const { agentSlug } = req.params;
      const { timeframe = "7d", limit } = req.query;
      const lim = Math.max(1, Math.min(parseInt(String(limit || 25)), 100));

      const pages = await (storage as any).getTopPagesByAgent(
        agentSlug,
        timeframe as string,
        lim
      );

      res.json({ timeframe, pages });
    } catch (error) {
      console.error("❌ Error fetching top pages:", error);
      res.status(500).json({ error: "Failed to fetch top pages" });
    }
  });

  // Generate engagement lead based on user activity
  app.post("/api/track/generate-engagement-lead", async (req, res) => {
    try {
      const { sessionId, agentSlug } = req.body;

      if (!sessionId || !agentSlug) {
        return res
          .status(400)
          .json({ error: "Session ID and agent slug are required" });
      }

      // Generate real engagement lead from database
      const engagementLead = await (storage as any).generateEngagementLead(
        sessionId,
        agentSlug
      );

      console.log("🎯 Engagement lead generation result:", engagementLead);

      if (engagementLead) {
        res.json({ success: true, lead: engagementLead });
      } else {
        res.json({
          success: false,
          message: "Not enough engagement to generate lead",
        });
      }
    } catch (error) {
      console.error("❌ Error generating engagement lead:", error);
      res.status(500).json({ error: "Failed to generate engagement lead" });
    }
  });

  // Get engagement leads for an agent (for admin dashboard)
  app.get("/api/engagement-leads/:agentSlug", async (req: any, res) => {
    try {
      const { agentSlug } = req.params;

      // Get real engagement leads from database
      const engagementLeads = await (storage as any).getEngagementLeadsByAgent(
        agentSlug
      );

      console.log(
        "📧 Returning real engagement leads for:",
        agentSlug,
        ":",
        engagementLeads
      );
      res.json(engagementLeads);
    } catch (error) {
      console.error("❌ Failed to fetch engagement leads:", error);
      res.status(500).json({ message: "Failed to fetch engagement leads" });
    }
  });

  // Get AI-generated market insights based on location
  app.get("/api/market-insights", async (req, res) => {
    try {
      const { city, state, zip } = req.query;

      if (!city || !state) {
        return res.status(400).json({ error: "City and state are required" });
      }

      const { generateMarketInsights } = await import("./market-insights-ai");
      const insights = await generateMarketInsights(
        city as string,
        state as string,
        zip as string | undefined
      );

      res.json(insights);
    } catch (error) {
      console.error("❌ Error generating market insights:", error);
      res.status(500).json({ error: "Failed to generate market insights" });
    }
  });

  // Convert engagement lead to contacted status
  app.put("/api/engagement-leads/:leadId/contact", async (req, res) => {
    try {
      const { leadId } = req.params;

      await (storage as any).markEngagementLeadContacted(parseInt(leadId));
      console.log("📞 Engagement lead marked as contacted:", leadId);
      res.json({ success: true });
    } catch (error) {
      console.error("❌ Error marking engagement lead as contacted:", error);
      res.status(500).json({ error: "Failed to update engagement lead" });
    }
  });

  // Social Media API Keys Management Routes
  // Get user's social media API keys
  app.get(
    "/api/user/social-media-keys",
    authenticateUser,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const keys = await (storage as any).getUserSocialMediaKeys(userId);

        console.log("🔑 Retrieved social media keys for user:", userId);
        res.json(keys);
      } catch (error) {
        console.error("❌ Error fetching social media keys:", error);
        res.status(500).json({ error: "Failed to fetch social media keys" });
      }
    }
  );

  // Save user's social media API keys
  app.post(
    "/api/user/social-media-keys",
    authenticateUser,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const keys = req.body;

        // Remove empty fields to avoid storing empty strings
        const cleanKeys = Object.fromEntries(
          Object.entries(keys).filter(([_, value]) => value && value !== "")
        );

        await (storage as any).saveSocialMediaKeys(userId, cleanKeys);

        console.log("💾 Saved social media keys for user:", userId);
        res.json({
          success: true,
          message: "Social media keys saved successfully",
        });
      } catch (error) {
        console.error("❌ Error saving social media keys:", error);
        res.status(500).json({ error: "Failed to save social media keys" });
      }
    }
  );

  // External access to social media keys (for RealtyFlow integration)
  app.get("/api/external/social-media-keys", async (req, res) => {
    try {
      const { domain, userId } = req.query;

      // Basic validation - in production, add proper domain validation
      if (!domain || !userId) {
        return res.status(400).json({ error: "Domain and userId required" });
      }

      // Convert userId to number if it's a string
      const userIdNum: number = (() => {
        if (typeof userId === "string") {
          const parsed = parseInt(userId, 10);
          if (Number.isNaN(parsed)) {
            throw new Error("Invalid userId format");
          }
          return parsed;
        }
        // If express parsed into array or object, reject to avoid unsafe cast
        if (Array.isArray(userId) || typeof userId === "object") {
          throw new Error("Invalid userId type");
        }
        return userId as number; // already a number
      })();

      const keys = await (storage as any).getUserSocialMediaKeys(userIdNum);

      console.log(
        "🌐 External access to social media keys for domain:",
        domain,
        "user:",
        userIdNum
      );
      res.json(keys);
    } catch (error) {
      console.error(
        "❌ Error fetching social media keys for external access:",
        error
      );
      res.status(500).json({ error: "Failed to fetch social media keys" });
    }
  });

  // =======================================================
  // SOCIAL MEDIA INTEGRATION
  // =======================================================
  
  // Import nanoid for generating IDs
  const { nanoid } = await import("nanoid");
  
  // Configure multer for Twitter uploads
  const upload = multer({
    dest: "uploads/",
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image and video files are allowed"));
      }
    },
  });

  // Configure multer for YouTube video uploads (larger limit)
  const videoUpload = multer({
    dest: "uploads/videos/",
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit for video uploads
    },
    fileFilter: (req, file, cb) => {
      // Only allow video files
      if (file.mimetype.startsWith("video/")) {
        cb(null, true);
      } else {
        cb(new Error("Only video files are allowed"));
      }
    },
  });

  // Import social media service
  const { socialMediaService } = await import("./services/socialMedia");

  // Get all social media accounts with connection status
  app.get("/api/social/accounts", requireAuth, async (req: any, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Resolve DB user ID to storage UUID
      let userId = String(req.user.id);
      let user = await storage.getUser(userId);

      // If not found by ID, try by email
      if (!user && req.user.email) {
        const allUsers = Array.from((storage as any).users?.values() || []);
        user = allUsers.find((u: any) => u.email === req.user.email);
      }

      // If not found by email, try by username
      if (!user && req.user.username) {
        user = await storage.getUserByUsername(req.user.username);
      }

      // Get social media accounts (empty if user not found)
      const socialAccounts = user
        ? await storage.getSocialMediaAccounts(user.id)
        : [];

      // Map accounts to include connection status
      const connectedPlatforms = new Set(
        socialAccounts.map((acc) => acc.platform.toLowerCase())
      );

      // Return all platforms with their connection status
      const platforms = [
        {
          id: nanoid(),
          platform: "facebook",
          isConnected: connectedPlatforms.has("facebook"),
          lastSync: connectedPlatforms.has("facebook")
            ? new Date().toISOString()
            : null,
        },
        {
          id: nanoid(),
          platform: "instagram",
          isConnected: connectedPlatforms.has("instagram"),
          lastSync: connectedPlatforms.has("instagram")
            ? new Date().toISOString()
            : null,
        },
        {
          id: nanoid(),
          platform: "linkedin",
          isConnected: connectedPlatforms.has("linkedin"),
          lastSync: connectedPlatforms.has("linkedin")
            ? new Date().toISOString()
            : null,
        },
        {
          id: nanoid(),
          platform: "x",
          isConnected:
            connectedPlatforms.has("x") || connectedPlatforms.has("twitter"),
          lastSync:
            connectedPlatforms.has("x") || connectedPlatforms.has("twitter")
              ? new Date().toISOString()
              : null,
        },
        {
          id: nanoid(),
          platform: "tiktok",
          isConnected: connectedPlatforms.has("tiktok"),
          lastSync: connectedPlatforms.has("tiktok")
            ? new Date().toISOString()
            : null,
        },
        {
          id: nanoid(),
          platform: "youtube",
          isConnected: connectedPlatforms.has("youtube"),
          lastSync: connectedPlatforms.has("youtube")
            ? new Date().toISOString()
            : null,
        },
      ];

      console.log(`📱 Returned ${platforms.length} platforms for user ${user?.id || 'unknown'}`);
      res.json(platforms);
    } catch (error) {
      console.error("Get social accounts error:", error);
      res.status(500).json({ error: "Failed to fetch social media accounts" });
    }
  });

  // Twitter post endpoint
  app.post(
    "/api/twitter/post",
    authenticateUser,
    upload.single("photo"),
    async (req: any, res) => {
      try {
        // Require authentication
        if (!req.user?.id) {
          return res.status(401).json({ error: "Authentication required" });
        }

        // Resolve DB user ID to storage UUID
        let userId = String(req.user.id);
        let user = await storage.getUser(userId);

        // If not found by ID, try by email
        if (!user && req.user?.email) {
          const allUsers = Array.from((storage as any).users?.values() || []);
          user = allUsers.find((u: any) => u.email === req.user.email);
        }

        // If not found by email, try by username
        if (!user && req.user?.username) {
          user = await storage.getUserByUsername(req.user.username);
        }

        if (!user) {
          return res.status(404).json({
            error: "User not found in storage. Please reconnect your Twitter account.",
          });
        }

        // Support both JSON and FormData
        let content = req.body.content;
        const photo = req.file;

        // Debug logging
        console.log("📝 Twitter post request:", {
          userId: user.id,
          contentType: req.get("content-type"),
          bodyKeys: Object.keys(req.body),
          content: content ? content.substring(0, 50) + "..." : "MISSING",
          hasPhoto: !!photo,
        });

        if (!content) {
          return res.status(400).json({ error: "Content is required" });
        }

        let photoUrl = null;
        let photoPath = null;
        if (photo) {
          photoUrl = `/uploads/${path.basename(photo.path)}`;
          photoPath = photo.path; // Pass the actual file path for media upload
        }

        // Build absolute URL for image if provided (for display purposes)
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const fullPhotoUrl = photoUrl ? baseUrl + photoUrl : undefined;

        // Pass userId and file path to use OAuth 2.0 token from database
        const postResult = await socialMediaService.postToTwitter(
          user.id,
          content,
          fullPhotoUrl,
          photoPath
        );

        res.json({
          success: true,
          message: "Content posted successfully to Twitter",
          postId: postResult.postId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Twitter post error:", error);
        res.status(500).json({
          error: `Failed to post to Twitter: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }
    }
  );

  // YouTube Post Endpoint
  app.post("/api/youtube/post", requireAuth, videoUpload.single("video"), async (req: any, res) => {
    try {
      const { title, description } = req.body;
      const videoFile = req.file;

      console.log("\n📺 YouTube Post Request:", {
        title,
        hasVideo: !!videoFile,
        userAuth: !!req.user,
      });

      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Resolve user and get YouTube access token
      let userId = String(req.user.id);
      let user = await storage.getUser(userId);

      if (!user && req.user.email) {
        const allUsers = Array.from((storage as any).users?.values() || []);
        user = allUsers.find((u: any) => u.email === req.user.email);
      }

      if (!user && req.user.username) {
        user = await storage.getUserByUsername(req.user.username);
      }

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get YouTube access token from social accounts
      const socialAccounts = await storage.getSocialMediaAccounts(user.id);
      const youtubeAccount = socialAccounts.find(
        (acc) => acc.platform.toLowerCase() === "youtube"
      );

      if (!youtubeAccount || !youtubeAccount.accessToken) {
        return res.status(400).json({
          error: "YouTube account not connected. Please connect your YouTube account first.",
        });
      }

      console.log(`   ✅ Found YouTube account for user: ${user.id}`);

      let videoUrl: string | undefined;
      let usedSampleVideo = false;

      if (videoFile) {
        // Use uploaded video - Force HTTPS for Replit
        const host = req.get("host");
        const baseUrl = host?.includes("replit.dev") ? `https://${host}` : `${req.protocol}://${host}`;
        videoUrl = `${baseUrl}/uploads/videos/${path.basename(videoFile.path)}`;
        console.log(`   📹 Using uploaded video: ${videoUrl}`);
      } else {
        // Fallback to sample video - Force HTTPS for Replit
        const sampleVideoPath = process.env.YOUTUBE_SAMPLE_VIDEO_PATH || "uploads/videos/demo-property-tour.mp4";
        const host = req.get("host");
        const baseUrl = host?.includes("replit.dev") ? `https://${host}` : `${req.protocol}://${host}`;
        videoUrl = `${baseUrl}/${sampleVideoPath}`;
        usedSampleVideo = true;
        console.log(`   📹 Using sample video: ${videoUrl}`);
      }

      // Upload video to YouTube
      const postResult = await socialMediaService.postToYoutube(
        title,
        description || title,
        videoUrl,
        youtubeAccount.accessToken
      );

      const watchUrl = `https://www.youtube.com/watch?v=${postResult.postId}`;
      const studioUrl = `https://studio.youtube.com/video/${postResult.postId}/edit`;

      console.log(`   ✅ YouTube video uploaded! ID: ${postResult.postId}`);
      console.log(`   🔗 Watch URL: ${watchUrl}`);
      console.log(`   🔧 Studio URL: ${studioUrl}`);

      res.json({
        success: true,
        message: "Video posted successfully to YouTube",
        postId: postResult.postId,
        watchUrl,
        studioUrl,
        usedSampleVideo,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ YouTube post error:", error);

      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        try {
          const fs = await import("fs");
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error("Failed to cleanup uploaded file:", cleanupError);
        }
      }

      res.status(500).json({
        error: `Failed to post to YouTube: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  });

  // LinkedIn Post Endpoint
  app.post("/api/linkedin/post", requireAuth, async (req, res) => {
    try {
      const { content } = req.body;

      console.log("\n💼 LinkedIn Post Request");

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Content is required" });
      }

      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Resolve user and get LinkedIn access token
      let userId = String(req.user.id);
      let user = await storage.getUser(userId);

      if (!user && req.user.email) {
        const allUsers = Array.from((storage as any).users?.values() || []);
        user = allUsers.find((u: any) => u.email === req.user.email);
      }

      if (!user && req.user.username) {
        user = await storage.getUserByUsername(req.user.username);
      }

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log(`   ✅ Posting as user: ${user.id} (${user.email || user.username})`);

      // Get LinkedIn access token using the helper method
      const accessToken = await socialMediaService.getLinkedInAccessToken(user.id);

      console.log(`   ✅ Retrieved LinkedIn access token for user: ${user.id}`);

      // Post to LinkedIn
      const postResult = await socialMediaService.postToLinkedIn(content, accessToken);

      console.log(`   ✅ LinkedIn post successful! ID: ${postResult.postId}`);

      res.json({
        success: true,
        message: "Content posted successfully to LinkedIn",
        postId: postResult.postId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ LinkedIn post error:", error);
      res.status(500).json({
        error: `Failed to post to LinkedIn: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  });

  // YouTube Video Upload Endpoint (dedicated)
  app.post("/api/youtube/upload-video", requireAuth, videoUpload.single("video"), async (req: any, res) => {
    try {
      const { title, description } = req.body;
      const videoFile = req.file;

      console.log("\n📺 YouTube Video Upload Request");

      if (!videoFile) {
        return res.status(400).json({ error: "Video file is required" });
      }

      if (!title) {
        return res.status(400).json({ error: "Video title is required" });
      }

      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Resolve user
      let userId = String(req.user.id);
      let user = await storage.getUser(userId);

      if (!user && req.user.email) {
        const allUsers = Array.from((storage as any).users?.values() || []);
        user = allUsers.find((u: any) => u.email === req.user.email);
      }

      if (!user && req.user.username) {
        user = await storage.getUserByUsername(req.user.username);
      }

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get YouTube access token
      const socialAccounts = await storage.getSocialMediaAccounts(user.id);
      const youtubeAccount = socialAccounts.find(
        (acc) => acc.platform.toLowerCase() === "youtube"
      );

      if (!youtubeAccount || !youtubeAccount.accessToken) {
        return res.status(400).json({
          error: "YouTube account not connected",
        });
      }

      // Build video URL - Force HTTPS for Replit
      const host = req.get("host");
      const baseUrl = host?.includes("replit.dev") ? `https://${host}` : `${req.protocol}://${host}`;
      const videoUrl = `${baseUrl}/uploads/videos/${path.basename(videoFile.path)}`;

      console.log("   Processing YouTube video upload:", {
        title,
        description,
        videoPath: videoFile.path,
        videoUrl,
        fileSize: videoFile.size,
        mimetype: videoFile.mimetype,
      });

      // Upload to YouTube
      const uploadResult = await socialMediaService.postToYoutube(
        title,
        description || title,
        videoUrl,
        youtubeAccount.accessToken
      );

      const watchUrl = `https://www.youtube.com/watch?v=${uploadResult.postId}`;
      const studioUrl = `https://studio.youtube.com/video/${uploadResult.postId}/edit`;

      res.json({
        success: true,
        message: "Video uploaded successfully to YouTube",
        videoId: uploadResult.postId,
        watchUrl,
        studioUrl,
        videoUrl: videoUrl,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ YouTube video upload error:", error);

      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        try {
          const fs = await import("fs");
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error("Failed to cleanup uploaded file:", cleanupError);
        }
      }

      res.status(500).json({
        error: `Failed to upload video to YouTube: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  });

  // Social Media OAuth Connection Route
  app.post("/api/social/connect/:platform", requireAuth, async (req, res) => {
    try {
      const { platform } = req.params;

      console.log("\n🔐 OAuth Connect Request for", platform);

      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Resolve the authenticated user
      let userId = String(req.user.id);
      let user = await storage.getUser(userId);

      // If not found by ID, try by email
      if (!user && req.user.email) {
        const allUsers = Array.from((storage as any).users?.values() || []);
        user = allUsers.find((u: any) => u.email === req.user.email);
      }

      // If not found by email, try by username
      if (!user && req.user.username) {
        user = await storage.getUserByUsername(req.user.username);
      }

      // If user still not found, create them in MemStorage
      if (!user) {
        console.log(`   → User not in MemStorage, creating with auto-generated UUID...`);
        user = await storage.createUser({
          username: req.user.username || req.user.email?.split("@")[0] || `user_${userId}`,
          email: req.user.email || undefined,
          password: "", // Not needed for OAuth-only users
          name: req.user.email || `User ${userId}`,
          role: ((req.user as any).type === "agent" ? "agent" : "public") as "agent" | "public" | "team_lead",
        });
        console.log(`   ✅ Created user in MemStorage: ${user.id} (DB ID was: ${userId})`);
      } else {
        console.log(`   ✅ Reusing existing MemStorage user: ${user.id}`);
      }

      // Use the MemStorage UUID for all social account operations
      userId = user.id;
      console.log(`✅ OAuth connect for user: ${userId} (${user.email || user.username})`);

      // Read base URL from environment
      const baseUrl = process.env.BASE_URL || 
        (process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
          : "http://localhost:5000");

      // Create state parameter with userId for OAuth callback
      const state = Buffer.from(JSON.stringify({ userId, platform })).toString("base64");

      // Generate PKCE code verifier and challenge for Twitter/X (OAuth 2.0 requires PKCE)
      let codeChallenge = '';
      let codeVerifier = '';
      if (platform === 'twitter' || platform === 'x') {
        codeVerifier = generateCodeVerifier();
        codeChallenge = generateCodeChallenge(codeVerifier);
        // Store code verifier with 10-minute expiration
        pkceStore.set(state, {
          codeVerifier,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        });
        console.log(`   🔑 Generated PKCE codes for state: ${state.substring(0, 20)}...`);
      }

      // Generate OAuth URLs for different platforms
      const oauthUrls: Record<string, string | null> = {
        facebook: null,
        instagram: null,
        linkedin: process.env.LINKEDIN_CLIENT_ID
          ? `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + "/api/social/callback/linkedin")}&scope=openid%20profile%20email%20w_member_social&state=${encodeURIComponent(state)}`
          : null,
        twitter: process.env.TWITTER_CLIENT_ID && codeChallenge
          ? `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${process.env.TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + "/api/social/callback/twitter")}&scope=tweet.read%20tweet.write%20users.read%20offline.access%20media.write&state=${encodeURIComponent(state)}&code_challenge=${codeChallenge}&code_challenge_method=S256`
          : null,
        x: process.env.TWITTER_CLIENT_ID && codeChallenge
          ? `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${process.env.TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + "/api/social/callback/x")}&scope=tweet.read%20tweet.write%20users.read%20offline.access%20media.write&state=${encodeURIComponent(state)}&code_challenge=${codeChallenge}&code_challenge_method=S256`
          : null,
        youtube: process.env.YOUTUBE_CLIENT_ID
          ? `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${process.env.YOUTUBE_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + "/api/social/callback/youtube")}&scope=https://www.googleapis.com/auth/youtube.upload%20https://www.googleapis.com/auth/youtube.force-ssl&access_type=offline&state=${encodeURIComponent(state)}`
          : null,
        tiktok: null,
      };

      const authUrl = oauthUrls[platform];

      if (!authUrl) {
        return res.status(400).json({
          error: `OAuth not configured for ${platform}`,
          message: `Please add ${platform.toUpperCase()}_CLIENT_ID to environment variables to enable OAuth`,
        });
      }

      res.json({
        authUrl,
        message: "OAuth URL generated successfully",
      });
    } catch (error) {
      console.error("OAuth initiation error:", error);
      res.status(500).json({ error: "Failed to initiate OAuth flow" });
    }
  });

  // OAuth Callback Handler for all platforms
  app.get("/api/social/callback/:platform", async (req, res) => {
    try {
      const { platform } = req.params;
      const { code, state, error: oauthError } = req.query;

      console.log(`\n🔄 OAuth Callback received for ${platform}`);
      console.log(`   State: ${String(state).substring(0, 30)}...`);
      console.log(`   Code: ${code ? 'Present' : 'Missing'}`);
      console.log(`   Error: ${oauthError || 'None'}`);

      // Read base URL from environment
      const baseUrl = process.env.BASE_URL || 
        (process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
          : "http://localhost:5000");

      // Handle OAuth errors from provider
      if (oauthError) {
        console.error(`❌ OAuth error from ${platform}:`, oauthError);
        return res.redirect(`${baseUrl}/?oauth_error=${oauthError}`);
      }

      // Validate required parameters
      if (!state || !code) {
        console.error('❌ Missing state or code parameter');
        return res.redirect(`${baseUrl}/?oauth_error=missing_parameters`);
      }

      // Decode and validate state parameter
      let decodedState: { userId: string; platform: string };
      try {
        decodedState = JSON.parse(Buffer.from(String(state), 'base64').toString());
      } catch (e) {
        console.error('❌ Invalid state parameter');
        return res.redirect(`${baseUrl}/?oauth_error=invalid_state`);
      }

      const { userId, platform: statePlatform } = decodedState;

      // Verify platform matches
      if (statePlatform !== platform && !(statePlatform === 'x' && platform === 'twitter') && !(statePlatform === 'twitter' && platform === 'x')) {
        console.error(`❌ Platform mismatch: expected ${statePlatform}, got ${platform}`);
        return res.redirect(`${baseUrl}/?oauth_error=platform_mismatch`);
      }

      console.log(`   User ID from state: ${userId}`);

      // Handle Twitter/X OAuth
      if (platform === 'twitter' || platform === 'x') {
        const clientId = process.env.TWITTER_CLIENT_ID;
        const clientSecret = process.env.TWITTER_CLIENT_SECRET;
        const redirectUri = `${baseUrl}/api/social/callback/${platform}`;

        if (!clientId || !clientSecret) {
          console.error('❌ Twitter OAuth credentials not configured');
          return res.redirect(`${baseUrl}/?oauth_error=missing_credentials`);
        }

        // Retrieve PKCE code verifier from store
        const pkceData = pkceStore.get(String(state));
        if (!pkceData) {
          console.error('❌ PKCE code verifier not found for state');
          return res.redirect(`${baseUrl}/?oauth_error=pkce_verifier_not_found`);
        }

        // Check if PKCE data expired
        if (pkceData.expiresAt < Date.now()) {
          pkceStore.delete(String(state));
          console.error('❌ PKCE code verifier expired');
          return res.redirect(`${baseUrl}/?oauth_error=pkce_verifier_expired`);
        }

        // Clean up PKCE data after retrieval
        const codeVerifier = pkceData.codeVerifier;
        pkceStore.delete(String(state));

        console.log('   🔑 Retrieved PKCE code verifier');

        try {
          // Exchange authorization code for access token
          console.log('   🔄 Exchanging code for access token...');
          const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code: String(code),
              redirect_uri: redirectUri,
              code_verifier: codeVerifier,
            }),
          });

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('❌ Twitter token exchange failed:', errorText);
            return res.redirect(`${baseUrl}/?oauth_error=token_exchange_failed`);
          }

          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;
          const refreshToken = tokenData.refresh_token;

          console.log('   ✅ Twitter token exchange successful');
          console.log('   Access token:', accessToken ? 'Present' : 'Missing');
          console.log('   Refresh token:', refreshToken ? 'Present' : 'Missing');

          // Get user from storage
          const user = await storage.getUser(userId);
          if (!user) {
            console.error(`❌ User not found: ${userId}`);
            return res.redirect(`${baseUrl}/?oauth_error=user_not_found`);
          }

          console.log(`   ✅ Found user: ${user.id} (${user.email || user.username})`);

          // Check if Twitter/X account already exists
          const existingAccounts = await storage.getSocialMediaAccounts(user.id);
          const twitterAccount = existingAccounts.find(
            (acc) => acc.platform.toLowerCase() === 'twitter' || acc.platform.toLowerCase() === 'x'
          );

          if (twitterAccount) {
            // Update existing account
            console.log(`   🔄 Updating existing Twitter account: ${twitterAccount.id}`);
            await storage.updateSocialMediaAccount(twitterAccount.id, {
              accessToken,
              refreshToken: refreshToken || undefined,
              isConnected: true,
              lastSync: new Date(),
            });
            console.log('   ✅ Twitter account updated');
          } else {
            // Create new account
            console.log('   ➕ Creating new Twitter account');
            await storage.createSocialMediaAccount({
              userId: user.id,
              platform: 'x',
              accountId: 'x_account',
              accessToken,
              refreshToken: refreshToken || undefined,
              isConnected: true,
            });
            console.log('   ✅ Twitter account created');
          }

          // Success! Return HTML that closes the popup
          res.send(`
            <html>
              <head>
                <title>Twitter Connected</title>
                <style>
                  body {
                    font-family: system-ui, -apple-system, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                  }
                  .container {
                    text-align: center;
                    padding: 2rem;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 1rem;
                    backdrop-filter: blur(10px);
                  }
                  h1 { margin: 0 0 0.5rem 0; font-size: 2rem; }
                  p { margin: 0; opacity: 0.9; }
                  .checkmark {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                    animation: scaleIn 0.5s ease-out;
                  }
                  @keyframes scaleIn {
                    from { transform: scale(0); }
                    to { transform: scale(1); }
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="checkmark">✅</div>
                  <h1>Twitter/X Connected!</h1>
                  <p>Your Twitter account has been connected successfully.</p>
                  <p style="margin-top: 1rem; font-size: 0.9rem;">This window will close automatically...</p>
                </div>
                <script>
                  // Notify parent window of success
                  if (window.opener) {
                    window.opener.postMessage({ success: true, platform: 'x' }, '*');
                  }
                  // Close window after 2 seconds
                  setTimeout(() => window.close(), 2000);
                </script>
              </body>
            </html>
          `);
        } catch (fetchError) {
          console.error('❌ Twitter OAuth error:', fetchError);
          return res.redirect(`${baseUrl}/?oauth_error=token_exchange_error`);
        }
      } else if (platform.toLowerCase() === 'youtube') {
        const clientId = process.env.YOUTUBE_CLIENT_ID;
        const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
        const redirectUri = `${baseUrl}/api/social/callback/youtube`;

        if (!clientId || !clientSecret) {
          console.error('❌ YouTube OAuth credentials not configured');
          return res.redirect(`${baseUrl}/?oauth_error=missing_credentials`);
        }

        try {
          // Exchange code for access token using Google OAuth
          console.log('   🔄 Exchanging code for YouTube access token...');
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code: String(code),
              redirect_uri: redirectUri,
              client_id: clientId,
              client_secret: clientSecret,
            }),
          });

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('❌ YouTube token exchange failed:', errorText);
            return res.redirect(`${baseUrl}/?oauth_error=token_exchange_failed`);
          }

          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;
          const refreshToken = tokenData.refresh_token;

          console.log('   ✅ YouTube token exchange successful');
          console.log('   Access token:', accessToken ? 'Present' : 'Missing');
          console.log('   Refresh token:', refreshToken ? 'Present' : 'Missing');

          // Get user from storage
          const user = await storage.getUser(userId);
          if (!user) {
            console.error(`❌ User not found: ${userId}`);
            return res.redirect(`${baseUrl}/?oauth_error=user_not_found`);
          }

          console.log(`   ✅ Found user: ${user.id} (${user.email || user.username})`);

          // Check if YouTube account already exists
          const existingAccounts = await storage.getSocialMediaAccounts(user.id);
          const youtubeAccount = existingAccounts.find(
            (acc) => acc.platform.toLowerCase() === 'youtube'
          );

          if (youtubeAccount) {
            // Update existing account
            console.log(`   🔄 Updating existing YouTube account: ${youtubeAccount.id}`);
            await storage.updateSocialMediaAccount(youtubeAccount.id, {
              accessToken,
              refreshToken: refreshToken || undefined,
              isConnected: true,
              lastSync: new Date(),
            });
            console.log('   ✅ YouTube account updated');
          } else {
            // Create new account
            console.log('   ➕ Creating new YouTube account');
            await storage.createSocialMediaAccount({
              userId: user.id,
              platform: 'youtube',
              accountId: 'youtube_account',
              accessToken,
              refreshToken: refreshToken || undefined,
              isConnected: true,
            });
            console.log('   ✅ YouTube account created');
          }

          // Success! Return HTML that closes the popup
          res.send(`
            <html>
              <head>
                <title>YouTube Connected</title>
                <style>
                  body {
                    font-family: system-ui, -apple-system, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #FF0000 0%, #CC0000 100%);
                    color: white;
                  }
                  .container {
                    text-align: center;
                    padding: 2rem;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 1rem;
                    backdrop-filter: blur(10px);
                  }
                  h1 { margin: 0 0 0.5rem 0; font-size: 2rem; }
                  p { margin: 0; opacity: 0.9; }
                  .checkmark {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                    animation: scaleIn 0.5s ease-out;
                  }
                  @keyframes scaleIn {
                    from { transform: scale(0); }
                    to { transform: scale(1); }
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="checkmark">✅</div>
                  <h1>YouTube Connected!</h1>
                  <p>Your YouTube channel has been connected successfully.</p>
                  <p style="margin-top: 1rem; font-size: 0.9rem;">This window will close automatically...</p>
                </div>
                <script>
                  // Notify parent window of success
                  if (window.opener) {
                    window.opener.postMessage({ success: true, platform: 'youtube' }, '*');
                  }
                  // Close window after 2 seconds
                  setTimeout(() => window.close(), 2000);
                </script>
              </body>
            </html>
          `);
        } catch (fetchError) {
          console.error('❌ YouTube OAuth error:', fetchError);
          return res.redirect(`${baseUrl}/?oauth_error=token_exchange_error`);
        }
      } else if (platform.toLowerCase() === 'linkedin') {
        const clientId = process.env.LINKEDIN_CLIENT_ID;
        const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
        const redirectUri = `${baseUrl}/api/social/callback/linkedin`;

        if (!clientId || !clientSecret) {
          console.error('❌ LinkedIn OAuth credentials not configured');
          return res.redirect(`${baseUrl}/?oauth_error=missing_credentials`);
        }

        try {
          // Exchange code for access token
          console.log('   🔄 Exchanging code for LinkedIn access token...');
          const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code: String(code),
              redirect_uri: redirectUri,
              client_id: clientId,
              client_secret: clientSecret,
            }),
          });

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('❌ LinkedIn token exchange failed:', errorText);
            return res.redirect(`${baseUrl}/?oauth_error=token_exchange_failed`);
          }

          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;
          const refreshToken = tokenData.refresh_token;

          console.log('   ✅ LinkedIn token exchange successful');
          console.log('   Access token:', accessToken ? 'Present' : 'Missing');
          console.log('   Refresh token:', refreshToken ? 'Present' : 'Missing');

          // Get user from storage
          const user = await storage.getUser(userId);
          if (!user) {
            console.error(`❌ User not found: ${userId}`);
            return res.redirect(`${baseUrl}/?oauth_error=user_not_found`);
          }

          console.log(`   ✅ Found user: ${user.id} (${user.email || user.username})`);

          // Check if LinkedIn account already exists
          const existingAccounts = await storage.getSocialMediaAccounts(user.id);
          const linkedinAccount = existingAccounts.find(
            (acc) => acc.platform.toLowerCase() === 'linkedin'
          );

          if (linkedinAccount) {
            // Update existing account
            console.log(`   🔄 Updating existing LinkedIn account: ${linkedinAccount.id}`);
            await storage.updateSocialMediaAccount(linkedinAccount.id, {
              accessToken,
              refreshToken: refreshToken || undefined,
              isConnected: true,
              lastSync: new Date(),
            });
            console.log('   ✅ LinkedIn account updated');
          } else {
            // Create new account
            console.log('   ➕ Creating new LinkedIn account');
            await storage.createSocialMediaAccount({
              userId: user.id,
              platform: 'linkedin',
              accountId: 'linkedin_account',
              accessToken,
              refreshToken: refreshToken || undefined,
              isConnected: true,
            });
            console.log('   ✅ LinkedIn account created');
          }

          // Success! Return HTML that closes the popup
          res.send(`
            <html>
              <head>
                <title>LinkedIn Connected</title>
                <style>
                  body {
                    font-family: system-ui, -apple-system, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #0077b5 0%, #005885 100%);
                    color: white;
                  }
                  .container {
                    text-align: center;
                    padding: 2rem;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 1rem;
                    backdrop-filter: blur(10px);
                  }
                  h1 { margin: 0 0 0.5rem 0; font-size: 2rem; }
                  p { margin: 0; opacity: 0.9; }
                  .checkmark {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                    animation: scaleIn 0.5s ease-out;
                  }
                  @keyframes scaleIn {
                    from { transform: scale(0); }
                    to { transform: scale(1); }
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="checkmark">✅</div>
                  <h1>LinkedIn Connected!</h1>
                  <p>Your LinkedIn account has been connected successfully.</p>
                  <p style="margin-top: 1rem; font-size: 0.9rem;">This window will close automatically...</p>
                </div>
                <script>
                  // Notify parent window of success
                  if (window.opener) {
                    window.opener.postMessage({ success: true, platform: 'linkedin' }, '*');
                  }
                  // Close window after 2 seconds
                  setTimeout(() => window.close(), 2000);
                </script>
              </body>
            </html>
          `);
        } catch (fetchError) {
          console.error('❌ LinkedIn OAuth error:', fetchError);
          return res.redirect(`${baseUrl}/?oauth_error=token_exchange_error`);
        }
      } else {
        // Other platforms not yet implemented
        res.send(`
          <html>
            <head><title>${platform} OAuth</title></head>
            <body style="font-family: system-ui; padding: 2rem; text-align: center;">
              <h1>${platform} OAuth Callback</h1>
              <p>OAuth setup for ${platform} requires additional configuration.</p>
              <p>Platform: ${platform} is not yet fully implemented.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `);
      }
    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      res.status(500).send('OAuth callback failed');
    }
  });

  // Twitter validation endpoint
  app.get("/api/twitter/validate", async (req, res) => {
    try {
      const isValid = await socialMediaService.validateConnection("twitter");
      res.json({
        valid: isValid,
        platform: "twitter",
        message: isValid
          ? "Twitter connection is valid"
          : "Twitter connection failed",
      });
    } catch (error) {
      console.error("Twitter validation error:", error);
      res.status(500).json({ error: "Failed to validate Twitter connection" });
    }
  });

  // Twitter delete tweet endpoint
  app.delete("/api/twitter/post/:tweetId", async (req, res) => {
    try {
      const { tweetId } = req.params;

      if (!tweetId) {
        return res.status(400).json({ error: "Tweet ID is required" });
      }

      const deleteResult = await socialMediaService.deleteTwitterPost(tweetId);

      res.json({
        success: deleteResult.success,
        message: "Tweet deleted successfully",
        tweetId: tweetId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Twitter delete error:", error);
      res.status(500).json({
        error: `Failed to delete Twitter post: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
