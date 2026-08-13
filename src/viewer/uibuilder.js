/**
 * UI Builder
 * 
 * Builds the viewer UI programmatically
 * Creates DOM structure once and caches references
 * All subsequent updates modify existing elements (no innerHTML)
 * 
 * Usage:
 *   const ui = new UIBuilder(container, options);
 *   ui.build();
 *   ui.refs // Access cached DOM references
 */

class UIBuilder {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!this.container) {
      throw new Error('Invalid container element');
    }
    
    this.options = {
      showToolbar: true,
      showSearch: true,
      showStatistics: true,
      showExport: true,
      showDistribution: true,
      theme: 'light',
      ...options
    };
    
    // DOM reference cache
    this.refs = {};
    
    // Component instances
    this.components = {};
  }
  
  /**
   * Build complete UI structure
   * This runs exactly once during initialization
   */
  build() {
    // Clear container
    this.container.innerHTML = '';
    this.container.className = 'mgf-container';
    
    // Build structure
    this.buildHeader();
    this.buildControls();
    this.buildViewer();
    this.buildEmptyState();
    
    // Cache all important references
    this.cacheReferences();
    
    // Set initial visibility
    this.refs.viewer.style.display = 'none';
    this.refs.emptyState.style.display = 'flex';
    
    return this.refs;
  }
  
  /**
   * Build header section
   */
  buildHeader() {
    const header = document.createElement('header');
    header.className = 'mgf-header';
    header.innerHTML = `
      <h1>🧬 MGFView.js</h1>
      <p>Interactive Mascot Generic Format (MGF) File Viewer</p>
      <p style="margin-top: 10px; font-size: 13px;">
        <a href="https://github.com/saurabhgayali/MGFView.js" target="_blank" style="color: white; text-decoration: underline;">GitHub Repository</a> | 
        <a href="doc/index.html" style="color: white; text-decoration: underline;">Documentation</a> | 
        <a href="index.html" style="color: white; text-decoration: underline;">Home</a>
      </p>
    `;
    
    this.container.appendChild(header);
    this.refs.header = header;
  }
  
  /**
   * Build controls panel
   */
  buildControls() {
    const controls = document.createElement('div');
    controls.className = 'mgf-controls';
    
    // Load example section
    const loadSection = this.createControlGroup();
    loadSection.innerHTML = `
      <label>Load Example:</label>
      <select id="exampleSelect">
        <option value="">-- Select an example file --</option>
        <option value="small.mgf">Small (5 spectra)</option>
        <option value="medium.mgf">Medium (20 spectra)</option>
        <option value="large.mgf">Large (100+ spectra)</option>
        <option value="Metabolomics.mgf">Metabolomics</option>
        <option value="spectral.mgf">Spectral Library</option>
      </select>
      <button id="loadExampleBtn">Load</button>
    `;
    controls.appendChild(loadSection);
    
    // File upload section
    const uploadSection = this.createControlGroup();
    uploadSection.innerHTML = `
      <label>Upload MGF:</label>
      <input type="file" id="fileInput" accept=".mgf,.txt" />
    `;
    controls.appendChild(uploadSection);
    
    // Message box
    const messageBox = document.createElement('div');
    messageBox.id = 'messageBox';
    controls.appendChild(messageBox);
    
    // Statistics panel
    if (this.options.showStatistics) {
      const statsPanel = document.createElement('div');
      statsPanel.id = 'statsPanel';
      statsPanel.style.display = 'none';
      statsPanel.style.cssText = 'display:none; padding: 20px; margin: 0; background: #f0f2f5; border-radius: 4px; margin-bottom: 15px;';
      statsPanel.innerHTML = `
        <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #333; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #555555; padding-bottom: 8px;">📊 File Statistics</h3>
        <div id="statsContent" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;"></div>
      `;
      controls.appendChild(statsPanel);
    }
    
    // Distribution panel
    if (this.options.showDistribution) {
      const distPanel = document.createElement('div');
      distPanel.id = 'distributionPanel';
      distPanel.style.cssText = 'display:none; padding: 20px; margin: 0; background: #f9f9f9; border-radius: 4px; margin-bottom: 15px;';
      distPanel.innerHTML = `
        <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #333; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #555555; padding-bottom: 8px;">📊 Peak Distribution</h3>
        <canvas id="distributionCanvas" style="width: 100%; border: 1px solid #e0e0e0; border-radius: 4px; background: white; display: block; margin-bottom: 15px;"></canvas>
        <div style="display: flex; gap: 8px; padding: 0; border-top: 1px solid #e0e0e0; flex-wrap: wrap; padding-top: 15px;">
          <button id="exportDistributionPNG" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📥 PNG</button>
          <button id="exportDistributionSVG" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📥 SVG</button>
          <button id="exportDistributionHTML" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📥 HTML</button>
          <button id="exportDistributionCSV" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📊 CSV</button>
        </div>
      `;
      controls.appendChild(distPanel);
    }
    
    // Export panel
    if (this.options.showExport) {
      const exportPanel = document.createElement('div');
      exportPanel.id = 'exportPanel';
      exportPanel.style.cssText = 'display:none; padding: 15px 0; border-top: 1px solid #e0e0e0;';
      exportPanel.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 12px; color: #333;">💾 Data Export</div>
        <div class="mgf-control-group" style="gap: 8px; flex-wrap: wrap;">
          <button id="exportJSON" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555;">All JSON</button>
          <button id="exportCSV" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555;">All CSV</button>
          <button id="exportMGF" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555;">All MGF</button>
          <button id="exportSpecJSON" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555;">Spectrum JSON</button>
          <button id="exportSpecCSV" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555;">Spectrum CSV</button>
        </div>
      `;
      controls.appendChild(exportPanel);
    }
    
    // Search panel
    if (this.options.showSearch) {
      const searchPanel = document.createElement('div');
      searchPanel.id = 'searchPanel';
      searchPanel.style.cssText = 'display:none; padding: 15px 20px; border-top: 1px solid #e0e0e0; background: #f9f9f9; margin-top: 15px; border-radius: 4px;';
      searchPanel.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 15px; color: #333;">🔍 Search & Filter</div>
        
        <div class="mgf-control-group">
          <label>Title:</label>
          <input type="text" id="searchTitle" placeholder="Search title..." style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          <button id="clearSearchBtn" style="padding: 8px 15px; font-size: 13px;">Clear</button>
        </div>
        
        <div class="mgf-control-group">
          <label>Precursor m/z:</label>
          <input type="number" id="searchMass" placeholder="m/z" step="0.01" style="flex: 0.8; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          <input type="number" id="searchMassTol" placeholder="±Da" value="5" step="0.1" style="flex: 0.6; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
        </div>
        
        <div class="mgf-control-group">
          <label>Charge State:</label>
          <select id="searchCharge" style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            <option value="">Any Charge</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </div>
        
        <div class="mgf-control-group">
          <label>RT Range (min):</label>
          <input type="number" id="searchRTMin" placeholder="Min" step="0.1" style="flex: 0.6; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          <input type="number" id="searchRTMax" placeholder="Max" step="0.1" style="flex: 0.6; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
        </div>
        
        <div id="scanFilterGroup" class="mgf-control-group" style="display: none;">
          <label>Scan Number:</label>
          <input type="number" id="searchScan" placeholder="Scan #" style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
        </div>
        
        <div id="peakFilterGroup" class="mgf-control-group" style="display: none;">
          <label>Min Peaks:</label>
          <input type="number" id="searchMinPeaks" placeholder="Min peak count" min="1" style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
        </div>
        
        <div id="filterResults" style="margin-top: 10px; padding: 10px; background: #f0f0f0; border-radius: 4px; font-size: 13px; color: #999; display: none;"></div>
      `;
      controls.appendChild(searchPanel);
    }
    
    this.container.appendChild(controls);
    this.refs.controls = controls;
  }
  
  /**
   * Build viewer section
   */
  buildViewer() {
    const viewer = document.createElement('div');
    viewer.className = 'mgf-viewer';
    viewer.id = 'viewer';
    viewer.style.display = 'none';
    
    // Spectrum list
    const spectrumList = document.createElement('div');
    spectrumList.className = 'mgf-spectrum-list';
    spectrumList.id = 'spectrumList';
    viewer.appendChild(spectrumList);
    
    // Spectrum content container
    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = 'display: flex; flex-direction: column; flex: 1; height: 100%;';
    
    const spectrumContent = document.createElement('div');
    spectrumContent.id = 'spectrumContent';
    spectrumContent.className = 'mgf-spectrum-content';
    spectrumContent.style.cssText = 'flex: 1; overflow-y: auto; display: flex; flex-direction: column; max-width: 100%; box-sizing: border-box;';
    
    // Plot container
    const plotContainer = document.createElement('div');
    plotContainer.id = 'plotContainer';
    plotContainer.style.cssText = 'width: 100%; height: 300px; flex-shrink: 0; border: 1px solid #e0e0e0; border-radius: 4px; background: white; margin: 0; box-sizing: border-box;';
    spectrumContent.appendChild(plotContainer);
    
    // Export spectrum buttons
    const exportButtons = document.createElement('div');
    exportButtons.style.cssText = 'display: flex; gap: 8px; padding: 15px 20px; border-top: 1px solid #e0e0e0; background: #f9f9f9; flex-shrink: 0; flex-wrap: wrap;';
    exportButtons.innerHTML = `
      <button id="exportSpectrumPNG" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📥 PNG</button>
      <button id="exportSpectrumSVG" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📥 SVG</button>
      <button id="exportSpectrumHTML" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📥 HTML</button>
      <button id="exportSpectrumCSV" style="padding: 8px 12px; font-size: 12px; background: white; color: #000; border: 1px solid #555555; border-radius: 4px; cursor: pointer; font-weight: 500;">📊 CSV</button>
    `;
    spectrumContent.appendChild(exportButtons);
    
    // Spectrum details
    const spectrumDetails = document.createElement('div');
    spectrumDetails.id = 'spectrumDetails';
    spectrumDetails.style.cssText = 'flex: 1; overflow-y: auto; padding: 20px; box-sizing: border-box; width: 100%; background: white; min-height: 100%;';
    spectrumContent.appendChild(spectrumDetails);
    
    contentWrapper.appendChild(spectrumContent);
    viewer.appendChild(contentWrapper);
    
    this.container.appendChild(viewer);
    this.refs.viewer = viewer;
  }
  
  /**
   * Build empty state
   */
  buildEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'mgf-empty-state';
    emptyState.id = 'emptyState';
    emptyState.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
        <line x1="9" y1="14" x2="15" y2="14"></line>
        <line x1="9" y1="18" x2="15" y2="18"></line>
      </svg>
      <h2>No MGF file loaded</h2>
      <p>Load an example file or upload your own MGF file to begin analysis</p>
    `;
    
    this.container.appendChild(emptyState);
    this.refs.emptyState = emptyState;
  }
  
  /**
   * Create control group div
   * @returns {HTMLElement}
   */
  createControlGroup() {
    const group = document.createElement('div');
    group.className = 'mgf-control-group';
    return group;
  }
  
  /**
   * Cache all important DOM references
   */
  cacheReferences() {
    // Core sections
    this.refs.header = this.container.querySelector('.mgf-header');
    this.refs.controls = this.container.querySelector('.mgf-controls');
    this.refs.viewer = this.container.querySelector('.mgf-viewer');
    this.refs.emptyState = this.container.querySelector('.mgf-empty-state');
    
    // Controls
    this.refs.exampleSelect = document.getElementById('exampleSelect');
    this.refs.loadExampleBtn = document.getElementById('loadExampleBtn');
    this.refs.fileInput = document.getElementById('fileInput');
    this.refs.messageBox = document.getElementById('messageBox');
    
    // Panels
    this.refs.statsPanel = document.getElementById('statsPanel');
    this.refs.statsContent = document.getElementById('statsContent');
    this.refs.distributionPanel = document.getElementById('distributionPanel');
    this.refs.distributionCanvas = document.getElementById('distributionCanvas');
    this.refs.exportPanel = document.getElementById('exportPanel');
    this.refs.searchPanel = document.getElementById('searchPanel');
    
    // Search inputs
    this.refs.searchTitle = document.getElementById('searchTitle');
    this.refs.searchMass = document.getElementById('searchMass');
    this.refs.searchMassTol = document.getElementById('searchMassTol');
    this.refs.searchCharge = document.getElementById('searchCharge');
    this.refs.searchRTMin = document.getElementById('searchRTMin');
    this.refs.searchRTMax = document.getElementById('searchRTMax');
    this.refs.searchScan = document.getElementById('searchScan');
    this.refs.searchMinPeaks = document.getElementById('searchMinPeaks');
    this.refs.clearSearchBtn = document.getElementById('clearSearchBtn');
    this.refs.filterResults = document.getElementById('filterResults');
    
    // Viewer components
    this.refs.spectrumList = document.getElementById('spectrumList');
    this.refs.spectrumContent = document.getElementById('spectrumContent');
    this.refs.plotContainer = document.getElementById('plotContainer');
    this.refs.spectrumDetails = document.getElementById('spectrumDetails');
    
    // Export buttons
    this.refs.exportJSON = document.getElementById('exportJSON');
    this.refs.exportCSV = document.getElementById('exportCSV');
    this.refs.exportMGF = document.getElementById('exportMGF');
    this.refs.exportSpecJSON = document.getElementById('exportSpecJSON');
    this.refs.exportSpecCSV = document.getElementById('exportSpecCSV');
    
    this.refs.exportSpectrumPNG = document.getElementById('exportSpectrumPNG');
    this.refs.exportSpectrumSVG = document.getElementById('exportSpectrumSVG');
    this.refs.exportSpectrumHTML = document.getElementById('exportSpectrumHTML');
    this.refs.exportSpectrumCSV = document.getElementById('exportSpectrumCSV');
    
    this.refs.exportDistributionPNG = document.getElementById('exportDistributionPNG');
    this.refs.exportDistributionSVG = document.getElementById('exportDistributionSVG');
    this.refs.exportDistributionHTML = document.getElementById('exportDistributionHTML');
    this.refs.exportDistributionCSV = document.getElementById('exportDistributionCSV');
  }
  
  /**
   * Show viewer, hide empty state
   */
  showViewer() {
    this.refs.viewer.style.display = 'grid';
    this.refs.emptyState.style.display = 'none';
    
    if (this.refs.statsPanel) this.refs.statsPanel.style.display = 'block';
    if (this.refs.distributionPanel) this.refs.distributionPanel.style.display = 'block';
    if (this.refs.exportPanel) this.refs.exportPanel.style.display = 'block';
    if (this.refs.searchPanel) this.refs.searchPanel.style.display = 'block';
  }
  
  /**
   * Hide viewer, show empty state
   */
  showEmptyState() {
    this.refs.viewer.style.display = 'none';
    this.refs.emptyState.style.display = 'flex';
    
    if (this.refs.statsPanel) this.refs.statsPanel.style.display = 'none';
    if (this.refs.distributionPanel) this.refs.distributionPanel.style.display = 'none';
    if (this.refs.exportPanel) this.refs.exportPanel.style.display = 'none';
    if (this.refs.searchPanel) this.refs.searchPanel.style.display = 'none';
  }
  
  /**
   * Show message
   * @param {string} message - Message text
   * @param {string} type - Message type (success, error, info)
   */
  showMessage(message, type = 'info') {
    if (!this.refs.messageBox) return;
    
    const className = `mgf-message mgf-${type}`;
    this.refs.messageBox.innerHTML = `<div class="${className}">${this.escapeHtml(message)}</div>`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.refs.messageBox.innerHTML = '';
    }, 5000);
  }
  
  /**
   * Clear message
   */
  clearMessage() {
    if (this.refs.messageBox) {
      this.refs.messageBox.innerHTML = '';
    }
  }
  
  /**
   * Escape HTML
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export to global window object for browser
if (typeof window !== 'undefined') {
  window.UIBuilder = UIBuilder;
}
