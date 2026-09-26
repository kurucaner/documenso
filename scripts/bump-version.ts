import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const rootDir = join(import.meta.dir, '..');
const rootPackagePath = join(rootDir, 'package.json');
const remixPackagePath = join(rootDir, 'apps/remix/package.json');

const bumpPatch = (version: string): string => {
  const parts = version.split('.').map(Number);

  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  parts[2] += 1;

  return parts.join('.');
};

const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8')) as { version: string };
const remixPackage = JSON.parse(readFileSync(remixPackagePath, 'utf8')) as { version: string };

const nextVersion = bumpPatch(rootPackage.version);

rootPackage.version = nextVersion;
remixPackage.version = nextVersion;

writeFileSync(rootPackagePath, `${JSON.stringify(rootPackage, null, 2)}\n`);
writeFileSync(remixPackagePath, `${JSON.stringify(remixPackage, null, 2)}\n`);

console.log(`Bumped version to v${nextVersion}`);
