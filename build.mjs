import fs from 'node:fs';
const header = fs.readFileSync('src/header.txt','utf8');
const libraryLicense = fs.readFileSync('vendor/html2canvas-pro.LICENSE','utf8');
const library = fs.readFileSync('vendor/html2canvas-pro.min.js','utf8')
  .replace(/\/\/# sourceMappingURL=.*$/gm,'')
  .replace(/,typeof window<`u`&&window\.html2canvas&&window\.html2canvas\.default&&\(window\.html2canvas=window\.html2canvas\.default\);?\s*$/, ';');
const app = fs.readFileSync('src/share.js','utf8');
// Capture the UMD export in a private module so nothing is added to the ChatGPT window.
const output = `${header}\n/* Bundled html2canvas-pro license:\n${libraryLicense}\n*/\n(function(){\nconst module={exports:{}}; const exports=module.exports;\n${library}\nconst renderCanvas=module.exports.default || module.exports.html2canvas || module.exports;\n${app}\n})();\n`;
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/chatgpt-share-image.user.js',output);
console.log(`Built dist/chatgpt-share-image.user.js (${output.length} characters)`);
