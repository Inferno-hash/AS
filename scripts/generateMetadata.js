// scripts/generateMetadata.js
const { writeFileSync, mkdirSync } = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Determine channel
const channel = process.argv.find((arg) => arg.startsWith('--channel='));
const isNightly = channel === '--channel=nightly';

// Read package.json (adjust path if your script lives elsewhere)
const { version, description } = require('../package.json');

// Safely run a git command, or return 'unknown'
function safeGit(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

// Get tags or commits
const tag = isNightly
  ? safeGit('git describe --tags --abbrev=0')
  : safeGit("sh -c \"git tag --sort=-version:refname | head -n 1\"");

const commitHash = safeGit('git rev-parse --short HEAD');
const commitTimeRaw = safeGit('git log -1 --format=%cd --date=iso');

// Build the metadata object
const versionInfo = {
  version,
  description,
  tag,
  commitHash,
  buildTime: new Date().toISOString(),
  // commitTime may be 'unknown' or an ISO string from git
  commitTime: commitTimeRaw === 'unknown'
    ? 'unknown'
    : new Date(commitTimeRaw).toISOString(),
};

// Ensure resources folder exists
const outputPath = path.resolve(__dirname, '../resources/metadata.json');
mkdirSync(path.dirname(outputPath), { recursive: true });

// Write it out
writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2), 'utf8');
console.log('Version info generated:', versionInfo);
