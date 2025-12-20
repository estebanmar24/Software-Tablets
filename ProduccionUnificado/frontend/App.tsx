import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform, ScrollView, useWindowDimensions, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePersistence } from './src/hooks/usePersistence';
import { StatusBar } from 'expo-status-bar';

import * as ScreenOrientation from 'expo-screen-orientation';

import { Sidebar } from './src/components/Sidebar';
import { TimerHeader } from './src/components/TimerHeader';
import { ActivitySelector } from './src/components/ActivitySelector';
import { ProductionCard } from './src/components/ProductionCard';
import { DailyTotals } from './src/components/DailyTotals';
import { ActivityHistory } from './src/components/ActivityHistory';
import { useTimer } from './src/hooks/useTimer';
import {
  Actividad,
  Usuario,
  Maquina,
  OrdenProduccion,
  TiempoProceso,
} from './src/types';
import * as api from './src/services/api';

import { AdminLogin } from './src/components/AdminLogin';
import { AdminDashboard } from './src/components/AdminDashboard';

export default function App() {
  // Persistence
  const { saveState, loadState, clearState } = usePersistence();
  const [isRestored, setIsRestored] = useState(false);

  // Responsive check
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const isPhone = width < 600; // Unicamente teléfonos

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
          // Phone -> Allow Rotation
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
        }
      } catch (e) {
        console.warn('Orientation lock failed:', e);
      }
    }
    changeOrientation();
  }, [isPhone]);

  // Estado de vista: 'timer' | 'login' | 'admin'
  const [currentView, setCurrentView] = useState<'timer' | 'login' | 'admin'>('timer');

  // Persistence for currentView
  useEffect(() => {
    async function loadView() {
      try {
        const savedView = await AsyncStorage.getItem('lastView');
        if (savedView === 'admin' || savedView === 'timer') {
          setCurrentView(savedView as any);
        }
      } catch (e) {
        console.log('Failed to load view state');
      }
    }
    loadView();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('lastView', currentView);
  }, [currentView]);


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
  const [opSearchText, setOpSearchText] = useState('');
  const [selectedActividad, setSelectedActividad] = useState<Actividad | null>(null);

  // Estados de producción acumulada (durante la actividad actual)
  const [tirosAcumulados, setTirosAcumulados] = useState(0);
  const [desperdicioAcumulado, setDesperdicioAcumulado] = useState(0);

  // Estado para observaciones de la sesión actual
  const [observaciones, setObservaciones] = useState('');

  // Totales del día (suma de todo el historial)
  const [tirosTotalesDia, setTirosTotalesDia] = useState(0);

  // 1. Cargar datos persistidos al iniciar
  useEffect(() => {
    const restoreSession = async () => {
      const saved = await loadState();
      if (saved) {
        if (saved.selectedUsuarioId) setSelectedUsuario(saved.selectedUsuarioId);
        if (saved.selectedMaquinaId) setSelectedMaquina(saved.selectedMaquinaId);
        if (saved.selectedActividad) setSelectedActividad(saved.selectedActividad);
        if (saved.selectedOrden) setSelectedOrden(saved.selectedOrden);
        if (saved.opSearchText) setOpSearchText(saved.opSearchText);
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

  // Hook del cronómetro
  const timer = useTimer();

  // 1. Cargar datos persistidos al iniciar
  useEffect(() => {
    const restoreSession = async () => {
      const saved = await loadState();
      if (saved) {
        if (saved.selectedUsuarioId) setSelectedUsuario(saved.selectedUsuarioId);
        if (saved.selectedMaquinaId) setSelectedMaquina(saved.selectedMaquinaId);
        if (saved.selectedActividad) setSelectedActividad(saved.selectedActividad);
        if (saved.selectedOrden) setSelectedOrden(saved.selectedOrden);
        if (saved.opSearchText) setOpSearchText(saved.opSearchText);
        if (saved.observaciones) setObservaciones(saved.observaciones);
        if (saved.tirosAcumulados) setTirosAcumulados(saved.tirosAcumulados);
        if (saved.desperdicioAcumulado) setDesperdicioAcumulado(saved.desperdicioAcumulado);

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
      selectedActividad: selectedActividad,
      selectedOrden: selectedOrden,
      opSearchText,
      observaciones,
      tirosAcumulados,
      desperdicioAcumulado,
      timerStartTime: timer.startTime ? timer.startTime.toISOString() : null
    });
  }, [
    selectedUsuario, selectedMaquina, selectedActividad, selectedOrden,
    opSearchText, observaciones, tirosAcumulados, desperdicioAcumulado,
    timer.startTime, isRestored
  ]);

  // Cargar catálogos al iniciar
  useEffect(() => {
    loadCatalogs();
  }, []);

  // Cargar producción cuando cambian los filtros (Usuario o Máquina)
  useEffect(() => {
    loadProductionData();
  }, [selectedUsuario, selectedMaquina]);

  const loadCatalogs = async () => {
    try {
      const [actividadesData, usuariosData, maquinasData, ordenesData] =
        await Promise.all([
          api.getActividades(),
          api.getUsuarios(),
          api.getMaquinas(),
          api.getOrdenes(),
        ]);

      setActividades(actividadesData);
      setUsuarios(usuariosData);

      // Map API data (PascalCase) to Frontend Interface (camelCase)
      const mappedMaquinas = (maquinasData as any[]).map(m => ({
        id: m.id || m.Id,
        nombre: m.nombre || m.Nombre,
        metaRendimiento: m.metaRendimiento || m.MetaRendimiento || 0,
        valorPorTiro: m.valorPorTiro || m.ValorPorTiro || 0,
        importancia: m.importancia || m.Importancia || 1,
        meta100Porciento: m.meta100Porciento || m.Meta100Porciento || 0
      }));
      console.log('Maquinas Mapped:', JSON.stringify(mappedMaquinas.slice(0, 3), null, 2)); // Debug log
      setMaquinas(mappedMaquinas);

      setOrdenes(ordenesData);
    } catch (error) {
      console.log('API no disponible (catálogos), usando datos de demostración');
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
        { id: 1, nombre: 'Juan Pérez' },
        { id: 2, nombre: 'María García' },
        { id: 3, nombre: 'Carlos López' },
      ]);
      setMaquinas([
        { id: 1, nombre: 'Convertidora 1', metaRendimiento: 15000, valorPorTiro: 0.5, importancia: 1, meta100Porciento: 20000 },
        { id: 2, nombre: 'Guillotina Principal', metaRendimiento: 20000, valorPorTiro: 0.3, importancia: 2, meta100Porciento: 25000 },
        { id: 3, nombre: 'Troqueladora A', metaRendimiento: 10000, valorPorTiro: 0.8, importancia: 3, meta100Porciento: 15000 },
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
      const produccionData = await api.getProduccionDia(
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
  const canStart = selectedActividad !== null && selectedMaquina !== null && selectedUsuario !== null;

  // Manejadores de eventos
  const handleStart = () => {
    if (!canStart) {
      showAlert('Datos incompletos', 'Debe seleccionar máquina, operario y actividad antes de iniciar.');
      return;
    }

    // Validar OP para Producción (02) y Puesta a Punto (01)
    const requiresOP = selectedActividad?.codigo === '01' || selectedActividad?.codigo === '02';
    if (requiresOP && !selectedOrden) {
      showAlert('OP Requerida', 'Debe seleccionar una Orden de Producción (OP) antes de iniciar Producción o Puesta a Punto.');
      return;
    }

    timer.start();
  };

  const handleStop = async () => {
    const { duration, startTime, endTime } = timer.stop();

    // Crear registro para el historial
    // Use local date format (YYYY-MM-DD) instead of UTC to prevent timezone issues
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const nuevoRegistro: TiempoProceso = {
      id: Date.now(),
      fecha: localDate,
      horaInicio: startTime,
      horaFin: endTime,
      duracion: duration,
      usuarioId: selectedUsuario!,
      maquinaId: selectedMaquina!,
      ordenProduccionId: selectedOrden || undefined,
      actividadId: selectedActividad!.id,
      actividadNombre: selectedActividad!.nombre,
      actividadCodigo: selectedActividad!.codigo,
      tiros: tirosAcumulados,
      desperdicio: desperdicioAcumulado,
      observaciones: observaciones, // Usar observaciones de la sesión
    };

    // Agregar al historial (más reciente primero)
    setHistorial((prev) => [nuevoRegistro, ...prev]);

    // Actualizar totales del día
    setTirosTotalesDia((prev) => prev + tirosAcumulados);
    setDesperdicioTotalDia((prev) => prev + desperdicioAcumulado);

    // Reiniciar contadores INMEDIATAMENTE para evitar doble conteo visual
    setTirosAcumulados(0);
    setDesperdicioAcumulado(0);
    setObservaciones('');

    // Intentar guardar en la API
    try {
      const payload = {
        fecha: nuevoRegistro.fecha,
        horaInicio: nuevoRegistro.horaInicio,
        horaFin: nuevoRegistro.horaFin,
        duracion: nuevoRegistro.duracion,
        usuarioId: nuevoRegistro.usuarioId,
        maquinaId: nuevoRegistro.maquinaId,
        ordenProduccionId: nuevoRegistro.ordenProduccionId,
        actividadId: nuevoRegistro.actividadId,
        tiros: nuevoRegistro.tiros,
        desperdicio: nuevoRegistro.desperdicio,
        referenciaOP: opSearchText,
        observaciones: observaciones,
      };
      console.log('=== GUARDANDO EN BD ===');
      console.log('Payload:', JSON.stringify(payload, null, 2));

      const result = await api.registrarTiempo(payload);
      console.log('Guardado exitoso:', result);

      // NO limpiar OP para que persista entre procesos
      // setOpSearchText('');
      clearState(); // Limpiar persistencia de sesión
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Error desconocido';
      console.error('=== ERROR AL GUARDAR ===');
      console.error('Error completo:', error);
      console.error('Mensaje:', errorMsg);
      showAlert('Error de Guardado', `No se pudó guardar en la base de datos: ${errorMsg}`);
    }
  };

  const handleAddTiros = (value: number) => {
    setTirosAcumulados((prev) => prev + value);
  };

  const handleAddDesperdicio = (value: number) => {
    setDesperdicioAcumulado((prev) => prev + value);
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
          await api.limpiarDatos();
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

  if (currentView === 'login') {
    return (
      <AdminLogin
        onLoginSuccess={() => setCurrentView('admin')}
        onBack={() => setCurrentView('timer')}
      />
    );
  }

  if (currentView === 'admin') {
    return (
      <AdminDashboard
        onBack={() => setCurrentView('timer')}
      />
    );
  }

  // Wrapper for mobile scroll
  const MainWrapper: React.ElementType = isMobile ? ScrollView : View;
  const wrapperProps = isMobile
    ? { style: { flex: 1 }, contentContainerStyle: { flexDirection: 'column' as const } }
    : { style: styles.container };

  return (
    <MainWrapper {...wrapperProps}>
      <StatusBar style="dark" />

      {/* Sidebar */}
      <Sidebar
        usuarios={usuarios}
        maquinas={maquinas}
        ordenes={ordenes}
        selectedUsuario={selectedUsuario}
        selectedMaquina={selectedMaquina}
        selectedOrden={selectedOrden}
        selectedActividad={selectedActividad}
        observaciones={observaciones}
        onUsuarioChange={setSelectedUsuario}
        onMaquinaChange={setSelectedMaquina}
        onOrdenChange={setSelectedOrden}
        onObservacionesChange={setObservaciones}
        onAdminPress={() => setCurrentView('login')}
        scrollEnabled={!isMobile} // Disable internal scroll on mobile
        isCollapsible={isPhone} // Solo colapsable en teléfonos
        style={isMobile ? { width: '100%', borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: '#E8ECF0', zIndex: 10 } : undefined}
        opSearchText={opSearchText}
        onOpSearchTextChange={setOpSearchText}
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
              handleAddDesperdicio={handleAddDesperdicio}
              historial={historial}
              // handleClearData removed as the button was removed from the component
              tirosTotales={tirosTotalesDia + tirosAcumulados}
              desperdicioTotal={desperdicioTotalDia + desperdicioAcumulado}
              metaDia={maquinas.find(m => m.id === selectedMaquina)?.metaRendimiento || 0}
              valorPorTiro={maquinas.find(m => m.id === selectedMaquina)?.valorPorTiro || 0}
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
            handleAddDesperdicio={handleAddDesperdicio}
            historial={historial}
            handleClearData={handleClearData}
            tirosTotales={tirosTotalesDia + tirosAcumulados}
            desperdicioTotal={desperdicioTotalDia + desperdicioAcumulado}
            metaDia={maquinas.find(m => m.id === selectedMaquina)?.metaRendimiento || 0}
            valorPorTiro={maquinas.find(m => m.id === selectedMaquina)?.valorPorTiro || 0}
          />
        )}
      </View>
    </MainWrapper>
  );
}

// Extracted Content Component to avoid duplication logic
const Content = ({ timer, selectedActividad, canStart, handleStart, handleStop, isMobile, actividades, handleSelectActividad, handleAddTiros, handleAddDesperdicio, historial, handleClearData, tirosTotales, desperdicioTotal, metaDia, valorPorTiro }: any) => (
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
        <ProductionCard
          onAddTiros={handleAddTiros}
          onAddDesperdicio={handleAddDesperdicio}
          disabled={!selectedActividad?.esProductiva || !timer.isRunning}
        />
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
    backgroundColor: '#F5F7FA',
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
    alignItems: 'flex-start', // Asegurar que las columnas no intenten estirarse infinitamente
    flexWrap: 'wrap', // Para pantallas muy pequeñas
  },
  leftColumn: {
    flex: 1,
    minWidth: 350,
    maxWidth: 600,
  },
  rightColumn: {
    flex: 1,
    minWidth: 350,
  },
});
