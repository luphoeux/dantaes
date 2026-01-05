const fs = require('fs');
const pdf = require('pdf-parse-fork');

const pdfPath = process.argv[2] || '0 to 10 Million Gold V1.0.0.pdf';

fs.readFile(pdfPath, async (err, dataBuffer) => {
    if (err) {
        console.error('Error reading PDF:', err);
        process.exit(1);
    }

    try {
        const data = await pdf(dataBuffer);
        console.log('=== PDF METADATA ===');
        console.log('Total Pages:', data.numpages);
        console.log('Info:', JSON.stringify(data.info, null, 2));
        console.log('\n=== FULL TEXT ===\n');
        console.log(data.text);
    } catch (error) {
        console.error('Error parsing PDF:', error);
        process.exit(1);
    }
});
