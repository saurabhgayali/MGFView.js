/**
 * ESM wrapper for MGFView.js Core Library
 * Re-exports the CommonJS module for ESM consumers
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MGFViewCore = require('./index.js');

export const {
  MGFParser,
  Spectrum,
  SearchFilter,
  StatisticsPanel,
  ExportManager,
  MGFUtils,
  ViewerState,
  Plugin,
  PluginSystem,
  MirrorPlotPlugin,
  SimilarityPlugin,
  AnnotationPlugin,
  ComparisonPlugin,
  version,
  name,
  getVersion,
  getInfo
} = MGFViewCore;

export default MGFViewCore;
