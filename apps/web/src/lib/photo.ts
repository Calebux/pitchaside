/** The square photos are kept at: sharp on a 3x phone at 100px, small to send and store. */
const SIZE = 320;
/** Stay under the server's limit with room to spare. */
const MAX_BYTES = 60 * 1024;

/**
 * A photo picked on the phone, made ready to upload: cropped to a centred square, scaled to
 * 320px and saved as a JPEG, lowering the quality until it's under 60 KB. Turned the right way
 * up (browsers apply the photo's rotation when drawing it).
 */
export async function resizePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That isn’t a photo. Pick an image.');
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new Error('That photo couldn’t be read. Try another.');
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This phone couldn’t prepare the photo.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
  for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    // Base64 is 4 characters for every 3 bytes.
    if (((url.length - url.indexOf(',') - 1) * 3) / 4 <= MAX_BYTES) return url;
  }
  throw new Error('That photo is too detailed to send. Try another.');
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That photo couldn’t be read. Try a JPEG or PNG.'));
    };
    img.src = url;
  });
}
