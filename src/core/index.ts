/**
 * Overflow Scout detection engine. Pure DOM code: no extension or UI APIs, so
 * it can run in the extension runtime, in tests, and later as an npm package.
 */
export { scanDocument, scanDocumentAsync } from './scan';
export { groupFindings, fingerprint, type Issue } from './group/group';
export {
  describeElement,
  elementLabel,
  elementSelector,
  type ElementDescription,
} from './select/describe';
export { PRESET_KINDS, PRESET_POOLS, getPreset, type PresetKind } from './text/presets';
export { sampleText } from './dom';
export { textCut, type TextCut } from './measure/cut';
export * from './types';
export * from './stress';
