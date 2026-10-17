import test from 'node:test';
import assert from 'node:assert/strict';
import { getPagination } from '../src/lib/pagination.js';

test('empty and single-page results keep valid, disabled pagination bounds', () => {
  assert.deepEqual(getPagination(0, 6, 1), {
    page: 1, totalPages: 1, offset: 0, start: 0, end: 0,
    pages: [1], hasPrevious: false, hasNext: false
  });
  assert.deepEqual(getPagination(1, 6, 1), {
    page: 1, totalPages: 1, offset: 0, start: 1, end: 1,
    pages: [1], hasPrevious: false, hasNext: false
  });
  assert.equal(getPagination(6, 6, 1).totalPages, 1);
});

test('first, middle and last pages report precise inclusive ranges and slice offsets', () => {
  const values = Array.from({ length: 14 }, (_, index) => index + 1);
  for (const [page, start, end, expected] of [
    [1, 1, 6, [1, 2, 3, 4, 5, 6]],
    [2, 7, 12, [7, 8, 9, 10, 11, 12]],
    [3, 13, 14, [13, 14]]
  ]) {
    const result = getPagination(values.length, 6, page);
    assert.equal(result.start, start);
    assert.equal(result.end, end);
    assert.deepEqual(values.slice(result.offset, result.end), expected);
    assert.equal(result.hasPrevious, page > 1);
    assert.equal(result.hasNext, page < 3);
  }
});

test('page numbers clamp when filters shrink results or requested pages exceed bounds', () => {
  assert.equal(getPagination(14, 6, 100).page, 3);
  assert.equal(getPagination(14, 6, -3).page, 1);
  assert.equal(getPagination(14, 6, 0).page, 1);
  assert.equal(getPagination(2, 6, 3).page, 1);
  assert.equal(getPagination(0, 6, 3).offset, 0);
  assert.equal(getPagination(14, 10, 3).page, 2);
});

test('page windows preserve endpoints and replace only multi-page gaps with ellipses', () => {
  assert.deepEqual(getPagination(70, 10, 4).pages, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(getPagination(100, 10, 1).pages, [1, 2, 3, 4, 'ellipsis', 10]);
  assert.deepEqual(getPagination(100, 10, 5).pages, [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  assert.deepEqual(getPagination(100, 10, 10).pages, [1, 'ellipsis', 7, 8, 9, 10]);
  assert.deepEqual(getPagination(80, 10, 4).pages, [1, 2, 3, 4, 5, 'ellipsis', 8]);
});

test('large catalogues have bounded ordered windows and valid offsets', () => {
  for (const totalItems of [8, 25, 1_000_000, Number.MAX_SAFE_INTEGER]) {
    for (const currentPage of [1, 2, 4, 5, Math.floor(totalItems / 2), totalItems - 1, totalItems]) {
      const result = getPagination(totalItems, 1, currentPage);
      const numbers = result.pages.filter((page) => typeof page === 'number');
      assert.ok(result.pages.length <= 7);
      assert.equal(numbers[0], 1);
      assert.equal(numbers.at(-1), totalItems);
      assert.ok(numbers.includes(result.page));
      assert.deepEqual(numbers, [...new Set(numbers)].sort((left, right) => left - right));
      assert.ok(result.offset >= 0 && result.offset < totalItems);
      assert.equal(result.start, result.end);
    }
  }
});

test('invalid numeric inputs fail explicitly instead of generating broken ranges', () => {
  for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '6', null, undefined]) {
    assert.throws(() => getPagination(value, 6, 1), /totalItems/);
  }
  for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '6', null, undefined]) {
    assert.throws(() => getPagination(10, value, 1), /pageSize/);
  }
  for (const value of [1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null, undefined]) {
    assert.throws(() => getPagination(10, 6, value), /currentPage/);
  }
});
