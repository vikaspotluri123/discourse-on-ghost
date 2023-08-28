---
layout: default
title: Local Setup
---

# Setting up Discourse on Ghost Locally

This document describes getting a local stack of Ghost + Discourse + DoG setup locally so you can test out and develop the integration.

Note: these instructions assume MacOS or Linux distributions, and are compiled from offical docs of the respective components.

When setting all this up, I found it useful to have everything alongside each other for easy access. For example:

```
├── working_directory
│   ├── ghost
│   ├── discourse
│   ├── discourse-on-ghost
```

## 1. Install Ghost Locally

Install [Ghost-CLI](https://ghost.org/docs/ghost-cli/)

```zsh
npm install ghost-cli@latest -g
```

Install Ghost

In your terminal, cd into the `ghost` directory (diagrammed above) and run the install command:

```zsh
ghost install local
```

Once the install is finished you’ll be able to access your new site on <http://localhost:2368> and <http://localhost:2368/ghost> to access Ghost Admin.

The official docs can be found here: <https://ghost.org/docs/install/local/>

## 2. Install Discourse Locally with Docker

Step 1. Install Docker

Step 2. Start container

Clone Discourse repository to your local device. Perform the following from the working directory in the diagram above:

```zsh
git clone https://github.com/discourse/discourse.git discourse
cd discourse

d/boot_dev --init
    # wait while:
    #   - dependencies are installed,
    #   - the database is migrated, and
    #   - an admin user is created (you'll need to interact with this)

# In one terminal:
d/rails s

# And in a separate terminal
d/ember-cli
```

Then open a browser on <http://localhost:4200> and voila!, you should see Discourse.

For more details, see offical docs: <https://meta.discourse.org/t/install-discourse-for-development-using-docker/102009>

## 3. Install Discourse on Ghost locally

From the root of your working directory:

Step 1. Install DoG

```zsh
git clone https://github.com/vikaspotluri123/discourse-on-ghost.git discourse-on-ghost

# Install dependencies
cd discourse-on-ghost
yarn install
```

Step 2. Set up DoG `.env`

Setup your `.env` based on the [configuration guide](https://github.vikaspotluri.me/discourse-on-ghost/configuration/). If this is your first time setting up DoG, I also recommend going through the excellent [Integrating Ghost SSO With Discourse Forum](https://linuxhandbook.com/ghost-sso-discourse/) on Linux Handbook along with the configuration guide.

Notes:

- For testing locally, make sure `DOG_DISCOURSE_URL` points to `localhost` rather than `127.0.0.1`

Step 3: Start DoG

Once your .env file is setup correctly, you can start DoG, from within your `discourse-on-ghost` directory:

```zsh
yarn dev
```

If everything went well, you should see something like:

```zsh
User ~/Sites/discourse-on-ghost-dev (master)$ yarn dev
yarn run v1.22.17
$ node scripts/dev.js
Watching for changes...
[2023-08-07 19:34:55] INFO Listening on http://127.0.0.1:3286
```

Step 4: Setup ghost session dev-proxy

The following assumes you are testing the `session` mode (rather than `jwt`) up for DoG.

Head over to your `ghost` folder.

Open `current/core/boot.js` and insert the following around line 483, immediately after `const rootApp = require('./app')();`

```javascript
const dog = await import("/path-to-working-directory/discourse-on-ghost-mp/dist/targets/dev-proxy.js");
await dog.load("/path-to-working-directory/discourse-on-ghost-mp/dist/", rootApp);
```

The final hack should look something like this:

```javascript
// Step 2 - Start server with minimal app in global maintenance mode
debug("Begin: load server + minimal app");
const rootApp = require("./app")();

const dog = await import("/path-to-working-directory/discourse-on-ghost-mp/dist/targets/dev-proxy.js");
await dog.load("/path-to-working-directory/discourse-on-ghost-mp/dist/", rootApp);
```

Save the file and restart Ghost:

```zsh
ghost restart
```

If Ghost starts up with out complaining, you can start testing the integration.

## Notes on Testing

1. To fully test, DoG, you'll want to have your local Ghost installation be able to send emails. There are many ways to do this but it's not the scope of this documentation.
2. As you are testing, you can check the DoG terminal (step 3 above) for output.
3. If you are testing logging in from Discourse, and redirecting back to page on Discourse where you logged in from, please see [this note](https://github.com/vikaspotluri123/discourse-on-ghost/discussions/80#discussioncomment-6726220) on some complexities around redirect urls.
