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

// 성공하면 stdout 문자열, 실패하면 null.
// 빈 문자열("출력이 없었다")과 null("실행이 실패했다")을 반드시 구분해야 한다 —
// git status가 타임아웃·버퍼 초과로 죽었을 때 이를 "변경 없음"으로 읽으면
// 상태 표시가 틀린 방향으로 실패한다.
function git(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout: 1000,
      maxBuffer: 10 * 1024 * 1024, // 기본 1MB로는 변경이 많은 저장소에서 ENOBUFS
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

// `git status --branch`의 첫 줄(`## ` 제거된 상태)에서 브랜치 이름을 뽑는다.
function branchLabel(header, cwd) {
  const noCommits = 'No commits yet on ';
  if (header.startsWith(noCommits)) {
    return header.slice(noCommits.length).split(/\s/)[0];
  }
  if (header === 'HEAD (no branch)' || header === 'HEAD') {
    const short = git(['rev-parse', '--short', 'HEAD'], cwd);
    return short ? short.trim() : 'detached';
  }
  // "main...origin/main [ahead 1]" → "main"
  return header.split('...')[0].split(/\s/)[0];
}

function renderBranch(label, mark) {
  if (!label) return '';
  const color = mark === '*' ? C.gold : mark === '?' ? C.red : C.jade;
  return paint(color, `⎇ ${label}${mark}`);
}

function gitSegment(cwd) {
  // 브랜치·detached 여부·dirty를 git 호출 한 번으로 모두 얻는다.
  const status = git(['status', '--porcelain', '--branch', '--untracked-files=no'], cwd);
  if (status !== null) {
    const lines = status.split('\n');
    const header = lines[0] || '';
    if (header.startsWith('## ')) {
      const dirty = lines.slice(1).some((line) => line.trim() !== '');
      return renderBranch(branchLabel(header.slice(3), cwd), dirty ? '*' : '');
    }
  }

  // 여기까지 왔다면 status가 실패했거나 형식이 예상과 다르다.
  // 깨끗하다고 단정하지 말고, 브랜치만 보여주면서 변경 여부는 '?'로 남긴다.
  const head = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  if (head === null) return ''; // git 저장소가 아님
  return renderBranch(branchLabel(head.trim(), cwd), '?');
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
