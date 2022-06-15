export interface GhostMember {
	uuid: string;
	email: string;
	name: string | null; // eslint-disable-line @typescript-eslint/ban-types
	firstname: string | null; // eslint-disable-line @typescript-eslint/ban-types
	paid: boolean;
	subscriptions: unknown[];
	avatar_image: string;
}

export interface GhostTier {
	id: string;
	active: boolean;
	created_at: string;
	updated_at: string;
	name: string;
	slug: string;
	description: string;
	type: 'paid' | 'free';
	visibility: 'public' | 'none';
	welcome_page_url?: string;
	monthly_price_id: string;
	yearly_price_id: string;
}

export interface GhostMemberWithTiers extends GhostMember {
	tiers: GhostTier[];
}
