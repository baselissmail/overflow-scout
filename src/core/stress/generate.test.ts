import { describe, expect, it } from 'vitest';

import { STRESS_INTENSITIES, translatedLength } from './expansion';
import type { TextStressOptions } from './generate';
import { accent, hasLetters, resizeParts, stressParts, stressText, textLength } from './generate';
import { LANGUAGE_SAMPLES, LONG_WORDS, SAMPLE_LANGUAGES } from './samples';

const options = (overrides: Partial<TextStressOptions> = {}): TextStressOptions => ({
  strategy: 'translation',
  intensity: 'worst',
  language: 'de',
  seed: 1,
  ...overrides,
});

describe('translation strategy', () => {
  it('keeps the original as a prefix and reaches the translated length', () => {
    for (const intensity of STRESS_INTENSITIES) {
      const stressed = stressText('Save changes', options({ intensity }));
      expect(stressed.startsWith('Save changes ')).toBe(true);
      expect(textLength([stressed])).toBe(translatedLength(12, intensity));
    }
  });

  it('pads with accented copies of the string’s own words', () => {
    const stressed = stressText('Save changes', options());
    expect(stressed.slice('Save changes '.length)).toMatch(/^[Šåṽéçĥñĝš ]+$/u);
  });

  it('preserves leading and trailing whitespace', () => {
    const stressed = stressText('  Settings\n', options());
    expect(stressed.startsWith('  Settings ')).toBe(true);
    expect(stressed.endsWith('\n')).toBe(true);
  });

  it('never starts or ends the filler with a space', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const stressed = stressText('Open the quarterly report', options({ seed }));
      expect(stressed).not.toMatch(/\s{2}|\s$/);
    }
  });

  it('leaves strings without letters alone', () => {
    for (const text of ['42', '$19.99', '3:45 PM'.replace('PM', ''), '—', '  ']) {
      expect(stressText(text, options())).toBe(text);
    }
  });

  it('spreads growth across the pieces of one string, sized by the whole string', () => {
    const parts = ['You have ', '3', ' unread messages'];
    const stressed = stressParts(parts, options());
    expect(stressed[1]).toBe('3');
    expect(stressed[0]?.startsWith('You have ')).toBe(true);
    expect(stressed[2]?.startsWith(' unread messages')).toBe(true);
    // 26 characters grow by 80% as a whole, not by 100–200% per short piece.
    expect(textLength(stressed)).toBe(translatedLength(textLength(parts), 'worst'));
  });

  it('grows unspaced scripts without inserting spaces', () => {
    const stressed = stressText('保存する', options());
    expect(stressed.startsWith('保存する')).toBe(true);
    expect(stressed).not.toMatch(/\s/);
    expect(textLength([stressed])).toBe(translatedLength(4, 'worst'));
  });

  it('keeps Thai vowels attached to their consonants', () => {
    const stressed = stressText('บันทึก', options({ seed: 3 }));
    // A combining mark right after the original text would mean a split grapheme.
    expect(stressed.slice('บันทึก'.length)).not.toMatch(/^\p{M}/u);
  });

  it('is deterministic per seed and varies between seeds', () => {
    const text = 'Download the latest invoice';
    expect(stressText(text, options({ seed: 9 }))).toBe(stressText(text, options({ seed: 9 })));
    const variants = new Set(
      Array.from({ length: 10 }, (_, seed) => stressText(text, options({ seed }))),
    );
    expect(variants.size).toBeGreaterThan(1);
  });
});

describe('pseudo strategy', () => {
  it('accents letters, brackets the string, and grows it', () => {
    const stressed = stressText('Save changes', options({ strategy: 'pseudo' }));
    expect(stressed).toMatch(/^\[Šåṽé çĥåñĝéš .+\]$/u);
    expect(textLength([stressed])).toBe(translatedLength(12, 'worst'));
  });

  it('opens the bracket on the first piece and closes it on the last', () => {
    const stressed = stressParts(['Save ', 'changes', ' 2'], options({ strategy: 'pseudo' }));
    expect(stressed[0]?.startsWith('[Šåṽé')).toBe(true);
    expect(stressed[1]?.endsWith(']')).toBe(true);
    expect(stressed[2]).toBe(' 2');
  });

  it('maps every ASCII letter to a single look-alike character', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const accented = accent(letters);
    expect(Array.from(accented)).toHaveLength(letters.length);
    expect(new Set(accented).size).toBe(letters.length);
    expect(accented).not.toMatch(/[A-Za-z]/);
  });
});

describe('long-words strategy', () => {
  it('appends one unbreakable token from the intensity’s list', () => {
    for (const intensity of STRESS_INTENSITIES) {
      const stressed = stressParts(
        ['Read ', 'more'],
        options({ strategy: 'long-words', intensity }),
      );
      expect(stressed[0]).toBe('Read ');
      const token = stressed[1]?.replace(/^more /, '') ?? '';
      expect(LONG_WORDS[intensity]).toContain(token);
    }
  });

  it('gets longer with intensity', () => {
    const lengths = (list: readonly string[]) => list.map((word) => Array.from(word).length);
    expect(Math.max(...lengths(LONG_WORDS.realistic))).toBeLessThanOrEqual(26);
    expect(Math.min(...lengths(LONG_WORDS.worst))).toBeGreaterThan(26);
    expect(Math.max(...lengths(LONG_WORDS.worst))).toBeLessThanOrEqual(40);
    expect(Math.min(...lengths(LONG_WORDS.extreme))).toBeGreaterThan(40);
  });

  it('only uses reserved domains for URLs and emails', () => {
    for (const word of Object.values(LONG_WORDS).flat()) {
      if (/[@/]/.test(word))
        expect(word).toMatch(/\.example(\.(com|org|net))?(\/|$|\?)|example\.(com|org|net)/);
    }
  });
});

describe('language strategy', () => {
  const scripts = {
    de: /\p{Script=Latin}/u,
    fi: /\p{Script=Latin}/u,
    ru: /\p{Script=Cyrillic}/u,
    ar: /\p{Script=Arabic}/u,
    ja: /[\p{Script=Han}\p{Script=Hiragana}]/u,
    th: /\p{Script=Thai}/u,
  } as const;

  it.each(SAMPLE_LANGUAGES)('replaces text with %s sample text', (language) => {
    const stressed = stressText('Save changes', options({ strategy: 'language', language }));
    expect(stressed).toMatch(scripts[language]);
    expect(stressed).not.toContain('Save');
    const expected = Math.ceil(translatedLength(12, 'worst') * LANGUAGE_SAMPLES[language].density);
    expect(Math.abs(textLength([stressed]) - expected)).toBeLessThanOrEqual(1);
  });

  it('uses fewer, wider characters for Japanese', () => {
    const japanese = stressText('Save changes', options({ strategy: 'language', language: 'ja' }));
    expect(textLength([japanese])).toBe(12);
  });
});

describe('helpers', () => {
  it('detects letters in any script', () => {
    expect(hasLetters('Save')).toBe(true);
    expect(hasLetters('保存')).toBe(true);
    expect(hasLetters('حفظ')).toBe(true);
    expect(hasLetters('12:30 · 4%')).toBe(false);
  });

  it('measures length the way a reader sees it', () => {
    expect(textLength(['  Save\n   ', ' changes  '])).toBe(12);
  });
});

describe('resizeParts', () => {
  it('grows and shrinks to the requested length', () => {
    const parts = ['Save ', 'changes'];
    for (const target of [1, 4, 6, 12, 20, 57]) {
      expect(textLength(resizeParts(parts, target, 1))).toBe(target);
    }
  });

  it('returns the original pieces at the original length', () => {
    expect(resizeParts(['Save ', 'changes'], 12, 1)).toEqual(['Save ', 'changes']);
  });

  it('never splits graphemes when shrinking', () => {
    const shrunk = resizeParts(['บันทึกการเปลี่ยนแปลง'], 3, 1)[0] ?? '';
    expect(shrunk).toBe('บันทึ');
    expect(textLength([shrunk])).toBe(3);
  });
});
