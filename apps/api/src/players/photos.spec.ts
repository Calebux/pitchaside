import { parsePhoto, MAX_PHOTO_BYTES } from './photos';

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
const url = (mime: string, b: Buffer) => `data:${mime};base64,${b.toString('base64')}`;

describe('parsePhoto', () => {
  it('takes a real JPEG', () => {
    expect(parsePhoto(url('image/jpeg', jpeg))).toMatchObject({ mime: 'image/jpeg' });
  });
  it('goes by the bytes, not what it says it is', () => {
    expect(parsePhoto(url('image/png', jpeg)).mime).toBe('image/jpeg');
  });
  it('refuses something that isn’t an image', () => {
    expect(() => parsePhoto(url('image/jpeg', Buffer.from('<script>alert(1)</script>')))).toThrow('isn’t a photo');
  });
  it('refuses other kinds of file and junk', () => {
    expect(() => parsePhoto('data:image/svg+xml;base64,PHN2Zz4=')).toThrow();
    expect(() => parsePhoto(42)).toThrow();
  });
  it('refuses one that is too big', () => {
    const big = Buffer.concat([jpeg, Buffer.alloc(MAX_PHOTO_BYTES)]);
    expect(() => parsePhoto(url('image/jpeg', big))).toThrow('too big');
  });
});
