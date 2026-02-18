import fs from 'fs';
import { PDFParse } from 'pdf-parse';

const dataBuffer = fs.readFileSync('G:\\Proyecto-Tablets\\reporte_desperdicios_1770648069729.pdf');

PDFParse(dataBuffer).then(function (data) {
    console.log(data.text);
}).catch(err => {
    console.error(err);
});
