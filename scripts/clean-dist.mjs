import fs from 'fs-extra';

const distPath = 'dist';

try {
  if (await fs.pathExists(distPath)) {
    const entries = await fs.readdir(distPath);
    await Promise.all(entries.map(entry => fs.remove(`${distPath}/${entry}`)));
    console.log('dist directory contents removed');
  }
} catch (err) {
  // Ignore errors if dist does not exist or cannot be removed
  console.warn('Could not clean dist contents:', err.message);
}
