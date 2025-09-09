import process from "node:process";
import { config as loadEnv } from "dotenv";
import express, { type Request, type Response, type RequestHandler } from "express";
import cookieParser from "cookie-parser";
import axios from "axios";
import crypto from "crypto";

import { deferGetConfig } from "../services/config.js";
import { useRequestLogging } from "../controllers/middleware.js";
import { bootstrapInjector } from "../services/dependency-injection.js";
import { RoutingManager } from "../routing.js";
import { core, envToConfigMapping } from "./shared-node.js";

loadEnv();

const config = bootstrapInjector(core, deferGetConfig(process.env, envToConfigMapping));
if (!config) {
  process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

const app = express();
export { app };

app.disable("x-powered-by");
app.use(cookieParser());           // <-- for reading the short-lived session cookie
app.use(useRequestLogging());

// ------------------------- helpers & env -------------------------

const getEnv = (k: string) => (process.env[k] ?? "").trim();

const SSO_SECRET =
  getEnv("DOG_DISCOURSE_SHARED_SECRET") || getEnv("SSO_SECRET");
const DISCOURSE_URL =
  getEnv("DOG_DISCOURSE_URL") || getEnv("DISCOURSE_URL");
const GHOST_URL = getEnv("DOG_GHOST_URL");
const GHOST_ADMIN_KEY = getEnv("DOG_GHOST_ADMIN_API_KEY");
const SESSION_SECRET = getEnv("DOG_SESSION_SECRET");
const SESSION_COOKIE = "dog_member";
const SESSION_TTL_SECONDS = 10 * 60; // 10 minutes

const signHmac = (payloadBase64: string) =>
  crypto.createHmac("sha256", SSO_SECRET).update(payloadBase64).digest("hex");

function signCookie(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig  = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyCookie(token: string, secret: string): null | any {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (expected !== sig) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// ------------------------- health & home -------------------------

app.get("/health", (_req, res) => res.status(200).send("OK"));

app.get("/", (_req, res) => {
  res.status(200).send("✨ Discourse-on-Ghost is live ✨");
});

// ------------------------- Bridge: Ghost -> cookie -> forum ------
//
// Add a Ghost nav/button that only shows to logged-in members and points to:
//   https://dogffg.onrender.com/login-from-ghost?e={{@member.email}}
//
// This verifies the member in Ghost, sets a short-lived signed cookie, and
// sends the user to your Discourse site (which will then call /discourse/sso).
//
const loginFromGhost: RequestHandler = async (req: Request, res: Response) => {
  try {
    const email = (req.query.e as string | undefined)?.trim();
    if (!email) return void res.status(400).send("Missing ?e=email");
    if (!GHOST_URL || !GHOST_ADMIN_KEY || !SESSION_SECRET) {
      return void res.status(500).send("Server missing Ghost or session config");
    }

    // Verify member exists & get stable ID
    const ghostResp = await axios.get(
      `${GHOST_URL}/ghost/api/admin/members/`,
      {
        headers: { Authorization: `Ghost ${GHOST_ADMIN_KEY}` },
        params: { filter: `email:'${email}'`, fields: "id,email,name" }
      }
    );

    const member = ghostResp.data?.members?.[0];
    if (!member) return void res.status(404).send("Ghost member not found");

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: member.id,
      email: member.email,
      name: member.name || "",
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
    };

    const token = signCookie(payload, SESSION_SECRET);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS * 1000,
      path: "/",
    });

    if (!DISCOURSE_URL) return void res.status(500).send("Missing DISCOURSE_URL");
    return void res.redirect(302, DISCOURSE_URL);
  } catch (err) {
    core.logger.error({ err }, "login-from-ghost failed");
    return void res.status(500).send("login-from-ghost failed");
  }
};

app.get("/login-from-ghost", loginFromGhost);

// ------------------------- Discourse SSO handler -----------------
//
// Discourse redirects users here with ?sso=...&sig=...
// We validate the signature, read our signed cookie, fetch Ghost member,
// and return the signed Discourse payload.
//
const discourseSSOHandler: RequestHandler = async (req: Request, res: Response) => {
  try {
    if (!SSO_SECRET || !DISCOURSE_URL) {
      return void res.status(500).send("Server misconfigured: missing SSO secret or forum URL");
    }

    const sso = req.query.sso as string | undefined;
    const sig = req.query.sig as string | undefined;
    if (!sso || !sig) return void res.status(400).send("Missing sso or sig");

    const expected = signHmac(sso);
    if (expected !== sig) return void res.status(403).send("Invalid SSO signature");

    const decoded = Buffer.from(sso, "base64").toString("utf8");
    const params = new URLSearchParams(decoded);
    const nonce = params.get("nonce");
    if (!nonce) return void res.status(400).send("Invalid SSO payload: missing nonce");

    // Read signed cookie set by /login-from-ghost
    if (!SESSION_SECRET) return void res.status(500).send("Missing SESSION_SECRET");
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const session = token ? verifyCookie(token, SESSION_SECRET) : null;
    if (!session || session.exp <= Math.floor(Date.now() / 1000)) {
      // No/expired session: ask user to start at the Ghost bridge
      const here = `${req.protocol}://${req.get("host")}/login-from-ghost`;
      return void res.redirect(302, here);
    }

    // Optional: re-verify Ghost member by ID to be extra safe
    if (!GHOST_URL || !GHOST_ADMIN_KEY) {
      return void res.status(500).send("Missing Ghost Admin API config");
    }
    const ghostResp = await axios.get(
      `${GHOST_URL}/ghost/api/admin/members/`,
      {
        headers: { Authorization: `Ghost ${GHOST_ADMIN_KEY}` },
        params: { filter: `id:'${session.sub}'`, fields: "id,email,name" }
      }
    );

    const member = ghostResp.data?.members?.[0];
    if (!member) return void res.status(404).send("Ghost member not found");

    // Build Discourse return payload
    const identity = new URLSearchParams({
      nonce,
      external_id: member.id,
      email: member.email,
      username: (member.name || member.email.split("@")[0]).replace(/\s+/g, "_"),
      name: member.name || "",
      // Optional: add_groups, avatar_url, suppress_welcome_message, etc.
    });

    const b64 = Buffer.from(identity.toString(), "utf8").toString("base64");
    const returnSig = signHmac(b64);
    const redirectUrl = `${DISCOURSE_URL}/session/sso_login?sso=${encodeURIComponent(b64)}&sig=${returnSig}`;

    core.logger.info(`SSO OK → redirecting to Discourse: ${redirectUrl}`);
    return void res.redirect(302, redirectUrl);
  } catch (err) {
    core.logger.error({ err }, "SSO handler error");
    return void res.status(500).send("Unexpected error in SSO handler");
  }
};

// IMPORTANT: register SSO route BEFORE other catch-alls
app.get("/discourse/sso", discourseSSOHandler);

// Keep your existing internal routes after SSO
const routingManager = new RoutingManager();
routingManager.addAllRoutes(app);

// ------------------------- start server -------------------------

app.listen(config.port, "0.0.0.0", () => {
  core.logger.info(`Listening on http://0.0.0.0:${config.port}`);
});
