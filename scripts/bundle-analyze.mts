/**
 * Bundle Analyzer — visualize what's in the bundle.
 *
 * Usage: bun run bundle:analyze
 * Output: .freebuff/bundle-analysis.html (open in browser)
 */

import { build } from 'esbuild';
import { visualizer } from 'esbuild-visualizer';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUTDIR = '.freebuff';

async function analyze() {
  console.log('📊 Analyzing bundle...');

  // Build with metafile enabled
  const result = await build({
    entryPoints: ['js/main.ts'],
    bundle: true,
    minify: true,
    metafile: true,
    outfile: '/dev/null', // We don't need the actual output
    logLevel: 'info',
  });

  // Create output directory if it doesn't exist
  if (!existsSync(OUTDIR)) {
    mkdirSync(OUTDIR, { recursive: true });
  }

  // Generate visualization (visualizer returns HTML string, write to file)
  const htmlPath = join(OUTDIR, 'bundle-analysis.html');
  const chartData = await visualizer(result.metafile, {
    title: 'ASJ Portal Bundle Analysis',
    template: 'treemap', // treemap | sunburst | network
  });
  writeFileSync(htmlPath, chartData, 'utf-8');

  console.log(`\n✅ Bundle analysis saved to: ${htmlPath}`);
  console.log(`   Open in browser to view the visualization.\n`);

  // Print summary
  const meta = result.metafile;
  if (meta?.inputs) {
    const entries = Object.entries(meta.inputs)
      .sort(([, a], [, b]) => b.bytes - a.bytes)
      .slice(0, 15);

    console.log('📦 Top 15 largest modules:');
    console.log('─'.repeat(60));
    for (const [file, info] of entries) {
      const name = file.replace('js/', '').replace('i18n/', 'i18n/');
      const kb = (info.bytes / 1024).toFixed(1);
      const bar = '█'.repeat(Math.min(30, Math.round(info.bytes / 5000)));
      console.log(`  ${kb.padStart(6)} KB  ${bar}  ${name}`);
    }
    console.log('─'.repeat(60));
    const total = Object.values(meta.inputs).reduce((s, i) => s + i.bytes, 0);
    console.log(`  Total: ${(total / 1024).toFixed(1)} KB\n`);
  }
}

analyze().catch((err) => {
  console.error('❌ Bundle analysis failed:', err);
  process.exit(1);
});
