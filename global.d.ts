declare module '@tryghost/errors' {
	interface GhostErrorOptions {
		id?: string;
		statusCode?: number;
		errorType?: string;
		message?: string;
		level?: string;
		context?: any;
		help?: any;
		errorDetails?: any;
		code?: string;
		property?: string;
		redirect?: string;
		hideStack?: boolean;
		err?: GhostError;
	}

	interface GhostError extends Error {}

	interface GhostErrorConstructor {
		new(options: GhostErrorOptions): GhostError;
		(options: GhostErrorOptions): GhostError;
	}

	type KnownGhostErrors = 'InternalServerError' | 'IncorrectUsageError' | 'NotFoundError' | 'BadRequestError' | 'UnauthorizedError' | 'NoPermissionError' | 'ValidationError' | 'UnsupportedMediaTypeError' | 'TooManyRequestsError' | 'MaintenanceError' | 'MethodNotAllowedError' | 'RequestNotAcceptableError' | 'RequestEntityTooLargeError' | 'TokenRevocationError' | 'VersionMismatchError' | 'DataExportError' | 'DataImportError' | 'EmailError' | 'ThemeValidationError' | 'DisabledFeatureError' | 'UpdateCollisionError' | 'HostLimitError' | 'HelperWarning' | 'PasswordResetRequiredError' | 'UnhandledJobError' | 'NoContentError' | 'ConflictError' | 'MigrationError';

	const defaultExport: {
		[error in KnownGhostErrors]: GhostErrorConstructor;
	};

	export default defaultExport;
}

declare module '@tryghost/logging' {
	type GhostLoggingMethods = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

	const defaultExport: {
		[k in GhostLoggingMethods]: (...args: any[]) => void
	};

	export default defaultExport;
}

declare module '@tryghost/admin-api' {
	type WithMeta<T> = T extends string
		? Record<T | 'meta', Record<string, unknown>>
		: T & {meta: Record<string, unknown>};
	type Action<Key extends string, AllowedDataTypes extends string = string, Returns = WithMeta<Key>> = (
		data: Partial<Record<AllowedDataTypes, unknown>>, query: Record<string, string>
	) => Promise<Returns>;

	interface ResourceActions<Key extends string> {
		read: Action<Key, 'id' | 'email' | 'slug', Record<string, unknown>>;
		edit: Action<Key>;
		add: Action<Key>;
		del: Action<Key, 'id' | 'email', unknown>;
		browse(query: Record<string, string>): Promise<WithMeta<Array<Record<string, unknown>>>>;
	}

	interface GhostAdminApiClass {
		members: ResourceActions<'members'>;
	}

	interface GhostAdminApiConstructorOptions {
		url: string;
		key: string;
		version: 'v5.0';
	}

	const GhostAdminApi: {
		(options: GhostAdminApiConstructorOptions): GhostAdminApiClass;
		new(options: GhostAdminApiConstructorOptions): GhostAdminApiClass;
	};

	export default GhostAdminApi;
}

declare module '@tryghost/admin-api/lib/token.js' {
	const token: (key: string, audience: string | string[]) => string;
	export default token;
}
