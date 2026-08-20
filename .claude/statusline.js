#!/usr/bin/env node
// Claude Code status line for 단장(丹粧).
// Reads the status JSON from stdin and prints a single styled line.
// Docs: https://code.claude.com/docs/en/statusline

'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

// 단청 팔레트에 맞춘 256색 코드 — 석록·군청·석간주·황
const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  jade: '\x1b[38;5;72m', // 석록
  navy: '\x1b[38;5;68m', // 군청
  red: '\x1b[38;5;167m', // 석간주
  gold: '\x1b[38;5;179m', // 황
  gray: '\x1b[38;5;245m',
};

function paint(color, text) {
  return `${color}${text}${C.reset}`;
}

function readStdin() {
  try {
    return require('node:fs').readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function gitSegment(cwd) {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  if (!branch) return '';

  // detached HEAD면 짧은 커밋 해시로 표시
  const label =
    branch === 'HEAD' ? git(['rev-parse', '--short', 'HEAD'], cwd) || 'detached' : branch;

  const dirty = git(['status', '--porcelain', '--untracked-files=no'], cwd) ? '*' : '';
  const color = dirty ? C.gold : C.jade;
  return paint(color, `⎇ ${label}${dirty}`);
}

function dirSegment(currentDir, projectDir) {
  if (!currentDir) return '';
  if (projectDir && currentDir !== projectDir) {
    const rel = path.relative(projectDir, currentDir);
    if (rel && !rel.startsWith('..')) {
      return paint(C.navy, `${path.basename(projectDir)}/${rel}`);
    }
  }
  return paint(C.navy, path.basename(currentDir));
}

function diffSegment(cost) {
  const added = cost.total_lines_added || 0;
  const removed = cost.total_lines_removed || 0;
  if (!added && !removed) return '';
  return `${paint(C.jade, `+${added}`)}${paint(C.gray, '/')}${paint(C.red, `-${removed}`)}`;
}

function costSegment(cost) {
  const usd = cost.total_cost_usd;
  if (typeof usd !== 'number' || usd <= 0) return '';
  return paint(C.gray, `$${usd < 0.01 ? usd.toFixed(3) : usd.toFixed(2)}`);
}

function main() {
  let data = {};
  try {
    data = JSON.parse(readStdin()) || {};
  } catch {
    data = {};
  }

  const workspace = data.workspace || {};
  const currentDir = workspace.current_dir || data.cwd || process.cwd();
  const projectDir = workspace.project_dir || '';
  const cost = data.cost || {};

  const segments = [
    paint(C.gold, `◈ ${(data.model && data.model.display_name) || 'Claude'}`),
    dirSegment(currentDir, projectDir),
    gitSegment(currentDir),
    diffSegment(cost),
    costSegment(cost),
    data.exceeds_200k_tokens ? paint(C.red, '⚠ 200k+') : '',
  ].filter(Boolean);

  process.stdout.write(segments.join(paint(C.gray, ' · ')));
}

main();
