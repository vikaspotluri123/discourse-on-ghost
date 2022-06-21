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
echo "import('@potluri/discourse-on-ghost/dist/targets/node.js');" > index.js
```

### Step 3: Configure DoG

The `.env` file you created contains the information needed to make DoG run. Refer to the [configuration documentation](./configuration) for in-depth information about each variable.

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
WorkingDirectory=/path/to/discourse-on-ghost
User=ghost # This might be different for `obscure` mode
Environment="NODE_ENV=production"
ExecStart=/path/to/node index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

1. Fill in the example, and save to `/lib/systemd/system/discourse_on_ghost.service`
1. run `sudo systemctl daemon-reload`
1. run `sudo systemctl enable discourse_on_ghost.service`
1. run `sudo systemctl start discourse_on_ghost.service`

*[SSO]: Single Sign On
*[DoG]: Discourse on Ghost
