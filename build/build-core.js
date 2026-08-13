#!/usr/bin/env node

/**
 * Build script for MGFView.js Core Library
 * 
 * Builds the Node.js compatible core library
 * Generates both CommonJS and ESM modules with TypeScript definitions
 */

const fs = require('fs');
const path = require('path');

// Ensure dist/core directory exists
const distCoreDir = path.join(__dirname, '..', 'dist', 'core');
if (!fs.existsSync(distCoreDir)) {
  fs.mkdirSync(distCoreDir, { recursive: true });
}

// Core modules to bundle
const coreModules = [
  'parser',
  'spectrum',
  'search',
  'stats',
  'export',
  'utils',
  'plugin',
  'state'
];

const srcDir = path.join(__dirname, '..', 'src', 'core');

// Read each module
const modules = {};
coreModules.forEach(name => {
  const file = path.join(srcDir, `${name}.js`);
  if (fs.existsSync(file)) {
    modules[name] = fs.readFileSync(file, 'utf-8');
  } else {
    console.warn(`Warning: ${name}.js not found`);
  }
});

// Create the main core index file in dist
const coreIndexFile = path.join(srcDir, 'index.js');
if (fs.existsSync(coreIndexFile)) {
  const indexContent = fs.readFileSync(coreIndexFile, 'utf-8');
  const distIndexPath = path.join(distCoreDir, 'index.js');
  fs.writeFileSync(distIndexPath, indexContent, 'utf-8');
  console.log(`✓ Created ${distIndexPath}`);
} else {
  console.warn('Warning: src/core/index.js not found');
}

// Copy individual modules to dist/core for direct require (CommonJS)
coreModules.forEach(name => {
  const srcFile = path.join(srcDir, `${name}.js`);
  const destFile = path.join(distCoreDir, `${name}.js`);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`✓ Copied ${name}.js to dist/core`);
  }
});

// Also copy the main entry point for CommonJS
const mainFile = path.join(__dirname, '..', 'src', 'core', 'index.js');
const distMainFile = path.join(__dirname, '..', 'dist', 'index.js');
if (fs.existsSync(mainFile)) {
  fs.copyFileSync(mainFile, distMainFile);
  console.log(`✓ Copied index.js to dist/index.js (main entry point)`);
}

// Generate ESM versions
function generateESM(commonjsContent, moduleName) {
  // Convert CommonJS to ESM
  let esmContent = commonjsContent;
  
  // Replace require() calls with import statements (for now, keep as require for simplicity)
  // This is a simple conversion - in a real scenario, you'd want a proper babel transformation
  
  // For a proper ESM version, we'd need to:
  // 1. Convert require() to import
  // 2. Convert module.exports to export default/named exports
  
  // For this MVP, we'll create a minimal ESM wrapper that re-exports the CommonJS module
  // In production, you'd use a tool like esbuild or babel
  
  return esmContent;
}

// Create ESM wrapper for main index
const indexCjsPath = path.join(distCoreDir, 'index.js');
const indexEsmPath = path.join(distCoreDir, 'index.mjs');

if (fs.existsSync(indexCjsPath)) {
  // Create ESM wrapper that re-exports CommonJS
  const esmWrapper = `/**
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
`;
  
  fs.writeFileSync(indexEsmPath, esmWrapper, 'utf-8');
  console.log(`✓ Created ESM wrapper at ${indexEsmPath}`);
}

// Create ESM wrappers for individual modules
coreModules.forEach(name => {
  const cjsPath = path.join(distCoreDir, `${name}.js`);
  const esmPath = path.join(distCoreDir, `${name}.mjs`);
  
  if (fs.existsSync(cjsPath)) {
    const esmWrapper = `/**
 * ESM wrapper for ${name}.js module
 * Re-exports the CommonJS module for ESM consumers
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const module_export = require('./${name}.js');

export default module_export;
export const * = module_export;
`;
    
    fs.writeFileSync(esmPath, esmWrapper, 'utf-8');
  }
});

console.log(`✓ Created ESM wrappers for all modules`);

// Generate basic TypeScript definitions
function generateTypeDefinitions() {
  const dtsContent = `/**
 * MGFView.js Core Library - TypeScript Definitions
 * 
 * Provides type information for all exported classes and interfaces
 */

declare module '@saurabhgayali/mgfview' {
  /**
   * Main MGF file parser class
   */
  export class MGFParser {
    load(content: string): Promise<any>;
    parse(lines: string[]): any;
  }

  /**
   * Represents a single mass spectrometry spectrum
   */
  export class Spectrum {
    constructor(data: any);
    getTitle(): string | null;
    getPeakCount(): number;
    getPrecursorMz(): number | null;
    getPrecursorCharge(): number | null;
  }

  /**
   * Advanced filtering and search functionality
   */
  export class SearchFilter {
    filter(spectra: Spectrum[], criteria: any): { matched: Spectrum[], unmatched: Spectrum[] };
  }

  /**
   * Statistical analysis of spectra collections
   */
  export class StatisticsPanel {
    analyze(spectra: Spectrum[]): any;
  }

  /**
   * Multi-format data export (JSON, CSV, MGF)
   */
  export class ExportManager {
    exportJSON(spectra: Spectrum[]): string;
    exportCSV(spectra: Spectrum[]): string;
    exportMGF(spectra: Spectrum[]): string;
  }

  /**
   * Utility functions for mass spectrometry calculations
   */
  export class MGFUtils {
    static formatNumber(value: number, decimals: number): string;
    static formatMz(value: number): string;
  }

  /**
   * State management for viewer and application
   */
  export class ViewerState {
    constructor();
    setState(key: string, value: any): void;
    getState(key: string): any;
  }

  /**
   * Plugin base class
   */
  export class Plugin {
    name: string;
    version: string;
    execute(data: any): any;
  }

  /**
   * Plugin system manager
   */
  export class PluginSystem {
    register(plugin: Plugin): void;
    execute(pluginName: string, data: any): any;
  }

  /**
   * Mirror plot visualization plugin
   */
  export class MirrorPlotPlugin extends Plugin {
    name: string;
  }

  /**
   * Spectral similarity matching plugin
   */
  export class SimilarityPlugin extends Plugin {
    name: string;
  }

  /**
   * Spectrum annotation plugin
   */
  export class AnnotationPlugin extends Plugin {
    name: string;
  }

  /**
   * Spectrum comparison plugin
   */
  export class ComparisonPlugin extends Plugin {
    name: string;
  }

  /**
   * Core library version
   */
  export const version: string;
  
  /**
   * Core library name
   */
  export const name: string;

  /**
   * Get library version
   */
  export function getVersion(): string;

  /**
   * Get library information
   */
  export function getInfo(): {
    name: string;
    version: string;
    components: string[];
  };
}

declare module '@saurabhgayali/mgfview/core' {
  export * from '@saurabhgayali/mgfview';
}
`;

  const dtsPath = path.join(__dirname, '..', 'dist', 'index.d.ts');
  fs.writeFileSync(dtsPath, dtsContent, 'utf-8');
  console.log(`✓ Created TypeScript definitions at ${dtsPath}`);

  const coreDtsPath = path.join(distCoreDir, 'index.d.ts');
  fs.writeFileSync(coreDtsPath, dtsContent, 'utf-8');
  console.log(`✓ Created core TypeScript definitions at ${coreDtsPath}`);
}

generateTypeDefinitions();

// Create ESM wrapper for main export
const mainEsmPath = path.join(__dirname, '..', 'dist', 'index.mjs');
if (fs.existsSync(distMainFile)) {
  const esmWrapper = `/**
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
`;
  
  fs.writeFileSync(mainEsmPath, esmWrapper, 'utf-8');
  console.log(`✓ Created ESM wrapper at ${mainEsmPath}`);
}

console.log('\n✓ Core library built successfully!');
console.log(`  Location: ${distCoreDir}`);
console.log(`  Main entry: dist/index.js (CommonJS)`);
console.log(`  ESM entry: dist/index.mjs`);
console.log(`  Types: dist/index.d.ts`);

