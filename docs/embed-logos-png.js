const https = require('https');
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const logos = {
  vercel:     'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vercel/vercel-original.svg',
  github:     'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg',
  react:      'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg',
  typescript: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg',
  vitejs:     'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vitejs/vitejs-original.svg',
  tailwind:   'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg',
  vitest:     'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vitest/vitest-original.svg',
  nodejs:     'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg',
  supabase:   'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/supabase/supabase-original.svg',
  postgresql: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg',
  // Zod – fetch PNG directly (already a raster image)
  zod:        'https://avatars.githubusercontent.com/u/86206918?s=64&v=4',
};

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function svgToPng(svgBuffer) {
  const svg = svgBuffer.toString('utf8');
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 64 } });
  const pngData = resvg.render();
  return pngData.asPng();
}

async function main() {
  const drawioPath = path.join(__dirname, 'system-architecture.drawio');
  let content = fs.readFileSync(drawioPath, 'utf8');

  const urlToDataUri = {};

  for (const [key, url] of Object.entries(logos)) {
    try {
      const buf = await fetchBuffer(url);
      let pngBuf;

      if (url.includes('avatars.githubusercontent.com')) {
        // Already a PNG
        pngBuf = buf;
      } else {
        // SVG → PNG
        pngBuf = svgToPng(buf);
      }

      const b64 = pngBuf.toString('base64');
      // Use data:image/png;base64 but WITHOUT semicolon conflict:
      // In draw.io style strings, we encode the whole value properly.
      // draw.io handles "data:image/png;base64," in image= correctly
      // because it special-cases data: URIs in its style parser.
      urlToDataUri[key] = `data:image/png;base64,${b64}`;
      console.log(`OK ${key}: SVG→PNG ${b64.length} chars`);
    } catch (e) {
      console.error(`FAIL ${key}: ${e.message}`);
    }
  }

  // Map old URLs (may already be data: URIs from previous run) to new PNG data URIs
  const cellIdToKey = {
    fe_vercel_img:  'vercel',
    fe_github_img:  'github',
    fe_react_img:   'react',
    fe_ts_img:      'typescript',
    fe_vite_img:    'vitejs',
    fe_tw_img:      'tailwind',
    fe_zod_img:     'zod',
    fe_vitest_img:  'vitest',
    be_node_img:    'nodejs',
    be_vitest_img:  'vitest',
    sb_logo:        'supabase',
    sb_pg_img:      'postgresql',
  };

  // Replace each cell's image value using regex on the id
  for (const [cellId, key] of Object.entries(cellIdToKey)) {
    const dataUri = urlToDataUri[key];
    if (!dataUri) continue;

    // Match: id="<cellId>" ... image=<anything up to next ; or ">
    const re = new RegExp(
      `(id="${cellId}"[^>]*style="[^"]*image=)(data:[^;"]*(;base64,)?[^;"]*|https?://[^;"]*)`,
      'g'
    );
    const before = content;
    content = content.replace(re, `$1${dataUri}`);
    if (content !== before) {
      console.log(`  Patched cell: ${cellId}`);
    } else {
      console.warn(`  WARNING: no match for cell ${cellId}`);
    }
  }

  fs.writeFileSync(drawioPath, content, 'utf8');
  console.log('\nDone! All logos embedded as PNG data URIs.');
}

main().catch(console.error);
