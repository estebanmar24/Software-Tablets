import { Platform } from 'react-native';
import {
    type ProveedorAsignado,
    type ProveedorCatalogo,
    type Requisicion,
    type OrdenCompra,
    findProveedorCatalogoPorNombre,
    getSubtotalProveedor,
    formatFechaDisplay,
    formatearConsecutivoOrdenCompra,
    enriquecerProveedorFiscal,
    getLineasFiscalesProveedor,
    getTotalPagarProveedor,
} from '../data/almacenMockData';
const EMPRESA = {
    nombre: 'Aleph impresores',
    nit: 'NIT 890.301.931 - 3',
    direccion: 'CRA 1 # 43 - 76',
    telefono: '6028912464 - 302 8395063',
    ciudad: 'CALI - COLOMBIA',
    regimen: 'REGIMEN COMUN - NO SOMOS AUTORETENEDORES',
};

export interface OrdenCompraPdfInput {
    requisicion: Requisicion;
    proveedor: ProveedorAsignado;
    catalogoProveedores: ProveedorCatalogo[];
    incluirIva: boolean;
}

export interface OrdenCompraConsolidadaPdfInput {
    ordenCompra: OrdenCompra;
    catalogoProveedores: ProveedorCatalogo[];
    incluirIva: boolean;
}

function formatearMonedaPdf(valor: number): string {
    const partes = Math.abs(valor).toFixed(2).split('.');
    const entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `$ ${entero},${partes[1]}`;
}

function formatearCantidadPdf(valor: number): string {
    return valor.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function slugArchivo(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 48);
}

function resolverCatalogoProveedor(
    prov: ProveedorAsignado,
    catalogo: ProveedorCatalogo[]
): ProveedorCatalogo | undefined {
    if (prov.catalogoId) {
        const porId = catalogo.find((c) => c.id === prov.catalogoId);
        if (porId) return porId;
    }
    return findProveedorCatalogoPorNombre(catalogo, prov.nombre);
}

async function cargarLogoBase64(): Promise<string | undefined> {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const rutas = [
        `${window.location.origin}/empresa-logo.jpeg`,
        `${window.location.origin}/assets/assets/LOGO_ALEPH_IMPRESORES.6add8f88690f6574027966c0bc7623da.jpg`,
    ];
    for (const url of rutas) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return dataUrl;
        } catch {
            /* intentar siguiente ruta */
        }
    }
    return undefined;
}

function fechaComprobantePdf(req: Requisicion): string {
    const raw = req.pedido?.fechaPedido?.trim();
    if (raw) return formatFechaDisplay(raw);
    return new Date().toLocaleDateString('es-CO');
}

function etiquetaTotalPdf(etiqueta: string, esRetencion?: boolean): string {
    if (esRetencion) {
        if (etiqueta.startsWith('Retefuente')) return 'Retefuente:';
        if (etiqueta.startsWith('ReteICA')) return 'ReteICA:';
        if (etiqueta.startsWith('ReteIVA')) return 'ReteIVA:';
        return etiqueta.split('(')[0].trim() + ':';
    }
    if (etiqueta.startsWith('IVA')) return 'Iva:';
    return etiqueta.split('(')[0].trim() + ':';
}

export async function generarOrdenCompraPdf(input: OrdenCompraPdfInput): Promise<void> {
    const { requisicion: req, proveedor: prov, catalogoProveedores } = input;
    const catalogo = resolverCatalogoProveedor(prov, catalogoProveedores);
    const provFiscal = enriquecerProveedorFiscal(prov, catalogoProveedores);
    const subtotal = getSubtotalProveedor(provFiscal);
    const lineasFiscales = getLineasFiscalesProveedor(provFiscal, catalogoProveedores);
    const totalPagar = getTotalPagarProveedor(provFiscal, catalogoProveedores);
    const precioUnitario = prov.precioUnitario ?? 0;

    const { jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    const logo = await cargarLogoBase64();
    if (logo) {
        const formato = logo.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(logo, formato, margin, 10, 30, 18);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(EMPRESA.nombre, pageWidth / 2, 14, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(EMPRESA.nit, pageWidth / 2, 19, { align: 'center' });
    doc.text(EMPRESA.direccion, pageWidth / 2, 23, { align: 'center' });
    doc.text(EMPRESA.telefono, pageWidth / 2, 27, { align: 'center' });
    doc.text(EMPRESA.ciudad, pageWidth / 2, 31, { align: 'center' });
    doc.text(EMPRESA.regimen, pageWidth / 2, 35, { align: 'center' });

    const numOc =
        prov.numeroOrdenCompra != null && prov.numeroOrdenCompra > 0
            ? formatearConsecutivoOrdenCompra(prov.numeroOrdenCompra)
            : req.codigo.replace(/^REQ-/i, '');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('ORDEN DE COMPRA', pageWidth - margin, 14, { align: 'right' });
    doc.setFontSize(22);
    doc.setTextColor(220, 38, 38);
    doc.text(numOc, pageWidth - margin, 24, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    let y = 42;
    const col1 = margin;
    const col2 = pageWidth * 0.38;
    const col3 = pageWidth * 0.62;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Señores:', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(prov.nombre, col1 + 18, y);

    doc.setFont('helvetica', 'bold');
    doc.text('Teléfono:', col2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(prov.telefono?.trim() || catalogo?.telefono?.trim() || '—', col2 + 18, y);

    doc.setFont('helvetica', 'bold');
    doc.text('Fecha de Comprobante:', col3, y);
    doc.setFont('helvetica', 'normal');
    doc.text(fechaComprobantePdf(req), col3 + 38, y);

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('NIT/CC:', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(prov.nit?.trim() || catalogo?.nit?.trim() || '—', col1 + 16, y);

    doc.setFont('helvetica', 'bold');
    doc.text('Ciudad:', col2, y);
    doc.setFont('helvetica', 'normal');
    doc.text('CALI', col2 + 14, y);

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Dirección:', col1, y);
    doc.setFont('helvetica', 'normal');
    const direccion = catalogo?.direccion?.trim() || '—';
    const dirLineas = doc.splitTextToSize(direccion, pageWidth * 0.45);
    doc.text(dirLineas, col1 + 18, y);

    const detallesProducto = [req.referencia?.trim(), req.ordenProduccion?.trim()]
        .filter(Boolean)
        .join(' · ');

    autoTable(doc, {
        startY: y + Math.max(6, dirLineas.length * 4.5) + 6,
        head: [['Nombre del producto y ref', 'Detalles', 'Unidad', 'Cantidad', 'Costo unitario', 'Costo Total']],
        body: [
            [
                req.producto,
                detallesProducto || '—',
                req.unidad,
                formatearCantidadPdf(prov.cantidad),
                precioUnitario > 0 ? formatearMonedaPdf(precioUnitario) : '—',
                subtotal > 0 ? formatearMonedaPdf(subtotal) : '—',
            ],
        ],
        styles: {
            fontSize: 8.5,
            cellPadding: 2.5,
            lineColor: [180, 180, 180],
            lineWidth: 0.2,
        },
        headStyles: {
            fillColor: [30, 58, 95],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
        },
        columnStyles: {
            0: { cellWidth: 62 },
            1: { cellWidth: 72 },
            2: { cellWidth: 22, halign: 'center' },
            3: { cellWidth: 24, halign: 'right' },
            4: { cellWidth: 32, halign: 'right' },
            5: { cellWidth: 32, halign: 'right' },
        },
        margin: { left: margin, right: margin },
    });

    const totalesX = pageWidth - margin - 58;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalYTabla = (doc as any).lastAutoTable?.finalY as number | undefined;
    let totalesY = (finalYTabla ?? y + 30) + 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalesX, totalesY);
    doc.text(formatearMonedaPdf(subtotal), pageWidth - margin, totalesY, { align: 'right' });

    totalesY += 6;
    for (const lf of lineasFiscales) {
        if (lf.esTotal) continue;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(etiquetaTotalPdf(lf.etiqueta, lf.esRetencion), totalesX, totalesY);
        if (lf.esRetencion) {
            doc.setTextColor(180, 38, 38);
            doc.text(`- ${formatearMonedaPdf(lf.monto)}`, pageWidth - margin, totalesY, { align: 'right' });
            doc.setTextColor(0, 0, 0);
        } else {
            doc.text(formatearMonedaPdf(lf.monto), pageWidth - margin, totalesY, { align: 'right' });
        }
        totalesY += 6;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const hayRetenciones = lineasFiscales.some((l) => l.esRetencion);
    doc.text(hayRetenciones ? 'Total a pagar:' : 'TOTAL:', totalesX, totalesY);
    doc.text(formatearMonedaPdf(totalPagar), pageWidth - margin, totalesY, { align: 'right' });

    const obsY = Math.min(totalesY + 14, pageHeight - 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Observaciones:', margin, obsY);
    doc.setFont('helvetica', 'normal');
    const obs = req.observacion?.trim() || '';
    if (obs) {
        const obsLineas = doc.splitTextToSize(obs, pageWidth * 0.55);
        doc.text(obsLineas, margin, obsY + 5);
    }

    const nombreArchivo = `Orden_Compra_${req.codigo}_${slugArchivo(prov.nombre)}.pdf`;

    if (Platform.OS === 'web') {
        const blob = doc.output('blob') as Blob;
        const url = URL.createObjectURL(blob);
        const ventana = window.open(url, '_blank', 'noopener,noreferrer');
        if (!ventana) {
            const enlace = document.createElement('a');
            enlace.href = url;
            enlace.target = '_blank';
            enlace.rel = 'noopener noreferrer';
            document.body.appendChild(enlace);
            enlace.click();
            document.body.removeChild(enlace);
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
        return;
    }

    const blob = doc.output('blob');
    const FileSystem = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const uri = `${FileSystem.documentDirectory}${nombreArchivo}`;
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] ?? '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
    });
    if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Orden de compra',
        });
    }
}

function proveedorDesdeOrdenCompra(oc: OrdenCompra): ProveedorAsignado {
    const subtotal = oc.lineas.reduce((acc, l) => {
        const pu = l.precioUnitario ?? 0;
        return acc + pu * l.cantidad;
    }, 0);
    return {
        id: oc.id,
        nombre: oc.nombreProveedor,
        cantidad: 1,
        nit: oc.nit,
        telefono: oc.telefono,
        catalogoId: oc.catalogoId,
        precioUnitario: subtotal > 0 ? subtotal : undefined,
        numeroOrdenCompra: oc.numeroOrdenCompra,
        ordenCompraId: oc.id,
    };
}

export async function generarOrdenCompraConsolidadaPdf(
    input: OrdenCompraConsolidadaPdfInput
): Promise<void> {
    const { ordenCompra: oc, catalogoProveedores, incluirIva } = input;
    if (!oc.lineas.length) throw new Error('La orden de compra no tiene líneas.');

    const provFiscalBase = proveedorDesdeOrdenCompra(oc);
    const catalogo = oc.catalogoId
        ? catalogoProveedores.find((c) => c.id === oc.catalogoId)
        : findProveedorCatalogoPorNombre(catalogoProveedores, oc.nombreProveedor);
    const provFiscal = enriquecerProveedorFiscal(provFiscalBase, catalogoProveedores);
    const subtotal = oc.lineas.reduce((acc, l) => acc + (l.precioUnitario ?? 0) * l.cantidad, 0);
    const lineasFiscales = incluirIva
        ? getLineasFiscalesProveedor(provFiscal, catalogoProveedores)
        : [];
    const totalPagar = incluirIva ? getTotalPagarProveedor(provFiscal, catalogoProveedores) : subtotal;

    const { jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    const logo = await cargarLogoBase64();
    if (logo) {
        const formato = logo.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(logo, formato, margin, 10, 30, 18);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(EMPRESA.nombre, pageWidth / 2, 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(EMPRESA.nit, pageWidth / 2, 19, { align: 'center' });
    doc.text(EMPRESA.direccion, pageWidth / 2, 23, { align: 'center' });
    doc.text(EMPRESA.telefono, pageWidth / 2, 27, { align: 'center' });
    doc.text(EMPRESA.ciudad, pageWidth / 2, 31, { align: 'center' });
    doc.text(EMPRESA.regimen, pageWidth / 2, 35, { align: 'center' });

    const numOc = formatearConsecutivoOrdenCompra(oc.numeroOrdenCompra);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('ORDEN DE COMPRA', pageWidth - margin, 14, { align: 'right' });
    doc.setFontSize(22);
    doc.setTextColor(220, 38, 38);
    doc.text(numOc, pageWidth - margin, 24, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    let y = 42;
    const col1 = margin;
    const col2 = pageWidth * 0.38;
    const col3 = pageWidth * 0.62;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Señores:', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(oc.nombreProveedor, col1 + 18, y);
    doc.setFont('helvetica', 'bold');
    doc.text('Teléfono:', col2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(oc.telefono?.trim() || catalogo?.telefono?.trim() || '—', col2 + 18, y);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha de Comprobante:', col3, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatFechaDisplay(oc.fechaPedido) || oc.fechaPedido, col3 + 38, y);

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('NIT/CC:', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(oc.nit?.trim() || catalogo?.nit?.trim() || '—', col1 + 16, y);
    doc.setFont('helvetica', 'bold');
    doc.text('Ciudad:', col2, y);
    doc.setFont('helvetica', 'normal');
    doc.text('CALI', col2 + 14, y);

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Dirección:', col1, y);
    doc.setFont('helvetica', 'normal');
    const direccion = catalogo?.direccion?.trim() || '—';
    const dirLineas = doc.splitTextToSize(direccion, pageWidth * 0.45);
    doc.text(dirLineas, col1 + 18, y);

    const body = oc.lineas.map((l) => {
        const detalles = [l.referencia?.trim(), l.ordenProduccion?.trim(), l.requisicionCodigo?.trim()]
            .filter(Boolean)
            .join(' · ');
        const pu = l.precioUnitario ?? 0;
        const lineSub = pu * l.cantidad;
        return [
            l.producto,
            detalles || '—',
            l.unidad,
            formatearCantidadPdf(l.cantidad),
            pu > 0 ? formatearMonedaPdf(pu) : '—',
            lineSub > 0 ? formatearMonedaPdf(lineSub) : '—',
        ];
    });

    autoTable(doc, {
        startY: y + Math.max(6, dirLineas.length * 4.5) + 6,
        head: [['Nombre del producto y ref', 'Detalles', 'Unidad', 'Cantidad', 'Costo unitario', 'Costo Total']],
        body,
        styles: {
            fontSize: 8.5,
            cellPadding: 2.5,
            lineColor: [180, 180, 180],
            lineWidth: 0.2,
        },
        headStyles: {
            fillColor: [30, 58, 95],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
        },
        columnStyles: {
            0: { cellWidth: 62 },
            1: { cellWidth: 72 },
            2: { cellWidth: 22, halign: 'center' },
            3: { cellWidth: 24, halign: 'right' },
            4: { cellWidth: 32, halign: 'right' },
            5: { cellWidth: 32, halign: 'right' },
        },
        margin: { left: margin, right: margin },
    });

    const totalesX = pageWidth - margin - 58;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalYTabla = (doc as any).lastAutoTable?.finalY as number | undefined;
    let totalesY = (finalYTabla ?? y + 30) + 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalesX, totalesY);
    doc.text(formatearMonedaPdf(subtotal), pageWidth - margin, totalesY, { align: 'right' });

    totalesY += 6;
    for (const lf of lineasFiscales) {
        if (lf.esTotal) continue;
        doc.text(etiquetaTotalPdf(lf.etiqueta, lf.esRetencion), totalesX, totalesY);
        if (lf.esRetencion) {
            doc.setTextColor(180, 38, 38);
            doc.text(`- ${formatearMonedaPdf(lf.monto)}`, pageWidth - margin, totalesY, { align: 'right' });
            doc.setTextColor(0, 0, 0);
        } else {
            doc.text(formatearMonedaPdf(lf.monto), pageWidth - margin, totalesY, { align: 'right' });
        }
        totalesY += 6;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const hayRetenciones = lineasFiscales.some((l) => l.esRetencion);
    doc.text(hayRetenciones ? 'Total a pagar:' : 'TOTAL:', totalesX, totalesY);
    doc.text(formatearMonedaPdf(totalPagar), pageWidth - margin, totalesY, { align: 'right' });

    const obsY = Math.min(totalesY + 14, pageHeight - 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Productos incluidos: ${oc.lineas.length}`, margin, obsY);

    const nombreArchivo = `Orden_Compra_${numOc}_${slugArchivo(oc.nombreProveedor)}.pdf`;

    if (Platform.OS === 'web') {
        const blob = doc.output('blob') as Blob;
        const url = URL.createObjectURL(blob);
        const ventana = window.open(url, '_blank', 'noopener,noreferrer');
        if (!ventana) {
            const enlace = document.createElement('a');
            enlace.href = url;
            enlace.target = '_blank';
            enlace.rel = 'noopener noreferrer';
            document.body.appendChild(enlace);
            enlace.click();
            document.body.removeChild(enlace);
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
        return;
    }

    const blob = doc.output('blob');
    const FileSystem = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const uri = `${FileSystem.documentDirectory}${nombreArchivo}`;
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] ?? '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
    });
    if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Orden de compra',
        });
    }
}
