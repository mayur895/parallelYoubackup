#!/usr/bin/env node
/**
 * scripts/download-models.mjs
 *
 * Downloads all RunAnywhere AI model files from HuggingFace
 * into public/models/ so they can be served locally.
 *
 * Run ONCE when you have internet, then go fully offline:
 *   node scripts/download-models.mjs
 *
 * Skips files already present. Safe to re-run.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const OUT_DIR = path.join(ROOT, 'public', 'models');

// Model files to download
const DOWNLOADS = [
  // LLM — LFM2 350M
  {
    dir: 'lfm2-350m',
    file: 'LFM2-350M-Q4_K_M.gguf',
    url: 'https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q4_K_M.gguf',
  },
  // LLM — LFM2 1.2B Tool
  {
    dir: 'lfm2-1.2b-tool',
    file: 'LFM2-1.2B-Tool-Q4_K_M.gguf',
    url: 'https://huggingface.co/LiquidAI/LFM2-1.2B-Tool-GGUF/resolve/main/LFM2-1.2B-Tool-Q4_K_M.gguf',
  },
  // VLM — LFM2-VL 450M
  {
    dir: 'lfm2-vl-450m',
    file: 'LFM2-VL-450M-Q4_0.gguf',
    url: 'https://huggingface.co/runanywhere/LFM2-VL-450M-GGUF/resolve/main/LFM2-VL-450M-Q4_0.gguf',
  },
  {
    dir: 'lfm2-vl-450m',
    file: 'mmproj-LFM2-VL-450M-Q8_0.gguf',
    url: 'https://huggingface.co/runanywhere/LFM2-VL-450M-GGUF/resolve/main/mmproj-LFM2-VL-450M-Q8_0.gguf',
  },
  // STT — Whisper Tiny
  {
    dir: 'whisper-tiny',
    file: 'sherpa-onnx-whisper-tiny.en.tar.gz',
    url: 'https://huggingface.co/runanywhere/sherpa-onnx-whisper-tiny.en/resolve/main/sherpa-onnx-whisper-tiny.en.tar.gz',
  },
  // TTS — Piper
  {
    dir: 'piper-tts',
    file: 'vits-piper-en_US-lessac-medium.tar.gz',
    url: 'https://huggingface.co/runanywhere/vits-piper-en_US-lessac-medium/resolve/main/vits-piper-en_US-lessac-medium.tar.gz',
  },
  // VAD — Silero
  {
    dir: 'silero-vad',
    file: 'silero_vad.onnx',
    url: 'https://huggingface.co/runanywhere/silero-vad-v5/resolve/main/silero_vad.onnx',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest + '.tmp');

    const req = protocol.get(url, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest + '.tmp');
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest + '.tmp');
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      let lastPct = -1;

      res.on('data', (chunk) => {
        received += chunk.length;
        file.write(chunk);
        if (total > 0) {
          const pct = Math.floor((received / total) * 100);
          if (pct !== lastPct && pct % 10 === 0) {
            process.stdout.write(`\r  ${pct}% (${(received / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB)`);
            lastPct = pct;
          }
        }
      });

      res.on('end', () => {
        file.close(() => {
          fs.renameSync(dest + '.tmp', dest);
          process.stdout.write('\r  100% ✓\n');
          resolve();
        });
      });
    });

    req.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest + '.tmp')) fs.unlinkSync(dest + '.tmp');
      reject(err);
    });
  });
}

async function main() {
  console.log('\n🚀 ParallelYou — Offline Model Downloader\n');
  console.log(`Output: ${OUT_DIR}\n`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let skipped = 0;
  let downloaded = 0;
  let failed = 0;

  for (const entry of DOWNLOADS) {
    const dir = path.join(OUT_DIR, entry.dir);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, entry.file);

    if (fs.existsSync(dest)) {
      const sizeMB = (fs.statSync(dest).size / 1e6).toFixed(1);
      console.log(`  ✓ SKIP  ${entry.file} (${sizeMB} MB already downloaded)`);
      skipped++;
      continue;
    }

    console.log(`  ⬇  ${entry.file}`);
    try {
      await download(entry.url, dest);
      downloaded++;
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log('\n─────────────────────────────────────');
  console.log(`  Downloaded : ${downloaded}`);
  console.log(`  Skipped    : ${skipped}`);
  console.log(`  Failed     : ${failed}`);
  console.log('─────────────────────────────────────');

  if (failed === 0) {
    console.log('\n✅ All models ready at public/models/');
    console.log('   You can now run the app fully offline with:');
    console.log('   npm run dev\n');
  } else {
    console.log('\n⚠️  Some downloads failed. Check your internet connection and retry.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
