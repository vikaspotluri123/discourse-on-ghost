# 0.3.0

 - :sparkles: add support for verifying Ghost webhooks
 - :sparkles: add `check` target [(docs)](https://github.vikaspotluri.me/discourse-on-ghost/configuration/checker/)
 - :sparkles: list all suggested configuration options when config validation fails
 - :art: improve error handling in first run target
 - Several documentation updates

New [Configuration](https://github.vikaspotluri.me/discourse-on-ghost/configuration/) Options:

 - DOG_GHOST_MEMBER_WEBHOOKS_SECRET_VERSION
 - DOG_GHOST_MEMBER_UPDATED_WEBHOOK_SECRET
 - DOG_GHOST_MEMBER_DELETED_WEBHOOK_SECRET

# 0.2.2-beta.0

 - :bug: fix session redirect not including auth params

# 0.2.1

 - :bug: fix crash when authenticating a member with subscriptions that don't map to a tier
 - :art: improve error log for invalid configuration settings

# 0.2.0

_Official release, no changes from v0.2.0-beta.3_

 - [BREAKING] :sparkles: use member JWT for auth instead of uuid + email
   - `DOG_DISCOURSE_SSO_TYPE` now takes `session` in place of `secure`, and `jwt` in place of `obscure`
   - If you're using `obscure` auth, the example landing page has been updated - please review and make any necessary changes
   - `DOG_OBSCURE_GHOST_SSO_PAGE` has been renamed to `DOG_JWT_GHOST_SSO_PAGE`
 - :bug: fix Ghost URL resolution
 - Remove `x-powered-by: express` header in responses

# 0.2.0-beta.3

 - add CORS headers to SSO POST request
 - fix: jwt-auth should send a GET request, not POST
 - fix typo in jwt-auth template response handler
 - remove test code in JWT key locator

# 0.2.0-beta.2

 - fix DOG_DISCOURSE_SSO_TYPE deprecation message not containing the actual environment variable
 - fix SSO JWT response type
 - add cors to SSO JWT URL
 - disable x-powered-by header

# 0.2.0-beta.1

 - config: run transformer for enums

# 0.2.0-beta.0

 - [BREAKING] :sparkles: use member JWT for auth instead of uuid + email
 - :bug: fix Ghost URL resolution

# 0.1.6

 - docs: add more information surrounding integrating Discourse with Ghost
 - add standalone "sync tiers" script

# 0.1.5

 - config: add support for (optional) Ghost Admin URL

# 0.1.4

 - Add DOG_OBSCURE_GHOST_SSO_PAGE to example env
 - Fix obscure sso redirect using the DoG domain instead of the Ghost domain
 - Add upgrading instructions

# 0.1.3

 - Core: Fix catch-22 for obscure auth
 - Docs: fix instructions around discourse connect
 - Landing Pages: Use a more clear example for the URL, and fix broken routing
 - Landing Pages: Add member check to obscure auth landing page

# 0.1.2

 - no user facing changes in this release
 - add scripts to enable release

# 0.1.1

 - No user facing changes in this release
 - Update dependencies
 - Add release workflow

# 0.1.0

 - Initial Release
