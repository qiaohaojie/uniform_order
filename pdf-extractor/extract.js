const fs = require('fs');
const pdf = require('pdf-parse');

const targetPath = process.argv[2];
if (!targetPath) {
    console.error("Usage: node extract.js <path-to-pdf>");
    process.exit(1);
}

let dataBuffer = fs.readFileSync(targetPath);

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(console.error);
