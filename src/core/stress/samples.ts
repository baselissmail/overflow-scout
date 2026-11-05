/**
 * Real text for the Language samples and Long words strategies.
 *
 * Language samples are Article 1 of the Universal Declaration of Human Rights
 * in each language, from the official translations published by the UN
 * (OHCHR), which may be freely reproduced.
 */
import type { StressIntensity } from './expansion';

export type SampleLanguage = 'de' | 'fi' | 'ru' | 'ar' | 'ja' | 'th';

export const SAMPLE_LANGUAGES = [
  'de',
  'fi',
  'ru',
  'ar',
  'ja',
  'th',
] as const satisfies readonly SampleLanguage[];

export interface LanguageSample {
  /** English name, for the UI. */
  name: string;
  direction: 'ltr' | 'rtl';
  /** Whether words are separated by spaces (Japanese and Thai aren't). */
  spaced: boolean;
  /**
   * Characters needed per character of English for similar width. Japanese
   * glyphs are full-width, about twice as wide as average Latin letters.
   */
  density: number;
  text: string;
}

export const LANGUAGE_SAMPLES: Readonly<Record<SampleLanguage, LanguageSample>> = {
  de: {
    name: 'German',
    direction: 'ltr',
    spaced: true,
    density: 1,
    text: 'Alle Menschen sind frei und gleich an Würde und Rechten geboren. Sie sind mit Vernunft und Gewissen begabt und sollen einander im Geist der Brüderlichkeit begegnen.',
  },
  fi: {
    name: 'Finnish',
    direction: 'ltr',
    spaced: true,
    density: 1,
    text: 'Kaikki ihmiset syntyvät vapaina ja tasavertaisina arvoltaan ja oikeuksiltaan. Heille on annettu järki ja omatunto, ja heidän on toimittava toisiaan kohtaan veljeyden hengessä.',
  },
  ru: {
    name: 'Russian',
    direction: 'ltr',
    spaced: true,
    density: 1,
    text: 'Все люди рождаются свободными и равными в своем достоинстве и правах. Они наделены разумом и совестью и должны поступать в отношении друг друга в духе братства.',
  },
  ar: {
    name: 'Arabic',
    direction: 'rtl',
    spaced: true,
    density: 1,
    text: 'يولد جميع الناس أحراراً متساوين في الكرامة والحقوق. وقد وهبوا عقلاً وضميراً وعليهم أن يعامل بعضهم بعضاً بروح الإخاء.',
  },
  ja: {
    name: 'Japanese',
    direction: 'ltr',
    spaced: false,
    density: 0.5,
    text: 'すべての人間は、生まれながらにして自由であり、かつ、尊厳と権利とについて平等である。人間は、理性と良心とを授けられており、互いに同胞の精神をもって行動しなければならない。',
  },
  th: {
    name: 'Thai',
    direction: 'ltr',
    spaced: false,
    density: 1,
    text: 'มนุษย์ทั้งหลายเกิดมามีอิสระและเสมอภาคกันในเกียรติศักดิ์และสิทธิ ต่างมีเหตุผลและมโนธรรม และควรปฏิบัติต่อกันด้วยเจตนารมณ์แห่งภราดรภาพ',
  },
};

/**
 * Tokens without break opportunities, longer at each intensity: German,
 * Finnish and Dutch compounds, plus URLs and email addresses on reserved
 * domains (RFC 2606), so they can never point at a real site or inbox.
 */
export const LONG_WORDS: Readonly<Record<StressIntensity, readonly [string, ...string[]]>> = {
  realistic: [
    'Datenschutzerklärung',
    'Benutzereinstellungen',
    'Zahlungsinformationen',
    'Sicherheitseinstellungen',
    'Passwortwiederherstellung',
    'käyttöoikeusasetukset',
    'gebruikersinstellingen',
    'support.team@example.org',
  ],
  worst: [
    'Eingabeverarbeitungsfunktionen',
    'Benachrichtigungseinstellungen',
    'Arbeitsunfähigkeitsbescheinigung',
    'Kraftfahrzeughaftpflichtversicherung',
    'Rechtsschutzversicherungsgesellschaften',
    'järjestelmänvalvojaoikeudet',
    'arbeidsongeschiktheidsverzekering',
    'https://docs.example.com/getting-started',
  ],
  extreme: [
    'Donaudampfschifffahrtsgesellschaftskapitän',
    'epäjärjestelmällistyttämättömyydellänsäkäänköhän',
    'lentokonesuihkuturbiinimoottoriapumekaanikkoaliupseerioppilas',
    'Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz',
    'Grundstücksverkehrsgenehmigungszuständigkeitsübertragungsverordnung',
    'firstname.lastname@international-corporation.example.com',
    'https://www.very-long-company-name-for-testing.example/products/category/item?id=12345',
  ],
};
