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
  process.exit(1);
}

const app = express();
export { app };

app.disable("x-powered-by");
app.use(cookieParser());
app.use(useRequestLogging());

// ------------------------- ENV -------------------------
const getEnv = (k: string) => (process.env[k] ?? "").trim();
const SSO_SECRET = getEnv("DISCOURSE_SSO_SECRET");
const DISCOURSE_URL = getEnv("DISCOURSE_URL");
const GHOST_URL = getEnv("GHOST_URL");
const GHOST_ADMIN_KEY = getEnv("GHOST_ADMIN_API_KEY");
const SESSION_SECRET = getEnv("SESSION_SECRET");
const SESSION_COOKIE = "dog_member";
const SESSION_TTL_SECONDS = 10 * 60;

// ------------------------- Helpers -------------------------
const signHmac = (payloadBase64: string) =>
  crypto.createHmac("sha256", SSO_SECRET).update(payloadBase64).digest("hex");

function signCookie(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
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

// ------------------------- Healthcheck -------------------------
app.get("/health", (_req, res) => res.status(200).send("OK"));

// ------------------------- login-from-ghost -------------------------
const loginFromGhost: RequestHandler = async (_req: Request, res: Response) => {
  core.logger.info("Starting login-from-ghost route...");

  try {
    // Check env vars
    if (!GHOST_URL || !GHOST_ADMIN_KEY || !SESSION_SECRET) {
      core.logger.error({
        GHOST_URL,
        GHOST_ADMIN_KEY: GHOST_ADMIN_KEY ? "SET" : "MISSING",
        SESSION_SECRET: SESSION_SECRET ? "SET" : "MISSING",
      }, "Missing environment variables");
      return res.status(500).send("Server missing Ghost config");
    }

    core.logger.info(`Calling Ghost Admin API: ${GHOST_URL}/ghost/api/admin/members/`);

    // Fetch latest member
    const ghostResp = await axios.get(`${GHOST_URL}/ghost/api/admin/members/`, {
      headers: { Authorization: `Ghost ${GHOST_ADMIN_KEY}` },
      params: { limit: 1, order: "last_seen_at desc" },
    });

    core.logger.info("Ghost API response", {
      membersFound: ghostResp.data?.members?.length || 0,
    });

    const member = ghostResp.data?.members?.[0];
    if (!member) {
      core.logger.warn("No member found, redirecting to Ghost sign-in");
      return res.redirect(`${GHOST_URL}/#/portal/signin`);
    }

    core.logger.info("Member found", { id: member.id, email: member.email });

    // Create session payload
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

    core.logger.info("Session cookie set successfully");

    if (!DISCOURSE_URL) {
      core.logger.error("DISCOURSE_URL is missing");
      return res.status(500).send("Missing DISCOURSE_URL");
    }

    core.logger.info(`Redirecting user to Discourse: ${DISCOURSE_URL}`);
    return res.redirect(302, DISCOURSE_URL);

  } catch (err: any) {
    core.logger.error({ error: err?.response?.data || err.message }, "login-from-ghost failed");
    console.error(err);
    return res.status(500).send(`login-from-ghost failed: ${err.message}`);
  }
};

app.get("/login-from-ghost", loginFromGhost);

// ------------------------- discourse/sso -------------------------
const discourseSSOHandler: RequestHandler = async (req: Request, res: Response) => {
  core.logger.info("Starting discourse/sso handler...");

  try {
    if (!SSO_SECRET || !DISCOURSE_URL) {
      core.logger.error("Missing SSO_SECRET or DISCOURSE_URL");
      return res.status(500).send("Server misconfigured: missing SSO secret or forum URL");
    }

    const sso = req.query.sso as string | undefined;
    const sig = req.query.sig as string | undefined;
    if (!sso || !sig) return res.status(400).send("Missing sso or sig");

    const expected = signHmac(sso);
    if (expected !== sig) return res.status(403).send("Invalid SSO signature");

    const decoded = Buffer.from(sso, "base64").toString("utf8");
    const params = new URLSearchParams(decoded);
    const nonce = params.get("nonce");
    if (!nonce) return res.status(400).send("Invalid SSO payload: missing nonce");

    // Read signed cookie
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const session = token ? verifyCookie(token, SESSION_SECRET) : null;
    if (!session || session.exp <= Math.floor(Date.now() / 1000)) {
      core.logger.warn("Session missing or expired, redirecting back to login-from-ghost");
      return res.redirect(302, `${req.protocol}://${req.get("host")}/login-from-ghost`);
    }

    core.logger.info("Session validated", { session });

    // Verify member
    const ghostResp = await axios.get(`${GHOST_URL}/ghost/api/admin/members/`, {
      headers: { Authorization: `Ghost ${GHOST_ADMIN_KEY}` },
      params: { filter: `id:'${session.sub}'`, fields: "id,email,name" },
    });

    const member = ghostResp.data?.members?.[0];
    if (!member) return res.status(404).send("Ghost member not found");

    core.logger.info("Member validated", { id: member.id, email: member.email });

    // Build SSO payload
    const identity = new URLSearchParams({
      nonce,
      external_id: member.id,
      email: member.email,
      username: (member.name || member.email.split("@")[0]).replace(/\s+/g, "_"),
      name: member.name || "",
    });

    const b64 = Buffer.from(identity.toString(), "utf8").toString("base64");
    const returnSig = signHmac(b64);
    const redirectUrl = `${DISCOURSE_URL}/session/sso_login?sso=${encodeURIComponent(b64)}&sig=${returnSig}`;

    core.logger.info("SSO payload built, redirecting to Discourse", { redirectUrl });
    return res.redirect(302, redirectUrl);

  } catch (err: any) {
    core.logger.error({ error: err?.response?.data || err.message }, "SSO handler error");
    console.error(err);
    return res.status(500).send(`Unexpected error in SSO handler: ${err.message}`);
  }
};

app.get("/discourse/sso", discourseSSOHandler);

// ------------------------- Routing -------------------------
const routingManager = new RoutingManager();
routingManager.addAllRoutes(app);

app.listen(config.port, "0.0.0.0", () => {
  core.logger.info(`Listening on http://0.0.0.0:${config.port}`);
});
