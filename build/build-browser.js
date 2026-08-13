#!/usr/bin/env node

/**
 * Build script for MGFView.js Browser Bundle
 * 
 * Creates a single mgfview.js file containing all core and viewer modules
 * for use in the browser
 */

const fs = require('fs');
const path = require('path');

// Read version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

// Ensure dist directory exists
const distDir = path.join(__dirname, '..', 'dist', 'browser');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Build order: core modules first, then viewer modules
const modules = [
  'src/core/parser.js',
  'src/core/spectrum.js',
  'src/core/search.js',
  'src/core/stats.js',
  'src/core/export.js',
  'src/core/utils.js',
  'src/core/plugin.js',
  'src/core/state.js',
  'src/viewer/uibuilder.js',
  'src/viewer/components.js',
  'src/viewer/plot.js',
  'src/viewer/viewer.js',
  'src/mgfview.js'  // Original main entry point
];

// Create bundle header
const header = `/**
 * ===============================================================
 * MGFView.js v${version} - Single-file Distribution
 * ===============================================================
 * 
 * Complete client-side JavaScript library for viewing and
 * analyzing Mascot Generic Format (MGF) mass spectrometry files
 * 
 * Author: Saurabh Gayali
 * License: MIT
 * Repository: https://github.com/saurabhgayali/MGFView.js
 * 
 * Features:
 * - Zero dependencies - works completely offline
 * - 100% client-side processing
 * - Interactive spectrum viewer with zoom/pan
 * - Advanced search & filter capabilities
 * - Multiple export formats (JSON, CSV, MGF, PNG, SVG)
 * - Extensible plugin architecture
 * - State-driven reactive architecture
 * 
 * Usage:
 *   <link rel="stylesheet" href="css/mgfview.css">
 *   <script src="dist/browser/mgfview.js"></script>
 *   
 *   const viewer = new MGFViewer('#container');
 *   await viewer.load('file.mgf');
 * 
 * ===============================================================
 */

(function(window) {
`;

// Create bundle footer
const footer = `
})(typeof window !== 'undefined' ? window : global);

console.log('%c✓ MGFView.js Bundle Loaded', 'color: #4caf50; font-weight: bold; font-size: 12px;');
`;

// Read all modules
let bundleContent = header;

modules.forEach(modulePath => {
  const fullPath = path.join(__dirname, '..', modulePath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8');
    
    // Remove shebang if present
    if (content.startsWith('#!')) {
      content = content.split('\n').slice(1).join('\n');
    }
    
    // Remove CommonJS module.exports that were added for Node.js compatibility
    // We'll replace them with a simpler pattern for the browser
    content = content.replace(
      /if \(typeof module !== 'undefined' && module\.exports\) \{[\s\S]*?\}/,
      ''
    );
    
    // Clean up extra whitespace at the end of modules
    content = content.replace(/\n\n+/g, '\n\n');
    
    bundleContent += `\n// ========== ${modulePath} ==========\n`;
    bundleContent += content;
    
    console.log(`✓ Bundled ${modulePath}`);
  } else {
    console.warn(`⚠ Missing module: ${modulePath}`);
  }
});

bundleContent += footer;

// Write the bundle
const bundlePath = path.join(distDir, 'mgfview.js');
fs.writeFileSync(bundlePath, bundleContent, 'utf-8');

console.log(`\n✓ Browser bundle created successfully!`);
console.log(`  Location: ${bundlePath}`);
console.log(`  Size: ${(bundleContent.length / 1024).toFixed(2)} KB`);
console.log(`  Usage: <script src="dist/browser/mgfview.js"></script>`);
