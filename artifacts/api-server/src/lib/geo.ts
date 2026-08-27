import geoip from "geoip-lite";
import type { Request } from "express";

// Best-effort client IP extraction. Render sits in front of the app as a
// reverse proxy, so `req.ip` only resolves correctly once Express is told
// to trust it (see `app.set("trust proxy", ...)` in app.ts) — this falls
// back to reading X-Forwarded-For directly in case that's ever missing.
export function getClientIp(req: Request): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? null;
}

export type GeoLocation = {
  city: string | null;
  region: string | null; // ISO 3166-2 subdivision code, e.g. "MH" for Maharashtra
  country: string | null; // ISO 3166-1 alpha-2, e.g. "IN"
};

const EMPTY_LOCATION: GeoLocation = { city: null, region: null, country: null };

// Local geoip database lookup — no network call, no third-party API, no
// rate limits. City-level accuracy is approximate by nature of IP
// geolocation (mobile carrier NAT especially), but country/region is
// generally reliable.
export function lookupLocation(ip: string | null): GeoLocation {
  if (!ip) return EMPTY_LOCATION;

  // Local/private addresses (dev, simulators, internal networks) never
  // resolve to a real location — return empty rather than a bogus guess.
  const geo = geoip.lookup(ip);
  if (!geo) return EMPTY_LOCATION;

  return {
    city: geo.city || null,
    region: geo.region || null,
    country: geo.country || null,
  };
}
