---
layout: default
title: Home
nav_order: 0
---
# Discourse, meet Ghost.

**Discourse on Ghost** is the glue to seamlessly integrate Discourse into your Ghost site.

- Make Ghost the source of truth for memberships by using it as the SSO Provider for Discourse
- Segment and restrict Discourse discussions based on Ghost Membership tiers


[Get started now](#getting-started){: .btn .btn-primary .fs-5 .mt-4 .mb-4 .mb-md-0 .mr-2 }
[View it on GitHub]({{ site.aux_links.GitHub }}){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Getting Started


### Step 1: Pick your Path

Discourse on Ghost has 2 methods to authenticate users:

1. Secure (recommended): Mirrors the authentication that Ghost uses to authenticate members.
	- Requires DoG to sit on the same domain (not a subdomain) as your Ghost site
2. Obscure: Uses the user's email address and unique Ghost identifier to authenticate members.
	- Allows Discourse on Ghost to sit on any domain (including a subdomain)
	- Relies on [security through obscurity](https://en.wikipedia.org/wiki/Security_through_obscurity) (since it's relatively difficult, though not impossible, to guess both the unique identifier and email address of a member)

Both methods have the same installation instructions, but your configuration will be slightly different.

### Step 2: Install on your Server



```bash
# Discourse on Ghost requires node.js and NPM to be installed, just like Ghost
# Discourse on Ghost is designed to run on Debian-based Linux distributions;
# Support for other distributions or operating systems is not guaranteed

mkdir discourse-on-ghost
cd discourse-on-ghost
npm install https://github.com/vikaspotluri123/discourse-on-ghost
cp node_modules/discourse-on-ghost/.env.example .env
echo "import('discourse-on-ghost/dist/targets/node.js');" > index.js
```

### Step 3: Configure

The `.env` file you created contains the information needed to make DoG run. Refer to the [configuration documentation](./configuration) for more information.

*[SSO]: Single Sign On
*[DoG]: Discourse on Ghost
