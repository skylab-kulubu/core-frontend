import { percentWithEnding, possessiveEnding } from './turkish-number';

it.each([
  [0, 'ı'],
  [1, 'i'],
  [2, 'si'],
  [3, 'ü'],
  [4, 'ü'],
  [5, 'i'],
  [6, 'sı'],
  [7, 'si'],
  [8, 'i'],
  [9, 'u'],
  [10, 'u'],
  [20, 'si'],
  [30, 'u'],
  [40, 'ı'],
  [50, 'si'],
  [60, 'ı'],
  [70, 'i'],
  [75, 'i'],
  [80, 'i'],
  [90, 'ı'],
  [100, 'ü'],
  [1000, 'i'],
])('%i takes "%s"', (value, ending) => {
  expect(possessiveEnding(value)).toBe(ending);
});

it('writes a percentage with its ending', () => {
  expect(percentWithEnding(50)).toBe("%50'si");
  expect(percentWithEnding(74.6)).toBe("%75'i");
  expect(percentWithEnding(100)).toBe("%100'ü");
});
