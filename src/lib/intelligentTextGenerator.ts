/**
 * Intelligent Text Generator
 * Smart length scaling with variety to prevent identical text
 */

import { ElementType } from '@/types';

// Pattern pools with variety
const BUTTON_PATTERNS = [
  'Save Changes',
  'Continue to Checkout',
  'Confirm Payment',
  'Accept and Continue',
  'Update Profile Settings',
  'Download Report',
  'Export Data',
  'Submit Form',
];

const LINK_PATTERNS = [
  'Privacy Policy',
  'Terms of Service',
  'Contact Support',
  'Help Center',
  'Documentation',
  'About Us',
  'Careers',
  'Press & Media',
  'Cookie Settings',
  'Accessibility',
];

const HEADING_PATTERNS = [
  'Account Settings',
  'Payment Information',
  'Security Options',
  'Notification Preferences',
  'Privacy Controls',
  'Billing History',
];

/**
 * Calculate smart target length (not 20x!)
 */
function getSmartTargetLength(originalLength: number): number {
  if (originalLength === 0) return 40; // Fallback
  
  // Smart scaling: shorter text gets higher multiplier
  if (originalLength < 10) return Math.ceil(originalLength * 3);    // 3x for very short
  if (originalLength < 20) return Math.ceil(originalLength * 2.5);  // 2.5x for short
  if (originalLength < 30) return Math.ceil(originalLength * 2);    // 2x for medium
  return Math.ceil(originalLength * 1.5);                           // 1.5x for already long
}

/**
 * Get varied pattern based on counter to prevent identical text
 */
function getVariedPattern(patterns: string[], counter: number): string {
  return patterns[counter % patterns.length];
}

/**
 * Extend pattern to target length intelligently
 */
function extendToLength(base: string, targetLength: number): string {
  if (base.length >= targetLength) return base;
  
  // Add contextual suffixes
  const extensions = [
    ' and Additional Options',
    ' with Full Details',
    ' Including All Features',
    ' for Complete Access',
    ' and Related Services',
    ' with Extended Support',
  ];
  
  let result = base;
  let extIndex = 0;
  
  while (result.length < targetLength && extIndex < extensions.length) {
    result += extensions[extIndex];
    extIndex++;
  }
  
  // If still too short, repeat base with ellipsis
  if (result.length < targetLength) {
    const remaining = targetLength - result.length;
    result += ' ' + base.substring(0, remaining);
  }
  
  return result.substring(0, targetLength);
}

/**
 * Generate intelligent test string with variety
 */
export function generateIntelligentText(
  elementType: ElementType,
  originalText: string,
  varietyCounter: number = 0
): string {
  const originalLength = originalText.trim().length;
  const targetLength = getSmartTargetLength(originalLength);
  
  let basePattern: string;
  
  // Select pattern based on element type
  switch (elementType) {
    case ElementType.BUTTON:
    case ElementType.BUTTON_SUBMIT:
      basePattern = getVariedPattern(BUTTON_PATTERNS, varietyCounter);
      break;
    
    case ElementType.LINK:
      basePattern = getVariedPattern(LINK_PATTERNS, varietyCounter);
      break;
    
    case ElementType.HEADING:
      basePattern = getVariedPattern(HEADING_PATTERNS, varietyCounter);
      break;
    
    case ElementType.INPUT_EMAIL:
      return 'very.long.user.email@example-domain.com';
    
    case ElementType.INPUT_URL:
      return 'https://www.long-domain-name-for-testing.example.com/path';
    
    case ElementType.INPUT_TEL:
      return '+1 (555) 123-4567 ext. 890';
    
    case ElementType.INPUT_SEARCH:
      return 'searching for specific item with long description';
    
    default:
      // Generic text - use original as base if meaningful
      if (originalLength > 5) {
        basePattern = originalText;
      } else {
        basePattern = getVariedPattern(LINK_PATTERNS, varietyCounter);
      }
  }
  
  // Extend to target length
  return extendToLength(basePattern, targetLength);
}

/**
 * Get multiple varied strings for batch testing
 */
export function generateBatchStrings(
  elementType: ElementType,
  elements: { text: string }[],
  startCounter: number = 0
): string[] {
  return elements.map((el, index) => 
    generateIntelligentText(elementType, el.text, startCounter + index)
  );
}
