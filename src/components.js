/**
 * Component Updaters
 * 
 * Efficient DOM update functions for viewer components
 * These functions update existing DOM elements without recreating them
 * 
 * Usage:
 *   ComponentUpdaters.updateSpectrumList(container, spectra, selectedIndex);
 *   ComponentUpdaters.updateMetadata(container, metadata);
 */

const ComponentUpdaters = {
  /**
   * Update spectrum list
   * Efficiently updates only what changed
   * @param {HTMLElement} container - Spectrum list container
   * @param {Array} spectra - Array of spectra
   * @param {number} selectedIndex - Currently selected spectrum index
   */
  updateSpectrumList(container, spectra, selectedIndex) {
    if (!container) return;
    
    // Get existing items
    const existingItems = container.querySelectorAll('.spectrum-item');
    
    // If count doesn't match, rebuild
    if (existingItems.length !== spectra.length) {
      this.rebuildSpectrumList(container, spectra, selectedIndex);
      return;
    }
    
    // Update existing items
    existingItems.forEach((item, index) => {
      const spectrum = spectra[index];
      const title = spectrum.metadata.TITLE || 'Untitled';
      const isActive = index === selectedIndex;
      
      // Update data attribute
      item.dataset.index = index;
      
      // Update classes
      if (isActive) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
      
      // Update content (only if changed)
      const numberDiv = item.querySelector('.number');
      const titleDiv = item.querySelector('.title');
      
      if (numberDiv && numberDiv.textContent !== `Spectrum ${index + 1}`) {
        numberDiv.textContent = `Spectrum ${index + 1}`;
      }
      
      if (titleDiv && titleDiv.textContent !== title) {
        titleDiv.textContent = title;
        titleDiv.title = title;
      }
    });
  },
  
  /**
   * Rebuild spectrum list (when count changes)
   * @param {HTMLElement} container - Spectrum list container
   * @param {Array} spectra - Array of spectra
   * @param {number} selectedIndex - Currently selected spectrum index
   */
  rebuildSpectrumList(container, spectra, selectedIndex) {
    container.innerHTML = '';
    
    spectra.forEach((spectrum, index) => {
      const item = document.createElement('div');
      item.className = 'spectrum-item';
      item.dataset.index = index;
      
      if (index === selectedIndex) {
        item.classList.add('active');
      }
      
      const title = spectrum.metadata.TITLE || 'Untitled';
      
      item.innerHTML = `
        <div class="number">Spectrum ${index + 1}</div>
        <div class="title" title="${this.escapeHtml(title)}">${this.escapeHtml(title)}</div>
      `;
      
      container.appendChild(item);
    });
  },
  
  /**
   * Update metadata panel
   * @param {HTMLElement} container - Metadata container
   * @param {Object} metadata - Spectrum metadata
   */
  updateMetadata(container, metadata) {
    if (!container) return;
    
    // Build metadata table
    let html = '<div style="margin-bottom: 30px;">';
    html += '<h3 style="font-size: 14px; font-weight: 600; color: #333; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #555555; padding-bottom: 8px;">Metadata</h3>';
    html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
    
    for (const [key, value] of Object.entries(metadata)) {
      if (key === 'TITLE') continue;
      
      let displayValue = value;
      if (typeof value === 'object') {
        displayValue = JSON.stringify(value);
      }
      
      html += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-weight: 500; color: #555555; width: 150px;">${this.escapeHtml(key)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${this.escapeHtml(String(displayValue))}</td>
        </tr>
      `;
    }
    
    html += '</table></div>';
    
    // Find or create metadata section
    let metadataSection = container.querySelector('.metadata-section');
    if (!metadataSection) {
      metadataSection = document.createElement('div');
      metadataSection.className = 'metadata-section';
      container.appendChild(metadataSection);
    }
    
    metadataSection.innerHTML = html;
  },
  
  /**
   * Update peak table
   * @param {HTMLElement} container - Peak table container
   * @param {Array} peaks - Array of peaks
   */
  updatePeakTable(container, peaks) {
    if (!container) return;
    
    let html = '<div style="margin-bottom: 30px;">';
    html += `<h3 style="font-size: 14px; font-weight: 600; color: #333; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #555555; padding-bottom: 8px;">Peaks (${peaks.length} total)</h3>`;
    html += '<div style="max-height: 400px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 4px;">';
    html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
    html += `
      <thead style="position: sticky; top: 0; background: #f5f5f5; z-index: 1;">
        <tr>
          <th style="padding: 10px 8px; text-align: right; color: #555555; font-weight: 600; border-bottom: 2px solid #ddd;">m/z</th>
          <th style="padding: 10px 8px; text-align: right; color: #555555; font-weight: 600; border-bottom: 2px solid #ddd;">Intensity</th>
        </tr>
      </thead>
      <tbody>
    `;
    
    peaks.forEach(peak => {
      html += `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 8px; text-align: right;">${peak.mz.toFixed(4)}</td>
          <td style="padding: 8px; text-align: right;">${peak.intensity.toFixed(2)}</td>
        </tr>
      `;
    });
    
    html += '</tbody></table></div></div>';
    
    // Find or create peak table section
    let peakSection = container.querySelector('.peak-table-section');
    if (!peakSection) {
      peakSection = document.createElement('div');
      peakSection.className = 'peak-table-section';
      container.appendChild(peakSection);
    }
    
    peakSection.innerHTML = html;
  },
  
  /**
   * Update statistics panel
   * @param {HTMLElement} container - Statistics container
   * @param {Object} stats - Statistics object
   */
  updateStatistics(container, stats) {
    if (!container) return;
    
    let html = '';
    
    // Total spectra
    html += this.createStatCard('Total Spectra', stats.totalSpectra);
    
    // Total peaks
    html += this.createStatCard('Total Peaks', stats.totalPeaks.toLocaleString());
    
    // Avg peaks
    html += this.createStatCard('Avg Peaks/Spectrum', stats.avgPeaksPerSpectrum.toFixed(1));
    
    // Peak range
    html += this.createStatCard('Peak Range', `${stats.minPeaks} - ${stats.maxPeaks}`);
    
    // Mass range
    if (stats.massRange.min !== Infinity) {
      html += this.createStatCard('Mass Range (m/z)', 
        `${stats.massRange.min.toFixed(2)} - ${stats.massRange.max.toFixed(2)}`);
    }
    
    // RT range
    if (stats.rtRange.min !== Infinity) {
      const rtMinMin = (stats.rtRange.min / 60).toFixed(2);
      const rtMaxMin = (stats.rtRange.max / 60).toFixed(2);
      html += this.createStatCard('RT Range (min)', `${rtMinMin} - ${rtMaxMin}`);
    }
    
    // Charge states
    if (Object.keys(stats.charges).length > 0) {
      const chargeStr = Object.entries(stats.charges)
        .map(([charge, count]) => `${charge}+ (${count})`)
        .join(', ');
      html += this.createStatCard('Charge States', chargeStr);
    }
    
    container.innerHTML = html;
  },
  
  /**
   * Create stat card HTML
   * @param {string} label - Stat label
   * @param {string|number} value - Stat value
   * @returns {string} HTML
   */
  createStatCard(label, value) {
    return `
      <div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #e0e0e0;">
        <div style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">${label}</div>
        <div style="font-size: 18px; font-weight: 600; color: #333;">${value}</div>
      </div>
    `;
  },
  
  /**
   * Update spectrum title
   * @param {HTMLElement} container - Container for title
   * @param {string} title - Spectrum title
   */
  updateSpectrumTitle(container, title) {
    if (!container) return;
    
    let titleSection = container.querySelector('.spectrum-title-section');
    if (!titleSection) {
      titleSection = document.createElement('div');
      titleSection.className = 'spectrum-title-section';
      titleSection.style.cssText = 'margin-bottom: 30px;';
      container.insertBefore(titleSection, container.firstChild);
    }
    
    titleSection.innerHTML = `
      <h2 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">${this.escapeHtml(title)}</h2>
    `;
  },
  
  /**
   * Update filter results display
   * @param {HTMLElement} container - Filter results container
   * @param {number} matchCount - Number of matching spectra
   * @param {number} totalCount - Total number of spectra
   */
  updateFilterResults(container, matchCount, totalCount) {
    if (!container) return;
    
    if (matchCount === totalCount) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = 'block';
    container.textContent = `Showing ${matchCount} of ${totalCount} spectra`;
  },
  
  /**
   * Clear a container
   * @param {HTMLElement} container - Container to clear
   */
  clear(container) {
    if (container) {
      container.innerHTML = '';
    }
  },
  
  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Export to global window object for browser
if (typeof window !== 'undefined') {
  window.ComponentUpdaters = ComponentUpdaters;
}
