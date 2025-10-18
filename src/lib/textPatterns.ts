/**
 * Text Pattern Library for Phase 2
 * Provides realistic, varied test strings for different contexts
 */

export enum TextPatternType {
  DEFAULT = 'default',
  I18N_GERMAN = 'i18n_german',
  I18N_ARABIC = 'i18n_arabic',
  I18N_CJK = 'i18n_cjk',
  UGC_COMMENT = 'ugc_comment',
  UGC_REVIEW = 'ugc_review',
  TECHNICAL = 'technical',
  FORMAL = 'formal',
}

interface TextPattern {
  short: string;
  medium: string;
  long: string;
}

/**
 * Pattern library organized by type
 */
export const TEXT_PATTERNS: Record<TextPatternType, TextPattern> = {
  [TextPatternType.DEFAULT]: {
    short: 'Internationalization Testing',
    medium: 'This is a substantially long text string designed to test overflow behavior',
    long: 'This is an extremely long text string specifically designed to stress-test text overflow, wrapping, ellipsis, and clipping behavior in user interface elements across different screen sizes and resolutions',
  },

  [TextPatternType.I18N_GERMAN]: {
    short: 'Übersetzung',
    medium: 'Übersetzung und Internationalisierung von Benutzeroberflächen',
    long: 'Übersetzung und Internationalisierung von Benutzeroberflächen erfordern sorgfältige Berücksichtigung von Textlängenvariation',
  },

  [TextPatternType.I18N_ARABIC]: {
    short: 'التدويل والترجمة',
    medium: 'اختبار تدفق النص من اليمين إلى اليسار والتخطيط',
    long: 'اختبار النصوص الطويلة باللغة العربية للتحقق من سلوك الفيض والقطع في واجهات المستخدم الحديثة',
  },

  [TextPatternType.I18N_CJK]: {
    short: '国際化テスト',
    medium: '文字列の長さと表示幅のテストケース',
    long: '这是一个专门设计用于测试用户界面元素中文本溢出、换行、省略号和裁剪行为的超长字符串',
  },

  [TextPatternType.UGC_COMMENT]: {
    short: 'OMG this is amazing!!!',
    medium: 'Hey everyone!! 👋 Just wanted to say this is INCREDIBLE and I love it so much 🎉🎊',
    long: 'OMG I literally can\'t even right now!!! 😱😱😱 This is absolutely THE BEST thing I\'ve ever seen and I just HAD to share with literally everyone I know because it\'s just THAT amazing!!!!! 🔥🔥🔥💯💯💯',
  },

  [TextPatternType.UGC_REVIEW]: {
    short: '⭐⭐⭐⭐⭐ Highly Recommend',
    medium: 'Absolutely fantastic product! Exceeded all my expectations and the customer service was top-notch',
    long: 'I was skeptical at first, but WOW! This completely exceeded my expectations. The quality is outstanding, delivery was super fast, and customer service went above and beyond. I\'ve already recommended this to 10+ friends. Definitely worth every penny! ⭐⭐⭐⭐⭐',
  },

  [TextPatternType.TECHNICAL]: {
    short: 'API Response Error',
    medium: 'ERR_CONNECTION_REFUSED: Unable to establish connection to remote server',
    long: 'ERROR: Failed to authenticate request. Invalid OAuth2 token provided. Please verify your credentials and ensure the access token has not expired (current timestamp: 1729268280000)',
  },

  [TextPatternType.FORMAL]: {
    short: 'Quarterly Financial Report',
    medium: 'Executive Summary: Third Quarter Results and Strategic Initiatives for Fiscal Year 2025',
    long: 'In accordance with regulatory requirements and corporate governance standards, we hereby present the comprehensive quarterly financial analysis, including revenue projections, expense allocations, and strategic recommendations for stakeholder consideration',
  },
};

/**
 * Specialized patterns for specific UI components
 */
export const COMPONENT_PATTERNS = {
  button: [
    'Submit Application',
    'Continue to Checkout',
    'Add to Shopping Cart',
    'Subscribe to Newsletter',
    'Download High-Resolution Version',
    'Proceed with International Shipping',
  ],

  link: [
    'Learn More About Our Services',
    'View Complete Terms and Conditions',
    'Read Customer Reviews and Testimonials',
    'Explore International Shipping Options',
  ],

  label: [
    'Email Address (Required)',
    'Full Legal Name as it Appears on ID',
    'International Mobile Phone Number',
    'Preferred Language and Communication Method',
  ],

  placeholder: [
    'Enter your full international address...',
    'Type your message here (maximum 500 characters)',
    'Search by product name, category, or SKU number',
    'johndoe@example-company-domain.com',
  ],

  heading: [
    'Übersetzung und Internationalisierung',
    'التدويل والتعريب',
    '国際化とローカライゼーション',
    'Configuration and Advanced Settings',
  ],

  notification: [
    'Your changes have been successfully saved to the database',
    'ERROR: Unable to process your request. Please try again later.',
    'Warning: You have unsaved changes that will be lost if you navigate away',
  ],

  breadcrumb: [
    'Home',
    'Products',
    'Categories',
    'Subcategories',
    'International Shipping Options',
    'Checkout and Payment Processing',
  ],
};

/**
 * Get a random pattern from an array (deterministic per session)
 */
let patternIndex = 0;
export function getRandomPattern(patterns: string[]): string {
  const index = patternIndex % patterns.length;
  patternIndex++;
  return patterns[index];
}

/**
 * Get text by length category
 */
export function getTextByLength(
  pattern: TextPattern,
  targetLength: 'short' | 'medium' | 'long'
): string {
  return pattern[targetLength];
}
