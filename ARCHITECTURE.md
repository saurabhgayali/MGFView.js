# MGFView.js Architecture

## Overview

MGFView.js has been refactored to separate reusable core functionality from browser-specific visualization code. This enables:

1. **npm Package Distribution**: The core library is now available as a Node.js/npm package
2. **Dual Environment Support**: Core runs in both Node.js and browser
3. **Clear Separation of Concerns**: Browser viewer uses core modules, preventing duplication
4. **Integration Ready**: MGFView-MCP and other tools can consume the core as an npm dependency

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MGFView.js Repository                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           REUSABLE CORE (src/core)                       │   │
│  │  Node.js Compatible • No DOM/Canvas Dependencies         │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                            │   │
│  │  ┌─────────────────────────────────────────────────┐     │   │
│  │  │  MGF Parsing & Data Models                      │     │   │
│  │  │  • parser.js (MGFParser)                        │     │   │
│  │  │  • spectrum.js (Spectrum)                       │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  │                                                            │   │
│  │  ┌─────────────────────────────────────────────────┐     │   │
│  │  │  Analysis & Filtering                           │     │   │
│  │  │  • search.js (SearchFilter)                     │     │   │
│  │  │  • stats.js (StatisticsPanel)                   │     │   │
│  │  │  • export.js (ExportManager)                    │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  │                                                            │   │
│  │  ┌─────────────────────────────────────────────────┐     │   │
│  │  │  Utilities & Infrastructure                     │     │   │
│  │  │  • utils.js (MGFUtils)                          │     │   │
│  │  │  • plugin.js (Plugin System)                    │     │   │
│  │  │  • state.js (ViewerState)                       │     │   │
│  │  │  • index.js (Public API)                        │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  │                                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                ▲                                  │
│                                │                                  │
│                ┌───────────────┴────────────────┐                │
│                │                                 │                │
│  ┌─────────────▼──────────┐    ┌────────────────▼────────────┐  │
│  │   npm Package: Node.js │    │   Browser Viewer            │  │
│  │   (dist/index.js)      │    │   (src/viewer)              │  │
│  │                        │    │   (dist/browser/mgfview.js) │  │
│  │  • @saurabhgayali/     │    │                             │  │
│  │    mgfview             │    │  ┌─────────────────────────┐ │  │
│  │  • Node.js require()   │    │  │  Browser-Specific Code: │ │  │
│  │  • npm install         │    │  │  • plot.js              │ │  │
│  │  • MGFView-MCP, etc.   │    │  │  • viewer.js            │ │  │
│  │                        │    │  │  • uibuilder.js         │ │  │
│  └────────────────────────┘    │  │  • components.js        │ │  │
│                                 │  └─────────────────────────┘ │  │
│                                 │  ┌─────────────────────────┐ │  │
│                                 │  │  Uses Core Modules      │ │  │
│                                 │  │  (from dist/core)       │ │  │
│                                 │  └─────────────────────────┘ │  │
│                                 │                             │  │
│                                 │  • example.html             │  │
│                                 │  • CSS styling              │  │
│                                 └─────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
MGFView.js/
│
├── src/                          # Source code
│   ├── core/                      # Reusable core (Node.js compatible)
│   │   ├── index.js               # Main entry point / public API
│   │   ├── parser.js              # MGF file parser
│   │   ├── spectrum.js            # Spectrum data class
│   │   ├── search.js              # Search/filter functionality
│   │   ├── stats.js               # Statistical analysis
│   │   ├── export.js              # Multi-format export
│   │   ├── utils.js               # Utility functions
│   │   ├── plugin.js              # Plugin system
│   │   └── state.js               # State management
│   │
│   ├── viewer/                    # Browser-only viewer components
│   │   ├── viewer.js              # High-level viewer API
│   │   ├── plot.js                # Canvas-based visualization
│   │   ├── uibuilder.js           # UI construction
│   │   └── components.js          # DOM component updaters
│   │
│   ├── browser/                   # Browser bundle
│   │   └── mgfview.js             # Bundled single-file distribution
│   │
│   ├── parser.js                  # DEPRECATED: kept for compatibility
│   ├── spectrum.js                # DEPRECATED: kept for compatibility
│   ├── search.js                  # DEPRECATED: kept for compatibility
│   ├── stats.js                   # DEPRECATED: kept for compatibility
│   ├── export.js                  # DEPRECATED: kept for compatibility
│   ├── utils.js                   # DEPRECATED: kept for compatibility
│   ├── plugin.js                  # DEPRECATED: kept for compatibility
│   ├── state.js                   # DEPRECATED: kept for compatibility
│   ├── viewer.js                  # DEPRECATED: kept for compatibility
│   ├── plot.js                    # DEPRECATED: kept for compatibility
│   ├── uibuilder.js               # DEPRECATED: kept for compatibility
│   ├── components.js              # DEPRECATED: kept for compatibility
│   └── mgfview.js                 # Entry point (uses core)
│
├── dist/                          # Build output
│   ├── index.js                   # Main entry for Node.js (CommonJS)
│   ├── index.mjs                  # ESM version (future)
│   ├── index.d.ts                 # TypeScript declarations (future)
│   ├── core/                      # Core modules (for direct require)
│   │   ├── index.js
│   │   ├── parser.js
│   │   ├── spectrum.js
│   │   └── ...
│   └── browser/                   # Browser bundle
│       └── mgfview.js
│
├── build/                         # Build scripts
│   ├── build.js                   # Main build orchestrator
│   ├── build-core.js              # Build core library
│   └── build-browser.js           # Build browser bundle
│
├── test/                          # Tests
│   ├── core.test.js               # Core functionality tests
│   └── fixtures/                  # Test MGF files
│
├── css/                           # Stylesheets
│   └── mgfview.css
│
├── example/                       # Example MGF files
│   ├── small.mgf
│   ├── medium.mgf
│   ├── large.mgf
│   └── Metabolomics.mgf
│
├── doc/                           # Documentation
│   └── index.html                 # API reference
│
├── example.html                   # Interactive demo
├── index.html                     # Main demo page
├── package.json                   # npm package configuration
├── .npmignore                     # npm publish exclude rules
├── README.md                      # Main documentation
├── ARCHITECTURE.md                # This file
├── LICENSE                        # MIT License
└── .git/                          # Git repository
```

## Core Modules

### MGFParser
- **Purpose**: Parse Mascot Generic Format (MGF) files
- **Input**: String, Blob, File, URL, or pre-parsed object
- **Output**: Array of Spectrum objects with metadata and peaks
- **Node.js**: ✅ Fully compatible
- **Browser**: ✅ Compatible with URL/blob handling

**Usage:**
```javascript
const parser = new MGFParser();
const result = await parser.load('path/to/file.mgf');
console.log(`Loaded ${result.count} spectra`);
```

### Spectrum
- **Purpose**: Data model for individual mass spectrometry spectra
- **Methods**: 
  - Metadata access: `getTitle()`, `getPrecursorMass()`, `getCharge()`, etc.
  - Peak access: `getPeaks()`, `getPeakCount()`, `getPeaksInRange()`
  - Analysis: `getStatistics()`, `getNormalizedPeaks()`, `sortPeaksByMz()`
- **Node.js**: ✅ Fully compatible
- **Browser**: ✅ Compatible

**Usage:**
```javascript
const spectrum = result.spectra[0];
console.log(spectrum.getTitle());
console.log(spectrum.getPrecursorMass());
console.log(spectrum.getPeakCount());
```

### SearchFilter
- **Purpose**: Filter spectra by various criteria
- **Features**: 
  - Title search with fuzzy matching
  - Precursor mass range (Da/ppm tolerance)
  - Charge state range
  - Retention time range
  - Custom metadata filtering
- **Node.js**: ✅ Fully compatible
- **Browser**: ✅ Compatible

**Usage:**
```javascript
const filter = new SearchFilter();
const results = filter.filter(spectra, {
  massLow: 400,
  massHigh: 1500,
  chargeLow: 2,
  chargeHigh: 4
});
```

### StatisticsPanel
- **Purpose**: Generate statistical analysis and distribution data
- **Outputs**: Peak counts, charge distributions, mass histograms, retention time patterns
- **Node.js**: ✅ Fully compatible
- **Browser**: ✅ Compatible (can generate data for rendering)

**Usage:**
```javascript
const stats = new StatisticsPanel();
const analysis = stats.analyze(spectra);
console.log(analysis.spectraCount);
console.log(analysis.charges);
```

### ExportManager
- **Purpose**: Export spectra in multiple formats
- **Formats**: JSON, CSV, MGF, PNG (requires Canvas), SVG (requires DOM)
- **Node.js**: ✅ JSON/CSV/MGF compatible; PNG/SVG need browser context
- **Browser**: ✅ All formats

**Usage:**
```javascript
const exporter = new ExportManager();
const json = exporter.exportJSON(spectra);
const csv = exporter.exportCSV(spectra);
const mgf = exporter.exportMGF(spectra);
```

### MGFUtils
- **Purpose**: Utility functions for formatting and data manipulation
- **Functions**: Formatting (numbers, m/z, intensity, retention time), escaping, sorting
- **Node.js**: ✅ Fully compatible
- **Browser**: ✅ Compatible

**Usage:**
```javascript
MGFUtils.formatMz(500.12345, 4);
MGFUtils.formatRetentionTime(125);
MGFUtils.formatNumber(3.14159, 2);
```

### Plugin System
- **Purpose**: Extensible architecture for adding custom functionality
- **Components**: Plugin base class, PluginSystem manager
- **Examples**: MirrorPlotPlugin, SimilarityPlugin, AnnotationPlugin, ComparisonPlugin
- **Node.js**: ✅ Mostly compatible (visualization plugins need browser)
- **Browser**: ✅ Compatible

**Usage:**
```javascript
const pluginSystem = new PluginSystem();
pluginSystem.register(new CustomPlugin());
pluginSystem.execute('analysisName', data);
```

### ViewerState
- **Purpose**: Centralized state management
- **Features**: Event-driven updates, computed properties caching
- **Node.js**: ✅ Fully compatible
- **Browser**: ✅ Compatible

**Usage:**
```javascript
const state = new ViewerState();
state.on('dataLoaded', (data) => { /* handle */ });
state.setData(spectra);
```

## Build Process

### Building the Package

```bash
# Build both core (Node.js) and browser bundle
npm run build

# Build just the core library
npm run build:core

# Build just the browser bundle
npm run build:browser
```

### Output Files

1. **dist/index.js** - Main Node.js entry point (CommonJS)
   - Contains all core modules bundled
   - Used by `npm require()`
   - Can be required in Node.js projects

2. **dist/browser/mgfview.js** - Browser bundle
   - Single file containing all core + viewer modules
   - Can be used in `<script>` tags
   - Maintains backward compatibility with original mgfview.js

3. **dist/core/** - Individual core modules
   - Each module available for direct require
   - Useful for tree-shaking and modular imports

## Publishing & Distribution

### npm Package

**Package Name**: `@saurabhgayali/mgfview`

**Installation**:
```bash
npm install @saurabhgayali/mgfview
```

**Usage in Node.js**:
```javascript
const { MGFParser, Spectrum, SearchFilter } = require('@saurabhgayali/mgfview');

const parser = new MGFParser();
const result = await parser.load('file.mgf');
```

### Browser Usage

**Option 1: Include in HTML**
```html
<link rel="stylesheet" href="css/mgfview.css">
<script src="dist/browser/mgfview.js"></script>
<script>
  const viewer = new MGFViewer('#container');
  await viewer.load('file.mgf');
</script>
```

**Option 2: Bundled with npm module**
```javascript
import('mgfview/browser').then(module => {
  const viewer = new window.MGFViewer('#container');
});
```

## Integration Examples

### MGFView-MCP (Claude MCP Server)

```javascript
// MGFView-MCP can now use:
const { MGFParser, Spectrum, SearchFilter, StatisticsPanel } = 
  require('@saurabhgayali/mgfview');

// Instead of loading the browser bundle and evaluating it
```

### Custom Analytics Tool

```javascript
const { MGFParser, ExportManager, StatisticsPanel } = 
  require('@saurabhgayali/mgfview');

async function analyzeMGFFiles(filePath) {
  const parser = new MGFParser();
  const result = await parser.load(filePath);
  
  const stats = new StatisticsPanel().analyze(result.spectra);
  
  const exporter = new ExportManager();
  const json = exporter.exportJSON(result.spectra);
  
  // Process data...
  return json;
}
```

### Educational Tool

```javascript
const viewer = MGFView.createViewer('#container');
await viewer.load('example.mgf');

// Access core functionality via the same API
const filter = new SearchFilter();
const results = filter.filter(viewer.getSpectra(), criteria);
```

## Backward Compatibility

The original source files in `/src` remain for backward compatibility:
- `src/parser.js`, `src/spectrum.js`, etc.
- These are deprecated but still functional
- New code should use `src/core/` modules
- Browser code continues to work with existing scripts

## Future Enhancements

1. **TypeScript Declarations**
   - Generate `.d.ts` files for full IDE support
   - Type definitions for all public APIs

2. **ES Module (ESM) Distribution**
   - Create `dist/index.mjs` for modern bundlers
   - Better tree-shaking support

3. **Minification**
   - Add minified versions for smaller downloads
   - Separate minified browser bundles

4. **Documentation**
   - Complete API reference with examples
   - Integration guides for common use cases
   - Migration guide from original mgfview.js

5. **Testing**
   - Expand test coverage for all modules
   - Add browser-specific tests
   - Performance benchmarks

6. **CI/CD Pipeline**
   - Automated testing on push
   - Automatic npm publishing on tag
   - Multi-version testing (Node.js 12, 14, 16+)

## Summary

MGFView.js now follows a clean architecture separating reusable core functionality from browser-specific visualization. This enables:

- ✅ npm package distribution
- ✅ Node.js compatibility for server-side tools and integrations
- ✅ Backward compatibility with existing browser viewers
- ✅ Clean public API for third-party consumers
- ✅ No duplication of scientific functionality
- ✅ Clear separation of concerns

The refactoring maintains the original functionality while opening new possibilities for consumption and integration.
