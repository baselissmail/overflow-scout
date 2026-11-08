/**
 * Stress text generation. Pure string logic: given the pieces of one string
 * (the text nodes of one block, e.g. "Save " and "changes" in
 * `Save <b>changes</b>`), returns longer replacements for each piece.
 */
import type { StressIntensity } from './expansion';
import { translatedLength } from './expansion';
import type { Random } from './random';
import { createRandom, hashString, pick, randomIndex } from './random';
import type { SampleLanguage } from './samples';
import { LANGUAGE_SAMPLES, LONG_WORDS } from './samples';

/**
 * - `translation`: keeps the original and appends more of its own words, up to
 *   the expected translated length. The text stays readable and recognizable,
 *   in the page's own language and script.
 * - `pseudo`: accents every letter and wraps the string in brackets; a missing
 *   `]` shows at a glance that the end was cut off. Opt-in: it reads as
 *   gibberish to anyone who hasn't met pseudo-localization.
 * - `long-words`: appends a long unbreakable word, URL, or email address.
 * - `language`: replaces the text with real text in another language and script.
 */
export type StressStrategy = 'translation' | 'pseudo' | 'long-words' | 'language';

export const STRESS_STRATEGIES = [
  'translation',
  'pseudo',
  'long-words',
  'language',
] as const satisfies readonly StressStrategy[];

export interface TextStressOptions {
  strategy: StressStrategy;
  intensity: StressIntensity;
  /** Language for the `language` strategy. */
  language: SampleLanguage;
  seed: number;
  /**
   * Makes every string this many times as long (2 doubles it), in place of
   * the translation table that `intensity` picks from. For a custom test.
   */
  scale?: number;
}

const LETTER = /\p{L}/u;
const UNSPACED_SCRIPT =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

/** Accented look-alikes of similar width, so pseudo text keeps its shape. */
const ACCENTED: Readonly<Record<string, string>> = Object.fromEntries(
  Array.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter, index) => [
    letter,
    Array.from('åƀçðéƒĝĥîĵķļɱñöþǫŕšţûṽŵẋýžÅƁÇÐÉƑĜĤÎĴĶĻṀÑÖÞǪŔŠŢÛṼŴẊÝŽ')[index] ?? letter,
  ]),
);

/** True when the text has letters, i.e. something a translator would translate. */
export function hasLetters(text: string): boolean {
  return LETTER.test(text);
}

/** Replaces ASCII letters with accented look-alikes. */
export function accent(text: string): string {
  return text.replace(/[A-Za-z]/g, (letter) => ACCENTED[letter] ?? letter);
}

let graphemeSegmenter: Intl.Segmenter | undefined;

/**
 * Splits text into user-perceived characters, so a cut never separates a
 * combining mark (Thai vowels, Arabic tanween) from its base letter. Text
 * without combining marks takes the fast path.
 */
function graphemes(text: string): string[] {
  if (!/\p{M}/u.test(text)) return Array.from(text);
  graphemeSegmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(graphemeSegmenter.segment(text), (segment) => segment.segment);
}

/** Length in characters as a reader counts them: graphemes, with whitespace collapsed. */
export function textLength(parts: readonly string[]): number {
  return graphemes(parts.join('').replace(/\s+/g, ' ').trim()).length;
}

interface Piece {
  lead: string;
  content: string;
  trail: string;
  /** Characters of content, whitespace collapsed. */
  length: number;
  letters: boolean;
}

function toPiece(value: string): Piece {
  const lead = /^\s*/.exec(value)?.[0] ?? '';
  const rest = value.slice(lead.length);
  const content = rest.trimEnd();
  const trail = rest.slice(content.length);
  return {
    lead,
    content,
    trail,
    length: graphemes(content.replace(/\s+/g, ' ')).length,
    letters: hasLetters(content),
  };
}

/** Splits `total` across pieces in proportion to their weights (largest remainder). */
function allocate(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum === 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (total * weight) / sum);
  const shares = exact.map(Math.floor);
  let left = total - shares.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (left <= 0) break;
    shares[index] = (shares[index] ?? 0) + 1;
    left -= 1;
  }
  return shares;
}

/** Characters of a cyclic filler source, and the indexes where words start. */
interface FillerSource {
  units: readonly string[];
  starts: readonly number[];
}

function wordSource(words: readonly string[]): FillerSource {
  const units = graphemes(`${words.join(' ')} `);
  const starts = [0];
  units.forEach((unit, index) => {
    if (unit === ' ' && index + 1 < units.length) starts.push(index + 1);
  });
  return { units, starts };
}

function characterSource(text: string): FillerSource {
  const units = graphemes(text);
  return { units, starts: units.map((_, index) => index) };
}

const sampleSources = new Map<SampleLanguage, FillerSource>();

function sampleSource(language: SampleLanguage): FillerSource {
  let source = sampleSources.get(language);
  if (!source) {
    const sample = LANGUAGE_SAMPLES[language];
    source = sample.spaced ? wordSource(sample.text.split(/\s+/)) : characterSource(sample.text);
    sampleSources.set(language, source);
  }
  return source;
}

/** An endless supply of filler characters, cycling through a source from a random start. */
class Filler {
  private position: number;
  private readonly wordStarts: ReadonlySet<number>;

  constructor(
    private readonly source: FillerSource,
    random: Random,
  ) {
    this.position = source.starts[randomIndex(random, source.starts.length)] ?? 0;
    this.wordStarts = new Set(source.starts);
  }

  private atWordStart(position: number): boolean {
    return this.wordStarts.has(position % this.source.units.length);
  }

  /**
   * Whole words of about `count` characters: stops at the word boundary
   * nearest to it (a tie goes longer), so the filler never ends in a cut word
   * or two words run together. Scripts written without spaces have a boundary
   * at every character, so they come out exact. May be empty for a tiny count.
   */
  takeWords(count: number): string {
    const { units } = this.source;
    if (count <= 0 || !units.some((unit) => unit !== ' ')) return '';
    while (!this.atWordStart(this.position)) this.position += 1;
    let out = '';
    let length = 0;
    while (length < count) {
      // The next word, with the space after it (none in unspaced scripts).
      let word = '';
      let next = this.position;
      do {
        word += units[next % units.length] ?? '';
        next += 1;
      } while (!this.atWordStart(next));
      const longer = graphemes(`${out}${word}`.trimEnd()).length;
      if (count - length < longer - count) break;
      out += word;
      length = longer;
      this.position = next;
    }
    return out.trimEnd();
  }

  private next(): string {
    const { units } = this.source;
    const unit = units[this.position % units.length] ?? '';
    this.position += 1;
    return unit;
  }

  /** The next `count` characters, never starting or ending with a space. */
  take(count: number): string {
    const { units } = this.source;
    if (count <= 0 || !units.some((unit) => unit !== ' ')) return '';
    let unit = this.next();
    while (unit === ' ') unit = this.next();
    let out = unit;
    for (let taken = 1; taken < count; taken += 1) {
      unit = this.next();
      if (unit === ' ' && taken === count - 1) unit = this.next();
      out += unit;
    }
    return out;
  }
}

/**
 * Filler made from the string itself: its own words (accented for pseudo-locale),
 * or its characters in scripts written without spaces.
 */
function selfFiller(
  contents: string,
  unspaced: boolean,
  random: Random,
  transform: (word: string) => string = (word) => word,
): Filler {
  return new Filler(
    unspaced
      ? characterSource(contents)
      : wordSource(contents.split(/\s+/).filter(Boolean).map(transform)),
    random,
  );
}

function isUnspaced(text: string): boolean {
  return UNSPACED_SCRIPT.test(text) && !/\s/.test(text.trim());
}

/** Appends `extra` characters of filler to `content`, separated as the script needs. */
function grow(content: string, extra: number, filler: Filler, separator: string): string {
  if (extra <= 0) return content;
  if (extra <= separator.length) return content + filler.take(extra);
  return content + separator + filler.take(extra - separator.length);
}

/** Appends about `extra` characters of whole words to `content`: readable, never cut mid-word. */
function growWords(content: string, extra: number, filler: Filler, separator: string): string {
  const words = extra > separator.length ? filler.takeWords(extra - separator.length) : '';
  return words === '' ? content : content + separator + words;
}

function stringRandom(parts: readonly string[], options: TextStressOptions): Random {
  return createRandom(hashString(parts.join(''), options.seed >>> 0));
}

/**
 * Returns stressed replacements for the pieces of one string. Pieces without
 * letters (numbers, prices, punctuation) are left as they are, because they
 * aren't translated. Leading and trailing whitespace is always preserved.
 */
export function stressParts(parts: readonly string[], options: TextStressOptions): string[] {
  const pieces = parts.map(toPiece);
  const letterPieces = pieces.filter((piece) => piece.letters);
  if (letterPieces.length === 0) return [...parts];

  const random = stringRandom(parts, options);
  const length = textLength(parts);
  const extra =
    (options.scale === undefined
      ? translatedLength(length, options.intensity)
      : Math.round(length * options.scale)) - length;
  const shares = allocate(
    extra,
    pieces.map((piece) => (piece.letters ? Math.max(1, piece.length) : 0)),
  );
  const contents = letterPieces.map((piece) => piece.content).join(' ');
  const unspaced = isUnspaced(contents);
  const separator = unspaced ? '' : ' ';
  const first = pieces.findIndex((piece) => piece.letters);
  const last = pieces.findLastIndex((piece) => piece.letters);

  const rebuild = (transform: (piece: Piece, index: number) => string) =>
    pieces.map((piece, index) =>
      piece.letters ? piece.lead + transform(piece, index) + piece.trail : (parts[index] ?? ''),
    );

  switch (options.strategy) {
    case 'translation': {
      const filler = selfFiller(contents, unspaced, random);
      return rebuild((piece, index) =>
        growWords(piece.content, shares[index] ?? 0, filler, separator),
      );
    }
    case 'pseudo': {
      const filler = selfFiller(contents, unspaced, random, accent);
      // The brackets count toward the expected length.
      const trimmed = allocate(
        Math.max(0, extra - 2),
        pieces.map((piece) => (piece.letters ? Math.max(1, piece.length) : 0)),
      );
      return rebuild((piece, index) => {
        const body = growWords(accent(piece.content), trimmed[index] ?? 0, filler, separator);
        return `${index === first ? '[' : ''}${body}${index === last ? ']' : ''}`;
      });
    }
    case 'long-words': {
      const token = pick(random, LONG_WORDS[options.intensity]);
      return rebuild((piece, index) =>
        index === last ? `${piece.content} ${token}` : piece.content,
      );
    }
    case 'language': {
      const sample = LANGUAGE_SAMPLES[options.language];
      const filler = new Filler(sampleSource(options.language), random);
      return rebuild((piece, index) =>
        filler.take(Math.max(1, Math.ceil((piece.length + (shares[index] ?? 0)) * sample.density))),
      );
    }
  }
}

/** Stresses a standalone string, such as a placeholder or a button value. */
export function stressText(text: string, options: TextStressOptions): string {
  return stressParts([text], options)[0] ?? text;
}

/** The characters a letter-free text grows by: its digits, so a count reads as a bigger count. */
function ownCharacters(text: string): string {
  return /\d/.test(text) ? text.replace(/\D/g, '') : text.replace(/\s/g, '');
}

/**
 * Resizes a string to about `target` characters for breaking-point search:
 * longer by appending translation filler, shorter by cutting from the end.
 * Exact to the character by default (a length slider, a search); with
 * `wholeWords`, growth stops at the nearest whole word, for text people read.
 * Callers should measure the result with `textLength`.
 *
 * Text with letters grows by its own words, and its numbers stay as they are.
 * Text without any letters (a count, a price) grows by its own digits.
 */
export function resizeParts(
  parts: readonly string[],
  target: number,
  seed: number,
  { wholeWords = false }: { wholeWords?: boolean } = {},
): string[] {
  const length = textLength(parts);
  if (target === length) return [...parts];
  const pieces = parts.map(toPiece);

  if (target > length) {
    const words = pieces.some((piece) => piece.letters);
    const grows = (piece: Piece) => (words ? piece.letters : piece.length > 0);
    const growing = pieces.filter(grows);
    if (growing.length === 0) return [...parts];
    const random = createRandom(hashString(parts.join(''), seed >>> 0));
    const contents = growing.map((piece) => piece.content).join(' ');
    const unspaced = !words || isUnspaced(contents);
    const filler = words
      ? selfFiller(contents, unspaced, random)
      : new Filler(characterSource(ownCharacters(contents)), random);
    const shares = allocate(
      target - length,
      pieces.map((piece) => (grows(piece) ? Math.max(1, piece.length) : 0)),
    );
    return pieces.map((piece, index) =>
      grows(piece)
        ? piece.lead +
          (wholeWords ? growWords : grow)(
            piece.content,
            shares[index] ?? 0,
            filler,
            unspaced ? '' : ' ',
          ) +
          piece.trail
        : (parts[index] ?? ''),
    );
  }

  // Keep whole pieces while they fit, then cut the first piece that doesn't.
  // Lengths are measured on the joined result so spaces between pieces count.
  const result = parts.map(() => '');
  for (const [index, piece] of pieces.entries()) {
    result[index] = parts[index] ?? '';
    if (textLength(result) <= target) continue;
    const characters = graphemes(piece.content);
    const withKept = (count: number) =>
      count === 0 ? '' : piece.lead + characters.slice(0, count).join('') + piece.trail;
    let low = 0;
    let high = characters.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      result[index] = withKept(middle);
      if (textLength(result) <= target) low = middle;
      else high = middle - 1;
    }
    result[index] = withKept(low);
    break;
  }
  return result;
}
