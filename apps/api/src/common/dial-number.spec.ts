import { dialNumber, phoneKey } from './format.util';

describe('dialNumber: any way a number is typed, read for WhatsApp and SMS', () => {
  it.each([
    ['08031234567', '2348031234567'],
    ['0803 123 4567', '2348031234567'],
    ['0803-123-4567', '2348031234567'],
    ['09031234567', '2349031234567'],
    ['07031234567', '2347031234567'],
    ['8031234567', '2348031234567'],
    ['+2348031234567', '2348031234567'],
    ['+234 803 123 4567', '2348031234567'],
    ['2348031234567', '2348031234567'],
    ['+234 0803 123 4567', '2348031234567'],
    ['(+234) 803-123-4567', '2348031234567'],
    ['+44 7700 900123', '447700900123'],
    ['0044 7700 900123', '447700900123'],
  ])('%s → %s', (input, want) => {
    expect(dialNumber(input)).toBe(want);
  });

  it.each([null, undefined, '', '   ', '12345', '0803123', 'not a number', '1234567890123'])('nothing we can send to: %p', (input) => {
    expect(dialNumber(input as any)).toBeNull();
  });

  it('matching people by number is unchanged: the last 10 digits are the same either way', () => {
    expect(phoneKey('08031234567')).toBe(phoneKey(`+${dialNumber('08031234567')}`));
  });
});
