#!/usr/bin/env node

/**
 * Main build script for MGFView.js
 * Builds both the Node.js core library and browser bundle
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔨 Building MGFView.js...\n');

// Build core library
console.log('📦 Building core library for Node.js...');
const buildCore = spawn('node', [path.join(__dirname, 'build-core.js')], { stdio: 'inherit' });

buildCore.on('close', (code) => {
  if (code !== 0) {
    console.error('✗ Core build failed');
    process.exit(1);
  }
  
  // Build browser bundle
  console.log('\n🌐 Building browser bundle...');
  const buildBrowser = spawn('node', [path.join(__dirname, 'build-browser.js')], { stdio: 'inherit' });
  
  buildBrowser.on('close', (code) => {
    if (code !== 0) {
      console.error('✗ Browser build failed');
      process.exit(1);
    }
    
    console.log('\n✓ Build complete!');
    console.log('\nOutput:');
    console.log('  Node.js: dist/index.js');
    console.log('  Browser: dist/browser/mgfview.js');
  });
});
