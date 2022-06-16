export interface MinimalGroup {
	name: string;
	niceName: string;
}

export interface DiscourseGroup {
	id: number;
	name: string;
	full_name: string;
	automatic: boolean;
	mentionable_level: number;
	visibility_level: number;
	members_visibility_level: number;
}

export interface DiscourseSSOUser {
	nonce?: string;
	name?: string;
	add_groups?: string;
	email: string;
	external_id: string;
	avatar_url: string;
}

export interface DiscourseSSOResponse extends DiscourseSSOUser {
	nonce: string;
}
