import process from 'node:process';
import {config as loadEnv} from 'dotenv';
import {deferGetConfig} from '../services/config.js';
import {bootstrapInjector} from '../services/dependency-injection.js';
import {core, envToConfigMapping} from './shared-node.js';

loadEnv();

export const config = bootstrapInjector(core, deferGetConfig(process.env, envToConfigMapping));
