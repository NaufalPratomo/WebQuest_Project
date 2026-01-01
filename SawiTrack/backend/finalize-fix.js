
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, 'src', 'index.js.tmp');
const dest = path.join(__dirname, 'src', 'index.js');

try {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(src, dest);
    console.log('Successfully replaced index.js');
} catch (e) {
    console.error(e);
}
