import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform, ScrollView, useWindowDimensions, BackHandler, TouchableOpacity, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePersistence } from './src/hooks/usePersistence';
import { StatusBar } from 'expo-status-bar';

import * as ScreenOrientation from 'expo-screen-orientation';

import { Sidebar } from './src/components/Sidebar';
import { TimerHeader } from './src/components/TimerHeader';
import { ActivitySelector } from './src/components/ActivitySelector';
import { ProductionCard } from './src/components/ProductionCard';
import { WasteModal } from './src/components/WasteModal';
import { DailyTotals } from './src/components/DailyTotals';
import { ActivityHistory } from './src/components/ActivityHistory';
import { useTimer } from './src/hooks/useTimer';
import * as coreApi from './src/services/api';
import * as planeacionApi from './src/services/planeacionApi';

import {
  Actividad,
  Usuario,
  Maquina,
  OrdenProduccion,
  TiempoProceso,
  CodigoDesperdicio,
  RegistroDesperdicioRequest,
  RegistrarTiempoRequest,
  Horario,
} from './src/types';

import { AdminLogin } from './src/components/AdminLogin';
import { AdminDashboard } from './src/components/AdminDashboard';
import CalidadScreen from './src/screens/CalidadScreen';
import OrdenAseoScreen from './src/screens/OrdenAseoScreen';
import UserManagementScreen from './src/screens/UserManagementScreen';
import CalidadTalleresScreen from './src/screens/CalidadTalleresScreen';
import MaquinasScreen from './src/screens/MaquinasScreen';

import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';

export const ThemeToggle = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  return (
    <TouchableOpacity
      style={[themeStyles.themeToggle, { backgroundColor: isDarkMode ? '#1F2937' : '#E2E8F0' }]}
      onPress={toggleTheme}
      activeOpacity={0.8}
    >
      <Text style={[themeStyles.themeToggleText, { filter: 'grayscale(100%) brightness(1.2)' }]}>
        {isDarkMode ? '☀️' : '🌙'}
      </Text>
    </TouchableOpacity>
  );
};

const themeStyles = StyleSheet.create({
  themeToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    marginLeft: 15,
  },
  themeToggleText: {
    fontSize: 20,
  }
});

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  // Persistence
  const { saveState, loadState, clearState } = usePersistence();
  const [isRestored, setIsRestored] = useState(false);
  const { isDarkMode, colors } = useTheme();

  // Responsive check
  const { width } = useWindowDimensions();
  const isMobile = width < 768; // Changed from 900 to prevent large tablets with scaling from triggering mobile view
  const isPhone = width < 600; // Unicamente teléfonos

  // ... (rest of the state and effects from former App component)

  // Enforce Orientation
  // Enforce Orientation
  useEffect(() => {
    async function changeOrientation() {
      if (Platform.OS === 'web') return; // Web browsers don't support forced locking reliably

      try {
        if (!isPhone) {
          // Tablet / Desktop -> Force Landscape
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          // Phone -> Allow free rotation (portrait and landscape)
          await ScreenOrientation.unlockAsync();
        }
      } catch (e) {
        console.warn('Orientation lock failed:', e);
      }
    }
    changeOrientation();
  }, [isPhone]);

  // Estado de vista
  const [currentView, setCurrentView] = useState<'timer' | 'login' | 'admin' | 'calidad' | 'calidad_talleres' | 'develop' | 'esst' | 'public_maquina'>('timer');
  const [publicMachineId, setPublicMachineId] = useState<number | null>(null);
  const [adminRole, setAdminRole] = useState<string>('admin');
  const [adminName, setAdminName] = useState<string>('');
  const [adminArea, setAdminArea] = useState<string>('');
  const [adminPermissions, setAdminPermissions] = useState<string>('');

  // Persistence for currentView - solo persiste 'admin', siempre inicia en 'timer'
  useEffect(() => {
    async function loadView() {
      try {
        // Detect public QR scan from URL params
        if (Platform.OS === 'web') {
            const params = new URLSearchParams(window.location.search);
            const maqId = params.get('maqId');
            if (maqId && !isNaN(parseInt(maqId))) {
                setPublicMachineId(parseInt(maqId));
                setCurrentView('public_maquina');
                return;
            }
        }

        // FORCE RESET TO FIX CRASH LOOP
        // Ignore saved view and clear it
        await AsyncStorage.removeItem('lastView');
        setCurrentView('timer');

        // Restore Admin name/role for context but don't auto-navigate
        const savedRole = await AsyncStorage.getItem('adminRole');
        const savedName = await AsyncStorage.getItem('adminName');
        const savedArea = await AsyncStorage.getItem('adminArea');
        const savedPermissions = await AsyncStorage.getItem('adminPermissions');
        if (savedRole) setAdminRole(savedRole);
        if (savedName) setAdminName(savedName);
        if (savedArea) setAdminArea(savedArea);
        if (savedPermissions) setAdminPermissions(savedPermissions);

      } catch (e) {
        console.log('Failed to load view state');
      }
    }
    loadView();
  }, []);

  useEffect(() => {
    // Persistir estado de vista para admin, calidad, eesst y calidad talleres
    if (currentView === 'admin' || currentView === 'calidad' || currentView === 'esst' || currentView === 'calidad_talleres') {
      AsyncStorage.setItem('lastView', currentView);
      AsyncStorage.setItem('adminRole', adminRole);
      AsyncStorage.setItem('adminName', adminName);
      AsyncStorage.setItem('adminArea', adminArea);
      AsyncStorage.setItem('adminPermissions', adminPermissions);
    } else {
      AsyncStorage.setItem('lastView', 'timer');
    }
  }, [currentView, adminRole, adminName, adminArea, adminPermissions]);

  const handleLoginSuccess = (role: string, nombreMostrar: string, username: string = '', area: string = '', permissions: string = '') => {
    const normalizedRole = (role || '').toLowerCase().trim();
    const normalizedName = (nombreMostrar || '').toLowerCase().trim();
    const normalizedUsername = (username || '').toLowerCase().trim();

    setAdminRole(normalizedRole);
    setAdminName(nombreMostrar || '');
    setAdminArea(area || '');
    setAdminPermissions(permissions || '');

    // Priority Routing: Develop > Calidad > ESST (Exclusive) > Admin (General)
    if (normalizedRole.includes('develop')) {
      setCurrentView('develop');
    } else if (normalizedRole === 'calidad') {
      // Exclusive view only if specific role is strictly 'calidad' and nothing else
      setCurrentView('calidad');
    } else if (normalizedRole === 'calidad_talleres') {
      setCurrentView('calidad_talleres');
    } else if (
      normalizedUsername === 'esst' || // FORCE REDIRECT BY USERNAME
      normalizedRole.includes('esst') ||
      (normalizedRole.includes('sst') && (normalizedName.includes('encuesta') || normalizedName.includes('aseo')))
    ) {
      // Exclusive view for ESST (Orden y Aseo) or SST user specifically for Encuestas
      setCurrentView('esst');
    } else {
      // For 'admin' and mixed roles (e.g. 'produccion,talleres'), use the Dashboard
      setCurrentView('admin');
    }
  };

  // Estados para datos del servidor
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);

  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [historial, setHistorial] = useState<TiempoProceso[]>([]);

  // Estados de selección
  const [selectedUsuario, setSelectedUsuario] = useState<number | null>(null);
  const [selectedMaquina, setSelectedMaquina] = useState<number | null>(null);
  const [selectedOrden, setSelectedOrden] = useState<number | null>(null);
  const [selectedHorario, setSelectedHorario] = useState<number | null>(null);
  const [opSearchText, setOpSearchText] = useState('');
  const [selectedActividad, setSelectedActividad] = useState<Actividad | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);

  // Estados de producción acumulada (durante la actividad actual)
  const [tirosAcumulados, setTirosAcumulados] = useState(0);
  const [desperdicioAcumulado, setDesperdicioAcumulado] = useState(0);

  // Estado para observaciones de la sesión actual
  const [observaciones, setObservaciones] = useState('');

  // Totales del día (suma de todo el historial)
  const [tirosTotalesDia, setTirosTotalesDia] = useState(0);

  // Planeación Actual (Planeador de Máquinas)
  const [planeacionActual, setPlaneacionActual] = useState<any>(null);


  // 1. Cargar datos persistidos al iniciar
  useEffect(() => {
    const restoreSession = async () => {
      const saved = await loadState();
      if (saved) {
        if (saved.selectedUsuarioId) setSelectedUsuario(saved.selectedUsuarioId);
        if (saved.selectedMaquinaId) setSelectedMaquina(saved.selectedMaquinaId);
        if (saved.selectedHorarioId) setSelectedHorario(saved.selectedHorarioId);
        if (saved.selectedActividad) setSelectedActividad(saved.selectedActividad);
        // NOTE: OP is intentionally NOT restored on page reload (user preference)
        // if (saved.selectedOrden) setSelectedOrden(saved.selectedOrden);
        // if (saved.opSearchText) setOpSearchText(saved.opSearchText);
        if (saved.observaciones) setObservaciones(saved.observaciones);
        if (saved.tirosAcumulados) setTirosAcumulados(saved.tirosAcumulados);
        if (saved.desperdicioAcumulado) setDesperdicioAcumulado(saved.desperdicioAcumulado);

        // Resume Timer if it was running and valid
        if (saved.timerStartTime) {
          const startDate = new Date(saved.timerStartTime);
          if (!isNaN(startDate.getTime())) {
            // Pass startDate to a custom start function if exposed, or handle manually
            // Since useTimer exposes 'start', we needed to modify it to accept Date.
            // We did that in the previous step.
            // However, we need to access 'timer' object here. 
            // It is defined below. We might need to move this effect down or move timer up.
            // Actually 'timer' is defined inside App component scope later.
          }
        }
      }
      setIsRestored(true);
    };
    restoreSession();
  }, []); // Run once on mount

  // 2. Guardar cambios automáticamente
  useEffect(() => {
    if (!isRestored) return; // Don't overwrite with empty state during load
    // Need access to timer.startTime, so this effect must be defined AFTER timer is instantiated (which is line 14 originally).
  }, []);
  const [desperdicioTotalDia, setDesperdicioTotalDia] = useState(0);

  // Estado para modal de desperdicios detallados
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [wasteRecords, setWasteRecords] = useState<RegistroDesperdicioRequest[]>([]);
  const [codigosDesperdicio, setCodigosDesperdicio] = useState<CodigoDesperdicio[]>([]);

  // Hook del cronómetro
  const timer = useTimer();
  const [activeProcessId, setActiveProcessId] = useState<number | null>(null);

  // 1. Cargar datos persistidos al iniciar
  useEffect(() => {
    const restoreSession = async () => {
      const saved = await loadState();
      if (saved) {
        if (saved.selectedUsuarioId) setSelectedUsuario(saved.selectedUsuarioId);
        if (saved.selectedMaquinaId) setSelectedMaquina(saved.selectedMaquinaId);
        if (saved.selectedActividad) setSelectedActividad(saved.selectedActividad);
        // NOTE: OP is intentionally NOT restored on page reload (user preference)
        // if (saved.selectedOrden) setSelectedOrden(saved.selectedOrden);
        // if (saved.opSearchText) setOpSearchText(saved.opSearchText);
        if (saved.observaciones) setObservaciones(saved.observaciones);
        if (saved.tirosAcumulados) setTirosAcumulados(saved.tirosAcumulados);
        if (saved.desperdicioAcumulado) setDesperdicioAcumulado(saved.desperdicioAcumulado);
        if (saved.activeProcessId) setActiveProcessId(saved.activeProcessId);

        // Resume Timer if it was running
        if (saved.timerStartTime) {
          const startDate = new Date(saved.timerStartTime);
          if (!isNaN(startDate.getTime())) {
            timer.start(startDate);
          }
        }
      }
      setIsRestored(true);
    };
    restoreSession();
  }, []); // Run once on mount

  // 2. Guardar cambios automáticamente
  useEffect(() => {
    if (!isRestored) return; // Don't overwrite with empty state during load

    saveState({
      selectedUsuarioId: selectedUsuario,
      selectedMaquinaId: selectedMaquina,
      selectedHorarioId: selectedHorario,
      selectedActividad: selectedActividad,
      selectedOrden: selectedOrden,
      opSearchText,
      observaciones,
      tirosAcumulados,
      desperdicioAcumulado,
      timerStartTime: timer.startTime ? timer.startTime.toISOString() : null,
      activeProcessId: activeProcessId
    });
  }, [
    selectedUsuario, selectedMaquina, selectedHorario, selectedActividad, selectedOrden,
    opSearchText, observaciones, tirosAcumulados, desperdicioAcumulado,
    timer.startTime, isRestored, activeProcessId
  ]);

  // Cargar catálogos al iniciar
  useEffect(() => {
    loadCatalogs();
  }, []);

  // Cargar producción cuando cambian los filtros (Usuario o Máquina)
  useEffect(() => {
    loadProductionData();
  }, [selectedUsuario, selectedMaquina]);

  // Cargar Planeación Actual al cambiar de máquina
  useEffect(() => {
    const fetchPlaneacion = async () => {
      if (selectedMaquina) {
        try {
          const plan = await planeacionApi.getPlaneadorActual(selectedMaquina);
          console.log('Planeación actual recibida:', plan);
          setPlaneacionActual(plan);

          // Si hay una planeación y no hay OP seleccionada, o la OP es diferente, sugerir/autollenar
          if (plan && plan.ordenProduccion) {
            // Solo autollenamos si el campo está vacío o si el usuario aún no ha empezado a escribir algo distinto
            if (!opSearchText || opSearchText === '') {
              setOpSearchText(plan.ordenProduccion.numero);
              setSelectedOrden(plan.ordenProduccion.id);
            }
          }
        } catch (error) {
          console.log('Error al buscar planeación:', error);
          setPlaneacionActual(null);
        }
      } else {
        setPlaneacionActual(null);
      }
    };
    fetchPlaneacion();
  }, [selectedMaquina]);


  const loadCatalogs = async () => {
    try {
      const [actividadesData, usuariosData, maquinasData, ordenesData, codigosData, horariosData] =
        await Promise.all([
          coreApi.getActividades(),
          coreApi.getUsuarios(),
          coreApi.getMaquinas(),
          coreApi.getOrdenes(),
          coreApi.getCodigosDesperdicio(),
          coreApi.getHorarios(),
        ]);

      setActividades(actividadesData);
      setUsuarios(usuariosData);
      setCodigosDesperdicio(codigosData);
      setHorarios(horariosData);

      // Map API data (PascalCase) to Frontend Interface (camelCase)
      const mappedMaquinas = (maquinasData as any[]).map(m => ({
        id: m.id || m.Id,
        nombre: m.nombre || m.Nombre,
        metaRendimiento: m.metaRendimiento || m.MetaRendimiento || 0,
        metaDesperdicio: m.metaDesperdicio || m.MetaDesperdicio || 0,
        valorPorTiro: m.valorPorTiro || m.ValorPorTiro || 0,
        tirosReferencia: m.tirosReferencia || m.TirosReferencia || 0,
        semaforoMin: m.semaforoMin || m.SemaforoMin || 0,
        semaforoNormal: m.semaforoNormal || m.SemaforoNormal || 0,
        semaforoMax: m.semaforoMax || m.SemaforoMax || 0,
        importancia: m.importancia || m.Importancia || 0,
        meta100Porciento: m.meta100Porciento || m.Meta100Porciento || 0,
        activo: m.activo ?? m.Activo ?? true,
        tarifa: m.tarifa || m.Tarifa || 0,
      }));
      console.log('Maquinas Mapped:', JSON.stringify(mappedMaquinas.slice(0, 3), null, 2)); // Debug log
      setMaquinas(mappedMaquinas);

      setOrdenes(ordenesData);
    } catch (error: any) {
      const errorMsg = error?.message || 'Error desconocido';
      console.error('Error al cargar catálogos:', error);
      console.error('URL de API:', coreApi.API_URL);
      Alert.alert(
        'Error de Conexión',
        `No se pudo conectar al servidor.\n\nError: ${errorMsg}\n\nUsando datos de demostración.`
      );
      // Datos de demostración
      setActividades([
        { id: 1, codigo: '01', nombre: 'Puesta a Punto', esProductiva: false, observaciones: 'Preparación inicial de la máquina' },
        { id: 2, codigo: '02', nombre: 'Producción', esProductiva: true, observaciones: 'Tiempo productivo de operación' },
        { id: 3, codigo: '03', nombre: 'Reparación', esProductiva: false, observaciones: 'Reparación de fallas o averías' },
        { id: 4, codigo: '04', nombre: 'Descanso', esProductiva: false, observaciones: 'Tiempo de descanso programado' },
        { id: 5, codigo: '08', nombre: 'Otro Tiempo Muerto', esProductiva: false, observaciones: 'Tiempos muertos no planificados' },
        { id: 6, codigo: '10', nombre: 'Mantenimiento y Aseo', esProductiva: false, observaciones: 'Mantenimiento preventivo y limpieza' },
        { id: 7, codigo: '13', nombre: 'Falta de Trabajo', esProductiva: false, observaciones: 'Sin órdenes de producción asignadas' },
        { id: 8, codigo: '14', nombre: 'Otros tiempos', esProductiva: false, observaciones: 'Calibración, cambios de formato y reuniones' },
      ]);
      setUsuarios([
        { id: 1, nombre: 'Juan Pérez', documento: '', activo: true, salario: 0, esPorHoras: false, email: '' },
        { id: 2, nombre: 'María García', documento: '', activo: true, salario: 0, esPorHoras: false, email: '' },
        { id: 3, nombre: 'Carlos López', documento: '', activo: true, salario: 0, esPorHoras: false, email: '' },
      ]);
      setMaquinas([
        { id: 1, nombre: 'Convertidora 1', metaRendimiento: 15000, metaDesperdicio: 0.25, valorPorTiro: 0.5, tirosReferencia: 1250, semaforoMin: 0, semaforoNormal: 0, semaforoMax: 0, importancia: 1, meta100Porciento: 20000, activo: true, tarifa: 0 },
        { id: 2, nombre: 'Guillotina Principal', metaRendimiento: 20000, metaDesperdicio: 0.25, valorPorTiro: 0.3, tirosReferencia: 1250, semaforoMin: 0, semaforoNormal: 0, semaforoMax: 0, importancia: 2, meta100Porciento: 25000, activo: true, tarifa: 0 },
        { id: 3, nombre: 'Troqueladora A', metaRendimiento: 10000, metaDesperdicio: 0.25, valorPorTiro: 0.8, tirosReferencia: 1000, semaforoMin: 0, semaforoNormal: 0, semaforoMax: 0, importancia: 3, meta100Porciento: 15000, activo: true, tarifa: 0 },
      ]);
      setOrdenes([
        { id: 1, numero: 'OP-2024-001', descripcion: 'Etiquetas para producto A', estado: 'EnProceso' },
        { id: 2, numero: 'OP-2024-002', descripcion: 'Cajas para cliente B', estado: 'Pendiente' },
        { id: 3, numero: 'OP-2024-003', descripcion: 'Empaques especiales', estado: 'Pendiente' },
      ]);
    }
  };

  // BackHandler Logic
  useEffect(() => {
    const backAction = () => {
      // Si el historial está abierto o modal, eso se maneja solo (normalmente)
      // Aquí interceptamos la salida de la app
      Alert.alert('Salir', '¿Estás seguro que quieres salir de la aplicación?', [
        {
          text: 'Cancelar',
          onPress: () => null,
          style: 'cancel',
        },
        { text: 'Salir', onPress: () => BackHandler.exitApp() },
      ]);
      return true; // Bloquea la acción por defecto
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);

  const loadProductionData = async () => {
    try {
      // STRICT FILTER: Solo cargar si hay Usuario Y Máquina seleccionados
      if (!selectedUsuario || !selectedMaquina) {
        setHistorial([]);
        setTirosTotalesDia(0);
        setDesperdicioTotalDia(0);
        return;
      }

      // Filtrar por AMBOS: usuario Y máquina seleccionados
      const produccionData = await coreApi.getProduccionDia(
        undefined, // fecha (hoy)
        selectedMaquina, // siempre filtrar por máquina seleccionada
        selectedUsuario  // siempre filtrar por usuario seleccionado
      );

      setHistorial(produccionData.historial);
      setTirosTotalesDia(produccionData.tirosTotales);
      setDesperdicioTotalDia(produccionData.desperdicioTotal);
    } catch (error) {
      console.log('API no disponible (producción)');
      // Limpiar datos si hay error
      setHistorial([]);
      setTirosTotalesDia(0);
      setDesperdicioTotalDia(0);
    }
  };

  // Verificar si se puede iniciar el cronómetro
  const canStart = selectedActividad !== null && selectedMaquina !== null && selectedUsuario !== null && selectedHorario !== null;

  // Manejadores de eventos
  const handleStart = async () => {
    if (!canStart) {
      showAlert('Datos incompletos', 'Debe seleccionar máquina, horario, operario y actividad antes de iniciar.');
      return;
    }

    // Validar OP para Producción (02) y Puesta a Punto (01)
    // Acepta selectedOrden (de lista) O opSearchText (texto libre)
    // NOTE: Ahora se permite vacío para otros, se pondrá 460 automáticamente al guardar si está vacía.
    const requiresOP = selectedActividad?.codigo === '01' || selectedActividad?.codigo === '02';

    const hasOP = selectedOrden || opSearchText.trim().length > 0;

    // EXCEPCIÓN: Corrugadoras 13A y 13B pueden tener OP opcional en estos procesos
    const currentMachine = maquinas.find(m => m.id === selectedMaquina);
    const isCorrugadora = currentMachine?.nombre && (
      currentMachine.nombre.toUpperCase().includes('13A') ||
      currentMachine.nombre.toUpperCase().includes('13B')
    );

    if (requiresOP && !hasOP && !isCorrugadora) {
      showAlert('OP Requerida', 'Debe ingresar una Orden de Producción (OP) antes de iniciar Producción o Puesta a Punto.');
      return;
    }

    const now = new Date();
    timer.start(now);

    // Register active session in backend
    try {
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const startTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ':' + now.getSeconds().toString().padStart(2, '0');

      const payload: RegistrarTiempoRequest = {
        fecha: localDate,
        horaInicio: startTimeStr,
        horaFin: startTimeStr, // Placeholder for start
        duracion: "00:00:00",
        usuarioId: selectedUsuario!,
        maquinaId: selectedMaquina!,
        ordenProduccionId: selectedOrden || undefined,
        actividadId: selectedActividad!.id,
        tiros: 0,
        desperdicio: 0,
        referenciaOP: opSearchText.trim() || '460',
        observaciones: observaciones || '',
        horarioId: selectedHorario || undefined
      };

      const savedRecord = await coreApi.registrarTiempo(payload);
      setActiveProcessId(savedRecord.id);

      // Add to history with "Running" indicators
      const displayRecord: TiempoProceso = {
        ...savedRecord,
        horaFin: '---',
        duracion: 'En Progreso'
      };
      setHistorial(prev => [displayRecord, ...prev]);
    } catch (e) {
      console.error("Error starting backend process:", e);
    }
  };

  const handleStop = async () => {
    // Validar: Para Producción (02), es OBLIGATORIO ingresar tiros > 0
    if (selectedActividad?.codigo === '02' || selectedActividad?.nombre === 'Producción') {
      if (tirosAcumulados <= 0) {
        showAlert('Tiros Requeridos', '⚠️ Debe ingresar la cantidad de tiros producidos antes de terminar el proceso.');
        return; // Detener la acción de parar
      }
    }

    // Validar: Para Reparación (03), es OBLIGATORIO ingresar observaciones
    if (selectedActividad?.codigo === '03' || selectedActividad?.nombre === 'Reparación') {
      if (!observaciones || observaciones.trim().length === 0) {
        showAlert('Observación Requerida', '⚠️ Para terminar una Reparación, debe ingresar obligatoriamente qué se hizo en el campo de "Observaciones".');
        return;
      }
    }

    const { duration, startTime, endTime } = timer.stop();

    // Crear registro para payload
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const payload: RegistrarTiempoRequest = {
      fecha: localDate,
      horaInicio: startTime,
      horaFin: endTime,
      duracion: duration,
      usuarioId: selectedUsuario!,
      maquinaId: selectedMaquina!,
      ordenProduccionId: selectedOrden || undefined,
      actividadId: selectedActividad!.id,
      tiros: tirosAcumulados,
      desperdicio: desperdicioAcumulado,
      referenciaOP: opSearchText.trim() || '460',
      observaciones: observaciones,
      horarioId: selectedHorario || undefined,
    };

    try {
      console.log('=== GUARDANDO EN BD ===');
      let savedRecord: TiempoProceso;

      if (activeProcessId) {
        console.log('Finalizando proceso existente:', activeProcessId);
        savedRecord = await coreApi.finalizarTiempo(activeProcessId, payload);
        // Actualizar en historial (reemplazar el item con "En Progreso")
        setHistorial((prev) => prev.map(item => item.id === activeProcessId ? savedRecord : item));
        setActiveProcessId(null);
      } else {
        console.log('No hay proceso activo, creando nuevo registro');
        savedRecord = await coreApi.registrarTiempo(payload);
        // Agregar al historial
        setHistorial((prev) => [savedRecord, ...prev]);
      }

      console.log('Guardado exitoso:', savedRecord);

      // Actualizar totales del día
      setTirosTotalesDia((prev) => prev + tirosAcumulados);
      setDesperdicioTotalDia((prev) => prev + desperdicioAcumulado);

      // Reiniciar contadores INMEDIATAMENTE
      setTirosAcumulados(0);
      setDesperdicioAcumulado(0);
      setObservaciones('');

      // Guardar registros detallados de desperdicio si existen
      if (wasteRecords.length > 0) {
        try {
          console.log('Guardando detalles de desperdicio:', wasteRecords.length);
          await Promise.all(wasteRecords.map(record =>
            coreApi.registrarDesperdicio({
              ...record,
              tiempoId: savedRecord.id
            })
          ));
          console.log('Detalles de desperdicio guardados correctamente');
        } catch (wasteError) {
          console.error("Error guardando detalles de desperdicio:", wasteError);
          Alert.alert("Advertencia", "El tiempo se guardó, pero hubo un error guardando los detalles de desperdicio.");
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "No se pudo guardar el proceso. Intente de nuevo.");
    }

    // Limpiar registros temporales
    setWasteRecords([]);



    // Clear OP to force re-entry for next process
    setOpSearchText('');
    setSelectedOrden(null); // Also clear selected order object

    clearState(); // Limpiar persistencia de sesión
  };

  const handleAddTiros = (value: number) => {
    setTirosAcumulados((prev) => prev + value);
  };

  // Funciones para WasteModal
  const handleOpenWasteModal = () => setIsWasteModalOpen(true);
  const handleCloseWasteModal = () => setIsWasteModalOpen(false);

  const handleAddWaste = (record: RegistroDesperdicioRequest) => {
    setWasteRecords((prev) => [...prev, record]);
    setDesperdicioAcumulado((prev) => prev + record.cantidad);
  };

  const handleClearData = async () => {
    showConfirm(
      'Limpiar datos',
      '¿Está seguro de que desea limpiar todos los datos del día? Esta acción no se puede deshacer.',
      async () => {
        timer.reset();
        setHistorial([]);
        setTirosTotalesDia(0);
        setDesperdicioTotalDia(0);
        setTirosAcumulados(0);
        setDesperdicioAcumulado(0);
        setObservaciones('');

        try {
          await coreApi.limpiarDatos();
        } catch (error) {
          console.log('No se pudo limpiar en el servidor');
        }
      }
    );
  };

  const handleSelectActividad = (actividad: Actividad) => {
    if (timer.isRunning) {
      showAlert('Cronómetro activo', 'Debe detener el cronómetro antes de cambiar de actividad.');
      return;
    }
    // Clear OP by default when changing activity
    setOpSearchText('');
    setSelectedOrden(null);

    // Special logic: If Descanso (04) or Reparación (03), auto-fill OP 460
    if (actividad.codigo === '03' || actividad.codigo === '04' || actividad.nombre === 'Descanso' || actividad.nombre === 'Reparación') {
      setOpSearchText('460');
      // Deselect any specific order object to ensure we just use the text '460'
      setSelectedOrden(null);
    }

    setSelectedActividad(actividad);
  };

  // Helpers para alertas
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: onConfirm, style: 'destructive' },
      ]);
    }
  };

  if (currentView === 'public_maquina' && publicMachineId) {
    return (
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            <MaquinasScreen 
                publicId={publicMachineId} 
                onBack={() => {
                    // Si el usuario vuelve, lo enviamos al inicio
                    window.location.href = window.location.origin;
                }} 
                publicMode={true}
            />
        </View>
    );
  }

  if (currentView === 'login') {
    return (
      <AdminLogin
        onLoginSuccess={(role, nombreMostrar, username, area) => {
          handleLoginSuccess(role, nombreMostrar, username, area);
        }}
        onBack={() => setCurrentView('timer')}
      />
    );
  }

  if (currentView === 'admin') {
    // FAIL-SAFE: Si el rol es calidad, NUNCA mostrar el dashboard admin
    if (adminRole === 'calidad') {
      return (
        <CalidadScreen
          navigation={{
            goBack: () => setCurrentView('timer'),
            navigate: (screen: string, params?: any) => { console.log('Navigate:', screen); },
            addListener: () => () => { }
          }}
        />
      );
    }

    // FAIL-SAFE: Si el rol es develop, NUNCA mostrar el dashboard admin
    if (adminRole.includes('develop')) {
      return (
        <UserManagementScreen 
          onBack={() => {
            setAdminRole('');
            setAdminName('');
            setAdminPermissions('');
            setCurrentView('timer');
            AsyncStorage.removeItem('adminRole');
            AsyncStorage.removeItem('adminPermissions');
            AsyncStorage.removeItem('lastView');
          }} 
        />
      );
    }

    return (
      <AdminDashboard
        role={adminRole}
        onBack={() => setCurrentView('timer')}
        displayName={adminName}
        area={adminArea}
        permissions={adminPermissions}
      />
    );
  }

  if (currentView === 'calidad') {
    return (
      <CalidadScreen
        navigation={{
          goBack: () => {
            // Limpiar rol y vista guardada para que no vuelva a abrir aquí
            setAdminRole('');
            setAdminName('');
            AsyncStorage.removeItem('adminRole');
            AsyncStorage.removeItem('lastView');
            setCurrentView('timer');
          },
          navigate: (screen: string, params?: any) => {
            // Simple navigation handler for quality screens
            console.log('Navigate to:', screen, params);
          },
          addListener: () => () => { }
        }}
      />
    );
  }

  if (currentView === 'calidad_talleres') {
    return (
      <CalidadTalleresScreen
        navigation={{
          goBack: () => {
            setAdminRole('');
            setAdminName('');
            AsyncStorage.removeItem('adminRole');
            AsyncStorage.removeItem('lastView');
            setCurrentView('timer');
          },
          navigate: (screen: string, params?: any) => {
            console.log('Navigate to:', screen, params);
          },
          addListener: () => () => { }
        }}
      />
    );
  }

  if (currentView === 'develop') {
    return (
      <UserManagementScreen onBack={() => {
        setAdminRole('');
        setAdminName('');
        setAdminPermissions('');
        setCurrentView('timer');
        AsyncStorage.removeItem('adminRole');
        AsyncStorage.removeItem('adminPermissions');
        // No removemos adminName aqui por si acaso, pero borramos persistencia de vista
        AsyncStorage.removeItem('lastView');
      }} />
    );
  }

  if (currentView === 'esst') {
    return (
      <OrdenAseoScreen
        navigation={{
          goBack: () => {
            setAdminRole('');
            setAdminName('');
            AsyncStorage.removeItem('adminRole');
            AsyncStorage.removeItem('lastView');
            setCurrentView('timer');
          },
          navigate: (screen: string, params?: any) => {
            console.log('Navigate to:', screen, params);
          },
          addListener: () => () => { }
        }}
      />
    );
  }

  // Wrapper for mobile scroll
  const MainWrapper: React.ElementType = isMobile ? ScrollView : View;
  const wrapperProps = isMobile
    ? { style: { flex: 1, backgroundColor: colors.background }, contentContainerStyle: { flexDirection: 'column' as const } }
    : { style: [styles.container, { backgroundColor: colors.background }] };

  return (
    <MainWrapper {...wrapperProps}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Sidebar */}
      <Sidebar
        usuarios={usuarios}
        maquinas={maquinas}
        ordenes={ordenes}
        horarios={horarios}
        selectedUsuario={selectedUsuario}
        selectedMaquina={selectedMaquina}
        selectedOrden={selectedOrden}
        selectedHorario={selectedHorario}
        selectedActividad={selectedActividad}
        observaciones={observaciones}
        onUsuarioChange={setSelectedUsuario}
        onMaquinaChange={setSelectedMaquina}
        onOrdenChange={setSelectedOrden}
        onHorarioChange={setSelectedHorario}
        onObservacionesChange={setObservaciones}
        onAdminPress={() => setCurrentView('login')}
        scrollEnabled={!isMobile} // Disable internal scroll on mobile
        isCollapsible={isPhone} // Solo colapsable en teléfonos
        style={isMobile ? { width: '100%', borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: '#E8ECF0', zIndex: 10 } : undefined}
        opSearchText={opSearchText}
        onOpSearchTextChange={setOpSearchText}
        isOpDisabled={selectedActividad?.codigo === '03' || selectedActividad?.codigo === '04' || selectedActividad?.nombre === 'Descanso' || selectedActividad?.nombre === 'Reparación'}
      />

      {/* Contenido principal */}
      <View
        style={[
          isMobile ? { width: '100%', padding: 20 } : styles.mainContent
        ]}
      >
        {/* En Desktop usa ScrollView interno, en Mobile el parent ya es ScrollView así que esto es View */}
        {!isMobile ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.mainContentInner}
            showsVerticalScrollIndicator={true}
          >
            <Content
              timer={timer}
              selectedActividad={selectedActividad}
              canStart={canStart}
              handleStart={handleStart}
              handleStop={handleStop}
              isMobile={isMobile}
              actividades={actividades}
              handleSelectActividad={handleSelectActividad}
              handleAddTiros={handleAddTiros}
              onOpenWasteModal={handleOpenWasteModal}
              historial={historial}
              // handleClearData removed as the button was removed from the component
              tirosTotales={tirosTotalesDia + tirosAcumulados}
              desperdicioTotal={desperdicioTotalDia + desperdicioAcumulado}
              metaDia={planeacionActual?.metaTiros || maquinas.find(m => m.id === selectedMaquina)?.metaRendimiento || 0}
              valorPorTiro={maquinas.find(m => m.id === selectedMaquina)?.valorPorTiro || 0}
              planeacionActual={planeacionActual}
            />

          </ScrollView>
        ) : (
          <Content
            timer={timer}
            selectedActividad={selectedActividad}
            canStart={canStart}
            handleStart={handleStart}
            handleStop={handleStop}
            isMobile={isMobile}
            actividades={actividades}
            handleSelectActividad={handleSelectActividad}
            handleAddTiros={handleAddTiros}
            onOpenWasteModal={handleOpenWasteModal}
            historial={historial}
            handleClearData={handleClearData}
            tirosTotales={tirosTotalesDia + tirosAcumulados}
            desperdicioTotal={desperdicioTotalDia + desperdicioAcumulado}
            metaDia={maquinas.find(m => m.id === selectedMaquina)?.metaRendimiento || 0}
            valorPorTiro={maquinas.find(m => m.id === selectedMaquina)?.valorPorTiro || 0}
          />
        )}
      </View>
      <WasteModal
        visible={isWasteModalOpen}
        onClose={handleCloseWasteModal}
        onAdd={(codigoId, cantidad) => {
          // Crear objeto registro
          if (!selectedMaquina || !selectedUsuario) return;

          const record: RegistroDesperdicioRequest = {
            maquinaId: selectedMaquina,
            usuarioId: selectedUsuario,
            codigoDesperdicioId: codigoId,
            cantidad: cantidad,
            fecha: new Date().toISOString(), // Fecha local UTC o similar
            ordenProduccion: opSearchText || undefined
          };
          handleAddWaste(record);
        }}
        codigos={codigosDesperdicio}
      />
    </MainWrapper>
  );
}

// Extracted Content Component to avoid duplication logic
const Content = ({
  timer, selectedActividad, canStart, handleStart, handleStop,
  isMobile, actividades, handleSelectActividad, handleAddTiros,
  onOpenWasteModal, historial, handleClearData, tirosTotales,
  desperdicioTotal, metaDia, valorPorTiro, planeacionActual
}: any) => (

  <View style={!isMobile ? { minHeight: '100%', padding: 20 } : {}}>
    {/* Header con cronómetro */}
    <TimerHeader
      formattedTime={timer.formattedTime}
      selectedActividad={selectedActividad}
      isRunning={timer.isRunning}
      isPaused={timer.isPaused}
      onStart={handleStart}
      onPause={timer.pause}
      onResume={timer.resume}
      onStop={handleStop}
      canStart={canStart}
    />

    {/* Contenido en dos columnas */}
    <View style={[styles.contentColumns, isMobile && { flexDirection: 'column' }]}>
      {/* Columna izquierda */}
      <View style={[styles.leftColumn, isMobile && { width: '100%', maxWidth: '100%', minWidth: 0 }]}>
        <ActivitySelector
          actividades={actividades}
          selectedActividad={selectedActividad}
          onSelect={handleSelectActividad}
          disabled={timer.isRunning}
        />
        {/* Only show Tiros/Desperdicio for Producción activity (code 02 or name Producción) */}
        {(selectedActividad?.codigo === '02' || selectedActividad?.nombre === 'Producción') && (
          <ProductionCard
            onAddTiros={handleAddTiros}
            onOpenWasteModal={onOpenWasteModal}
            disabled={!timer.isRunning}
          />
        )}
      </View>

      {/* Columna derecha - Historial y Totales */}
      <View style={[styles.rightColumn, isMobile && { width: '100%', minWidth: 0 }]}>
        <ActivityHistory
          historial={historial}
        />
        <View style={{ marginTop: 20 }}>
          <DailyTotals
            tirosTotales={tirosTotales}
            desperdicioTotal={desperdicioTotal}
            meta={metaDia}
            valorPorTiro={valorPorTiro}
            planeacionActual={planeacionActual}
          />

        </View>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContent: {
    flex: 1,
  },
  mainContentInner: {
    padding: 20,
    minHeight: '100%',
  },
  contentColumns: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  leftColumn: {
    flex: 1,
    minWidth: 250,
  },
  rightColumn: {
    flex: 1,
    minWidth: 250,
  },
});

// Trigger reload

// Trigger reload 2

// Trigger reload 3 - Fix Rounding
