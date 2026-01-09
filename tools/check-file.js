#!/usr/bin/env node
const { execFileSync } = require('child_process');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('❌ Please provide a file path');
  process.exit(1);
}

// Get absolute path
const absolutePath = path.resolve(file);
const ext = path.extname(file).toLowerCase();
const baseName = path.basename(file);

const PRETTIER_SUPPORTED_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.scss',
  '.css',
  '.html',
  '.yml',
  '.yaml',
]);
const PRETTIER_SUPPORTED_BASENAMES = new Set([]);

const shouldRunPrettier =
  PRETTIER_SUPPORTED_EXTS.has(ext) || PRETTIER_SUPPORTED_BASENAMES.has(baseName);

try {
  if (shouldRunPrettier) {
    // Run prettier
    console.log(`🎨 Formatting ${path.basename(file)}...`);
    execFileSync('npm', ['run', 'prettier:file', '--', absolutePath], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } else {
    console.log(
      `ℹ️  Skipping format for ${path.basename(file)} (unsupported by prettier)`,
    );
  }

  // Run lint based on file type
  console.log(`🔍 Linting ${path.basename(file)}...`);

  if (ext === '.scss') {
    // Use stylelint for SCSS files
    execFileSync('npx', ['stylelint', absolutePath], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } else if (ext === '.ts' || ext === '.tsx' || ext === '.html') {
    // Use ng lint for files Angular knows how to lint.
    execFileSync('npm', ['run', 'lint:file', '--', absolutePath], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } else {
    // For files Angular can't lint (e.g. JSON, MD, YAML, Dockerfile), formatting is enough.
    console.log(`ℹ️  Skipping lint for ${path.basename(file)} (unsupported by ng lint)`);
  }

  // If we get here, both commands succeeded
  console.log(`✅ ${path.basename(file)} - All checks passed!`);
} catch (error) {
  // If there's an error, show the full output
  console.error('\n❌ Errors found:\n');
  console.error(error.stdout || error.stderr || error.message);
  process.exit(1);
}
