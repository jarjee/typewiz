/**
 * TypeScript declarations for TypeWiz Enhanced runtime instrumentation
 */

declare global {
  interface Window {
    $_$twiz: any;
    __typewiz_enhanced_enabled: boolean;
  }

  var $_$twiz: any;
}

export {};