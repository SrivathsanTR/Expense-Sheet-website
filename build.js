import { mkdir, copyFile } from 'node:fs/promises';

// Publish only browser assets. The local development server is not a function.
await mkdir(new URL('./dist/src/', import.meta.url), { recursive: true });
for (const file of ['index.html', 'src/app.js', 'src/model.js', 'src/styles.css']) {
  await copyFile(new URL(file, import.meta.url), new URL(`dist/${file}`, import.meta.url));
}
console.log('Static website built in dist/. No server functions are required.');
