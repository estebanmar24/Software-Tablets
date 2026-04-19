// Tipos de datos para la aplicación Tiempo de Procesos

export interface Actividad {
  id: number;
  codigo: string;
  nombre: string;
  esProductiva: boolean;
  observaciones?: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  documento: string;
  activo: boolean;
  salario: number;
  esPorHoras: boolean;
  email: string;
}

export interface Maquina {
  id: number;
  nombre: string;
  metaRendimiento: number;
  metaDesperdicio: number;
  valorPorTiro: number;
  tirosReferencia: number;
  semaforoMin: number;
  semaforoNormal: number;
  semaforoMax: number;
  importancia: number;
  meta100Porciento: number;
  activo: boolean;
  tarifa: number;
}

export interface OrdenProduccion {
  id: number;
  numero: string;
  descripcion: string;
  estado: string;
}

export interface TiempoProceso {
  id: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  duracion: string;
  usuarioId: number;
  usuarioNombre?: string;
  maquinaId: number;
  maquinaNombre?: string;
  ordenProduccionId?: number;
  ordenProduccionNumero?: string;
  actividadId: number;
  actividadNombre?: string;
  actividadCodigo?: string;
  tiros: number;
  desperdicio: number;
  observaciones?: string;
}

export interface ProduccionDia {
  tirosTotales: number;
  desperdicioTotal: number;
  historial: TiempoProceso[];
}

export interface RegistrarTiempoRequest {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  duracion: string;
  usuarioId: number;
  maquinaId: number;
  ordenProduccionId?: number;
  actividadId: number;
  tiros: number;
  desperdicio: number;
  referenciaOP?: string;
  observaciones?: string;
  horarioId?: number;  // Turno de trabajo
}

export interface CodigoDesperdicio {
  id: number;
  codigo: string;
  descripcion: string;
}

export interface Horario {
  id: number;
  codigo: string;
  nombre: string;
}

export interface RegistroDesperdicioRequest {
  maquinaId: number;
  usuarioId: number;
  codigoDesperdicioId: number;
  ordenProduccion?: string;
  cantidad: number;
  fecha: string;
  nota?: string;
  tiempoId?: number;
}
