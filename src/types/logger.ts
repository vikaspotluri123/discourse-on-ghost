type AvailableLoggingMethods = 'trace' | 'debug' | 'info' | 'warn' | 'error';
export type Logger = {
	[k in AvailableLoggingMethods]: (...args: any[]) => void;
};
