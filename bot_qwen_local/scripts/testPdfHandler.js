const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

async function createSamplePdf(dir, name, text) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, name);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(12).text(text, { align: 'left' });
    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

async function runTest() {
  const pdfDir = path.join(__dirname, '..', 'data', 'pdfs');
  const sampleText = `Este es un PDF de ejemplo sobre aprendizaje automático.\n\nMetodología: se utiliza regresión y clasificación.\n\nResultados: precisión alta en datos sintéticos.`;
  console.log('Creando PDF de ejemplo en', pdfDir);
  await createSamplePdf(pdfDir, 'sample.pdf', sampleText);

  console.log('Indexando PDFs...');
  const handler = require('../src/modules/pdfHandler');
  const info = await handler.buildIndex(pdfDir);
  console.log('Index info:', info);

  const q = '¿Cuál es la metodología?';
  console.log('Consultando:', q);
  const res = handler.query(q, { topK: 3 });
  console.log('Respuesta (extractiva):\n', res.answer ? res.answer.slice(0, 800) : res.reason);
  console.log('Fuentes:', res.sources);
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
