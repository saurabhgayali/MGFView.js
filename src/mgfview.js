/**
 * MGFView.js
 * 
 * Main entry point for the MGFView.js library
 * Aggregates all components: Parser, Viewer, Spectrum, Plot, Utils
 * 
 * Usage:
 *   <script src="src/mgfview.js"></script>
 *   
 *   const viewer = new MGFViewer('#container');
 *   await viewer.load('path/to/file.mgf');
 */

// Namespace for the library
const MGFView = {
  version: '1.0.0',
  name: 'MGFView.js',

  /**
   * Create a new viewer instance
   * @param {string|Element} container 
   * @param {Object} options 
   * @returns {MGFViewer}
   */
  createViewer(container, options = {}) {
    if (typeof MGFViewer === 'undefined') {
      throw new Error('MGFViewer class not found. Include src/viewer.js');
    }
    return new MGFViewer(container, options);
  },

  /**
   * Create a new parser instance
   * @returns {MGFParser}
   */
  createParser() {
    if (typeof MGFParser === 'undefined') {
      throw new Error('MGFParser class not found. Include src/parser.js');
    }
    return new MGFParser();
  },

  /**
   * Create a new spectrum instance
   * @param {Object} data 
   * @returns {Spectrum}
   */
  createSpectrum(data = {}) {
    if (typeof Spectrum === 'undefined') {
      throw new Error('Spectrum class not found. Include src/spectrum.js');
    }
    return new Spectrum(data);
  },

  /**
   * Create a new plot instance
   * @param {string|Element} container 
   * @param {Object} options 
   * @returns {SpectrumPlot}
   */
  createPlot(container, options = {}) {
    if (typeof SpectrumPlot === 'undefined') {
      throw new Error('SpectrumPlot class not found. Include src/plot.js');
    }
    return new SpectrumPlot(container, options);
  },

  /**
   * Get utilities
   * @returns {Object}
   */
  getUtils() {
    if (typeof MGFUtils === 'undefined') {
      throw new Error('MGFUtils not found. Include src/utils.js');
    }
    return MGFUtils;
  },

  /**
   * Check if all components are loaded
   * @returns {Object} Component status
   */
  checkComponents() {
    return {
      MGFParser: typeof MGFParser !== 'undefined',
      MGFViewer: typeof MGFViewer !== 'undefined',
      Spectrum: typeof Spectrum !== 'undefined',
      SpectrumPlot: typeof SpectrumPlot !== 'undefined',
      MGFUtils: typeof MGFUtils !== 'undefined'
    };
  },

  /**
   * Get library version
   * @returns {string}
   */
  getVersion() {
    return this.version;
  },

  /**
   * Initialize example
   * @param {Object} options 
   * @returns {MGFViewer}
   */
  initExample(options = {}) {
    const container = options.container || '#mgf-viewer';
    const exampleFiles = options.exampleFiles || [
      'small.mgf',
      'medium.mgf.txt',
      'large.mgf'
    ];
    const examplePath = options.examplePath || './example/';

    try {
      const viewer = this.createViewer(container, options);
      
      // Store example files for later use
      viewer.exampleFiles = exampleFiles;
      viewer.examplePath = examplePath;

      return viewer;
    } catch (error) {
      console.error('Failed to initialize MGFView:', error);
      throw error;
    }
  }
};

// Export to global window object
if (typeof window !== 'undefined') {
  window.MGFView = MGFView;
}

// Define ASCII art
const loaderArt = `
===============================================================
 __  __   _____   ______ __      __ _                   
|  \\/  | / ____| |  ____|\ \\    / /(_)                  
| \\  / || |  __  | |__    \\ \\  / /  _   ___ __      __
| |\\/| || | |_ | |  __|    \\ \\/ /  | | / _ \\\\ \\ /\\ / /
| |  | || |__| | | |        \\  /   | ||  __/ \\ V  V /
|_|  |_| \\_____| |_|         \\/    |_| \\___|  \\_/\\_/

                        MGFView.js
        Client-side JavaScript MGF Spectrum Viewer
===============================================================

Version     : 1.0.0
Author      : Saurabh Gayali
License     : MIT
Website     : https://github.com/saurabhgayali/MGFView.js

Features
✓ 100% Client-side
✓ No dependencies
✓ Parse MGF files
✓ Interactive spectrum viewer
✓ Search & filter
✓ Export support

Ready.
===============================================================
`;

// Log library initialization and component status
if (typeof console !== 'undefined' && console.log) {
  console.log('%c' + loaderArt, 'color: #667eea; font-family: monospace; font-weight: bold;');
  
  // Check loaded components
  const components = {
    'Parser': typeof MGFParser !== 'undefined',
    'Viewer': typeof MGFViewer !== 'undefined',
    'Spectrum': typeof Spectrum !== 'undefined',
    'Plot': typeof SpectrumPlot !== 'undefined',
    'Search': typeof SearchFilter !== 'undefined',
    'Statistics': typeof StatisticsPanel !== 'undefined',
    'Export': typeof ExportManager !== 'undefined',
    'Utils': typeof MGFUtils !== 'undefined'
  };
  
  const loaded = Object.values(components).filter(v => v).length;
  const total = Object.keys(components).length;
  
  console.log(`%cComponents: ${loaded}/${total} loaded`, 
    `color: ${loaded === total ? '#4caf50' : '#ff9800'}; font-weight: bold;`);
  
  Object.entries(components).forEach(([name, loaded]) => {
    const status = loaded ? '✓' : '✗';
    const color = loaded ? '#4caf50' : '#f44336';
    console.log(`  %c${status} ${name}`, `color: ${color};`);
  });
  
  console.log('%cReady to use! https://github.com/saurabhgayali/MGFView.js', 'color: #667eea;');
}
