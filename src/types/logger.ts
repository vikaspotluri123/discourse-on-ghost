import {createInjectionToken} from '../lib/injector.js';

type AvailableLoggingMethods = 'trace' | 'debug' | 'info' | 'warn' | 'error';
type LoggerType = Record<AvailableLoggingMethods, (...arguments_: any[]) => void>;

export const Logger = createInjectionToken<LoggerType>('logger');
