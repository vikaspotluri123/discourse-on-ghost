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
