---
layout: default
title: Configuration
---

<style>
h2 {
	word-break: break-all;
}

tr td:first-child {
	word-break: break-all;
}

@media (min-width: 66.5rem) {

}

@media (min-width: 800px) {
	.side-bar {
		max-width: 248px;
	}

	.main {
		margin-left: 248px;
		max-width: 1200px;
	}
}

@media (min-width: 1050px) {
	.side-bar {
		max-width: 350px;
	}

	.main {
		margin-left: calc((100% - 1064px) / 2 + 264px);
		max-width: 1200px;
	}
}

@media (min-width: 1250px) {
	.main {
		margin-left: 350px;
	}

	tr td:first-child {
		word-break: inherit;
	}

	.main {
		max-width: unset;
	}

	tbody {
		max-width: 1600px;
	}
}

</style>

# Configuring Discourse on Ghost

DoG has several configuration options which should be included in your `.env` file, using the `{key}="{value}"` syntax.

| Name | Type | Default Value (**Yes**=required) | Description |
| ---- | ---- | -------------------------------- | ----------- |
|DOG_HOSTNAME | IP Address | 127.0.0.1 | The hostname for DoG to listen |
|DOG_PORT | Port | 3286 | The port for DoG to listen |
|DOG_GHOST_URL | URL | **Yes** | The URL of your Ghost installation |
|DOG_DISCOURSE_SHARED_SECRET | string | **Yes**\* | The shared secret for Discourse SSO |
|DOG_GHOST_ADMIN_TOKEN | string | **Yes** | Admin token for your Ghost installation - [Ghost Docs](https://ghost.org/integrations/custom-integrations/) (needs to be an API+webhook integration) |
|DOG_DISCOURSE_URL | URL | **Yes** | The URL of your Discourse installation |
|DOG_DISCOURSE_API_KEY | string | **Yes** | The API key for your Discourse installation - `https://your.discourse.example/admin/api/keys`. User Level is `All Users`, and `Scope` is Global |
|DOG_DISCOURSE_API_USER | username | system | The username for the user that performs actions when using the Discourse API |
|DOG_LOG_DISCOURSE_REQUESTS | boolean | false | Whether to log requests made to Discourse. _There could be some user-specific information in the logs_ |
|DOG_LOG_GHOST_REQUESTS | boolean | false | Whether to log requests made to Ghost. _There could be some user-specific information  in the logs_ |
|DOG_GHOST_MEMBER_WEBHOOKS_ENABLED | boolean | false | Whether to enable the Ghost member webhooks. This is used to sync membership tiers |
|DOG_GHOST_MEMBER_UPDATED_WEBHOOK_ID | string | **Yes**\* | The endpoint to listen for Ghost Member Updated webhooks. |
|DOG_GHOST_MEMBER_DELETED_WEBHOOK_ID | string | **Yes**\* | The endpoint to listen for Ghost Member Deleted webhooks. |
|DOG_GHOST_MEMBER_DELETE_DISCOURSE_ACTION | [enum](#dog_ghost_member_delete_discourse_action) | **Yes** | The action to take on Discourse when a Ghost member is deleted |
|DOG_DISCOURSE_SSO_TYPE | [enum](#dog_discourse_sso_type) | **Yes** | The type of SSO to use for Discourse (see `Pick your Path`) |
|DOG_SSO_NO_AUTH_REDIRECT | URL | {ghost_url} /#/portal/account | A custom landing page to redirect to if the user is not authenticated |

*These values shared with either Discourse or Ghost. If you don't specify a value, DoG will suggest one for you.

## Enums

Some of the configuration options have a fixed set of values to choose how DoG behaves.

## DOG_GHOST_MEMBER_DELETE_DISCOURSE_ACTION

Configures how DoG responds to the `Member Deleted` Ghost event.

_Note_: The member won't be signed out of any Discourse sessions, but since Ghost is the SSO provider for Discourse, they won't be able to explicitly log in until they become a member again.

| Value         | Action Taken |
| ------------- | ------------ |
| **none**      | Do nothing |
| **sync**      | Remove the member from any Discourse Groups associated with a Ghost user |
| **suspend**   | Suspend the member's Discourse account |
| **anonymize** | Anonymize the member's Discourse account. Data will be retained, but not be associated with the member |
| **delete**    | Delete the member's Discourse account. All data will be deleted |

## DOG_DISCOURSE_SSO_TYPE

Configures how DoG handles SSO. Refer to the [Pick your Path](../#step-1-pick-your-path) section on the home page.

Supported values: **obscure**, or **secure**

*[SSO]: Single Sign On
*[DoG]: Discourse on Ghost
