<center>

# Discourse on Ghost
</center>

> Add Ghost-based SSO to Discourse

Discourse is a powerful forum and commenting platform. Ghost is a powerful publishing platform. _Discourse on Ghost_ marries the platforms to create a more cohesive membership experience.

- Use Ghost as the SSO (Single Sign On) Provider for Discourse, so Ghost serves as your central member repository
- Segment and Lock user discussions based on Ghost Membership tiers

## Sound intriguing?

Check out the docs! https://github.vikaspotluri.me/discourse-on-ghost/
# 🐶 Discourse on Ghost (DoG)

This is a middleware service for integrating [Discourse](https://discourse.org) with a [Ghost](https://ghost.org) blog using webhook and SSO routes.

Hosted live at: [https://dogffg.onrender.com](https://dogffg.onrender.com)

## 🧠 What It Does

- Accepts **Discourse webhooks** for user updates/deletes.
- Provides an **SSO login endpoint** for authenticating via Ghost.
- Hosts a **health check route** used by Render.
- Deploys automatically on new pushes to `main`.

---

## 🌐 Live Routes

| Route                    | Description                        |
|-------------------------|------------------------------------|
| `/health`               | Health check (Render requires it) |
| `/discourse/sso`        | Handles SSO from Discourse         |
| `/ghost/api/external_discourse_on_ghost/hook/:token` | Webhooks for Discourse events |
| `/`                     | (Optional) Welcome text if added   |

---

## 🧰 Tech Stack

- **Node.js** (v18+)
- **TypeScript**
- **Express.js**
- **ESM Modules**
- Hosted on [Render](https://render.com)

---

## 🛠 Setup (Dev)

To run locally:

```bash
npm install
npm run build
npm start
