/**
 * Plot
 * 
 * Interactive spectrum plot visualization using HTML5 Canvas
 * Supports zoom, pan, hover tooltips, and peak selection
 */

class SpectrumPlot {
  /**
   * Create a new spectrum plot
   * @param {string|Element} container - Container selector or element
   * @param {Object} options - Plot options
   */
  constructor(container, options = {}) {
    console.log('🎨 SpectrumPlot constructor called with container:', container);
    
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;

    if (!this.container) {
      throw new Error('Invalid container: element not found');
    }
    
    console.log('📦 Container element:', this.container);
    console.log('📏 Container size:', this.container.clientWidth, 'x', this.container.clientHeight);
    console.log('📏 Container style height:', this.container.style.height);

    // Configuration
    // Use container dimensions, but fall back to reasonable defaults
    const containerWidth = this.container.clientWidth || 800;
    const containerHeight = this.container.clientHeight || 400;
    
    console.log('📐 Using dimensions:', containerWidth, 'x', containerHeight);
    
    this.options = {
      width: options.width || containerWidth,
      height: options.height || containerHeight,
      padding: options.padding || { top: 40, right: 20, bottom: 50, left: 60 },
      backgroundColor: options.backgroundColor || '#fafafa',
      peakColor: options.peakColor || '#667eea',
      peakWidth: options.peakWidth || 2,
      gridColor: options.gridColor || '#e0e0e0',
      axisColor: options.axisColor || '#333',
      tooltipBgColor: options.tooltipBgColor || '#333',
      tooltipTextColor: options.tooltipTextColor || '#fff',
      ...options
    };
    
    console.log('⚙️  Plot options:', this.options);

    // State
    this.spectrum = null;
    this.peaks = [];
    this.canvas = null;
    this.ctx = null;
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.selectedPeaks = [];
    this.hoveredPeak = null;

    // Event listeners
    this.listeners = {};

    // Initialize
    this.init();
  }

  /**
   * Initialize the plot
   */
  init() {
    console.log('⚙️  init() called');
    console.log('� Container:', this.container);
    console.log('📏 Container size: clientWidth=' + this.container.clientWidth + ', clientHeight=' + this.container.clientHeight);
    
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.border = '1px solid #e0e0e0';
    this.canvas.style.borderRadius = '4px';
    this.canvas.style.cursor = 'crosshair';
    this.canvas.style.boxSizing = 'border-box';

    this.container.appendChild(this.canvas);
    console.log('📌 Canvas appended to container');
    
    this.ctx = this.canvas.getContext('2d');
    console.log('🖌️  2D context obtained');

    // Attach event listeners
    this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
    this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
    this.canvas.addEventListener('mouseup', e => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', e => this.handleWheel(e));
    this.canvas.addEventListener('click', e => this.handleClick(e));
    
    console.log('✅ init() complete');
  }

  /**
   * Set spectrum data
   * @param {Spectrum|Object} spectrum 
   */
  setSpectrum(spectrum) {
    console.log('📊 setSpectrum() called');
    
    this.spectrum = spectrum;
    this.peaks = spectrum.peaks || [];
    
    console.log('  Peaks loaded:', this.peaks.length);
    
    this.selectedPeaks = [];
    this.hoveredPeak = null;
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    
    // Set canvas dimensions from container before drawing
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
    
    console.log('  Canvas dimensions set to:', this.canvas.width, 'x', this.canvas.height);
    console.log('✅ Drawing spectrum');
    
    this.draw();
    this.emit('spectrumSet', { spectrum });
  }

  /**
   * Draw the plot
   */
  draw() {
    const { ctx, canvas } = this;
    const { padding, backgroundColor } = this.options;

    if (!canvas || !ctx) {
      console.error('❌ Canvas or context not initialized!');
      return;
    }

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this.peaks.length === 0) {
      this.drawEmptyState();
      return;
    }

    // Draw grid
    this.drawGrid();

    // Draw axes
    this.drawAxes();

    // Draw peaks
    this.drawPeaks();

    // Draw tooltip if hovered
    if (this.hoveredPeak !== null) {
      this.drawTooltip(this.hoveredPeak);
    }
  }

  /**
   * Draw empty state
   */
  drawEmptyState() {
    const { ctx, canvas } = this;
    const text = 'No peaks to display';

    ctx.fillStyle = '#999';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }

  /**
   * Draw grid
   */
  drawGrid() {
    const { ctx, canvas } = this;
    const { padding, gridColor } = this.options;

    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Vertical grid lines (m/z)
    const mzRange = this.getMzRange();
    const mzStep = this.calculateStep(mzRange.max - mzRange.min);
    
    for (let mz = Math.ceil(mzRange.min / mzStep) * mzStep; mz <= mzRange.max; mz += mzStep) {
      const x = padding.left + ((mz - mzRange.min) / (mzRange.max - mzRange.min)) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, canvas.height - padding.bottom);
      ctx.stroke();
    }

    // Horizontal grid lines (intensity)
    const intensityRange = this.getIntensityRange();
    const intensityStep = this.calculateStep(intensityRange.max);
    
    for (let intensity = 0; intensity <= intensityRange.max; intensity += intensityStep) {
      const y = canvas.height - padding.bottom - (intensity / intensityRange.max) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();
    }
  }

  /**
   * Draw axes
   */
  drawAxes() {
    const { ctx, canvas } = this;
    const { padding, axisColor } = this.options;

    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 2;
    ctx.fillStyle = axisColor;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, canvas.height - padding.bottom);
    ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvas.height - padding.bottom);
    ctx.stroke();

    // X-axis labels (m/z)
    const mzRange = this.getMzRange();
    const mzStep = this.calculateStep(mzRange.max - mzRange.min);
    const plotWidth = canvas.width - padding.left - padding.right;

    for (let mz = Math.ceil(mzRange.min / mzStep) * mzStep; mz <= mzRange.max; mz += mzStep) {
      const x = padding.left + ((mz - mzRange.min) / (mzRange.max - mzRange.min)) * plotWidth;
      ctx.fillText(mz.toFixed(0), x, canvas.height - padding.bottom + 5);
    }

    // Y-axis label
    ctx.save();
    ctx.translate(15, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Intensity', 0, 0);
    ctx.restore();

    // X-axis label
    ctx.textAlign = 'center';
    ctx.fillText('m/z', canvas.width / 2, canvas.height - 10);
  }

  /**
   * Draw peaks
   */
  drawPeaks() {
    const { ctx, canvas } = this;
    const { padding, peakColor, peakWidth } = this.options;

    const mzRange = this.getMzRange();
    const intensityRange = this.getIntensityRange();
    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;

    ctx.strokeStyle = peakColor;
    ctx.lineWidth = peakWidth;

    this.peaks.forEach((peak, index) => {
      const x = padding.left + ((peak.mz - mzRange.min) / (mzRange.max - mzRange.min)) * plotWidth;
      const y = canvas.height - padding.bottom - (peak.intensity / intensityRange.max) * plotHeight;

      // Draw peak as vertical line
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - padding.bottom);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Highlight selected or hovered peaks
      if (this.selectedPeaks.includes(index) || this.hoveredPeak === index) {
        ctx.fillStyle = this.hoveredPeak === index ? '#ff6b6b' : '#ffd700';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  /**
   * Draw tooltip
   * @param {number} peakIndex 
   */
  drawTooltip(peakIndex) {
    const peak = this.peaks[peakIndex];
    if (!peak) return;

    const { ctx, canvas } = this;
    const { padding, tooltipBgColor, tooltipTextColor } = this.options;

    const mzRange = this.getMzRange();
    const intensityRange = this.getIntensityRange();
    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;

    const x = padding.left + ((peak.mz - mzRange.min) / (mzRange.max - mzRange.min)) * plotWidth;
    const y = canvas.height - padding.bottom - (peak.intensity / intensityRange.max) * plotHeight;

    const text = `m/z: ${peak.mz.toFixed(4)}\nIntensity: ${peak.intensity.toFixed(2)}`;
    const lines = text.split('\n');

    ctx.font = '12px Arial';
    ctx.fillStyle = tooltipBgColor;
    const width = 180;
    const height = 20 + lines.length * 15;
    const tooltipX = Math.min(x + 10, canvas.width - width - 10);
    const tooltipY = Math.max(y - height - 10, 5);

    ctx.fillRect(tooltipX, tooltipY, width, height);
    ctx.fillStyle = tooltipTextColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    lines.forEach((line, i) => {
      ctx.fillText(line, tooltipX + 10, tooltipY + 5 + i * 15);
    });
  }

  /**
   * Get m/z range
   * @returns {Object} {min, max}
   */
  getMzRange() {
    if (this.peaks.length === 0) {
      return { min: 0, max: 1000 };
    }

    const mzs = this.peaks.map(p => p.mz);
    return {
      min: Math.floor(Math.min(...mzs) - 50),
      max: Math.ceil(Math.max(...mzs) + 50)
    };
  }

  /**
   * Get intensity range
   * @returns {Object} {min, max}
   */
  getIntensityRange() {
    if (this.peaks.length === 0) {
      return { min: 0, max: 1000 };
    }

    const intensities = this.peaks.map(p => p.intensity);
    return {
      min: 0,
      max: Math.ceil(Math.max(...intensities) * 1.1)
    };
  }

  /**
   * Calculate step size for axis labels
   * @param {number} range 
   * @returns {number}
   */
  calculateStep(range) {
    const magnitude = Math.floor(Math.log10(range));
    const normalized = range / Math.pow(10, magnitude);

    let step = 1;
    if (normalized > 5) step = 5;
    else if (normalized > 2) step = 2;

    return step * Math.pow(10, magnitude);
  }

  /**
   * Handle mouse move
   * @param {MouseEvent} e 
   */
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find nearest peak
    const peakIndex = this.findNearestPeak(x, y);
    
    if (peakIndex !== this.hoveredPeak) {
      this.hoveredPeak = peakIndex;
      this.draw();
      this.emit('peakHovered', { index: peakIndex, peak: this.peaks[peakIndex] || null });
    }
  }

  /**
   * Handle mouse down
   * @param {MouseEvent} e 
   */
  handleMouseDown(e) {
    this.isPanning = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
  }

  /**
   * Handle mouse up
   */
  handleMouseUp() {
    this.isPanning = false;
  }

  /**
   * Handle wheel (zoom)
   * @param {WheelEvent} e 
   */
  handleWheel(e) {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoomLevel *= delta;
    this.zoomLevel = Math.max(1, Math.min(10, this.zoomLevel));

    this.draw();
    this.emit('zoomed', { zoomLevel: this.zoomLevel });
  }

  /**
   * Handle click
   * @param {MouseEvent} e 
   */
  handleClick(e) {
    if (this.hoveredPeak !== null) {
      const isSelected = this.selectedPeaks.includes(this.hoveredPeak);
      if (e.ctrlKey || e.metaKey) {
        // Toggle selection with Ctrl/Cmd
        if (isSelected) {
          this.selectedPeaks = this.selectedPeaks.filter(i => i !== this.hoveredPeak);
        } else {
          this.selectedPeaks.push(this.hoveredPeak);
        }
      } else {
        // Single selection
        this.selectedPeaks = [this.hoveredPeak];
      }

      this.draw();
      this.emit('peakSelected', {
        index: this.hoveredPeak,
        peak: this.peaks[this.hoveredPeak],
        selected: this.selectedPeaks
      });
    }
  }

  /**
   * Find nearest peak to coordinates
   * @param {number} x 
   * @param {number} y 
   * @returns {number|null} Peak index or null
   */
  findNearestPeak(x, y) {
    const { canvas } = this;
    const { padding } = this.options;

    const mzRange = this.getMzRange();
    const intensityRange = this.getIntensityRange();
    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;

    let nearest = null;
    let minDistance = 15; // Click tolerance in pixels

    this.peaks.forEach((peak, index) => {
      const peakX = padding.left + ((peak.mz - mzRange.min) / (mzRange.max - mzRange.min)) * plotWidth;
      const peakY = canvas.height - padding.bottom - (peak.intensity / intensityRange.max) * plotHeight;

      const distance = Math.sqrt((x - peakX) ** 2 + (y - peakY) ** 2);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = index;
      }
    });

    return nearest;
  }

  /**
   * Reset view
   */
  resetView() {
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.selectedPeaks = [];
    this.hoveredPeak = null;
    this.draw();
    this.emit('viewReset', {});
  }

  /**
   * Export as PNG
   * @returns {string} Data URL
   */
  exportPNG() {
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Export as SVG
   * @returns {string} SVG string
   */
  exportSVG() {
    const { canvas } = this;
    let svg = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${canvas.width}" height="${canvas.height}" fill="${this.options.backgroundColor}"/>`;

    // Add peaks
    const { padding } = this.options;
    const mzRange = this.getMzRange();
    const intensityRange = this.getIntensityRange();
    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;

    this.peaks.forEach(peak => {
      const x = padding.left + ((peak.mz - mzRange.min) / (mzRange.max - mzRange.min)) * plotWidth;
      const y = canvas.height - padding.bottom - (peak.intensity / intensityRange.max) * plotHeight;

      svg += `<line x1="${x}" y1="${canvas.height - padding.bottom}" x2="${x}" y2="${y}" stroke="${this.options.peakColor}" stroke-width="${this.options.peakWidth}"/>`;
    });

    svg += '</svg>';
    return svg;
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
   * Destroy plot
   */
  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

// Export to global window object for browser
if (typeof window !== 'undefined') {
  window.SpectrumPlot = SpectrumPlot;
}
