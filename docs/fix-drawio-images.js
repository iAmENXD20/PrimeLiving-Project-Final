const fs = require('fs');

const drawioPath = './system-architecture.drawio';
const lines = fs.readFileSync(drawioPath, 'utf8').split('\n');
let changes = 0;

const result = lines.map(line => {
  // Only touch shape=image cells that have embedded PNG data
  if (!line.includes('shape=image') || !line.includes('data:image/png;base64,')) {
    return line;
  }

  // Extract base64 payload (only valid base64 chars)
  const b64Match = line.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  if (!b64Match) return line;
  const b64 = b64Match[1];

  // Build HTML-label style — no semicolons inside the data URI anymore
  const newStyle = 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;';
  // XML-encode the img tag so it can sit inside a draw.io value="" attribute
  const newValue = `&lt;img src=&quot;data:image/png;base64,${b64}&quot; width=&quot;100%&quot; height=&quot;100%&quot; /&gt;`;

  // Replace style="..." — use a split on style=" to avoid greedy issues
  const styleReplaced = line.replace(/style="[^"]*"/, `style="${newStyle}"`);
  // Replace value="..." (currently empty or old img)
  const valueReplaced = styleReplaced.replace(/value="[^"]*"/, `value="${newValue}"`);

  const idM = line.match(/id="([^"]+)"/);
  console.log(`  Converted: ${idM ? idM[1] : '?'}`);
  changes++;
  return valueReplaced;
});

fs.writeFileSync(drawioPath, result.join('\n'), 'utf8');
console.log(`\nDone — converted ${changes} image cells to html=1 labels.`);
