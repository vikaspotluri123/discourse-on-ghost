import {type NextFunction, type Request, type Response} from 'express';
import errors from '@tryghost/errors';
import {Logger} from '../types/logger.js';
import {type MemberRemoved, type MemberUpdated} from '../types/ghost.js';
import {MemberSyncService} from '../services/member-sync.js';
import {type Dependency, inject} from '../lib/injector.js';
import {Configuration, type ConfigurationType} from '../types/config.js';
import {IsomorphicCore, type IsomorphicCoreType} from '../types/isomorph.js';
import {Fifo} from '../lib/fifo.js';

type SafeMemberRemoved = MemberRemoved['member']['previous'] & {id: string};
type DeleteHandler = (payload: SafeMemberRemoved) => Parameters<MemberSyncService['queue']>;

export function parseSignature(signature: string) {
	const response: Record<string, string> = {};
	const tokens = signature.split(/, ?/);
	for (const token of tokens) {
		const [key, value] = token.split('=');
		response[key] = value;
	}

	return response;
}

type MaybeKey = ReturnType<IsomorphicCoreType['crypto']['secretToKey']> | undefined;

const TIMESTAMP_STORE_SIZE = 64;

export class GhostWebhookController {
	private readonly core = inject(IsomorphicCore);
	private readonly logger = inject(Logger);
	private readonly _memberSyncService = inject(MemberSyncService);
	private readonly _webhookVersion: ConfigurationType['ghostWebhooksSecretVersion'];
	private readonly _deletedSecret: MaybeKey;
	private readonly _updatedSecret: MaybeKey;
	private	readonly _seenTimestamps = new Fifo(TIMESTAMP_STORE_SIZE);

	constructor() {
		const {ghostWebhooksSecretVersion, ghostMemberUpdatedSecret, ghostMemberDeletedSecret} = inject(Configuration);
		this._webhookVersion = ghostWebhooksSecretVersion;
		this._updatedSecret = ghostMemberUpdatedSecret ? this.core.crypto.secretToKey(ghostMemberUpdatedSecret) : undefined;
		this._deletedSecret = ghostMemberDeletedSecret ? this.core.crypto.secretToKey(ghostMemberDeletedSecret) : undefined;
	}

	memberUpdated = async (request: Request, response: Response, next: NextFunction) => {
		this.logger.info('Processing member updated event');
		if (!await this.verifyWebhook(this._updatedSecret, request, response)) {
			return;
		}

		const body: MemberUpdated = request.body as unknown as MemberUpdated;

		if (!body.member?.current.id) {
			next(new errors.BadRequestError({message: 'Missing member ID'}));
			return;
		}

		const {id, uuid, tiers} = body.member.current;
		if (this._memberSyncService.has(id)) {
			response.status(202).json({message: 'Syncing member'});
			return;
		}

		if (!tiers) {
			this._memberSyncService.queue(id, 'syncGroups', id);
			response.status(202).json({message: 'Syncing member'});
			return;
		}

		this._memberSyncService.queue(id, 'setDiscourseGroupsFromTiers', uuid, tiers);
		response.status(202).json({message: 'Syncing member'});
	};

	deleteController(deleteAction: Dependency<typeof Configuration>['ghostMemberDeleteDiscourseAction']) {
		if (deleteAction === 'anonymize') {
			return this.createWrappedDeleteHandler(member => [member.id, 'anonymizeDiscourseUser', member.uuid]);
		}

		if (deleteAction === 'suspend') {
			return this.createWrappedDeleteHandler(member => [member.id, 'suspendDiscourseUser', member.uuid]);
		}

		if (deleteAction === 'sync') {
			return this.createWrappedDeleteHandler(member => [member.id, 'setDiscourseGroupsFromTiers', member.uuid, []]);
		}

		if (deleteAction === 'delete') {
			return this.createWrappedDeleteHandler(member => [member.id, 'deleteDiscourseUser', member.uuid]);
		}

		return undefined;
	}

	private createWrappedDeleteHandler(handler: DeleteHandler) {
		const secret = this._deletedSecret;
		return async (request: Request, response: Response, next: NextFunction) => {
			this.logger.info('Processing member removed event');
			if (!await this.verifyWebhook(secret, request, response)) {
				return;
			}

			const body: MemberRemoved = request.body as unknown as MemberRemoved;

			if (!body.member?.previous.id) {
				next(new errors.BadRequestError({message: 'Missing member ID'}));
				return;
			}

			// @ts-expect-error Handler returns Parameters<queue> which is what we're calling `queue` with
			this._memberSyncService.queue(...handler(body.member.previous as SafeMemberRemoved));
			response.status(202).json({message: 'Syncing member'});
		};
	}

	/**
	 * Verifies the signature of a webhook request.
	 * @param secret - the webhook secret. If empty, the webhook is considered valid.
	 * @returns if the webhook is valid.
	 * @throws never
	 */
	private async verifyWebhook(secret: MaybeKey, request: Request, response: Response) {
		if (!secret) {
			return true;
		}

		const signature = request.headers['x-ghost-signature'];
		if (!signature || typeof signature !== 'string') {
			response.status(400).json({message: 'Missing signature'});
			return false;
		}

		const unsafeParsedSignature = parseSignature(signature);

		// eslint-disable-next-line prefer-object-has-own
		if (!Object.hasOwnProperty.call(unsafeParsedSignature, 'sha256') || !Object.hasOwnProperty.call(unsafeParsedSignature, 't')) {
			response.status(400).json({message: 'Invalid signature'});
			return false;
		}

		const {t: timestamp, sha256} = unsafeParsedSignature as Record<'sha256' | 't', string>;
		let bodyToSign = '';

		// Avoid replays - Fifo#add returns true if a value was added (not seen before)
		// Note: we keep a pretty small history (`TIMESTAMP_STORE_SIZE`)
		if (!this._seenTimestamps.add(timestamp)) {
			// The request should have been/is being handled, the sender shouldn't retry it
			response.status(204).end();
			return false;
		}

		switch (this._webhookVersion) { // eslint-disable-line @typescript-eslint/switch-exhaustiveness-check
			// First implementation of webhooks - timestamp is not included in signature
			case '1': {
				bodyToSign = JSON.stringify(request.body);
				break;
			}

			// Second implementation - timestamp is included in the signature
			case '2': {
				bodyToSign = `${JSON.stringify(request.body)}${timestamp}`;
				break;
			}

			default: {
				response.status(500).json({message: 'Invalid server configuration'});
				this.logger.error(new errors.IncorrectUsageError({
					message: `Unable to handle webhook verification version ${this._webhookVersion}`,
				}));
				return false;
			}
		}

		let valid: boolean;

		try {
			valid = await this.core.crypto.verify(await secret, sha256, bodyToSign);
		} catch {
			response.status(500).json({message: 'Unable to verify signature'});
			return false;
		}

		if (!valid) {
			response.status(400).json({message: 'Invalid signature'});
			return false;
		}

		return true;
	}
}
