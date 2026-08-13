/**
 * ESM wrapper for state.js module
 * Re-exports the CommonJS module for ESM consumers
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const module_export = require('./state.js');

export default module_export;
export const * = module_export;
