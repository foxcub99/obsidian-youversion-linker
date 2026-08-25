import { requestUrl } from 'obsidian';
import tippy from 'tippy.js';
import { parseVerseData } from '../utils/VerseData';
import { applyFormatting, bodyForDisplay } from '../verses/formatVerse';
import type { VerseFormat } from '../settings/SettingsData';

type CacheElement = {
  info: { version: string; title: string };
  verses: string;
  err: boolean;
};

type CacheType = { [key: string]: CacheElement };

export default class LinkPreviewManager {
  static cache: CacheType = {};

  static async processLink(link: HTMLAnchorElement, formatSettings: VerseFormat) {
    const content = await this.processUrl(link.href, formatSettings);

    const popup = document.createElement('div');
    popup.addClass('preview-youversion');

    if (content.err) {
      popup
        .createSpan({ cls: 'error-youversion' })
        .setText('Verse preview is unavailable for this link.');
    } else {
      const formatted = applyFormatting(content.verses, formatSettings);
      const body = bodyForDisplay(formatted, formatSettings);
      const span = popup.createSpan({ cls: 'content-youversion' });
      (span as HTMLElement).innerHTML = body.replace(/\n/g, '<br>');
      popup
        .createSpan({ cls: 'info-youversion' })
        .setText(content.info.title + ' ' + content.info.version);
    }

    tippy(link, { content: popup, allowHTML: true });
  }

  static async processUrl(url: string, formatSettings: VerseFormat): Promise<CacheElement> {
    if (!this.cache[url]) {
      try {
        const parsed = this.parseBibleUrl(url);

        if (parsed && parsed.versesSpec && this.isMultiVerseSpec(parsed.versesSpec)) {
          const fmt = formatSettings?.text ?? 'translation';
          const verseNumbers = this.expandVerses(parsed.versesSpec);

          if (fmt === 'translation') {
            const rangeCombined = await this.processSingleVerse(url);
            if (rangeCombined.err) throw 1;

            const singleUrls = verseNumbers.map((n) =>
              this.buildSingleVerseUrl(parsed.versionId, parsed.book, parsed.chapter, n),
            );
            const singles = await Promise.all(singleUrls.map((u) => this.processSingleVerse(u)));

            const baseText = rangeCombined.verses;
            let curPos = 0;
            let result = '';

            for (let i = 0; i < verseNumbers.length; i++) {
              const markerVerse = verseNumbers[i];
              const single = singles[i];
              const sv = single && !single.err ? single.verses.trim() : '';
              if (!sv) continue;

              let idx = this.getFuzzyIndex(baseText, sv, curPos);

              if (idx === -1) {
                console.warn(`[BiblePlugin] Fuzzy match failed for verse ${markerVerse}...`);
                continue;
              }

              const openingPunctuation = new Set(['"', "'", '“', '‘', '(', '[', '{', '—', '-']);

              while (idx > curPos) {
                const previousChar = baseText[idx - 1];
                if (previousChar === undefined || !openingPunctuation.has(previousChar)) break;
                if (previousChar === '\n') break;
                idx--;
              }

              result += baseText.substring(curPos, idx);
              result += `[${markerVerse}] `;
              curPos = idx;
            }

            result += baseText.substring(curPos);

            if (!result || result.length < 1) throw 1;

            this.cache[url] = { err: false, info: rangeCombined.info, verses: result };
          } else {
            const singleUrls = verseNumbers.map((n) =>
              this.buildSingleVerseUrl(parsed.versionId, parsed.book, parsed.chapter, n),
            );
            const singles = await Promise.all(singleUrls.map((u) => this.processSingleVerse(u)));

            if (singles.some((s) => !s || s.err)) {
              const rangeCombined = await this.processSingleVerse(url);
              if (rangeCombined.err) throw 1;
              this.cache[url] = {
                err: false,
                info: rangeCombined.info,
                verses: rangeCombined.verses,
              };
            } else {
              const texts = singles.map((s) => s.verses.trim());
              const combined =
                fmt === 'manuscript'
                  ? texts.join(' ').replace(/\s+/g, ' ').trim()
                  : texts.join('\n');
              const firstSingle = singles[0];
              if (!firstSingle) throw 1;
              this.cache[url] = { err: false, info: firstSingle.info, verses: combined };
            }
          }
        } else {
          const single = await this.processSingleVerse(url);
          this.cache[url] = single;
        }
      } catch {
        this.cache[url] = {
          err: true,
          info: { title: '', version: '' },
          verses: '',
        };
      }
    }
    return this.cache[url];
  }

  private static async processSingleVerse(url: string): Promise<CacheElement> {
    if (this.cache[url]) return this.cache[url];
    try {
      const res = await requestUrl(url);
      const data = parseVerseData(res.text);
      if (!data) throw 1;

      this.cache[url] = { err: false, info: data.info, verses: data.verses };
      return this.cache[url];
    } catch {
      this.cache[url] = { err: true, info: { title: '', version: '' }, verses: '' };
      return this.cache[url];
    }
  }

  private static parseBibleUrl(
    url: string,
  ): { versionId: string; book: string; chapter: number; versesSpec?: string } | null {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter((p) => p.length > 0);
      if (parts.length < 3 || parts[0] !== 'bible') return null;
      const versionId = parts[1];
      const bookPart = parts[2];
      if (!versionId || !bookPart) return null;
      const segs = bookPart.split('.');
      if (segs.length < 2) return null;
      const book = segs[0];
      if (!book) return null;
      const chapter = parseInt(segs[1] ?? '');
      if (isNaN(chapter)) return null;
      const versesSpec = segs.length >= 3 ? segs.slice(2).join('.') : undefined;
      return { versionId, book, chapter, versesSpec };
    } catch {
      return null;
    }
  }

  private static isMultiVerseSpec(spec: string): boolean {
    return spec.includes(',') || spec.includes('-');
  }

  private static expandVerses(spec: string): number[] {
    const nums: number[] = [];
    const items = spec
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    items.forEach((it) => {
      if (it.includes('-')) {
        const [aRaw, bRaw] = it.split('-');
        const a = parseInt((aRaw ?? '').trim());
        const b = parseInt((bRaw ?? '').trim());
        if (!isNaN(a) && !isNaN(b)) {
          const start = Math.min(a, b);
          const end = Math.max(a, b);
          for (let i = start; i <= end; i++) nums.push(i);
        }
      } else {
        const n = parseInt(it);
        if (!isNaN(n)) nums.push(n);
      }
    });
    return nums;
  }

  private static buildSingleVerseUrl(
    versionId: string,
    book: string,
    chapter: number,
    verse: number,
  ): string {
    return `https://www.bible.com/bible/${versionId}/${book}.${chapter}.${verse}`;
  }

  static clearCache(notClear: Array<string>) {
    console.debug(
      `Clearing cache... (${Math.abs(Object.keys(this.cache).length - notClear.length)} items)`,
    );
    let dict: CacheType = {};
    notClear.forEach((ele) => {
      const cached = this.cache[ele];
      if (cached) dict[ele] = cached;
    });
    this.cache = dict;
  }

  private static getFuzzyIndex(baseText: string, searchStr: string, startPos: number): number {
    const cleanSearch = searchStr.replace(/[\W_]+/g, '').toLowerCase();

    if (!cleanSearch) return -1;

    let cleanBase = '';
    const indicesMap: number[] = [];

    for (let i = startPos; i < baseText.length; i++) {
      const char = baseText[i];
      if (char !== undefined && /\w/.test(char)) {
        cleanBase += char.toLowerCase();
        indicesMap.push(i);
      }
    }

    const foundIndexInClean = cleanBase.indexOf(cleanSearch);

    if (foundIndexInClean === -1) {
      return -1;
    }

    return indicesMap[foundIndexInClean] ?? -1;
  }
}
