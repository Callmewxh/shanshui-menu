const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function externalizeImages(data, root, options = {}) {
  const imgDir = path.join(root, 'data', 'img');
  const dry = !!options.dry;
  let extracted = 0;
  let bytes = 0;
  if (!dry) fs.mkdirSync(imgDir, { recursive: true });

  for (const dish of (data.library || [])) {
    const match = typeof dish.image === 'string'
      ? dish.image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/s)
      : null;
    if (!match) continue;
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const safeId = String(dish.id || crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 12))
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeId}.${ext}`;
    if (!dry) fs.writeFileSync(path.join(imgDir, filename), buffer);
    dish.image = `./data/img/${filename}`;
    extracted++;
    bytes += buffer.length;
  }
  return { extracted, bytes, data };
}

module.exports = { externalizeImages };
