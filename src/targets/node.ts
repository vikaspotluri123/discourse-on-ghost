import process from "node:process";
import { config as loadEnv } from "dotenv";
import express, { type Request, type Response, type RequestHandler } from "express";
import { deferGetConfig } from "../services/config.js";
import { useRequestLogging } from "../controllers/middleware.js";
import { bootstrapInjector } from "../services/dependency-injection.js";
import { RoutingManager } from "../routing.js";
import { core, envToConfigMapping } from "./shared-node.js";
import crypto from "crypto";

// Optional: if you later want URL-encoded parsing helpers
// import querystring from "node:querystring";

loadEnv();

const config = bootstrapInjector(core, deferGetConfig(process.env, envToConfigMapping));
if (!config) {
  process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

const routingManager = new RoutingManager();
export const app = express();
app.disable("x-powered-by");
app.use(useRequestLogging());

// --- Small helpers ----------------------------------------------------------

const getEnv = (k: string) => (process.env[k] ?? "").trim();

/**
 * The shared secret MUST match Discourse's "sso secret".
 * We'll look for either DOG_DISCOURSE_SHARED_SECRET (your .env.example)
 * or SSO_SECRET (common name) to be flexible.
 */
const SSO_SECRET =
  getEnv("DOG_DISCOURSE_SHARED_SECRET") || getEnv("SSO_SECRET");

/** Discourse base URL, e.g. https://ffgtestwizards.discourse.group */
const DISCOURSE_URL =
  getEnv("DOG_DISCOURSE_URL") || getEnv("DISCOURSE_URL");

/** HMAC-SHA256 signature helper */
const sign = (payloadBase64: string) =>
  crypto.createHmac("sha256", SSO_SECRET).update(payloadBase64).digest("hex");

// --- Health & Landing -------------------------------------------------------

app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

app.get("/", (_req, res) => {
  res.status(200).send("✨ Discourse-on-Ghost is live ✨");
});

// --- Discourse SSO (MUST be registered BEFORE addAllRoutes) -----------------

/**
 * This handler completes the Discourse SSO handshake.
 * It does NOT assume "email" is present in the incoming payload (it won't be).
 * For now we return a test identity so you can verify the round-trip.
 * Next step: replace the test identity with Ghost session lookup.
 */
const discourseSSOHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!SSO_SECRET || !DISCOURSE_URL) {
      res
        .status(500)
        .send("Server misconfigured: missing SSO_SECRET or DISCOURSE_URL");
      return;
    }

    const sso = req.query.sso as string | undefined;
    const sig = req.query.sig as string | undefined;

    if (!sso || !sig) {
      res.status(400).send("Missing sso or sig");
      return;
    }

    // 1) Verify Discourse signature
    const expected = sign(sso);
    if (expected !== sig) {
      res.status(403).send("Invalid SSO signature");
      return;
    }

    // 2) Decode payload and extract nonce (Discourse always sends it)
    const decoded = Buffer.from(sso, "base64").toString("utf8");
    const params = new URLSearchParams(decoded);
    const nonce = params.get("nonce");
    const returnTo = params.get("return_sso_url"); // not required here but useful for logs/debug

    if (!nonce) {
      res.status(400).send("Invalid SSO payload: missing nonce");
      return;
    }

    // 3) TODO: Replace this block with REAL Ghost-authenticated user lookup.
    //    For now we provide a test identity so you can confirm the Discourse round-trip works.
    const user = {
      external_id: "test-user-123",                   // stable ID from your system
      email: "testuser@example.com",                  // Ghost member email
      username: "testuser",                           // no spaces
      name: "Test User",                              // display name
    };

    // 4) Build response payload for Discourse
    const responseParams = new URLSearchParams({
      nonce,
      email: user.email,
      external_id: user.external_id,
      username: user.username,
      name: user.name,
    });

    const responseB64 = Buffer.from(responseParams.toString(), "utf8").toString("base64");
    const responseSig = sign(responseB64);

    const redirectUrl = `${DISCOURSE_URL}/session/sso_login?sso=${encodeURIComponent(
      responseB64
    )}&sig=${responseSig}`;

    core.logger.info(
      `SSO OK → redirecting to Discourse: ${redirectUrl}${
        returnTo ? ` (orig return: ${returnTo})` : ""
      }`
    );

    res.redirect(302, redirectUrl);
  } catch (err) {
    core.logger.error({ err }, "SSO handler error");
    res.status(500).send("Unexpected error in SSO handler");
  }
};

// IMPORTANT: mount BEFORE catch-alls/other routers
app.get("/discourse/sso", discourseSSOHandler);

// Mount the rest of the app after our SSO route so it isn't shadowed.
routingManager.addAllRoutes(app);

// --- Start server -----------------------------------------------------------

app.listen(config.port, "0.0.0.0", () => {
  core.logger.info(`Listening on http://0.0.0.0:${config.port}`);
});
