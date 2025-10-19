/**
 * Phase 9: Smart Text Generator
 * Generates varied, length-banded, role-appropriate test strings
 */

import { ElementType } from '@/types';

export enum TextLength {
  SHORT = 24,
  MEDIUM = 36,
  LONG = 48,
  VERY_LONG = 72,
  EXTREME = 120,
}

/**
 * Length-banded test strings with variety
 */
const BUTTON_STRINGS = {
  [TextLength.SHORT]: [
    'Confirm payment now',
    'Save and continue',
    'Accept all cookies',
  ],
  [TextLength.MEDIUM]: [
    'Confirm payment with card details',
    'Save changes and continue to next',
    'Accept all cookies and preferences',
  ],
  [TextLength.LONG]: [
    'Confirm payment with credit card processing',
    'Save all changes and continue to checkout flow',
    'Accept all cookies and privacy preferences now',
  ],
  [TextLength.VERY_LONG]: [
    'Confirm payment with credit card processing and billing verification',
    'Save all changes and continue to secure checkout payment processing',
  ],
  [TextLength.EXTREME]: [
    'Confirm payment with credit card processing, billing verification, and fraud protection systems activated for secure transaction',
  ],
};

const HEADING_STRINGS = {
  [TextLength.SHORT]: [
    'User Account Settings',
    'Payment Information',
  ],
  [TextLength.MEDIUM]: [
    'User Account Settings and Preferences',
    'Payment Information and Billing Details',
  ],
  [TextLength.LONG]: [
    'User Account Settings, Preferences, and Privacy Controls',
    'Payment Information, Billing Details, and Transaction History',
  ],
  [TextLength.VERY_LONG]: [
    'User Account Settings, Preferences, Privacy Controls, and Security Options Available',
  ],
  [TextLength.EXTREME]: [
    'User Account Settings, Preferences, Privacy Controls, Security Options, and Complete Profile Management Dashboard',
  ],
};

const EMAIL_STRINGS = {
  [TextLength.SHORT]: ['user@example.com'],
  [TextLength.MEDIUM]: ['very.long.user@example.com'],
  [TextLength.LONG]: ['very.long.user.name@example-domain.com'],
  [TextLength.VERY_LONG]: ['very.long.user.name.with.tags+billing@example-very-long-domain.com'],
  [TextLength.EXTREME]: ['very.long.user.name.with.tags+billing+department@example-very-long-international-domain.co.uk'],
};

/**
 * Get random varied string for element
 */
export function getSmartTestString(
  elementType: ElementType,
  originalLength: number = 10
): string {
  // Choose length band based on original
  const targetLength = chooseLengthBand(originalLength);
  
  // Get appropriate string for element type
  switch (elementType) {
    case ElementType.BUTTON:
    case ElementType.BUTTON_SUBMIT:
      return getRandomFromBand(BUTTON_STRINGS, targetLength);
    
    case ElementType.HEADING:
      return getRandomFromBand(HEADING_STRINGS, targetLength);
    
    case ElementType.INPUT_EMAIL:
      return getRandomFromBand(EMAIL_STRINGS, targetLength);
    
    case ElementType.INPUT_URL:
      return 'https://www.extremely-long-international-domain-name-for-overflow-testing.example.com/path/to/resource';
    
    case ElementType.INPUT_TEL:
      return '+1 (555) 123-4567 ext. 89012';
    
    case ElementType.INPUT_SEARCH:
      return 'searching for very specific international product with extremely long descriptive name';
    
    default:
      return getRandomFromBand(HEADING_STRINGS, targetLength);
  }
}

/**
 * Choose appropriate length band
 */
function chooseLengthBand(originalLength: number): TextLength {
  if (originalLength > 60) return TextLength.EXTREME;
  if (originalLength > 40) return TextLength.VERY_LONG;
  if (originalLength > 25) return TextLength.LONG;
  if (originalLength > 15) return TextLength.MEDIUM;
  return TextLength.SHORT;
}

/**
 * Get random string from length band
 */
function getRandomFromBand(
  bands: Record<TextLength, string[]>,
  length: TextLength
): string {
  const options = bands[length] || bands[TextLength.LONG];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get variety of lengths for batch testing
 */
export function getVariedLengths(count: number): TextLength[] {
  const lengths = [
    TextLength.SHORT,
    TextLength.MEDIUM,
    TextLength.LONG,
    TextLength.VERY_LONG,
    TextLength.EXTREME,
  ];
  
  const result: TextLength[] = [];
  for (let i = 0; i < count; i++) {
    result.push(lengths[i % lengths.length]);
  }
  
  return result;
}
