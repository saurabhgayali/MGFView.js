/**
 * MGFView.js Core Library
 * 
 * Reusable mass spectrometry core for Node.js and browser environments
 * Provides MGF parsing, spectrum analysis, filtering, and data export
 * 
 * Usage in Node.js:
 *   const { MGFParser, Spectrum, SearchFilter, StatisticsPanel, ExportManager } = require('@saurabhgayali/mgfview');
 * 
 * Usage in browser:
 *   const MGFParser = window.MGFParser;
 *   const Spectrum = window.Spectrum;
 * 
 * @version 1.0.0
 * @license MIT
 */

// Determine if we're in dist/ or src/core/
const path = require('path');
const currentDir = __dirname;
const isInDist = currentDir.includes('dist');
const modulePath = isInDist ? './core/' : './';

// Import/require all core modules
// These can work in both Node.js and browser environments

// Core data structures and parsing
const MGFParser = require(modulePath + 'parser.js');
const Spectrum = require(modulePath + 'spectrum.js');

// Core analysis and filtering
const SearchFilter = require(modulePath + 'search.js');
const StatisticsPanel = require(modulePath + 'stats.js');
const ExportManager = require(modulePath + 'export.js');

// Utilities
const MGFUtils = require(modulePath + 'utils.js');

// Plugin system
const PluginModules = require(modulePath + 'plugin.js');
const { Plugin, PluginSystem, MirrorPlotPlugin, SimilarityPlugin, AnnotationPlugin, ComparisonPlugin } = PluginModules;

// State management
const ViewerState = require(modulePath + 'state.js');

// Library metadata
const version = '1.0.0';
const name = 'MGFView.js';

/**
 * Public API for reusable MGFView core
 * All components are Node.js compatible and browser-safe
 */
const MGFViewCore = {
  // Version info
  version,
  name,

  // Core classes for direct instantiation
  MGFParser,
  Spectrum,
  SearchFilter,
  StatisticsPanel,
  ExportManager,
  MGFUtils,
  ViewerState,

  // Plugin system
  Plugin,
  PluginSystem,
  MirrorPlotPlugin,
  SimilarityPlugin,
  AnnotationPlugin,
  ComparisonPlugin,

  /**
   * Get library info
   */
  getVersion() {
    return this.version;
  },

  getInfo() {
    return {
      name: this.name,
      version: this.version,
      components: [
        'MGFParser - Mascot Generic Format parser',
        'Spectrum - Individual spectrum data and methods',
        'SearchFilter - Advanced search and filtering',
        'StatisticsPanel - Statistical analysis',
        'ExportManager - Multi-format data export (JSON, CSV, MGF)',
        'MGFUtils - Utility functions',
        'ViewerState - State management',
        'Plugin/PluginSystem - Plugin architecture'
      ]
    };
  }
};

// For Node.js: Export the entire API
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MGFViewCore;
  // Also export individual classes for direct require
  module.exports.MGFParser = MGFParser;
  module.exports.Spectrum = Spectrum;
  module.exports.SearchFilter = SearchFilter;
  module.exports.StatisticsPanel = StatisticsPanel;
  module.exports.ExportManager = ExportManager;
  module.exports.MGFUtils = MGFUtils;
  module.exports.ViewerState = ViewerState;
  module.exports.Plugin = Plugin;
  module.exports.PluginSystem = PluginSystem;
  module.exports.MirrorPlotPlugin = MirrorPlotPlugin;
  module.exports.SimilarityPlugin = SimilarityPlugin;
  module.exports.AnnotationPlugin = AnnotationPlugin;
  module.exports.ComparisonPlugin = ComparisonPlugin;
}

// For browser: Expose to window if available
if (typeof window !== 'undefined') {
  window.MGFViewCore = MGFViewCore;
  // Also maintain backward compatibility with individual globals
  if (typeof window.MGFParser === 'undefined') window.MGFParser = MGFParser;
  if (typeof window.Spectrum === 'undefined') window.Spectrum = Spectrum;
  if (typeof window.SearchFilter === 'undefined') window.SearchFilter = SearchFilter;
  if (typeof window.StatisticsPanel === 'undefined') window.StatisticsPanel = StatisticsPanel;
  if (typeof window.ExportManager === 'undefined') window.ExportManager = ExportManager;
  if (typeof window.MGFUtils === 'undefined') window.MGFUtils = MGFUtils;
  if (typeof window.ViewerState === 'undefined') window.ViewerState = ViewerState;
  if (typeof window.PluginSystem === 'undefined') window.PluginSystem = PluginSystem;
}
