import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, Modal, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { api } from '../services/productionApi';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_BASE64 } from '../assets/logo_base64';

interface ConsolidadoRow {
    encuestaId: number;
    fecha: string;
    ordenProduccion: string;
    cliente?: string;
    referencia?: string;
    material?: string;
    cantidadTotal: number;
    cantidadRecuperada: number;
    cantidadParaDespacho: number;
    descripcionNovedad?: string;
    totalProcesos: number;
    // NC data
    ncId?: number;
    alcance?: string;
    tipoReclamacion?: string;
    cantidadNC: number;
    item?: string;
    tipoDefecto?: string;
    responsable?: string;
    areaInvolucrada?: string;
    cargo?: string;
    valorNC: number;
    producto?: string;
    salidaNC?: string;
    controles?: string;
    ncCompleto: boolean;
}

interface AccionASeguir {
    accion: string;
    responsables: string;
    cuando: string;
}

const emptyAccion = (): AccionASeguir => ({ accion: '', responsables: '', cuando: '' });

// Parse controles field - handles both JSON array and legacy plain text
const parseAcciones = (controles?: string): AccionASeguir[] => {
    if (!controles) return [emptyAccion()];
    try {
        const parsed = JSON.parse(controles);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
        // Legacy plain text - wrap in a single action
        return [{ accion: controles, responsables: '', cuando: '' }];
    }
    return [emptyAccion()];
};

const serializeAcciones = (acciones: AccionASeguir[]): string => {
    const filled = acciones.filter(a => a.accion.trim());
    if (filled.length === 0) return '';
    return JSON.stringify(filled);
};

const ALCANCE_OPCIONES = ['Alcance interno', 'Alcance externo'];
const TIPO_OTRO = 'Otro';

const emptyNCForm = {
    alcance: '',
    tipoReclamacion: '',
    cantidadNC: '0',
    item: '',
    tipoDefecto: '',
    responsable: '',
    areaInvolucrada: '',
    cargo: '',
    valorNC: '0',
    producto: '',
    salidaNC: '',
};

export default function ConsolidadoNCView() {
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [rows, setRows] = useState<ConsolidadoRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedRow, setSelectedRow] = useState<ConsolidadoRow | null>(null);
    const [formData, setFormData] = useState({ ...emptyNCForm });
    const [acciones, setAcciones] = useState<AccionASeguir[]>([emptyAccion()]);
    const [tiposReclamacion, setTiposReclamacion] = useState<string[]>(['Queja', 'Reclamo', 'Devolución', 'Otro']);
    const [otroTipoTexto, setOtroTipoTexto] = useState('');

    const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`consolidadonc/consolidado?mes=${mes}&anio=${anio}`);
            setRows(res.data);
        } catch (err) {
            console.error('Error loading consolidado', err);
        } finally {
            setLoading(false);
        }
    }, [mes, anio]);

    useEffect(() => { loadData(); }, [loadData]);

    const loadTiposReclamacion = useCallback(async () => {
        try {
            const res = await api.get('consolidadonc/tipos-reclamacion');
            const tipos = Array.isArray(res.data) ? res.data : [];
            if (tipos.length > 0) setTiposReclamacion(tipos);
        } catch (err) {
            console.error('Error loading tipos reclamación', err);
        }
    }, []);

    useEffect(() => { loadTiposReclamacion(); }, [loadTiposReclamacion]);

    const resolveAlcanceFromRow = (row: ConsolidadoRow) => {
        if (row.alcance) return row.alcance;
        const legacy = (row.tipoReclamacion || '').toUpperCase().trim();
        if (legacy === 'INTERNO' || legacy === 'INTERNA') return 'Alcance interno';
        if (legacy === 'EXTERNO' || legacy === 'EXTERNA') return 'Alcance externo';
        return '';
    };

    const resolveTipoReclamacionFromRow = (row: ConsolidadoRow) => {
        const alcance = resolveAlcanceFromRow(row);
        const tipo = row.tipoReclamacion || '';
        if (!tipo) return '';
        if (tipo === alcance) return '';
        const upper = tipo.toUpperCase();
        if (['INTERNO', 'INTERNA', 'EXTERNO', 'EXTERNA'].includes(upper)) return '';
        return tipo;
    };

    const resolveTipoReclamacionGuardado = () => {
        if (formData.tipoReclamacion === TIPO_OTRO) {
            return otroTipoTexto.trim() || TIPO_OTRO;
        }
        return formData.tipoReclamacion.trim();
    };

    const openEdit = (row: ConsolidadoRow) => {
        setSelectedRow(row);
        const alcanceResolved = resolveAlcanceFromRow(row);
        const tipoResolved = resolveTipoReclamacionFromRow(row);
        setOtroTipoTexto('');
        if (tipoResolved && !tiposReclamacion.includes(tipoResolved)) {
            setFormData({
                ...emptyNCForm,
                alcance: alcanceResolved,
                tipoReclamacion: TIPO_OTRO,
                cantidadNC: (row.cantidadNC || 0).toString(),
                item: row.item || '',
                tipoDefecto: row.tipoDefecto || '',
                responsable: row.responsable || '',
                areaInvolucrada: row.areaInvolucrada || '',
                cargo: row.cargo || '',
                valorNC: (row.valorNC || 0).toString(),
                producto: row.producto || '',
                salidaNC: row.salidaNC || '',
            });
            setOtroTipoTexto(tipoResolved);
        } else {
            setFormData({
                alcance: alcanceResolved,
                tipoReclamacion: tipoResolved,
                cantidadNC: (row.cantidadNC || 0).toString(),
                item: row.item || '',
                tipoDefecto: row.tipoDefecto || '',
                responsable: row.responsable || '',
                areaInvolucrada: row.areaInvolucrada || '',
                cargo: row.cargo || '',
                valorNC: (row.valorNC || 0).toString(),
                producto: row.producto || '',
                salidaNC: row.salidaNC || '',
            });
        }
        setAcciones(parseAcciones(row.controles));
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!selectedRow) return;
        const tipoFinal = resolveTipoReclamacionGuardado();
        const controlesStr = serializeAcciones(acciones);
        try {
            await api.post('consolidadonc/guardar', {
                ncId: selectedRow.ncId || null,
                encuestaProduccionId: selectedRow.encuestaId,
                alcance: formData.alcance,
                tipoReclamacion: tipoFinal,
                tipoReclamacionNuevo: formData.tipoReclamacion === TIPO_OTRO ? otroTipoTexto.trim() : null,
                cantidadNC: parseFloat(formData.cantidadNC) || 0,
                item: formData.item,
                tipoDefecto: formData.tipoDefecto,
                responsable: formData.responsable,
                areaInvolucrada: formData.areaInvolucrada,
                cargo: formData.cargo,
                valorNC: parseFloat(formData.valorNC) || 0,
                producto: formData.producto,
                salidaNC: formData.salidaNC,
                controles: controlesStr,
            });
            setModalVisible(false);
            loadData();
            loadTiposReclamacion();
        } catch (err: any) {
            const msg = err?.message || err?.response?.data?.message || 'Error al guardar';
            Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
        }
    };

    const formatDate = (d: string) => new Date(d).toLocaleDateString();
    const formatCurrency = (v: number) => `$${(v || 0).toLocaleString('es-CO')}`;
    const setField = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

    const updateAccion = (idx: number, field: keyof AccionASeguir, value: string) => {
        setAcciones(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], [field]: value };
            return updated;
        });
    };

    const addAccion = () => {
        setAcciones(prev => [...prev, emptyAccion()]);
    };

    const removeAccion = (idx: number) => {
        setAcciones(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : [emptyAccion()]);
    };

    const pendientes = rows.filter(r => !r.ncCompleto).length;
    const completas = rows.filter(r => r.ncCompleto).length;

    // Build a display string for the table cell
    const getControlesDisplay = (controles?: string) => {
        if (!controles) return null;
        try {
            const parsed: AccionASeguir[] = JSON.parse(controles);
            if (Array.isArray(parsed)) {
                return parsed
                    .filter(a => a.accion.trim())
                    .map(a => {
                        let str = a.accion;
                        if (a.responsables || a.cuando) {
                            str += ` (${[a.responsables, a.cuando].filter(Boolean).join(' - ')})`;
                        }
                        return str;
                    })
                    .join(' | ');
            }
        } catch { return controles; }
        return controles;
    };

    const exportToExcel = () => {
        if (rows.length === 0) {
            Platform.OS === 'web' ? alert('No hay datos para exportar.') : Alert.alert('Sin datos', 'No hay datos para exportar.');
            return;
        }

        const headers = [
            'NC #', 'Fecha', 'OP', 'Cliente', 'Referencia',
            'Alcance', 'Tipo NC', 'Cant NC', 'Cant Total',
            'Item', 'Desc. Novedad', 'Tipo Defecto', 'Responsable',
            'Área', 'Cargo', 'Valor NC ($)', 'Producto', 'Salida NC', 'Acciones a Seguir', 'Estado'
        ];

        const data = rows.map(r => ([
            r.ncId || '',
            new Date(r.fecha).toLocaleDateString('es-CO'),
            r.ordenProduccion,
            r.cliente || '',
            r.referencia || '',
            resolveAlcanceFromRow(r),
            resolveTipoReclamacionFromRow(r),
            r.cantidadNC,
            r.cantidadTotal,
            r.item || '',
            r.descripcionNovedad || '',
            r.tipoDefecto || '',
            r.responsable || '',
            r.areaInvolucrada || '',
            r.cargo || '',
            r.valorNC || 0,
            r.producto || '',
            r.salidaNC || '',
            getControlesDisplay(r.controles) || '',
            r.ncCompleto ? 'Completo' : 'Pendiente'
        ]));

        const wsData = [headers, ...data];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        ws['!cols'] = [
            { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 25 },
            { wch: 20 }, { wch: 10 }, { wch: 12 },
            { wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 22 },
            { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 25 }, { wch: 35 }, { wch: 12 }
        ];

        const wb = XLSX.utils.book_new();
        const mesNombre = meses[mes];
        XLSX.utils.book_append_sheet(wb, ws, `NC ${mesNombre} ${anio}`);

        if (Platform.OS === 'web') {
            const fileName = `Consolidado_NC_${mesNombre}_${anio}.xlsx`;
            XLSX.writeFile(wb, fileName);
        } else {
            Alert.alert('Exportación', 'La exportación a Excel está disponible en la versión web.');
        }
    };

    // Whether the last action has enough data to show the "add" button
    const canAddAccion = acciones.length > 0 &&
        acciones[acciones.length - 1].accion.trim() !== '';

    const exportSingleNCPDF = (row: ConsolidadoRow) => {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const margin = 10;
        const pageWidth = doc.internal.pageSize.width;
        const width = pageWidth - (margin * 2);

        // HEADER BOX
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.rect(margin, margin, width, 25); // Main Header box
        doc.line(margin + 45, margin, margin + 45, margin + 25); // Logo separator
        doc.line(margin + width - 50, margin, margin + width - 50, margin + 25); // Info separator

        // Actual Logo Image
        try {
            // Ensure any whitespace/line breaks are removed from base64
            const cleanedLogo = LOGO_BASE64.trim();
            doc.addImage(cleanedLogo, 'JPEG', margin + 5, margin + 5, 35, 15);
        } catch (e) {
            console.error('Error adding logo to PDF', e);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('ALEPH', margin + 5, margin + 17);
        }

        // Title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('TRATAMIENTO DE NO CONFORME', margin + 45 + (width - 45 - 50) / 2, margin + 15, { align: 'center' });

        // Metadata
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('CODIGO: FO GC 01', margin + width - 48, margin + 5);
        doc.text('VERSION: 01', margin + width - 48, margin + 10);
        doc.text('Fecha de emisión: 2025-07-19', margin + width - 48, margin + 15);
        doc.text('Fecha de actualización:', margin + width - 48, margin + 20);

        let y = margin + 35;

        // SECTION 1: Status checkboxes
        doc.setFontSize(9);
        doc.text('Materia prima: ______', margin, y);
        doc.text('Producto en proceso: ______', margin + 55, y);
        doc.text('Producto terminado: __X__', margin + 130, y);

        y += 10;
        // SECTION 2: General info
        doc.text(`Fecha de elaboración: ${new Date(row.fecha).toLocaleDateString('es-CO')}`, margin, y);
        doc.text(`Proceso: __${row.areaInvolucrada || ''}__`, margin + 55, y);

        y += 7;
        doc.text(`O.P/Factura/Remisión: ________________________`, margin + 55, y);
        doc.text(row.ordenProduccion, margin + 95, y - 1);

        doc.text(`Cliente/Proveedor: ${row.cliente || ''}`, margin + 130, y);
        doc.text(`Consecutivo: ${row.ncId || ''}`, margin + 130, y + 5);

        y += 10;
        // SECTION 3: Name and Ref
        doc.text(`Nombre del producto y referencia:  ${row.producto || row.referencia || ''}`, margin, y);
        doc.line(margin + 58, y + 1, margin + 110, y + 1);
        doc.text(`Detectado por: ${resolveTipoReclamacionFromRow(row) || ''}`, margin + 115, y);

        y += 12;
        // SECTION 4: Description box
        doc.text('Descripción de la no conformidad:', margin, y);
        y += 5;
        doc.rect(margin, y, width, 50);
        const splitDesc = doc.splitTextToSize(row.descripcionNovedad || '', width - 10);
        doc.text(splitDesc, margin + 5, y + 8);

        y += 55;
        // SECTION 5: Quantitative
        doc.text(`Tamaño del lote: ${row.cantidadTotal}`, margin, y);
        doc.line(margin + 30, y + 1, margin + 50, y + 1);

        doc.text(`Cantidad no conforme:`, margin + 55, y);
        doc.text(`${row.cantidadNC}`, margin + 95, y);
        doc.line(margin + 93, y + 1, margin + 110, y + 1);

        doc.text(`Faltante OP:`, margin + 130, y);
        doc.text(`${row.cantidadNC}`, margin + 155, y);
        doc.line(margin + 153, y + 1, margin + 195, y + 1);

        y += 7;
        doc.text(`Costo:   $ ${(row.valorNC || 0).toLocaleString('es-CO')}`, margin + 130, y);
        doc.line(margin + 145, y + 1, margin + 195, y + 1);

        y += 10;
        // TABLE: Actions
        const rowActions = parseAcciones(row.controles);
        const tableData = rowActions
            .filter(a => a.accion.trim())
            .map(acc => [acc.accion, acc.responsables, acc.cuando, '']);

        autoTable(doc, {
            startY: y,
            head: [['Acción a seguir', 'Responsable', 'Cuando', 'FIRMA']],
            body: tableData.length > 0 ? tableData : [['', '', '', ''], ['', '', '', '']],
            theme: 'grid',
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                lineWidth: 0.2,
                lineColor: [0, 0, 0],
                halign: 'center'
            },
            styles: {
                fontSize: 8,
                cellPadding: 3,
                lineColor: [0, 0, 0],
                lineWidth: 0.2,
                minCellHeight: 15
            },
            columnStyles: {
                0: { cellWidth: 90 },
                1: { cellWidth: 40 },
                2: { cellWidth: 30 },
                3: { cellWidth: 30 }
            }
        });

        // FOOTER
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.text('Notificado a: ____________________________________________________', margin, finalY);
        doc.text('Reportar a Gerencia: _____________________________________________', margin, finalY + 8);

        doc.save(`NC_${row.ncId || 'S_N'}_${row.ordenProduccion}.pdf`);
    };

    return (
        <View style={styles.container}>
            <View style={{ marginBottom: 15 }}>
                <View style={styles.statsRow}>
                    <View style={[styles.statBadge, { backgroundColor: '#FED7D7' }]}>
                        <Text style={[styles.statText, { color: '#C53030' }]}>⚠️ Pendientes: {pendientes}</Text>
                    </View>
                    <View style={[styles.statBadge, { backgroundColor: '#C6F6D5' }]}>
                        <Text style={[styles.statText, { color: '#276749' }]}>✅ Completas: {completas}</Text>
                    </View>
                    <View style={[styles.statBadge, { backgroundColor: '#E2E8F0' }]}>
                        <Text style={[styles.statText, { color: '#4A5568' }]}>📊 Total: {rows.length}</Text>
                    </View>
                </View>
            </View>

            {/* Filters */}
            <View style={styles.filterRow}>
                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Mes:</Text>
                    <View style={styles.pickerWrap}>
                        <Picker selectedValue={mes} onValueChange={(v) => setMes(Number(v))} style={styles.picker}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                <Picker.Item key={m} label={meses[m]} value={m} />
                            ))}
                        </Picker>
                    </View>
                </View>
                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Año:</Text>
                    <View style={styles.pickerWrap}>
                        <Picker selectedValue={anio} onValueChange={(v) => setAnio(Number(v))} style={styles.picker}>
                            {[2024, 2025, 2026].map(a => (
                                <Picker.Item key={a} label={a.toString()} value={a} />
                            ))}
                        </Picker>
                    </View>
                </View>
                <TouchableOpacity style={styles.btnRefresh} onPress={loadData}>
                    <Text style={styles.btnText}>🔄 Actualizar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnExcel} onPress={exportToExcel}>
                    <Text style={styles.btnText}>📊 Exportar Excel</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#3182CE" style={{ marginTop: 40 }} />
            ) : (
                <ScrollView horizontal>
                    <View>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { width: 55 }]}>NC #</Text>
                            <Text style={[styles.th, { width: 85 }]}>Fecha</Text>
                            <Text style={[styles.th, { width: 65 }]}>OP</Text>
                            <Text style={[styles.th, { width: 120 }]}>Cliente</Text>
                            <Text style={[styles.th, { width: 150 }]}>Referencia</Text>
                            <Text style={[styles.th, { width: 100 }]}>Alcance</Text>
                            <Text style={[styles.th, { width: 110 }]}>Tipo NC</Text>
                            <Text style={[styles.th, { width: 70 }]}>Cant NC</Text>
                            <Text style={[styles.th, { width: 80 }]}>Cant Total</Text>
                            <Text style={[styles.th, { width: 90 }]}>Item</Text>
                            <Text style={[styles.th, { width: 160 }]}>Desc. Novedad</Text>
                            <Text style={[styles.th, { width: 110 }]}>Tipo Defecto</Text>
                            <Text style={[styles.th, { width: 110 }]}>Responsable</Text>
                            <Text style={[styles.th, { width: 110 }]}>Área</Text>
                            <Text style={[styles.th, { width: 90 }]}>Cargo</Text>
                            <Text style={[styles.th, { width: 100 }]}>Valor NC</Text>
                            <Text style={[styles.th, { width: 110 }]}>Producto</Text>
                            <Text style={[styles.th, { width: 110 }]}>Salida NC</Text>
                            <Text style={[styles.th, { width: 140 }]}>Acciones a Seguir</Text>
                            <Text style={[styles.th, { width: 70 }]}>Acción</Text>
                            <Text style={[styles.th, { width: 70 }]}>Exportar</Text>
                        </View>

                        {/* Table Body */}
                        <ScrollView style={{ maxHeight: 500 }}>
                            {rows.length === 0 ? (
                                <View style={styles.emptyRow}>
                                    <Text style={styles.emptyText}>No hay encuestas de producción para este período</Text>
                                </View>
                            ) : (
                                rows.map((row, idx) => {
                                    const isPending = !row.ncCompleto;
                                    const bgColor = isPending
                                        ? '#FFFAF0'
                                        : (idx % 2 === 0 ? '#fff' : '#F7FAFC');
                                    const borderLeft = isPending ? '#ED8936' : 'transparent';
                                    const controlesDisplay = getControlesDisplay(row.controles);

                                    return (
                                        <TouchableOpacity
                                            key={row.encuestaId}
                                            style={[styles.row, { backgroundColor: bgColor, borderLeftWidth: 3, borderLeftColor: borderLeft }]}
                                            onPress={() => openEdit(row)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.cell, { width: 55, fontWeight: 'bold', color: row.ncId ? '#2D3748' : '#A0AEC0' }]}>
                                                {row.ncId || '—'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 85 }]}>{formatDate(row.fecha)}</Text>
                                            <Text style={[styles.cell, { width: 65, fontWeight: 'bold' }]}>{row.ordenProduccion}</Text>
                                            <Text style={[styles.cell, { width: 120 }]}>{row.cliente || '-'}</Text>
                                            <Text style={[styles.cell, { width: 150 }]} numberOfLines={1}>{row.referencia || '-'}</Text>
                                            <Text style={[styles.cell, { width: 100, color: resolveAlcanceFromRow(row) ? '#2D3748' : '#E57373' }]}>
                                                {resolveAlcanceFromRow(row) || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 110, color: resolveTipoReclamacionFromRow(row) ? '#2D3748' : '#E57373' }]}>
                                                {resolveTipoReclamacionFromRow(row) || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 70, fontWeight: 'bold', color: row.cantidadNC > 0 ? '#E53E3E' : '#E57373' }]}>
                                                {row.cantidadNC}
                                            </Text>
                                            <Text style={[styles.cell, { width: 80 }]}>{row.cantidadTotal}</Text>
                                            <Text style={[styles.cell, { width: 90, color: row.item ? '#2D3748' : '#E57373' }]}>
                                                {row.item || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 160 }]} numberOfLines={2}>
                                                {row.descripcionNovedad || '-'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 110, color: row.tipoDefecto ? '#2D3748' : '#E57373' }]}>
                                                {row.tipoDefecto || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 110, color: row.responsable ? '#2D3748' : '#E57373' }]}>
                                                {row.responsable || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 110, color: row.areaInvolucrada ? '#2D3748' : '#E57373' }]}>
                                                {row.areaInvolucrada || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 90, color: row.cargo ? '#2D3748' : '#E57373' }]}>
                                                {row.cargo || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 100, fontWeight: 'bold', color: row.valorNC > 0 ? '#38A169' : '#E57373' }]}>
                                                {row.valorNC > 0 ? formatCurrency(row.valorNC) : '$0'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 110, color: row.producto ? '#2D3748' : '#E57373' }]}>
                                                {row.producto || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 110, color: row.salidaNC ? '#2D3748' : '#E57373' }]}>
                                                {row.salidaNC || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 140, color: controlesDisplay ? '#2D3748' : '#E57373' }]} numberOfLines={2}>
                                                {controlesDisplay || 'Sin llenar'}
                                            </Text>
                                            <View style={[styles.cell, { width: 70, alignItems: 'center' }]}>
                                                <View style={[styles.editBadge, { backgroundColor: isPending ? '#ED8936' : '#3182CE' }]}>
                                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                                                        {isPending ? 'Llenar' : 'Editar'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.cell, { width: 70, alignItems: 'center' }]}
                                                onPress={(e) => { e.stopPropagation(); exportSingleNCPDF(row); }}
                                            >
                                                <View style={[styles.editBadge, { backgroundColor: '#E53E3E' }]}>
                                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>PDF</Text>
                                                </View>
                                            </TouchableOpacity>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                    </View>
                </ScrollView>
            )}

            {/* Edit Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView>
                            <Text style={styles.modalTitle}>
                                {selectedRow?.ncId ? '✏️ Editar Datos NC' : '📝 Llenar Datos NC'}
                            </Text>

                            {/* Info from encuesta (read-only) */}
                            {selectedRow && (
                                <View style={styles.infoBox}>
                                    <Text style={styles.infoTitle}>Datos de la Encuesta de Producción</Text>
                                    <View style={styles.infoGrid}>
                                        <Text style={styles.infoItem}>📅 Fecha: <Text style={styles.infoValue}>{formatDate(selectedRow.fecha)}</Text></Text>
                                        <Text style={styles.infoItem}>📦 OP: <Text style={styles.infoValue}>{selectedRow.ordenProduccion}</Text></Text>
                                        <Text style={styles.infoItem}>👤 Cliente: <Text style={styles.infoValue}>{selectedRow.cliente || '-'}</Text></Text>
                                        <Text style={styles.infoItem}>📄 Referencia: <Text style={styles.infoValue}>{selectedRow.referencia || '-'}</Text></Text>
                                        <Text style={styles.infoItem}>📊 Cantidad Total: <Text style={styles.infoValue}>{selectedRow.cantidadTotal}</Text></Text>
                                        <Text style={styles.infoItem}>📝 Novedad: <Text style={styles.infoValue}>{selectedRow.descripcionNovedad || '-'}</Text></Text>
                                    </View>
                                </View>
                            )}

                            <Text style={styles.sectionTitle}>Campos NC (ingreso manual)</Text>

                            {/* Manual fields in 2-column grid */}
                            <View style={styles.formGrid}>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Alcance</Text>
                                    <View style={styles.pickerWrap}>
                                        <Picker
                                            selectedValue={formData.alcance}
                                            onValueChange={(v) => setField('alcance', v)}
                                            style={styles.picker}
                                        >
                                            <Picker.Item label="-- Seleccionar --" value="" />
                                            {ALCANCE_OPCIONES.map((opt) => (
                                                <Picker.Item key={opt} label={opt} value={opt} />
                                            ))}
                                        </Picker>
                                    </View>
                                </View>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Tipo de reclamación</Text>
                                    <View style={styles.pickerWrap}>
                                        <Picker
                                            selectedValue={formData.tipoReclamacion}
                                            onValueChange={(v) => {
                                                setField('tipoReclamacion', v);
                                                if (v !== TIPO_OTRO) setOtroTipoTexto('');
                                            }}
                                            style={styles.picker}
                                        >
                                            <Picker.Item label="-- Seleccionar --" value="" />
                                            {tiposReclamacion.map((opt) => (
                                                <Picker.Item key={opt} label={opt} value={opt} />
                                            ))}
                                        </Picker>
                                    </View>
                                    {formData.tipoReclamacion === TIPO_OTRO && (
                                        <TextInput
                                            style={[styles.input, { marginTop: 8 }]}
                                            value={otroTipoTexto}
                                            onChangeText={setOtroTipoTexto}
                                            placeholder="Especifique el tipo (quedará en la lista)"
                                        />
                                    )}
                                </View>
                            </View>

                            <View style={styles.formGrid}>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Cantidad NC</Text>
                                    <TextInput style={styles.input} value={formData.cantidadNC} onChangeText={(v) => setField('cantidadNC', v)} keyboardType="numeric" />
                                </View>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Item</Text>
                                    <TextInput style={styles.input} value={formData.item} onChangeText={(v) => setField('item', v)} placeholder="Item..." />
                                </View>
                            </View>

                            <View style={styles.formGrid}>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Tipo de Defecto</Text>
                                    <TextInput style={styles.input} value={formData.tipoDefecto} onChangeText={(v) => setField('tipoDefecto', v)} placeholder="Tipo de defecto..." />
                                </View>
                            </View>

                            <View style={styles.formGrid}>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Responsable</Text>
                                    <TextInput style={styles.input} value={formData.responsable} onChangeText={(v) => setField('responsable', v)} placeholder="Nombre..." />
                                </View>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Área Involucrada</Text>
                                    <TextInput style={styles.input} value={formData.areaInvolucrada} onChangeText={(v) => setField('areaInvolucrada', v)} placeholder="Área..." />
                                </View>
                            </View>

                            <View style={styles.formGrid}>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Cargo</Text>
                                    <TextInput style={styles.input} value={formData.cargo} onChangeText={(v) => setField('cargo', v)} placeholder="Cargo..." />
                                </View>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Valor NC (COP $)</Text>
                                    <TextInput style={styles.input} value={formData.valorNC} onChangeText={(v) => setField('valorNC', v)} keyboardType="numeric" placeholder="0" />
                                </View>
                            </View>

                            <View style={styles.formGrid}>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Producto</Text>
                                    <TextInput style={styles.input} value={formData.producto} onChangeText={(v) => setField('producto', v)} placeholder="Producto..." />
                                </View>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Salida NC</Text>
                                    <TextInput style={styles.input} value={formData.salidaNC} onChangeText={(v) => setField('salidaNC', v)} placeholder="Salida NC..." />
                                </View>
                            </View>

                            {/* Acciones a Seguir */}
                            <View style={styles.accionesSection}>
                                <Text style={styles.accionesSectionTitle}>📋 Acciones a Seguir</Text>

                                {acciones.map((accion, idx) => (
                                    <View key={idx} style={styles.accionCard}>
                                        <View style={styles.accionCardHeader}>
                                            <Text style={styles.accionCardNum}>Acción #{idx + 1}</Text>
                                            {acciones.length > 1 && (
                                                <TouchableOpacity onPress={() => removeAccion(idx)} style={styles.removeAccionBtn}>
                                                    <Text style={styles.removeAccionText}>✕ Quitar</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        <Text style={styles.formLabel}>Acción a Seguir</Text>
                                        <TextInput
                                            style={[styles.input, { height: 60, marginBottom: 8 }]}
                                            value={accion.accion}
                                            onChangeText={(v) => updateAccion(idx, 'accion', v)}
                                            multiline
                                            placeholder="Describir la acción a seguir..."
                                        />

                                        <View style={styles.formGrid}>
                                            <View style={styles.formCol}>
                                                <Text style={styles.formLabel}>Responsables</Text>
                                                <TextInput
                                                    style={styles.input}
                                                    value={accion.responsables}
                                                    onChangeText={(v) => updateAccion(idx, 'responsables', v)}
                                                    placeholder="Nombre(s)..."
                                                />
                                            </View>
                                            <View style={styles.formCol}>
                                                <Text style={styles.formLabel}>Cuándo</Text>
                                                <TextInput
                                                    style={styles.input}
                                                    value={accion.cuando}
                                                    onChangeText={(v) => updateAccion(idx, 'cuando', v)}
                                                    placeholder="Fecha o plazo..."
                                                />
                                            </View>
                                        </View>
                                    </View>
                                ))}

                                {canAddAccion && (
                                    <TouchableOpacity style={styles.addAccionBtn} onPress={addAccion}>
                                        <Text style={styles.addAccionText}>+ Agregar otra Acción a Seguir</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Buttons */}
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                    <Text style={styles.saveBtnText}>💾 Guardar NC</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 15, backgroundColor: '#F5F7FA' },
    header: { marginBottom: 12 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#2D3748', marginBottom: 8 },
    statsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    statBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
    statText: { fontSize: 12, fontWeight: '700' },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15, flexWrap: 'wrap' },
    filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    filterLabel: { fontSize: 13, fontWeight: '600', color: '#4A5568' },
    pickerWrap: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 6, backgroundColor: '#fff', height: 36, justifyContent: 'center', minWidth: 120 },
    picker: { height: 36 },
    btnRefresh: { backgroundColor: '#3182CE', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
    btnExcel: { backgroundColor: '#276749', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    // Table
    tableHeader: { flexDirection: 'row', backgroundColor: '#2D3748', padding: 8, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
    th: { color: '#fff', fontWeight: 'bold', fontSize: 11, paddingHorizontal: 3 },
    row: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', cursor: 'pointer' as any },
    cell: { fontSize: 11, color: '#2D3748', paddingHorizontal: 3 },
    emptyRow: { padding: 30, alignItems: 'center' },
    emptyText: { color: '#A0AEC0', fontStyle: 'italic' },
    editBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '92%', maxWidth: 750, maxHeight: '92%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D3748', marginBottom: 12, textAlign: 'center' },
    infoBox: { backgroundColor: '#EBF8FF', borderRadius: 8, padding: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#3182CE' },
    infoTitle: { fontSize: 14, fontWeight: 'bold', color: '#2C5282', marginBottom: 8 },
    infoGrid: { gap: 4 },
    infoItem: { fontSize: 12, color: '#4A5568' },
    infoValue: { fontWeight: 'bold', color: '#2D3748' },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#4A5568', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 4 },
    formGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    formCol: { flex: 1 },
    formLabel: { fontSize: 12, fontWeight: '600', color: '#4A5568', marginBottom: 4 },
    input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 6, padding: 8, fontSize: 13, backgroundColor: '#fff' },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 15 },
    cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E0' },
    cancelBtnText: { color: '#4A5568', fontWeight: '600' },
    saveBtn: { backgroundColor: '#38A169', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 },
    saveBtnText: { color: '#fff', fontWeight: 'bold' },
    // Acciones a Seguir
    accionesSection: { marginTop: 4, marginBottom: 12 },
    accionesSectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#2D3748', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 4 },
    accionCard: { backgroundColor: '#F7FAFC', borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    accionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    accionCardNum: { fontSize: 12, fontWeight: 'bold', color: '#3182CE' },
    removeAccionBtn: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#FED7D7', borderRadius: 4 },
    removeAccionText: { fontSize: 11, color: '#C53030', fontWeight: '600' },
    addAccionBtn: { backgroundColor: '#EBF8FF', borderWidth: 1, borderColor: '#90CDF4', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
    addAccionText: { color: '#2B6CB0', fontWeight: 'bold', fontSize: 13 },
});
