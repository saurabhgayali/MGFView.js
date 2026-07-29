# MGFView.js

**Browser-Native Mass Spectrometry File Viewer for Proteomics and Metabolomics Research**

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21682475.svg)](https://doi.org/10.5281/zenodo.21682475)





MGFView.js is a lightweight, zero-dependency JavaScript library for viewing and analyzing Mascot Generic Format (MGF) mass spectrometry files directly in the browser. Designed for proteomics and metabolomics researchers, it provides instant access to spectral data without server uploads or specialized software installation.

---

## Why MGFView.js for Life Sciences Research?

### Designed for Biological Mass Spectrometry
MGFView.js is purpose-built for proteomics, metabolomics, and other life sciences applications where MGF files are the standard output format from mass spectrometry instruments and database search engines like Mascot, X!Tandem, and OMSSA.

**Common Research Workflows:**
- **Peptide Identification**: View MS/MS spectra from proteomics experiments, inspect precursor masses, charge states, and fragmentation patterns
- **Metabolite Analysis**: Examine metabolomics data with support for custom metadata fields from vendor-specific instruments
- **Quality Control**: Quickly assess spectral quality, peak distributions, and retention time patterns before database searching
- **Data Exploration**: Filter spectra by biological relevance (charge state, mass range, retention time windows)
- **Publication Figures**: Export high-resolution spectrum plots (4× PNG, SVG) for manuscripts and presentations
- **Teaching**: Demonstrate mass spectrometry concepts with interactive, real-time visualization

### Zero Dependencies = Maximum Portability
Unlike heavyweight desktop applications or server-dependent web tools, MGFView.js runs entirely in the browser with no external libraries, frameworks, or build tools required.

**Benefits for Researchers:**
- ✅ **No Installation**: Works instantly in any modern browser (Chrome, Firefox, Safari, Edge)
- ✅ **Data Privacy**: All processing happens locally - your sensitive research data never leaves your computer
- ✅ **Offline Capable**: Download the viewer once and use it anywhere, even on air-gapped computers or in the field
- ✅ **Cross-Platform**: Windows, macOS, Linux - identical functionality everywhere
- ✅ **Laboratory Computers**: No admin rights needed, works on locked-down institutional computers
- ✅ **Collaborative**: Share a single HTML file with colleagues for consistent data viewing

---

## Live Demo & Offline Use

### Try It Online
**[Launch Interactive Viewer](example.html)** - Full-featured demo with example datasets

### Download for Offline Use
**MGFView.js works completely offline** - ideal for laboratory computers, fieldwork, or secure research environments:

1. **Download the viewer**: Right-click [example.html](example.html) → Save As
2. **Save to your computer**: Choose any location (Desktop, USB drive, network share)
3. **Open locally**: Double-click the HTML file - no server required
4. **Load your data**: Drag and drop your MGF files directly into the browser

The entire application is self-contained in a single HTML file (~250KB) with embedded JavaScript and CSS. No internet connection needed after download.

**Use Cases:**
- Analyze data on secure/air-gapped research computers
- Work during flights or in remote field locations
- Ensure reproducibility by archiving the exact viewer version with your datasets
- Share results with collaborators who don't have specialized software

---

## Key Features

### Mass Spectrometry Capabilities
- **MGF Parser**: Robust parsing with support for all standard MGF fields (TITLE, PEPMASS, CHARGE, RTINSECONDS) plus vendor-specific metadata
- **Spectrum Visualization**: Interactive canvas-based plots with zoom, pan, and peak selection
- **Multi-Criteria Search**: Filter by title, precursor mass (Da/ppm tolerance), charge state, retention time, or custom metadata
- **Statistical Analysis**: Automated calculation of peak distributions, precursor mass histograms, charge state distributions
- **Batch Export**: JSON, CSV, MGF reconstruction, high-resolution PNG (4×), scalable SVG

### Technical Features
- **Zero Dependencies**: Pure vanilla JavaScript ES6+ - no React, jQuery, or external libraries
- **Small Footprint**: ~15KB gzipped core library
- **Modern Browser APIs**: Canvas 2D, File API, Drag & Drop - no legacy polyfills
- **Responsive Design**: Desktop and tablet optimized (tested with 16,000+ spectrum files)
- **Extensible**: Plugin system for custom processing and validation

### Input Formats
- File upload (drag & drop or file picker)
- Raw MGF text strings
- Remote URLs (HTTP/HTTPS)
- Pre-parsed JavaScript objects

### Output Formats
- **JSON**: Complete metadata and peak lists
- **CSV**: Tabular format for Excel/R/Python analysis
- **MGF**: Reconstruct original format (e.g., after filtering)
- **PNG**: Publication-quality plots (4× resolution, 300 DPI equivalent)
- **SVG**: Vector graphics for infinite scaling

---

## Quick Start

### Installation
```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="path/to/css/mgfview.css">
</head>
<body>
    <div id="viewer"></div>
    
    <!-- Single file - all modules included -->
    <script src="path/to/mgfview.js"></script>
    
    <script>
        const viewer = new MGFViewer('#viewer');
    </script>
</body>
</html>
```

### Basic Usage - Proteomics Workflow

```javascript
// Initialize parser
const parser = new MGFParser();

// Load MS/MS data from file upload
document.getElementById('file-input').addEventListener('change', async (e) => {
    const mgfFile = e.target.files[0];
    const result = await parser.loadBlob(mgfFile);
    console.log(`Loaded ${result.count} MS/MS spectra`);
});

// Filter doubly-charged peptides in specific m/z range
const search = new SearchFilter();
const filtered = search.filter(parser.getSpectra(), {
    chargeLow: 2,
    chargeHigh: 2,
    massLow: 400,
    massHigh: 1500
});

// Visualize spectrum
const plot = new SpectrumPlot('#plot-container');
plot.setSpectrum(filtered.matched[0].spectrum);

// Export publication figure (4× resolution)
const pngData = plot.exportPNG(4);
```

For complete API documentation, usage examples, and advanced workflows, see **[Full Documentation](doc/index.html)**.

---

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 60+ | ✅ Fully Supported |
| Firefox | 60+ | ✅ Fully Supported |
| Safari | 12+ | ✅ Fully Supported |
| Edge | 79+ | ✅ Fully Supported |

**Requirements**: ES6+ (classes, arrow functions, async/await), Canvas API, File API

---

## Performance

Tested with real-world proteomics datasets:

- **Small** (2 spectra): <10ms load time
- **Medium** (2,262 spectra): ~100ms load time
- **Large** (16,654 spectra): ~800ms load time
- **Memory**: ~1MB per 1,000 spectra (including metadata)

---

## Project Structure

```
MGFviewjs/
├── src/                   # Core library (10 modules)
│   ├── parser.js          # MGF parsing engine
│   ├── viewer.js          # High-level viewer API
│   ├── plot.js            # Canvas visualization
│   ├── search.js          # Multi-criteria filtering
│   ├── stats.js           # Statistical analysis
│   ├── export.js          # Multi-format export
│   └── ...
├── css/
│   └── mgfview.css        # Professional styling
├── doc/
│   └── index.html         # Complete documentation
├── example/
│   ├── small.mgf          # Test datasets
│   ├── medium.mgf
│   └── large.mgf
├── example.html           # Interactive demo (download for offline use)
└── README.md
```

---

## Documentation

- **[Full API Reference](doc/index.html)** - Complete documentation with all classes, methods, and examples
- **[Live Demo](example.html)** - Interactive viewer with example datasets
- **[Download for Offline](example.html)** - Right-click → Save As to use locally

---

## Citation

If you use MGFView.js in your research, please cite:

```
MGFView.js: Browser-Native Mass Spectrometry File Viewer
Version 1.0.0
https://github.com/saurabhgayali/MGFView.js
```

---

## License

MIT License - Free for academic and commercial use. See [LICENSE](LICENSE) for details.

---

## Contributing

Contributions welcome! Please ensure:
- No external dependencies added
- Browser compatibility maintained (Chrome 60+, Firefox 60+, Safari 12+)
- Code follows ES6+ standards
- Changes tested with [example.html](example.html)

---

**MGFView.js** - Empowering proteomics and metabolomics research with zero-dependency, offline-capable mass spectrometry data visualization.
