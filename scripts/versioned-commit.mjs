#!/usr/bin/env node
/**
 * Crea un commit cuyo asunto empieza con [rama@hash] para que EasyPanel
 * muestre la versión Git en "Deploy service: ...".
 *
 * Uso (después de git add):
 *   node scripts/versioned-commit.mjs "fix(front): descripción del cambio"
 */
import { execSync } from 'child_process';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
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
const branch = sh('git rev-parse --abbrev-ref HEAD');
const sha = sh('git rev-parse --short HEAD');
const versioned = `[${branch}@${sha}] ${subject}`;
sh(`git commit --amend -m ${JSON.stringify(versioned)}`);
const deploySha = sh('git rev-parse --short HEAD');

console.log('');
console.log(`Commit: ${versioned}`);
console.log(`Hash a pushear: ${deploySha}`);
console.log('EasyPanel mostrará la línea anterior en Deployment History.');
