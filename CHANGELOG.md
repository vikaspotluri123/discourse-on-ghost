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
