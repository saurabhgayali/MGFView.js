#!/usr/bin/env node

/**
 * Build script for MGFView.js Core Library
 * 
 * Builds the Node.js compatible core library
 * Concatenates all core modules into a single CommonJS bundle
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

// Copy individual modules to dist/core for direct require
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

console.log('\n✓ Core library built successfully!');
console.log(`  Location: ${distCoreDir}`);
console.log(`  Main entry: dist/index.js`);
