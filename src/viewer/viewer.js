/**
 * MGF Viewer
 * 
 * High-level API for loading, viewing, and interacting with MGF files
 * in the browser. Uses state-driven architecture for efficient updates.
 * 
 * Usage:
 *   const viewer = new MGFViewer('#container');
 *   await viewer.load('path/to/file.mgf');
 *   // or
 *   await viewer.load(fileInput.files[0]);
 *   // or
 *   await viewer.load(rawMGFString);
 *   // or
 *   await viewer.load([{metadata: {...}, peaks: [...]}]);
 */

class MGFViewer {
  constructor(container, options = {}) {
    // Container can be a selector string or DOM element
    this.containerElement = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;

    if (!this.containerElement) {
      throw new Error('Invalid container: element not found');
    }

    // Initialize parser
    this.parser = new MGFParser();
    
    // Initialize state management (if ViewerState is available)
    if (typeof ViewerState !== 'undefined') {
      this.state = new ViewerState();
      this.usingNewArchitecture = true;
      
      // Setup state change listeners
      this.state.on('dataLoaded', (data) => {
        this.onDataLoaded(data);
      });
      
      this.state.on('spectrumSelected', (data) => {
        this.onSpectrumSelected(data);
      });
      
      // Initialize listeners for backward compatibility
      this.listeners = {};
    } else {
      // Fallback to old architecture
      this.usingNewArchitecture = false;
      this.currentSpectrumIndex = 0;
      this.spectra = [];
      this.metadata = {};
      this.listeners = {};
    }
    
    // Initialize UI builder (if available)
    if (typeof UIBuilder !== 'undefined' && this.usingNewArchitecture) {
      this.ui = new UIBuilder(this.containerElement, options);
      // Build UI once
      this.refs = this.ui.build();
      // Attach event handlers
      this.attachEventHandlers();
    } else {
      // Fallback: render empty state
      this.container = this.containerElement;
      this.renderEmpty();
    }
    
    // Plot instance (created lazily when needed)
    this.plot = null;
  }

  /**
   * Unified load method - accepts all input types
   * 
   * @param {string|File|Blob|Object|Array} input 
   *   - string: URL, file path, raw MGF string, or data URL
   *   - File/Blob: File object or Blob from input element
   *   - Object: {spectra: [...], metadata: {...}} or single spectrum
   *   - Array: Array of spectrum objects
   * 
   * @returns {Promise<void>}
   * @fires MGFViewer#loaded
   */
  async load(input) {
    try {
      if (this.usingNewArchitecture) {
        this.state.setLoading(true);
      } else {
        this.renderLoading();
      }
      
      // Use parser's unified load method
      const result = await this.parser.load(input);
      
      if (this.usingNewArchitecture) {
        // Load into state
        this.state.loadDataset(result.spectra || [], result.metadata || {});
      } else {
        // Old architecture
        this.spectra = result.spectra || [];
        this.metadata = result.metadata || {};
        this.currentSpectrumIndex = 0;

        // Trigger loaded event
        this.emit('loaded', {
          spectraCount: this.spectra.length,
          metadata: this.metadata
        });

        // Render UI
        if (this.spectra.length > 0) {
          this.render();
        } else {
          this.renderEmpty();
        }
      }

      return result;
    } catch (error) {
      if (this.usingNewArchitecture) {
        this.state.setError(error);
      } else {
        this.renderError(error.message);
        this.emit('error', { error: error.message });
      }
      throw error;
    }
  }

  /**
   * Load from URL
   * @param {string} url - URL to MGF file
   * @returns {Promise<void>}
   */
  async loadUrl(url) {
    return this.load(url);
  }

  /**
   * Load from File or Blob
   * @param {File|Blob} fileOrBlob 
   * @returns {Promise<void>}
   */
  async loadFile(fileOrBlob) {
    return this.load(fileOrBlob);
  }

  /**
   * Load from raw MGF string
   * @param {string} mgfString 
   * @returns {Promise<void>}
   */
  async loadString(mgfString) {
    return this.load(mgfString);
  }

  /**
   * Load from pre-parsed data
   * @param {Object|Array} data 
   * @returns {Promise<void>}
   */
  async loadData(data) {
    return this.load(data);
  }

  /**
   * Get current spectrum
   * @returns {Object} Current spectrum
   */
  getCurrentSpectrum() {
    if (this.usingNewArchitecture) {
      return this.state.getSelectedSpectrum();
    }
    return this.spectra[this.currentSpectrumIndex];
  }

  /**
   * Get spectrum by index
   * @param {number} index 
   * @returns {Object} Spectrum at index
   */
  getSpectrum(index) {
    if (this.usingNewArchitecture) {
      return this.state.get('spectra')[index];
    }
    return this.spectra[index];
  }

  /**
   * Get all spectra
   * @returns {Array} All spectra
   */
  getSpectra() {
    if (this.usingNewArchitecture) {
      return this.state.get('spectra');
    }
    return this.spectra;
  }

  /**
   * Get spectrum count
   * @returns {number}
   */
  getSpectrumCount() {
    if (this.usingNewArchitecture) {
      return this.state.get('spectra').length;
    }
    return this.spectra.length;
  }

  /**
   * Get file metadata
   * @returns {Object}
   */
  getMetadata() {
    if (this.usingNewArchitecture) {
      return this.state.get('metadata');
    }
    return this.metadata;
  }

  /**
   * Get statistics
   * @returns {Object}
   */
  getStatistics() {
    if (this.usingNewArchitecture) {
      return this.state.getStatistics();
    }
    return this.parser.getStatistics();
  }

  /**
   * Select spectrum by index
   * @param {number} index 
   * @returns {Object} Selected spectrum
   */
  selectSpectrum(index) {
    if (this.usingNewArchitecture) {
      this.state.selectSpectrum(index);
      return this.getCurrentSpectrum();
    } else {
      if (index < 0 || index >= this.spectra.length) {
        throw new Error(`Spectrum index ${index} out of range`);
      }
      this.currentSpectrumIndex = index;
      this.render();
      this.emit('spectrumChanged', { index, spectrum: this.getCurrentSpectrum() });
      return this.getCurrentSpectrum();
    }
  }

  /**
   * Go to next spectrum
   * @returns {Object} Next spectrum
   */
  next() {
    if (this.currentSpectrumIndex < this.spectra.length - 1) {
      return this.selectSpectrum(this.currentSpectrumIndex + 1);
    }
    return this.getCurrentSpectrum();
  }

  /**
   * Go to previous spectrum
   * @returns {Object} Previous spectrum
   */
  previous() {
    if (this.currentSpectrumIndex > 0) {
      return this.selectSpectrum(this.currentSpectrumIndex - 1);
    }
    return this.getCurrentSpectrum();
  }

  /**
   * Search spectra by title
   * @param {string} query 
   * @returns {Array} Matching spectra
   */
  searchByTitle(query) {
    return this.parser.searchByTitle(query);
  }

  /**
   * Filter by metadata
   * @param {string} key 
   * @param {*} value 
   * @returns {Array} Matching spectra
   */
  filterByMetadata(key, value) {
    return this.parser.filterByMetadata(key, value);
  }

  /**
   * Reset view
   */
  resetView() {
    this.currentSpectrumIndex = 0;
    this.render();
  }

  /**
   * Export current spectrum as JSON
   * @returns {string} JSON string
   */
  exportJSON() {
    const spectrum = this.getCurrentSpectrum();
    return JSON.stringify(spectrum, null, 2);
  }

  /**
   * Export current spectrum peaks as CSV
   * @returns {string} CSV string
   */
  exportCSV() {
    const spectrum = this.getCurrentSpectrum();
    let csv = 'm/z,Intensity\n';
    spectrum.peaks.forEach(peak => {
      csv += `${peak.mz},${peak.intensity}\n`;
    });
    return csv;
  }

  /**
   * Render the viewer UI
   */
  render() {
    if (this.spectra.length === 0) {
      this.renderEmpty();
      return;
    }

    const spectrum = this.getCurrentSpectrum();
    const html = this.buildSpectrumHTML(spectrum);
    this.container.innerHTML = html;

    // Attach event listeners
    this.attachEventListeners();

    this.emit('rendered', { index: this.currentSpectrumIndex });
  }

  /**
   * Render empty state
   */
  renderEmpty() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: #999; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
        <h2 style="color: #333; margin-bottom: 10px;">No file loaded</h2>
        <p style="margin: 0;">Load an MGF file to begin viewing spectra</p>
      </div>
    `;
  }

  /**
   * Render loading state
   */
  renderLoading() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: #667eea; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 20px; animation: spin 1s linear infinite;">⌛</div>
        <p style="margin: 0; font-size: 16px;">Loading...</p>
      </div>
      <style>
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    `;
  }

  /**
   * Render error state
   * @param {string} message 
   */
  renderError(message) {
    this.container.innerHTML = `
      <div style="background: #ffebee; border-left: 4px solid #f44336; color: #c62828; padding: 20px; border-radius: 4px; margin: 20px;">
        <h3 style="margin-top: 0; color: #d32f2f;">Error loading file</h3>
        <p style="margin: 10px 0 0 0; font-size: 14px;">${this.escapeHtml(message)}</p>
      </div>
    `;
  }

  /**
   * Build HTML for spectrum display
   * @param {Object} spectrum 
   * @returns {string} HTML
   */
  buildSpectrumHTML(spectrum) {
    let html = `
      <div class="mgf-viewer" style="display: grid; grid-template-columns: 250px 1fr; gap: 0; height: 100%; background: white;">
        <div class="spectrum-list" style="border-right: 1px solid #e0e0e0; overflow-y: auto; background: #fafafa;">
    `;

    // Spectrum list
    this.spectra.forEach((spec, index) => {
      const title = spec.metadata.TITLE || 'Untitled';
      const isActive = index === this.currentSpectrumIndex ? 'active' : '';
      const bgColor = isActive ? '#667eea' : 'transparent';
      const color = isActive ? 'white' : '#333';

      html += `
        <div class="spectrum-item" data-index="${index}" 
             style="padding: 15px; border-bottom: 1px solid #e0e0e0; cursor: pointer; 
                    background: ${bgColor}; color: ${color}; transition: all 0.2s;"
             onmouseover="this.style.background = '${isActive ? '#667eea' : '#f0f0f0'}'" 
             onmouseout="this.style.background = '${bgColor}'">
          <div style="font-weight: 600; font-size: 12px; opacity: 0.8;">Spectrum ${index + 1}</div>
          <div style="font-size: 12px; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; title="${title}">${title}</div>
        </div>
      `;
    });

    html += `
        </div>
        <div class="spectrum-content" style="padding: 30px; overflow-y: auto;">
    `;

    // Spectrum detail
    if (spectrum.metadata.TITLE) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">${this.escapeHtml(spectrum.metadata.TITLE)}</h2>
        </div>
      `;
    }

    // Metadata
    if (Object.keys(spectrum.metadata).length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 14px; font-weight: 600; color: #333; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #667eea; padding-bottom: 8px;">Metadata</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      `;

      for (const [key, value] of Object.entries(spectrum.metadata)) {
        if (key === 'TITLE') continue;
        
        let displayValue = value;
        if (typeof value === 'object') {
          displayValue = JSON.stringify(value);
        }

        html += `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-weight: 500; color: #667eea; width: 150px;">${this.escapeHtml(key)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${this.escapeHtml(String(displayValue))}</td>
          </tr>
        `;
      }

      html += `
          </table>
        </div>
      `;
    }

    // Peaks
    if (spectrum.peaks.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 14px; font-weight: 600; color: #333; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #667eea; padding-bottom: 8px;">Peaks (${spectrum.peaks.length} total)</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; max-height: 400px; overflow-y: auto;">
            <thead>
              <tr style="background: #f5f5f5; position: sticky; top: 0;">
                <th style="padding: 10px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">m/z</th>
                <th style="padding: 10px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">Intensity</th>
              </tr>
            </thead>
            <tbody>
      `;

      spectrum.peaks.forEach(peak => {
        html += `
          <tr style="border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 8px 10px;">${peak.mz.toFixed(4)}</td>
            <td style="padding: 8px 10px;">${peak.intensity.toFixed(2)}</td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Attach event listeners to rendered elements
   */
  attachEventListeners() {
    const items = this.container.querySelectorAll('[data-index]');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.getAttribute('data-index'));
        this.selectSpectrum(index);
      });
    });
  }

  /**
   * Listen for events
   * @param {string} event 
   * @param {Function} callback 
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Emit event
   * @param {string} event 
   * @param {Object} data 
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  /**
   * Escape HTML special characters
   * @param {string} text 
   * @returns {string}
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }
  
  // ==========================================
  // New Architecture Methods
  // ==========================================
  
  /**
   * Attach event handlers to UI elements
   * Only used in new architecture
   */
  attachEventHandlers() {
    if (!this.refs) return;
    
    // Spectrum list click handler (event delegation)
    if (this.refs.spectrumList) {
      this.refs.spectrumList.addEventListener('click', (e) => {
        const item = e.target.closest('.spectrum-item');
        if (item) {
          const index = parseInt(item.dataset.index);
          if (!isNaN(index)) {
            this.selectSpectrum(index);
          }
        }
      });
    }
  }
  
  /**
   * Handle data loaded event
   * @param {Object} data - Event data
   */
  onDataLoaded(data) {
    if (!this.refs) return;
    
    // Show viewer, hide empty state
    this.ui.showViewer();
    
    // Update spectrum list
    if (typeof ComponentUpdaters !== 'undefined') {
      ComponentUpdaters.updateSpectrumList(
        this.refs.spectrumList,
        data.spectra,
        0
      );
      
      // Update statistics
      const stats = this.state.getStatistics();
      if (stats && this.refs.statsContent) {
        ComponentUpdaters.updateStatistics(this.refs.statsContent, stats);
      }
    }
    
    // Select first spectrum
    if (data.spectra.length > 0) {
      this.selectSpectrum(0);
    }
    
    // Emit event for backward compatibility
    this.emit('loaded', {
      spectraCount: data.spectra.length,
      metadata: data.metadata
    });
  }
  
  /**
   * Handle spectrum selected event
   * @param {Object} data - Event data
   */
  onSpectrumSelected(data) {
    if (!this.refs) return;
    
    const spectrum = data.spectrum;
    if (!spectrum) return;
    
    // Update spectrum list selection
    if (typeof ComponentUpdaters !== 'undefined') {
      ComponentUpdaters.updateSpectrumList(
        this.refs.spectrumList,
        this.state.get('spectra'),
        data.index
      );
      
      // Update spectrum details
      if (this.refs.spectrumDetails) {
        // Clear container
        this.refs.spectrumDetails.innerHTML = '';
        
        // Update title
        if (spectrum.metadata.TITLE) {
          ComponentUpdaters.updateSpectrumTitle(
            this.refs.spectrumDetails,
            spectrum.metadata.TITLE
          );
        }
        
        // Update metadata
        ComponentUpdaters.updateMetadata(
          this.refs.spectrumDetails,
          spectrum.metadata
        );
        
        // Update peak table
        ComponentUpdaters.updatePeakTable(
          this.refs.spectrumDetails,
          spectrum.peaks
        );
      }
      
      // Update plot (create if needed)
      if (this.refs.plotContainer) {
        if (!this.plot && typeof SpectrumPlot !== 'undefined') {
          this.plot = new SpectrumPlot(this.refs.plotContainer);
        }
        if (this.plot) {
          this.plot.setSpectrum(spectrum);
        }
      }
    }
    
    // Emit event for backward compatibility
    this.emit('spectrumChanged', { index: data.index, spectrum });
    this.emit('rendered', { index: data.index });
  }
}

// Export to global window object for browser
if (typeof window !== 'undefined') {
  window.MGFViewer = MGFViewer;
}
