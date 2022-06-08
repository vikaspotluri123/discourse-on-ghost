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
