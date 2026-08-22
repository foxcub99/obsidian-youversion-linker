import { booksNames } from '../src/books/BooksLists';
import { testBookRegex } from '../src/Regex';
import { cleanBookName } from '../src/books/Books';
import { describe, expect, test } from '@jest/globals';
import { ALL_BOOKS, BASE_BOOKS } from '../src/books/BooksType';

describe('Book names', () => {
  test.each(Object.entries(booksNames))('All book names are valid for %s', (_lang, list) => {
    Object.values(list).forEach((names) => {
      expect(names.length).toBeGreaterThan(0);
      names.map(cleanBookName).forEach((n) => {
        expect(typeof n).toBe('string');
        expect(n).toMatch(testBookRegex);
      });
    });
  });

  test.each(Object.entries(booksNames))('All books keys are unique for %s', (_lang, list) => {
    const keys = new Set(Object.keys(list));
    expect(keys.size).toBe(Object.keys(list).length);
  });

  test.each(Object.entries(booksNames))(
    'Contains only base books or all books for %s',
    (_lang, list) => {
      const keys = new Set(Object.keys(list));
      if (keys.size <= BASE_BOOKS.length) {
        expect(keys).toStrictEqual(new Set(BASE_BOOKS));
      } else {
        expect(keys).toStrictEqual(new Set(ALL_BOOKS));
      }
    },
  );
});
