---
layout: default
title: Home
nav_order: 0
---
# Ghost, meet Discourse.

**Discourse on Ghost** is the glue to seamlessly integrate Discourse into your Ghost site.

- Make Ghost the source of truth for memberships by using it as the SSO Provider for Discourse
- Segment and restrict Discourse discussions based on Ghost Membership tiers


[Get started now](#getting-started){: .btn .btn-primary .fs-5 .mt-4 .mb-4 .mb-md-0 .mr-2 }
[View it on GitHub]({{ site.aux_links.GitHub }}){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Getting Started

_Feel like something's missing? [File an issue](https://github.com/vikaspotluri123/discourse-on-ghost/issues)!_

### Step 1: Pick your Path

Discourse on Ghost has 2 methods to authenticate users:

1. Secure (recommended): Mirrors the authentication that Ghost uses to authenticate members.
	- Requires DoG to sit on the same domain (not a subdomain) as your Ghost site
2. Obscure: Uses the user's email address and unique Ghost identifier to authenticate members.
	- Allows Discourse on Ghost to sit on any domain (including a subdomain)
	- Relies on [security through obscurity](https://en.wikipedia.org/wiki/Security_through_obscurity) (since it's relatively difficult, though not impossible, to guess both the unique identifier and email address of a member)

Both methods have the same installation instructions, but your configuration will be slightly different.

### Step 2: Install on your Server

A few things to note:
- DoG requires node.js (v16 LTS) and npm to be installed, which is compatible with Ghost.
- DoG will work on Debian-based Linux distributions, but support for other flavors or Operating Systems (such as Mac OS or Windows) is not guaranteed.

```bash
# Create the directory where DoG will live
mkdir discourse-on-ghost
cd discourse-on-ghost
# Install the DoG dependency
npm install @potluri/discourse-on-ghost
# Create the environment variables file
cp node_modules/@potluri/discourse-on-ghost/.env.example .env
# Create the entrypoint script
echo "import('@potluri/discourse-on-ghost/build/targets/node.js');" > index.js
```

### Step 3: Configure DoG

The `.env` file you created contains the information needed to make DoG run. Refer to the [configuration documentation](./configuration) for in-depth information about each variable.

Once you configure DoG, make sure all the Ghost Tiers are tracked as Discourse Groups. You should run this script whenever you change add/remove tiers.

```bash
node node_modules/@potluri/discourse-on-ghost/build/targets/first-run-node.js
```

### Step 4: Set up NGINX


#### For standalone installations (`obscure` mode)

_This section isn't well documented. PRs are welcome!_

You'll need to install NGINX with SSL (acme.sh is a good place to start), and configure it to serve traffic from your domain.

#### For existing Ghost installations (`secure` mode)

Modify the NGINX configuration that Ghost automatically created. You can find the file in `/etc/nginx/sites-enabled/your.domain-ssl.conf`.

Add the following before the last line (should be a `}`):

```nginx
location {SUB_DIR}/ghost/api/external_discourse_on_ghost {
	proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	proxy_set_header X-Forwarded-Proto $scheme;
	proxy_set_header X-Real-IP $remote_addr;
	proxy_set_header Host $host;
	proxy_pass http://127.0.0.1:{PORT_NAME};
}
```

- Replace `{SUB_DIR}` with your Ghost subdirectory, if you have one. If you don't, just remove it.
- Replace `{PORT_NAME}` with the port that DoG will listen (DOG_PORT, defaults to 3286). Don't remove the `;` at the end!

Save the file, and run `sudo nginx -s reload` to get NGINX to safely pick up the changes.

<details>
<summary markdown="span">Example DoG + Ghost NGINX configuration</summary>

```nginx
server {
	listen 443 ssl http2;
	listen [::]:443 ssl http2;

	server_name example.com;
	root /var/www/ghost/system/nginx-root;

	ssl_certificate /etc/letsencrypt/example.com/fullchain.cer;
	ssl_certificate_key /etc/letsencrypt/example.com/example.com.key;
	include /var/www/ghost/system/files/ssl-params.conf;

	location / {
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header Host $http_host;
		proxy_pass http://127.0.0.1:2369;
	}

	location /ghost/api/external_discourse_on_ghost {
		proxy_pass http://127.0.0.1:3286;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header Host $http_host;
	}

	location ~ /.well-known {
		allow all;
	}

	client_max_body_size 50m;
}
```
</details>

### Step 5: Configure a process manager

Process managers are used to run an application in the background. They try to ensure that the application is running, even after crashing.

#### Systemd

Example service file (based on Ghost):
```systemd
[Unit]
Description=Discourse on Ghost
Documentation=https://github.vikaspotluri.me/discourse-on-ghost

[Service]
Type=simple
# Don't forget to update this!
WorkingDirectory=/path/to/discourse-on-ghost
# The user might be different for `obscure` mode
User=ghost
Environment="NODE_ENV=production"
# You can get your node path by running `which node`
ExecStart=/path/to/node index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

1. Fill in the example, and save to `/lib/systemd/system/discourse_on_ghost.service`
1. run `sudo systemctl daemon-reload`
1. run `sudo systemctl enable discourse_on_ghost.service`
1. run `sudo systemctl start discourse_on_ghost.service`
1. confirm you did everything correctly:
    - run `sudo systemctl status discourse_on_ghost.service`
    - The output should contain `Loaded: loaded`, and `Active: active (running)`

*[SSO]: Single Sign On
*[DoG]: Discourse on Ghost

### Step 6: Configure Discourse

_Note: You should already have created an API key for DoG in the configuration step_

Head to the *Login Settings* of your Discourse installation (`https://your.forum/admin/site_settings/category/login`)

Scroll to the option `enable discourse connect`

1. Before you can enable Discourse Connect (SSO), you need to specify the URL. Enter the Discourse Connect URL in the `discourse connect url` field
  - This will be `https://your.ghost.blog/subdir/ghost/api/external_discourse_on_ghost/sso`. `subdir` will be the path your blog is installed on - if you don't have a path, remove it from the url.
  - For `obscure` mode, you need to set up a landing page at `DOG_OBSCURE_GHOST_SSO_PAGE` as defined in the configuration
1. Check the `enable discourse connect` option (above `discourse connect url`)
1. Enter the `DOG_DISCOURSE_SHARED_SECRET` value from your configuration into `discourse connect secret`

Once you enable Discourse Connect, forum members will only be able to log in by being a member in Ghost. Forum admins can log in using a magic link via `https://your.forum/u/admin-login`

#### Allow longer usernames

Ghost's default tier names can get pretty long, and this can cause Discourse Groups to fail being created. You might want to increase the `max username length` setting to 30 since username and group lengths are both controlled by this. Here's a [Discourse discussion for reference](https://meta.discourse.org/t/group-name-character-limitation/31229)

### Step 7: Configure Ghost Webhooks

Head to the *Integrations* page of your Ghost installation (`https://your.blog/ghost/#/settings/integrations/`)

Go to your DoG integration (should have been created in the configuration step)

Scroll to the `Webhooks` section

Add your `Member Updated` Webhook
- Name can be whatever you want!
- Event should be `Member Updated`
- Target URL should be `https://your.blog/ghost/api/external_discourse_on_ghost/DOG_GHOST_MEMBER_UPDATED_WEBHOOK_ID` (replace `DOG_GHOST_MEMBER_UPDATED_WEBHOOK_ID` with the config value)

Add your `Member Deleted` Webhook
- Name can be whatever you want!
- Event should be `Member Deleted`
- Target URL should be `https://your.blog/ghost/api/external_discourse_on_ghost/DOG_GHOST_MEMBER_DELETED_WEBHOOK_ID` (replace `DOG_GHOST_MEMBER_DELETED_WEBHOOK_ID` with the config value)

### Step 8: Create private categories

Following the creation of one or more Discourse Groups by DoG in order to coincide with any tiers existent on your Ghost site, the next step is to create `Private Categories` for each Discourse Group using category permission / security settings. (Categories are collections of Topics, Topics being the discussion threads associated with posts on your Ghost site.) Here's a [Discourse video for reference](https://meta.discourse.org/t/how-to-create-private-categories-using-category-permission-security-settings/87678), or follow the steps below

1. Navigate to the `Categories` section, click on the wrench near the top-right, and select `New Category`
1. Type in the name of the Category, and if desired change the badge colour
1. Click on the `Security` tab, then select the Group or Groups you'd like to have access to this Category
1. You'll see any Group(s) you've selected in the Group section, as well as the default `everyone` Group. But as you likely don't want "everyone" to have access to the members-only Category, delete the `everyone` Group
1. As you don't want to bestow upon members the ability to create Topics in said Category, once you've deleted the `everyone` Group you will see that the `Create` selection boxes for any Groups you've selected are now accessible, which you can proceed to deselect. Having done all that, click on `Save Category`.

Repeat the above process for each tier you've created in Ghost and thus their associated Group(s) in Discourse.

### Step 9: You're done with installation and setup!

It might have been a journey, but you made it 🎉 Test out Discourse SSO, and member tier sync, it should work now!

### Step 10: Changing a topic's category (for tiers usage)

When new posts are published on Ghost they automatically have an associated Topic created on Discourse via the [embed](https://ghost.org/integrations/discourse/) added to one's Ghost theme. Each Topic is by default slotted into the public "Uncategorized" Category (or whichever singular category has been selected under the `Post to Category` portion on the Discourse Embedding page (`https://your.forum/admin/customize/embedding`)). At the current time Discourse is unable to set the unique category for an embedded post via the embed (meaning it can't automatically detect the tier and thus associate that with its proper Category) and so defaults to the aforementioned singular option. The recourse is to manually move new posts to their correct category immediately after they get published to Discourse.

1. Navigate to the new post
1. Click the pencil icon at the end of the title
1. Change the category
1. Click the checkmark to save

## Upgrading

To update your DoG instance:

1. Determine if there's a new release by viewing the [Releases page](https://github.com/vikaspotluri123/discourse-on-ghost/releases) on GitHub
1. Review the changes. Just like after a flight, please use caution when opening overhead bins, as feature changes and deprecations might smack you in the face.
1. Make sure you're in the installation directory - `cd /path/to/discourse-on-ghost`
1. Update the module - `npm update`
1. Make any required config changes based on the release notes
1. Restart the process. If you're using systemd, run `sudo systemctl restart discourse_on_ghost.service`
