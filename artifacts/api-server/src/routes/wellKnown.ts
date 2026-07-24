import { Router, type IRouter } from "express";

const router: IRouter = Router();

const PACKAGE_NAME = "com.haamarkissa.app";

/**
 * Android App Links verification file.
 * Must be served at exactly https://<domain>/.well-known/assetlinks.json
 * over HTTPS, with content-type application/json, and no redirects.
 *
 * ANDROID_SHA256_FINGERPRINTS should be set as an env var on Render:
 * one or more SHA-256 certificate fingerprints, comma-separated if more than one
 * (e.g. the Play App Signing key, and optionally your local upload key for testing).
 * Get it from Play Console → Setup → App integrity → App signing key certificate → SHA-256,
 * or via `eas credentials -p android` → view keystore.
 */
router.get("/.well-known/assetlinks.json", (_req, res) => {
  const fingerprints = (process.env["ANDROID_SHA256_FINGERPRINTS"] || "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  res.setHeader("Content-Type", "application/json");
  res.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
});

export default router;
