const fs = require('fs');
const path = require('path');
// pdfjs will be imported dynamically inside `buildIndex` to support ESM legacy build
const glob = require('glob');
const natural = require('natural');

class PDFHandler {
  constructor() {
    this.docs = [];
    this.tfidf = new natural.TfIdf();
    this._built = false;
    this._cache = {}; // cache per-directory: { fingerprint, docs, tfidf }
  }

  async buildIndex(dir, opts = {}) {
    this.docs = [];
    this.tfidf = new natural.TfIdf();
    const useOCR = opts.useOCR !== undefined ? opts.useOCR : true;
    const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;

    // compute fingerprint of files (paths + mtimes)
    const patternAll = path.join(dir, '**', '*.pdf').replace(/\\/g, '/');
    const allFiles = glob.sync(patternAll, { nodir: true }).sort();
    const filesMeta = allFiles.map(f => {
      try { const s = fs.statSync(f); return { f, mtime: s.mtimeMs, size: s.size }; } catch(e){ return { f, mtime:0, size:0 }; }
    });
    const fingerprint = JSON.stringify(filesMeta);

    const cacheEntry = this._cache[dir];
    if (cacheEntry && cacheEntry.fingerprint === fingerprint) {
      // restore from cache
      this.docs = cacheEntry.docs;
      this.tfidf = cacheEntry.tfidf;
      this._built = true;
      return { filesIndexed: allFiles.length, chunks: this.docs.length, cached: true };
    }

    const pattern = path.join(dir, '**', '*.pdf').replace(/\\/g, '/');
    const files = glob.sync(pattern, { nodir: true });

    if (onProgress) onProgress({ stage: 'start', totalFiles: files.length });

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      const buffer = fs.readFileSync(file);
      try {
        // Import pdfjs legacy ESM build dynamically then extract text
        const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const pdfjsLib = pdfjsModule && (pdfjsModule.default || pdfjsModule);
        const uint8 = new Uint8Array(buffer);
        const loadingTask = pdfjsLib.getDocument({ data: uint8 });
        const pdfDoc = await loadingTask.promise;
        let fullText = '';
        for (let pi = 1; pi <= pdfDoc.numPages; pi++) {
          if (onProgress) onProgress({ stage: 'page_start', fileIndex: fi, file: file, page: pi, totalPages: pdfDoc.numPages });
          const page = await pdfDoc.getPage(pi);
          const content = await page.getTextContent();
          let strs = content.items.map(i => i.str || '').join(' ');

          // If no text found and OCR requested, try OCR for this page
          if ((!strs || strs.trim().length === 0) && useOCR) {
            try {
              const { createCanvas } = await import('canvas').catch(() => ({}));
              const tesseract = await import('tesseract.js').catch(() => ({}));
              if (createCanvas && tesseract && tesseract.createWorker) {
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');
                const renderContext = { canvasContext: context, viewport, canvas };
                await page.render(renderContext).promise;
                const imgBuf = canvas.toBuffer('image/png');
                const worker = tesseract.createWorker();
                await worker.load();
                await worker.loadLanguage('eng');
                await worker.initialize('eng');
                const { data: { text } } = await worker.recognize(imgBuf);
                await worker.terminate();
                strs = (text || '').replace(/\s+/g, ' ').trim();
              }
            } catch (ocrErr) {
              // ignore OCR failures and continue
            }
          }

          fullText += (strs || '') + '\n\n';
          if (onProgress) onProgress({ stage: 'page_end', fileIndex: fi, file: file, page: pi });
        }
        const data = { text: fullText };
        let text = (data.text || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;

        const chunks = this._chunkText(text, 1000, 200);
        for (let i = 0; i < chunks.length; i++) {
          const id = `${path.basename(file)}::${i}`;
          this.docs.push({ id, file: path.basename(file), path: file, index: i, text: chunks[i] });
          this.tfidf.addDocument(chunks[i]);
          if (onProgress) onProgress({ stage: 'chunk', fileIndex: fi, file: file, chunkIndex: i });
        }
        if (onProgress) onProgress({ stage: 'file_end', fileIndex: fi, file: file });
      } catch (err) {
        console.warn('Failed to parse PDF', file, err.message);
      }
    }

    this._built = true;

    // store cache entry
    this._cache[dir] = {
      fingerprint,
      docs: this.docs,
      tfidf: this.tfidf,
      filesIndexed: files.length,
      chunks: this.docs.length,
      cachedAt: Date.now()
    };

    return { filesIndexed: files.length, chunks: this.docs.length, cached: false };
  }

  // Clear cache for a directory or all
  clearCache(dir) {
    if (dir) delete this._cache[dir]; else this._cache = {};
  }

  _chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end).trim());
      if (end === text.length) break;
      start = Math.max(0, end - overlap);
    }
    return chunks;
  }

  _scoreQuery(query) {
    if (!this._built) throw new Error('Index not built. Call buildIndex(dir) first.');
    const tokenizer = new natural.WordTokenizer();
    const terms = tokenizer.tokenize(query.toLowerCase());

    const scores = this.docs.map((doc, i) => {
      let s = 0;
      for (const t of terms) {
        s += this.tfidf.tfidf(t, i) || 0;
      }
      return { i, score: s };
    });
    return scores;
  }

  query(queryText, opts = {}) {
    const topK = opts.topK || 3;
    if (!this._built) throw new Error('Index not built. Call buildIndex(dir) first.');

    const scores = this._scoreQuery(queryText);
    scores.sort((a, b) => b.score - a.score);

    const top = scores.slice(0, topK).filter(s => s.score > 0);
    if (top.length === 0) {
      return { answer: null, reason: 'No hay información relevante en los PDFs para esa consulta.', sources: [] };
    }

    const passages = top.map(s => this.docs[s.i]);

    // Simple extractive "answer": concatenate top passages (trim to reasonable size)
    const answerText = passages.map(p => p.text).join('\n\n');
    const sources = passages.map(p => ({ file: p.file, path: p.path, chunk: p.index }));

    return { answer: answerText, sources };
  }
}

module.exports = new PDFHandler();

// Usage example (uncomment to run directly):
// (async () => {
//   const handler = require('./pdfHandler');
//   await handler.buildIndex('./data/pdfs');
//   const res = handler.query('pregunta sobre el tema', { topK: 5 });
//   console.log(res);
// })();
