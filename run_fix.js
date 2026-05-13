const fs = require('fs');
let code = fs.readFileSync('app/welcome/page.tsx', 'utf8');

const regex = /(<div className="grid grid-cols-2 gap-3">[\s\S]*?<\/div>)\s*<CityTile/;

const replacement = '{(!concierge || !concierge.needsInitialization) && (\n              \n            )}\n            <CityTile';

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('app/welcome/page.tsx', code);
    console.log('Successfully wrapped HomeTiles.');
} else {
    console.log('Failed to wrap HomeTiles.');
}
