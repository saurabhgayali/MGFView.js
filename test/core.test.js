#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

let MGFParser, Spectrum, SearchFilter, StatisticsPanel, ExportManager, MGFUtils;

try {
  if (fs.existsSync(path.join(__dirname, '..', 'dist', 'index.js'))) {
    const core = require('../dist/index.js');
    MGFParser = core.MGFParser;
    Spectrum = core.Spectrum;
    SearchFilter = core.SearchFilter;
    StatisticsPanel = core.StatisticsPanel;
    ExportManager = core.ExportManager;
    MGFUtils = core.MGFUtils;
  }
} catch (err) {
  console.error('✗ Failed to import:', err.message);
  process.exit(1);
}

let testsPassed = 0, testsFailed = 0, failedTests = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    testsFailed++;
    failedTests.push({name, error: err.message});
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  console.log('\n🧪 MGFView.js Core Library Tests\n');

  const smallMGFPath = path.join(__dirname, '..', 'example', 'small.mgf');
  let parser = null, parsedResult = null;

  console.log('📦 Parser Tests');
  test('Load small.mgf file', () => assert(fs.existsSync(smallMGFPath)));
  test('Create parser instance', () => { parser = new MGFParser(); assert(parser); });
  
  try {
    const mgfContent = fs.readFileSync(smallMGFPath, 'utf-8');
    parsedResult = await parser.load(mgfContent);
    console.log(`  ✓ Parse MGF file`);
    testsPassed++;
  } catch (err) {
    console.log(`  ✗ Parse MGF file: ${err.message}`);
    testsFailed++;
  }

  console.log('\n🎯 Spectrum Tests');
  let spectrum = null;
  test('Create Spectrum instance', () => {
    if (parsedResult?.spectra?.length) {
      spectrum = new Spectrum(parsedResult.spectra[0]);
      assert(spectrum);
    } else throw new Error('No spectra');
  });
  test('Get spectrum title', () => {
    const title = spectrum.getTitle();
    assert(title === null || typeof title === 'string');
  });
  test('Get peak count', () => {
    const count = spectrum.getPeakCount();
    assert(typeof count === 'number' && count >= 0);
  });

  console.log('\n🔍 Search & Filter Tests');
  let searchFilter = null;
  test('Create SearchFilter', () => { searchFilter = new SearchFilter(); assert(searchFilter); });
  test('Filter spectra', () => {
    const specs = parsedResult.spectra.map(s => new Spectrum(s));
    const results = searchFilter.filter(specs, {massLow: 100, massHigh: 2000});
    assert(Array.isArray(results.matched));
  });

  console.log('\n📊 Statistics Tests');
  test('Analyze spectra', () => {
    const stats = new StatisticsPanel();
    const specs = parsedResult.spectra.map(s => new Spectrum(s));
    const analysis = stats.analyze(specs);
    assert(typeof analysis.spectraCount === 'number');
  });

  console.log('\n💾 Export Tests');
  test('Export to JSON', () => {
    const exporter = new ExportManager();
    const specs = parsedResult.spectra.map(s => new Spectrum(s));
    const json = exporter.exportJSON(specs);
    assert(json.includes('spectra'));
  });
  test('Export to CSV', () => {
    const exporter = new ExportManager();
    const specs = parsedResult.spectra.map(s => new Spectrum(s));
    const csv = exporter.exportCSV(specs);
    assert(csv.length > 0);
  });

  console.log('\n🛠️  Utilities Tests');
  test('Format number', () => {
    assert(MGFUtils.formatNumber(3.14159, 2) === '3.14');
  });
  test('Format m/z', () => {
    const formatted = MGFUtils.formatMz(500.12345);
    assert(typeof formatted === 'string' && formatted.length > 0);
  });

  console.log('\n' + '='.repeat(50));
  console.log(`\n  ✓ Passed: ${testsPassed}`);
  console.log(`  ✗ Failed: ${testsFailed}`);
  console.log(`  Total:  ${testsPassed + testsFailed}`);

  if (testsFailed > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(t => console.log(`  - ${t.name}`));
    process.exit(1);
  } else {
    console.log('\n✓ All tests passed!');
    console.log('🎉 Core library is fully functional in Node.js\n');
    process.exit(0);
  }
})();
