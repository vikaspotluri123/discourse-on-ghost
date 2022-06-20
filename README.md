# Discourse on Ghost

> Add Ghost-based SSO to Discourse

Discourse is a powerful forum and commenting platform. Ghost is a powerful publishing platform. _Discourse on Ghost_ marries the platforms to create a more cohesive membership experience.

- Use Ghost as the SSO (Single Sign On) Provider for Discourse, so Ghost serves as your central member repository
- Segment and Lock user discussions based on Ghost Membership tiers

## Getting Started

### Pick your Path

Discourse on Ghost has 2 methods to authenticate users:

1. `Secure` (recommended) - Uses the membership identification cookie on your Ghost site to authenticate users
	- This requires Discourse on Ghost to sit on the same domain as your Ghost site
2. `Obscure` - Uses the user's email address and unique Ghost identifier to authenticate users
	- Allows Discourse on Ghost to sit on any domain
	- Relies on the fact that it's relatively difficult to guess both a unique identifier and email address combination. This isn't _insecure_ per-se, but the `secure` method is recommended.

Both methods have the same installation instructions, but your configuration will be slightly different.

### Install on your Server

```bash
# Discourse on Ghost requires node.js and NPM to be installed, just like Ghost
# Discourse on Ghost is designed to run on Debian-based Linux distributions;
# Support for other distributions or operating systems is not guaranteed

mkdir discourse-on-ghost
cd discourse-on-ghost
npm install https://github.com/vikaspotluri123/discourse-on-ghost
cp node_modules/discourse-on-ghost/.env.example .env
echo "import('discourse-on-ghost/dist/targets/node.js');" > index.js
# Edit .env file to configure your Discourse on Ghost instance - config keys are documented below
nano .env
# Set up NGINX - see Setting up NGINX section
# TODO: Set up NGINX
# This runs the app in your terminal; you'll need to configure a process manger like PM2 or systemd to run it in the background
node index.js
```

## Configuration

_Discourse on Ghost is abbreviated as DoG for succinctness._

Here are the configuration variables that you need to set in your `.env` file, using `{key}="{value}"` syntax.:

| Name | Type | Default Value (Yes=required) | Description |
| ---- | ---- | ------------------ | ----------- |
|DOG_HOSTNAME | IP Address | 127.0.0.1 | The hostname for DoG to listen |
|DOG_PORT | Port | 3286 | The port for DoG to listen |
|DOG_GHOST_URL | URL | Yes | The URL of your Ghost installation |
|DOG_DISCOURSE_SHARED_SECRET | String | Yes | The shared secret for Discourse SSO |
|DOG_GHOST_ADMIN_TOKEN | String | Yes | Admin token for your Ghost installation |
|DOG_DISCOURSE_URL | URL | Yes | The URL of your Discourse installation |
|DOG_DISCOURSE_API_KEY | String | Yes | The API key for your Discourse installation |
|DOG_DISCOURSE_API_USER | Username | system | The user that's used when using the Discourse API |
|DOG_LOG_DISCOURSE_REQUESTS | Boolean | false | Whether to log requests made to Discourse. _There could be some PII in the logs_ |
|DOG_LOG_GHOST_REQUESTS | Boolean | false | Whether to log requests made to Ghost. _There could be some PII in the logs_ |
|DOG_GHOST_MEMBER_WEBHOOKS_ENABLED | Boolean | false | Whether to enable the Ghost member webhooks. This is used to sync membership tiers |
|DOG_GHOST_MEMBER_UPDATED_WEBHOOK_ID | String | Yes | The endpoint to listen for Ghost Member Updated webhooks. _Hint: if you leave it blank, DoG will suggest one for you!_ |
|DOG_GHOST_MEMBER_DELETED_WEBHOOK_ID | String | Yes | The endpoint to listen for Ghost Member Deleted webhooks. _Hint: if you leave it blank, DoG will suggest one for you!_ |
|DOG_GHOST_MEMBER_DELETE_DISCOURSE_ACTION | 'none', 'sync', 'suspend', 'anonymize', 'delete' | Yes | The action to take on Discourse when a Ghost member is deleted |
|DOG_DISCOURSE_SSO_TYPE | "obscure", "secure" | Yes | The type of SSO to use for Discourse (see `Pick your Path`) |
|DOG_SSO_NO_AUTH_REDIRECT | URL | {ghost_url}/#/portal/account | A custom landing page to redirect to if the user is not authenticated |
