const https = require('https');
const fs = require('fs');
const path = require('path');

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
  zod:        'https://avatars.githubusercontent.com/u/86206918?s=64&v=4',
};

function fetchData(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http');
    mod.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchData(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  const result = {};
  for (const [key, url] of Object.entries(logos)) {
    try {
      const buf = await fetchData(url);
      const isGitHub = url.includes('avatars.githubusercontent.com');
      const mime = isGitHub ? 'image/png' : 'image/svg+xml';
      const b64 = buf.toString('base64');
      result[key] = `data:${mime};base64,${b64}`;
      console.log(`OK ${key} (${b64.length} chars)`);
    } catch (e) {
      console.error(`FAIL ${key}: ${e.message}`);
    }
  }

  // Now patch the drawio file
  const drawioPath = path.join(__dirname, 'system-architecture.drawio');
  let content = fs.readFileSync(drawioPath, 'utf8');

  const replacements = {
    'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vercel/vercel-original.svg': result.vercel,
    'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg': result.github,
    'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg': result.react,
    'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg': result.typescript,
    'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vitejs/vitejs-original.svg': result.vitejs,
    'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg': result.tailwind,
    'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vitest/vitest-original.svg': result.vitest,
    'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg': result.nodejs,
    'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/supabase/supabase-original.svg': result.supabase,
    'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg': result.postgresql,
    'https://avatars.githubusercontent.com/u/86206918?s=64&amp;v=4': result.zod,
    'https://avatars.githubusercontent.com/u/86206918?s=64&v=4': result.zod,
  };

  for (const [from, to] of Object.entries(replacements)) {
    if (to && content.includes(from)) {
      content = content.split(from).join(to);
      console.log(`Replaced: ${from.split('/').pop()}`);
    }
  }

  fs.writeFileSync(drawioPath, content, 'utf8');
  console.log('\nDone! system-architecture.drawio updated with embedded logos.');
}

main();
