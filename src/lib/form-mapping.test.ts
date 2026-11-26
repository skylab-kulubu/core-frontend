import { ProblemError } from '@/lib/api/core';
import type { FormQuestion } from '@/lib/api/form-respondents';
import {
  fieldFromText,
  formMappingProblem,
  guessMapping,
  mappableQuestion,
  mappingIssue,
  previewLine,
} from '@/lib/form-mapping';

const q = (id: string, question: string, extra: Partial<FormQuestion> = {}): FormQuestion => ({
  id,
  type: 'short_text',
  question,
  ...extra,
});

describe('fieldFromText (SPEC §5.2 step 3)', () => {
  it.each([
    ['E-posta adresiniz', 'email'],
    ['Eposta', 'email'],
    ['Mail', 'email'],
    ['Ad Soyad', 'fullName'],
    ['Adınız Soyadınız', 'fullName'],
    ['Adı soyadı', 'fullName'],
    ['İsim Soyisim', 'fullName'],
    ['Soyadınız', 'lastName'],
    ['Soyisim', 'lastName'],
    ['Ad', 'firstName'],
    ['Adınız', 'firstName'],
    ['İsminiz', 'firstName'],
    ['Okul numaranız', null],
    ['Adres', null],
  ])('%s → %s', (text, field) => {
    expect(fieldFromText(text)).toBe(field);
  });
});

describe('guessMapping', () => {
  it('takes the identity marks first, whatever the text says', () => {
    const { mapping, guessed } = guessMapping([
      q('a', 'Bize nasıl ulaşalım?', { identity: 'email' }),
      q('b', 'İlk', { identity: 'firstName' }),
      q('c', 'Son', { identity: 'lastName' }),
      q('d', 'E-posta (yedek)'),
    ]);
    expect(mapping).toEqual({ firstName: 'b', lastName: 'c', fullName: null, email: 'a' });
    expect(guessed.sort()).toEqual(['email', 'firstName', 'lastName']);
  });

  it('keeps core’s suggestion and fills the rest', () => {
    const { mapping } = guessMapping([q('a', 'İletişim'), q('b', 'Ad Soyad')], {
      email: 'a',
      firstName: null,
    });
    expect(mapping).toEqual({ firstName: null, lastName: null, fullName: 'b', email: 'a' });
  });

  it('reads inputType before the text', () => {
    const { mapping } = guessMapping([
      q('a', 'İletişim', { inputType: 'email' }),
      q('b', 'Katılımcı', { inputType: 'name' }),
    ]);
    expect(mapping).toEqual({ firstName: null, lastName: null, fullName: 'b', email: 'a' });
  });

  it('guesses from Turkish question text, accents and case aside', () => {
    const { mapping } = guessMapping([
      q('1', 'ADINIZ'),
      q('2', 'Soyadınız'),
      q('3', 'E-POSTA'),
      q('4', 'Telefon'),
    ]);
    expect(mapping).toEqual({ firstName: '1', lastName: '2', fullName: null, email: '3' });
  });

  it('leaves a box empty when two questions fit it', () => {
    const { mapping, guessed } = guessMapping([
      q('1', 'E-posta'),
      q('2', 'Okul e-postası'),
      q('3', 'Ad soyad'),
    ]);
    expect(mapping.email).toBeNull();
    expect(mapping.fullName).toBe('3');
    expect(guessed).toEqual(['fullName']);
  });

  it('ignores a suggestion for a question the form no longer has', () => {
    const { mapping } = guessMapping([q('1', 'E-posta')], { email: 'gone' });
    expect(mapping.email).toBe('1');
  });
});

describe('mappingIssue (core’s rule)', () => {
  it('asks for the e-mail first', () => {
    expect(mappingIssue({ firstName: 'a', lastName: 'b', fullName: null, email: null })).toBe(
      'E-posta sorusunu seç.',
    );
  });
  it('asks for both names or the full name', () => {
    expect(mappingIssue({ firstName: 'a', lastName: null, fullName: null, email: 'e' })).toBe(
      'Ad ve soyad ya da ad soyad sorusunu seç.',
    );
    expect(mappingIssue({ firstName: null, lastName: null, fullName: 'f', email: 'e' })).toBeNull();
    expect(mappingIssue({ firstName: 'a', lastName: 'b', fullName: null, email: 'e' })).toBeNull();
  });
  it('refuses one question twice', () => {
    expect(mappingIssue({ firstName: null, lastName: null, fullName: 'e', email: 'e' })).toBe(
      'Bir soru iki kutuda seçili.',
    );
  });
});

describe('formMappingProblem', () => {
  it.each([
    [503, 'forms_pull_off', 'Forms bağlantısı kapalı.'],
    [403, 'forms_access_denied', 'Bu forma erişimin yok.'],
    [422, 'mapping_question_missing', 'Seçili bir soru artık formda yok.'],
    [404, 'form_not_listed', 'Etkinliği kaydet, sonra eşle.'],
  ])('%i %s', (status, code, text) => {
    expect(formMappingProblem(new ProblemError(status, 'x', { code }), 'yedek')).toBe(text);
  });
});

it('previewLine names only what is not zero', () => {
  expect(
    previewLine({ tickets: 3, waitlisted: 1, full: 0, alreadyTicketed: 2, pendingSkipped: 4 }),
  ).toBe('3 bilet, 1 bekleme listesi, 2 zaten biletli');
  expect(previewLine({ recorded: 0, waitlisted: 0, full: 2, skipped: 1 })).toBe(
    '0 bilet, 2 yer yok, 1 atlandı',
  );
});

it('mappableQuestion leaves out files and choices that hold no name', () => {
  expect(mappableQuestion(q('1', 'CV', { type: 'file' }))).toBe(false);
  expect(mappableQuestion(q('1', 'Ad'))).toBe(true);
});
