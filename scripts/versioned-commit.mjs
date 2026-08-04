#!/usr/bin/env node
/**
 * Crea un commit cuyo asunto empieza con [VERSION@hash] para EasyPanel.
 * VERSION = producto (APP_RELEASE / VERSION), no el nombre de rama.
 *
 * Uso (después de git add):
 *   node scripts/versioned-commit.mjs "fix(front): descripción del cambio"
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function getAppRelease() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const versionFile = join(root, 'VERSION');
  if (existsSync(versionFile)) {
    const v = readFileSync(versionFile, 'utf8').trim();
    if (v) return v;
  }
  const appReleaseJs = join(root, 'front', 'scripts', 'app-release.js');
  if (existsSync(appReleaseJs)) {
    const raw = readFileSync(appReleaseJs, 'utf8');
    const m = raw.match(/APP_RELEASE\s*=\s*'([^']+)'/);
    if (m && m[1]) return m[1];
  }
  throw new Error('No se pudo resolver la version de producto (VERSION o front/scripts/app-release.js).');
}

const subject = process.argv.slice(2).join(' ').trim();
if (!subject) {
  console.error('Uso: node scripts/versioned-commit.mjs "mensaje de commit"');
  process.exit(1);
}

const staged = sh('git diff --cached --name-only');
if (!staged) {
  console.error('No hay cambios en staging. Ejecuta git add antes.');
  process.exit(1);
}

sh(`git commit -m ${JSON.stringify(subject)}`);
const release = getAppRelease();
const sha = sh('git rev-parse --short HEAD');
const versioned = `[${release}@${sha}] ${subject}`;
sh(`git commit --amend -m ${JSON.stringify(versioned)}`);
const deploySha = sh('git rev-parse --short HEAD');

console.log('');
console.log(`Commit: ${versioned}`);
console.log(`Hash a pushear: ${deploySha}`);
console.log('EasyPanel mostrará la línea anterior en Deployment History.');
