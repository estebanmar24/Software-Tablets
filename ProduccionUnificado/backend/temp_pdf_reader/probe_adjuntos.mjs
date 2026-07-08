import fs from 'fs';
import { PDFParse } from 'pdf-parse';

async function r(p) {
    const buf = fs.readFileSync(p);
    const parser = new PDFParse();
    const d = await parser.parse(buf);
    console.log('===', p, '===');
    const text = String(d.text || '');
    console.log(text.slice(0, 3500));
    console.log('--- total chars:', text.length);
}

await r('G:/Proyecto-Tablets/Adjuntos/fichas/F7679.pdf');
await r('G:/Proyecto-Tablets/Adjuntos/op/OP7679.pdf');
