/**
 * MGFView.js Core Library - TypeScript Definitions
 * 
 * Provides type information for all exported classes and interfaces
 */

declare module '@saurabhgayali/mgfview' {
  /**
   * Main MGF file parser class
   */
  export class MGFParser {
    load(content: string): Promise<any>;
    parse(lines: string[]): any;
  }

  /**
   * Represents a single mass spectrometry spectrum
   */
  export class Spectrum {
    constructor(data: any);
    getTitle(): string | null;
    getPeakCount(): number;
    getPrecursorMz(): number | null;
    getPrecursorCharge(): number | null;
  }

  /**
   * Advanced filtering and search functionality
   */
  export class SearchFilter {
    filter(spectra: Spectrum[], criteria: any): { matched: Spectrum[], unmatched: Spectrum[] };
  }

  /**
   * Statistical analysis of spectra collections
   */
  export class StatisticsPanel {
    analyze(spectra: Spectrum[]): any;
  }

  /**
   * Multi-format data export (JSON, CSV, MGF)
   */
  export class ExportManager {
    exportJSON(spectra: Spectrum[]): string;
    exportCSV(spectra: Spectrum[]): string;
    exportMGF(spectra: Spectrum[]): string;
  }

  /**
   * Utility functions for mass spectrometry calculations
   */
  export class MGFUtils {
    static formatNumber(value: number, decimals: number): string;
    static formatMz(value: number): string;
  }

  /**
   * State management for viewer and application
   */
  export class ViewerState {
    constructor();
    setState(key: string, value: any): void;
    getState(key: string): any;
  }

  /**
   * Plugin base class
   */
  export class Plugin {
    name: string;
    version: string;
    execute(data: any): any;
  }

  /**
   * Plugin system manager
   */
  export class PluginSystem {
    register(plugin: Plugin): void;
    execute(pluginName: string, data: any): any;
  }

  /**
   * Mirror plot visualization plugin
   */
  export class MirrorPlotPlugin extends Plugin {
    name: string;
  }

  /**
   * Spectral similarity matching plugin
   */
  export class SimilarityPlugin extends Plugin {
    name: string;
  }

  /**
   * Spectrum annotation plugin
   */
  export class AnnotationPlugin extends Plugin {
    name: string;
  }

  /**
   * Spectrum comparison plugin
   */
  export class ComparisonPlugin extends Plugin {
    name: string;
  }

  /**
   * Core library version
   */
  export const version: string;
  
  /**
   * Core library name
   */
  export const name: string;

  /**
   * Get library version
   */
  export function getVersion(): string;

  /**
   * Get library information
   */
  export function getInfo(): {
    name: string;
    version: string;
    components: string[];
  };
}

declare module '@saurabhgayali/mgfview/core' {
  export * from '@saurabhgayali/mgfview';
}
