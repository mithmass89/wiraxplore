#!/usr/bin/env node
try {
  await import('../dist/cli.js');
} catch (error) {
  if (error?.code === 'ERR_MODULE_NOT_FOUND' && String(error.message).includes('dist')) {
    console.error('wiraxplore: dist/ is missing. Run `npm run build` (or reinstall the package).');
    process.exit(1);
  }
  throw error;
}

