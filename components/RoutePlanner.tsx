
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { geminiService } from '../services/geminiService';
import { AddressStatus, SiteRecord, PlannerConfig, Depot, RoutesMode, ProgressionMode, ProjectCapacity, CapacityStatus, RouteMode, Evidence, Project, ProjectMetadata } from '../types';
import { COLORS } from '../constants';
import { googleMapsService } from '../services/googleMapsService';
import { LogicEngine } from '../LogicEngine';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExecutiveReport from './ExecutiveReport';
import { VisualCalendar } from './VisualCalendar';
import { exportService } from '../services/exportService';
import EvidencePortal from './EvidencePortal';
import { CorridorRouteEngine, DEFAULT_HUBS, MEXICAN_CORRIDORS } from '../services/CorridorRouteEngine';
import { MasterScheduleGantt } from './MasterScheduleGantt';
import { SystemReadiness } from './SystemReadiness';
import { RouteEditor } from './RouteEditor';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  Cell
} from 'recharts';
import targetLogo from '../Images/logo.png';
import { projectDatabase } from '../services/projectDatabase';
import { DataIntegrityChecker } from '../utils/dataIntegrityChecker';
import LZString from 'lz-string';
import * as XLSX from 'xlsx';
import { ImportAuditProcessor } from '../utils/importAuditProcessor';
import { ImportAuditData, FinalDecision } from '../types/auditTypes';
import { DataAuditScreen } from './DataAuditScreen';
import { fuzzyGeocodingService } from '../services/fuzzyGeocodingService';

const RoutePlanner: React.FC = () => {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('PROYECTO_NUEVO_' + new Date().toISOString().split('T')[0]);

  const [fileContent, setFileContent] = useState<string>('');
  const [isCleaning, setIsCleaning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [optimizedRoutes, setOptimizedRoutes] = useState<any[]>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [isLightMode, setIsLightMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [detailViewRoute, setDetailViewRoute] = useState<string | null>(null);
  const [activeRouteForEvidence, setActiveRouteForEvidence] = useState<any | null>(null);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [currentStoreForEvidence, setCurrentStoreForEvidence] = useState<any | null>(null);
  const [evidenceType, setEvidenceType] = useState<'PHOTO' | 'ACK'>('PHOTO');
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [dashboardFilter, setDashboardFilter] = useState<'ALL' | 'PENDING'>('ALL');
  const [evidenceViewMode, setEvidenceViewMode] = useState<'ROUTES' | 'OPERATIONAL' | 'MOBILE' | 'CALENDAR'>('ROUTES');

  const [config, setConfig] = useState<PlannerConfig>({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    workDays: [1, 2, 3, 4, 5, 6], // L-S
    nonWorkingDays: [0], // D
    stopsPerDayPerRoute: 3,
    routesMode: RoutesMode.AUTO,
    plannerMode: 'AI',
    routeMode: RouteMode.LINEAR, // Las rutas NO regresan a CDMX
    progressionMode: ProgressionMode.RADIAL,
    dailyReturnToDepot: false, // Pernocta/hotel
    routesTotalManual: 10,
    avgServiceMinutesPerStop: 60,
    bufferMinutesPerDay: 30,
    bufferPercent: 15
  });

  const [depots, setDepots] = useState<Depot[]>([
    { id: '1', name: 'BASE_CDMX', address: 'Av. Gran Canal del Desagüe 6706, CDMX', lat: 19.523682, lng: -99.033951, routes_count: 10, color: '#2298E0' }
  ]);

  const [activeTab, setActiveTab] = useState<'COMMAND_CENTER' | 'LIST' | 'DASHBOARD' | 'MAP' | 'CALENDAR' | 'EVIDENCIAS'>('COMMAND_CENTER');

  const [mapFilters, setMapFilters] = useState({
    base: 'Todas',
    date: 'Todas',
    routeId: 'Todas'
  });

  const [manualRoutes, setManualRoutes] = useState<any[]>([]);
  const [unassignedSites, setUnassignedSites] = useState<SiteRecord[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showQuotation, setShowQuotation] = useState(false);
  const [showRouteEditor, setShowRouteEditor] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // 🔍 Estados para Auditoría de Importación
  const [auditData, setAuditData] = useState<ImportAuditData | null>(null);
  const [showAuditScreen, setShowAuditScreen] = useState(false);

  const workloadData = useMemo(() => {
    if (optimizedRoutes.length === 0) return [];
    const grouped: { [key: string]: any } = {};
    optimizedRoutes.forEach(r => {
      const d = r.date || 'Sin fecha';
      if (!grouped[d]) {
        grouped[d] = { date: d, total: 0 };
        depots.forEach(dep => {
          grouped[d][dep.name] = 0;
        });
      }
      grouped[d].total++;
      if (r.base) {
        grouped[d][r.base] = (grouped[d][r.base] || 0) + 1;
      }
    });
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [optimizedRoutes, depots]);

  // Persistence Logic - Cargar lista de proyectos y el último proyecto activo
  useEffect(() => {
    const savedMetadata = localStorage.getItem('iamanos_projects_metadata');
    if (savedMetadata) {
      const parsed = JSON.parse(savedMetadata);
      setProjects(parsed);

      // Intentar recuperar el último proyecto activo
      const lastActiveId = localStorage.getItem('iamanos_active_project_id');
      if (lastActiveId && parsed.some((p: any) => p.id === lastActiveId)) {
        loadProject(lastActiveId);
      }
    }
  }, []);

  // Persistir ID del proyecto activo para otros componentes (como el Chat)
  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem('iamanos_active_project_id', activeProjectId);
      localStorage.setItem('iamanos_active_project_name', projectName);
    } else {
      localStorage.removeItem('iamanos_active_project_name');
    }
  }, [activeProjectId, projectName]);

  const saveProject = async (currentSites: SiteRecord[], routes: any[], currentEvidences: Evidence[], currentConfig: PlannerConfig) => {
    try {
      const id = activeProjectId || crypto.randomUUID();
      const metadata: ProjectMetadata = {
        id,
        name: projectName,
        createdAt: projects.find(p => p.id === id)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalSites: currentSites.length,
        totalRoutes: routes.length,
        status: projects.find(p => p.id === id)?.status === 'APPROVED' ? 'APPROVED' : (routes.length > 0 ? 'EXECUTING' : 'PLANNING')
      };

      const projectData: Project = {
        metadata,
        sites: currentSites,
        config: currentConfig,
        optimizedRoutes: routes,
        evidences: currentEvidences
      };

      // ✅ Usar projectDatabase para almacenamiento robusto (IndexedDB via Dexie/Custom)
      await projectDatabase.saveProject(projectData);

      // Fallback a LocalStorage para metadatos rápidos y compatibilidad legacy
      const updatedMetadata = activeProjectId
        ? projects.map(p => p.id === id ? metadata : p)
        : [metadata, ...projects];

      setProjects(updatedMetadata);
      localStorage.setItem('iamanos_projects_metadata', JSON.stringify(updatedMetadata));

      // Sincronizar rutas para el portal de evidencias (Versión compacta para MOBILE)
      if (routes.length > 0) {
        try {
          const lightRoutes = routes.map(r => ({
            ...r,
            stops: r.stops.map((s: any) => ({
              id: s.id,
              store_job_id: s.store_job_id,
              site_id: s.site_id,
              name_sitio: s.name_sitio,
              lat: s.lat,
              lng: s.lng,
              city: s.city,
              state: s.state,
              direccion_completa: s.direccion_completa,
              day_status: s.day_status
            }))
          }));
          localStorage.setItem('iamanos_active_routes', JSON.stringify(lightRoutes));
        } catch (e) {
          console.warn("Could not sync active routes to local storage (quota). Mobile portal may not update.");
        }
      }

      setActiveProjectId(id);
      setLastSaved(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error("Error global de guardado:", err);
      setError("No se pudo sincronizar el proyecto: " + err.message);
    }
  };

  const loadProject = async (id: string) => {
    console.log(`🔄 Cargando proyecto: ${id}`);
    try {
      // ✅ Primero intentar cargar desde projectDatabase (IndexedDB/dexie)
      let project = await projectDatabase.loadProject(id);

      // Fallback a LocalStorage si no está en la base de datos (migración)
      if (!project) {
        const saved = localStorage.getItem(`iamanos_project_${id}`);
        if (saved) {
          try {
            if (!saved.trim().startsWith('{') && !saved.trim().startsWith('[')) {
              const decompressed = LZString.decompressFromUTF16(saved);
              project = JSON.parse(decompressed || '{}');
            } else {
              project = JSON.parse(saved);
            }
            // Migrar a projectDatabase
            if (project) await projectDatabase.saveProject(project);
          } catch (e) {
            console.error("Failed to parse fallback localStorage project:", e);
          }
        }
      }

      if (!project) {
        setError("Error: El proyecto solicitado no fue encontrado.");
        return;
      }

      setActiveProjectId(id);
      setProjectName(project.metadata?.name || 'Proyecto Sin Nombre');

      if (project.sites) setSites(project.sites);
      if (project.sites) setSites(project.sites);
      if (project.config) {
        setConfig(prev => ({
          ...prev,
          ...project.config,
          // Asegurar que las fechas existan, fallback a defaults si están indefinidas
          startDate: project.config.startDate || prev.startDate,
          endDate: project.config.endDate || prev.endDate
        }));
      }
      if (project.optimizedRoutes) setOptimizedRoutes(project.optimizedRoutes);
      if (project.evidences) setEvidences(project.evidences);

      // Determinar paso correcto
      if (project.metadata?.status === 'APPROVED') {
        setActiveStep(4);
      } else {
        setActiveStep(project.optimizedRoutes?.length > 0 ? 4 : (project.sites?.length > 0 ? 2 : 1));
      }

      console.log(`✅ Proyecto cargado con éxito: ${id}`);
    } catch (e: any) {
      console.error("Failed to load project:", e);
      setError("Error al cargar el proyecto: " + e.message);
    }
  };

  const deleteProject = (id: string, e: React.BaseSyntheticEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Deseas eliminar este proyecto permanentemente?\n\nEsta acción:\n1. Liberará espacio en la memoria del navegador.\n2. Borrará todas las rutas y evidencias asociadas.\n3. NO se puede deshacer.")) {
      const updatedMetadata = projects.filter(p => p.id !== id);
      setProjects(updatedMetadata);
      localStorage.setItem('iamanos_projects_metadata', JSON.stringify(updatedMetadata));
      localStorage.removeItem(`iamanos_project_${id}`);
      if (activeProjectId === id) {
        handleCreateNewProject();
      }
    }
  };

  const projectCapacity = useMemo(() => {
    const routesTotal = config.routesMode === RoutesMode.AUTO ? 0 : (config.routesTotalManual || 0);
    return LogicEngine.calculateProjectCapacity(sites.length, config, routesTotal || depots[0].routes_count);
  }, [sites.length, config, depots]);

  const quotationData = useMemo(() => {
    if (optimizedRoutes.length === 0) return null;

    // ✅ Validar que cada ruta tenga km válidos (no NaN, no undefined, no null)
    const totalActualKm = optimizedRoutes.reduce((acc, r) => {
      const km = parseFloat(String(r.totalKm || 0));
      return acc + (isNaN(km) ? 0 : km);
    }, 0);

    const quotedKm = totalActualKm || 0; // Fallback a 0 si es 0 o NaN

    let totalRouteDays = 0;

    optimizedRoutes.forEach(route => {
      // Filtrar fechas válidas
      const validDates = route.stops
        .map((s: any) => s.scheduled_date ? new Date(s.scheduled_date) : null)
        .filter((d): d is Date => d !== null && !isNaN(d.getTime()));

      if (validDates.length > 0) {
        // Calcular span de días (incluyendo domingos/días intermedios)
        const minDate = new Date(Math.min(...validDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...validDates.map(d => d.getTime())));

        // Diferencia en milisegundos
        const diffTime = Math.abs(maxDate.getTime() - minDate.getTime());
        // Diferencia en días (ceil para asegurar día completo) + 1 para incluir el día de inicio
        const daysSpan = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        totalRouteDays += daysSpan;
      }
    });

    const dailyRate = 2000;
    const totalViaticos = totalRouteDays * dailyRate;

    // Regla de Negocio: 15 pesos x Km cubre Gasolina, Casetas, Desgaste y Percances
    const operationalCostPerKm = 15;
    const fuelCost = quotedKm * operationalCostPerKm;

    // Cálculo de Utilidad (30%)
    const subtotal = totalViaticos + fuelCost;
    const margin = subtotal * 0.30;
    // const totalProjectValue = subtotal + margin; // OLD LOGIC

    // Nueva lógica simplificada si el usuario prefiere sumar todo directo, 
    // pero mantenemos estructura comercial estándar (Costo + Margen)
    const totalProjectValue = subtotal + margin;

    // ✅ Agregar campo para tiendas únicas
    const uniqueStoreIds = new Set(optimizedRoutes.flatMap(r => r.stops.map(s => s.id)));
    const totalStores = uniqueStoreIds.size;

    return {
      totalActualKm,
      quotedKm,
      totalKm: quotedKm, // Alias para compatibilidad con PDF
      totalRouteDays,
      dailyRate,
      totalViaticos,
      fuelCost,
      subtotal,
      margin,
      totalProjectValue,
      routesCount: optimizedRoutes.length,
      totalStores // ✅ NUEVO: Tiendas ÚNICAS
    };
  }, [optimizedRoutes]);

  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Sincronización continua de evidencias (Simulación de Real-time con el Nodo Móvil)
  useEffect(() => {
    const syncEvidences = () => {
      const savedEvidences = localStorage.getItem('iamanos_project_evidences');
      if (savedEvidences) {
        const parsed = JSON.parse(savedEvidences);
        if (JSON.stringify(parsed) !== JSON.stringify(evidences)) {
          setEvidences(parsed);
        }
      }
    };

    const interval = setInterval(syncEvidences, 2000);
    return () => clearInterval(interval);
  }, [evidences]);

  // Cargador dinámico de Google Maps SDK
  useEffect(() => {
    const rawKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
    const key = typeof rawKey === 'string' ? rawKey.trim() : rawKey;

    if (!key) {
      console.warn("Google Maps API Key no encontrada.");
      // Solo mostramos error si el usuario está en la pestaña de mapas
      if (activeTab === 'MAP') {
        setMapError("Configuración incompleta: Se requiere llave de Google Maps para visualización GIS.");
      }
      return;
    }

    // Limpiamos errores previos si la llave sí existe
    setMapError(null);

    // Definir manejador de falla de autenticación
    (window as any).gm_authFailure = () => {
      setMapError("Falla de Autenticación: La API Key proporcionada no es válida o no tiene los permisos necesarios (Maps JavaScript API).");
      setMapReady(false);
    };

    if ((window as any).google) {
      setMapReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry,drawing,places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log("Google Maps SDK Loaded Dynamically");
      setMapReady(true);
    };
    script.onerror = () => {
      setMapError("Error al cargar Google Maps SDK. Verifica tu conexión o API Key.");
    };
    document.head.appendChild(script);
  }, []);


  // Mapa Interactivo GIS
  useEffect(() => {
    if (activeTab === 'MAP' && (window as any).google && optimizedRoutes.length > 0) {
      setTimeout(() => {
        const container = document.getElementById('google-map-container');
        if (!container) return;

        const map = new (window as any).google.maps.Map(container, {
          center: { lat: depots[0].lat, lng: depots[0].lng },
          zoom: 5,
          disableDefaultUI: false,
          styles: isLightMode ? [
            { elementType: "geometry", stylers: [{ color: "#f8fafc" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#f8fafc" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e2e8f0" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#e2e8f0" }] }
          ] : [
            { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] }
          ]
        });

        mapRef.current = map;
        setMapReady(true);

        const bounds = new (window as any).google.maps.LatLngBounds();
        const infoWindow = new (window as any).google.maps.InfoWindow();

        // Filtrar rutas según la selección
        const routesToShow = optimizedRoutes.filter(r =>
          (mapFilters.base === 'Todas' || r.base === mapFilters.base) &&
          (mapFilters.date === 'Todas' || r.date === mapFilters.date) &&
          (mapFilters.routeId === 'Todas' || r.id === mapFilters.routeId)
        );

        routesToShow.forEach((route) => {
          const pathCoords: any[] = [];
          const baseColor = route.color || '#3b82f6';

          const baseObj = depots.find(d => d.id === route.depotId) || depots[0];
          const originCoords = { lat: baseObj.lat, lng: baseObj.lng };
          pathCoords.push(originCoords);
          bounds.extend(originCoords);

          route.stops.forEach((stop: SiteRecord, idx: number) => {
            const pos = { lat: stop.lat || 0, lng: stop.lng || 0 };
            pathCoords.push(pos);
            bounds.extend(pos);

            // Marcador Premium AntiGravity
            const marker = new (window as any).google.maps.Marker({
              position: pos,
              map,
              title: `${stop.name_sitio}\nRuta ${route.id} - P${idx + 1}\n${(stop as any).direccion_normalizada || stop.formatted_address || ''}`,
              clickable: true,
              label: {
                text: `R${String(route.id).replace(/\D/g, '')}-${idx + 1}`,
                color: "white",
                fontSize: "9px",
                fontWeight: "bold",
                className: "map-label-outline"
              },
              icon: {
                path: 'M 0,-1.5 A 1.5,1.5 0 1,1 0,1.5 A 1.5,1.5 0 1,1 0,-1.5 Z', // Círculo perfecto SVG
                fillColor: baseColor,
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "#ffffff",
                scale: 16,
                labelOrigin: new (window as any).google.maps.Point(0, 0)
              },
              zIndex: 1000 + idx
            });

            // Acción de Click: Mostrar InfoWindow con detalles y link
            marker.addListener("click", () => {
              const address = (stop as any).direccion_normalizada || stop.formatted_address || stop.full_address_derived || "Ubicación Georreferenciada";

              // Construir query de alta precisión
              const query = stop.lat && stop.lng
                ? `${stop.lat},${stop.lng}`
                : `${stop.name_sitio}, ${address}`;

              const contentString = `
                <div style="color:#0f172a; padding:4px; max-width:220px; font-family: sans-serif;">
                  <h3 style="margin:0 0 4px 0; font-weight:800; font-size:13px; text-transform:uppercase;">${stop.name_sitio}</h3>
                  <p style="margin:0 0 8px 0; font-size:10px; color:#64748b; line-height:1.4;">${address}</p>
                  
                  <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                     <span style="background:${baseColor}; color:white; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:bold; letter-spacing:1px;">RUTA ${String(route.id).replace(/\D/g, '')}</span>
                     <span style="background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:bold;">SEQ #${idx + 1}</span>
                  </div>

                  <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}" target="_blank" style="display:inline-block; width:100%; text-align:center; background:#2563eb; color:white; padding:6px 0; border-radius:6px; font-weight:bold; font-size:10px; text-decoration:none; box-shadow:0 2px 5px rgba(37,99,235,0.2);">
                    📍 ABRIR EN GOOGLE MAPS
                  </a>
                </div>
               `;

              infoWindow.setContent(contentString);
              infoWindow.open(map, marker);
            });
          });

          if (config.dailyReturnToDepot) {
            pathCoords.push(originCoords);
          }

          // Polilínea de Ruta con Brillo Estético
          new (window as any).google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor: baseColor,
            strokeOpacity: 0.9,
            strokeWeight: 5,
            map: map
          });
        });

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds);
        }
      }, 500);
    }
  }, [activeTab, optimizedRoutes, mapFilters, depots, isLightMode]);

  const processFileRows = (headers: string[], rows: any[][], fileName: string = 'archivo.xlsx') => {
    const originalHeaders = headers.map(h =>
      h.trim().replace(/^["']|["']$/g, '').replace(/^\uFEFF/, '')
    );
    setFileHeaders(originalHeaders);

    const upperHeaders = originalHeaders.map(h => h.toUpperCase().trim());

    // Búsqueda inteligente de columnas (Lax Mapping)
    const findCol = (possibilities: string[]) => {
      for (const p of possibilities) {
        const idx = upperHeaders.findIndex(h => h === p.toUpperCase() || h.includes(p.toUpperCase()));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const idxs = {
      id: findCol(['ID_TIENDA', 'ID', 'CODIGO', 'SITE_ID', 'SITIO_ID', 'ID SITIO']),
      name: findCol(['NOMBRE_TIENDA', 'NOMBRE', 'SITE_NAME', 'TIENDA', 'SITIO', 'NOMBRE SITIO']),
      marca: findCol(['MARCA', 'CLIENTE', 'BRAND', 'NEGOCIO']),
      region: findCol(['REGION', 'ZONA', 'AREA', 'TERRITORIO']),
      ranking: findCol(['RANKING', 'PRIORIDAD', 'IMPORTANCIA', 'NIVEL']),
      city: findCol(['CIUDAD', 'CITY', 'LOCALIDAD', 'POBLACION']),
      state: findCol(['ESTADO', 'STATE', 'ENTIDAD', 'PROVINCIA']),
      municipio: findCol(['ALCALDIA_MUNICIPIO', 'MUNICIPIO', 'ALCALDIA', 'DELEGACION']),
      cp: findCol(['CP', 'CODIGO POSTAL', 'POSTAL_CODE', 'ZIP']),
      colonia: findCol(['COLONIA', 'NEIGHBORHOOD', 'BARRIO', 'FRACCIONAMIENTO']),
      address: findCol(['DIRECCION_COMPLETA', 'DIRECCION', 'ADDRESS', 'CALLE_Y_NUMERO', 'CALLE'])
    };

    const data = rows.map((cols, i) => {
      const raw_data: Record<string, string> = {};
      originalHeaders.forEach((header, hIdx) => {
        raw_data[header] = String(cols[hIdx] || '').trim();
      });

      // Extracción Robusta
      const extract = (idx: number, fallback: string = '') => {
        if (idx === -1) return fallback;
        const val = String(cols[idx] || '').trim();
        return val || fallback;
      };

      const rawSite: Partial<SiteRecord> = {
        site_id: extract(idxs.id, `T-${1000 + i}`),
        name_sitio: extract(idxs.name, `TIENDA ${1000 + i}`),
        marca: extract(idxs.marca, 'TIENDA'),
        region: extract(idxs.region, 'CENTRO'),
        ranking: extract(idxs.ranking, 'B'),
        city: extract(idxs.city, ''),
        state: extract(idxs.state, ''),
        municipio: extract(idxs.municipio, ''),
        cp: extract(idxs.cp, ''),
        colonia: extract(idxs.colonia, ''),
        direccion_completa: extract(idxs.address, 'DIRECCIÓN NO PROPORCIONADA'),
        raw_data
      };

      // Paso 2 — Limpieza y FULL_ADDRESS
      const full_address_derived = LogicEngine.deriveFullAddress(rawSite);
      // 🔥 IMPORTANTE: Resetear coordenadas para obligar a geocodificar si no vienen
      // O usarlas si el Excel ya las trae (lat, lng)
      // Por ahora asumimos que se re-calculan o se intenta geocodificar.

      return {
        ...rawSite,
        id: crypto.randomUUID(),
        full_address_derived,
        status: AddressStatus.PENDING,
        notes: 'Pendiente de Geocodificación',
        confidence_score: 0,
      } as SiteRecord;
    });

    // 🚀 BYPASS DE AUDITORÍA (Solicitado por Usuario)
    // Cargar datos directamente sin pasar por pantalla de confirmación
    console.log(`🚀 Importación directa de ${data.length} sitios (Audit Bypass)`);
    setSites(data as SiteRecord[]);
    saveProject(data as SiteRecord[], [], [], config);
    setActiveStep(2);
  };

  // 🔍 Handlers de Auditoría de Importación
  const handleAuditApproval = (approvedData: ImportAuditData) => {
    // Filtrar solo tiendas que SE_QUEDAN
    const finalSites = approvedData.entries
      .filter(e => e.status_final === FinalDecision.SE_QUEDA)
      .map(e => ({
        ...e.original.raw_data,
        lat: e.processed.lat,
        lng: e.processed.lng,
        place_id: e.processed.place_id,
        formatted_address: e.processed.formatted_address,
        confidence_score: e.processed.confidence_score
      } as SiteRecord));

    console.log(`✅ Aprobadas ${finalSites.length} de ${approvedData.entries.length} tiendas`);

    setSites(finalSites);
    saveProject(finalSites, [], [], config);
    setShowAuditScreen(false);
    setAuditData(null);
    setActiveStep(2);
  };

  const handleAuditCancel = () => {
    setShowAuditScreen(false);
    setAuditData(null);
    // No avanzar, usuario puede volver a cargar archivo
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    if (fileName.endsWith('.csv')) {
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setFileContent(text);
        try {
          const lines = text.split(/\r?\n/).filter(r => r.trim());
          if (lines.length === 0) return;

          const firstRow = lines[0];
          const delimiters = [',', ';', '\t', '|'];
          const counts = delimiters.map(d => ({ d, count: firstRow.split(d).length }));
          const delimiter = counts.sort((a, b) => b.count - a.count)[0].d;

          const headers = firstRow.split(delimiter);
          const rows = lines.slice(1).map(row =>
            row.split(new RegExp(`${delimiter === '|' ? '\\|' : delimiter}(?=(?:(?:[^"]*"){2})*[^"]*$)`))
              .map(c => c.trim().replace(/^["']|["']$/g, ''))
          );

          processFileRows(headers, rows, file.name);
        } catch (err) {
          console.error("Error parsing CSV", err);
          setError("Error al leer el archivo CSV. Verifica el formato.");
        }
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length === 0) return;

          const headers = jsonData[0].map(h => String(h || ''));
          const rows = jsonData.slice(1);

          processFileRows(headers, rows, file.name);
        } catch (err) {
          console.error("Error parsing Excel", err);
          setError("Error al leer el archivo Excel. Asegúrate de que no esté protegido.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError("Formato de archivo no soportado. Usa .csv, .xlsx o .xls");
    }
  };

  const [error, setError] = useState<string | null>(null);

  const [selectedSites, setSelectedSites] = useState<string[]>([]);

  const toggleSiteSelection = (siteId: string) => {
    setSelectedSites(prev => prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]);
  };

  const addManualRoute = (depotId: string) => {
    const newRoute: any = {
      id: `M-${Date.now()}`,
      depotId,
      base: depots.find(d => d.id === depotId)?.name || 'Manual',
      date: config.startDate,
      driverName: "Técnico Nuevo",
      secondaryDriverName: "Asistente",
      stops: [],
      totalKm: 0,
      estTimeMinutes: 0,
      color: Object.values(COLORS)[Math.floor(Math.random() * Object.values(COLORS).length)]
    };
    setOptimizedRoutes([...optimizedRoutes, newRoute]);
  };

  const toggleStopLock = (routeId: string, siteId: string) => {
    setOptimizedRoutes(prev => prev.map(r => {
      if (r.id !== routeId) return r;
      return {
        ...r,
        stops: r.stops.map((s: SiteRecord) => s.id === siteId ? { ...s, locked: !s.locked } : s)
      };
    }));
  };

  const addDepot = async () => {
    const name = prompt("Nombre de la nueva base (Ej. DEPOT SUR - PUEBLA):");
    if (!name) return;
    const address = prompt("Dirección de la base (Ej. Puebla, Pue):");
    if (!address) return;

    setIsCleaning(true);
    try {
      const geo = await googleMapsService.geocode(address);
      if (geo) {
        const newDepot: Depot = {
          id: `D-${Date.now()}`,
          name: name.toUpperCase(),
          address: geo.formatted_address || address,
          lat: geo.lat,
          lng: geo.lng,
          routes_count: 1,
          color: Object.values(COLORS)[depots.length % Object.values(COLORS).length] as string
        };
        setDepots([...depots, newDepot]);
      } else {
        alert("No se pudo geocodificar la dirección de la base.");
      }
    } catch (err) {
      console.error("Error adding depot:", err);
    } finally {
      setIsCleaning(false);
    }
  };

  const deleteDepot = (id: string) => {
    if (depots.length <= 1) {
      alert("Debe haber al menos un origen configurado.");
      return;
    }
    setDepots(prev => prev.filter(d => d.id !== id));
  };

  const updateDepot = async (id: string, updates: Partial<Depot>) => {
    setDepots(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));

    if (updates.address) {
      // Intentar geocodificar si la dirección es nueva
      try {
        const geo = await googleMapsService.geocode(updates.address);
        if (geo) {
          setDepots(prev => prev.map(d => d.id === id ? {
            ...d,
            lat: geo.lat,
            lng: geo.lng,
            address: geo.formatted_address || updates.address!
          } : d));
        }
      } catch (e) {
        console.error("Error geocoding updated depot address", e);
      }
    }
  };

  const startCleaning = async () => {
    setIsCleaning(true);
    setError(null);
    try {
      console.log("Iniciando Limpieza y Geocodificación para", sites.length, "sitios");
      const updatedSites = [...sites];
      let processedCount = 0;

      for (let i = 0; i < updatedSites.length; i++) {
        const site = updatedSites[i];
        if (site.lat && site.lng && site.status === AddressStatus.OK) continue;

        const cleanAddress = LogicEngine.deriveFullAddress(site);
        const result = await googleMapsService.geocode(cleanAddress);

        if (result) {
          processedCount++;
          // Validar Coherencia Geográfica (Reverse Geocoding)
          const geoValidation = await googleMapsService.reverseGeocode(result.lat, result.lng);

          let status = result.partial_match ? AddressStatus.WARNING : AddressStatus.OK;
          let notes = result.partial_match ? 'Coincidencia parcial (WARNING)' : 'Validado Google Maps';

          if (geoValidation) {
            const stateMatch = site.state && geoValidation.state &&
              (geoValidation.state.toUpperCase().includes(site.state.toUpperCase()) ||
                site.state.toUpperCase().includes(geoValidation.state.toUpperCase()));

            if (!stateMatch) {
              status = AddressStatus.ERROR;
              notes = `DISCREPANCIA GEOGRÁFICA: El archivo dice ${site.state}, pero las coordenadas ubican en ${geoValidation.state}.`;
            }
          }

          updatedSites[i] = {
            ...updatedSites[i],
            lat: result.lat,
            lng: result.lng,
            place_id: result.place_id,
            formatted_address: result.formatted_address,
            confidence_score: result.partial_match ? 0.6 : 1.0,
            status,
            notes
          };
        } else {
          updatedSites[i].status = AddressStatus.ERROR;
          updatedSites[i].notes = 'No se pudo geocodificar (ERROR)';
        }
      }

      console.log("Limpieza terminada. Sitios procesados:", processedCount);
      setSites(updatedSites);
      setActiveStep(3);
    } catch (err: any) {
      console.error("Geocoding failed:", err);
      setError("Error en la geocodificación: " + (err.message || "Error desconocido"));
    } finally {
      setIsCleaning(false);
    }
  };

  const reoptimizeRouteWithGoogle = async (routeId: string) => {
    setIsGenerating(true);
    try {
      const idx = optimizedRoutes.findIndex(r => r.id === routeId);
      if (idx === -1) return;

      const route = optimizedRoutes[idx];
      const depot = depots.find(d => d.id === route.depotId) || depots[0];
      const origin = { lat: depot.lat, lng: depot.lng };

      // 1. Optimizar Orden
      const optimizedStops = await googleMapsService.optimizeWaypointOrder(origin, route.stops);

      // 2. Obtener Kilimtraje Real
      const metrics = await googleMapsService.getRouteDistance(origin, optimizedStops, config.dailyReturnToDepot);

      setOptimizedRoutes(prev => {
        const updated = [...prev];
        updated[idx] = {
          ...route,
          stops: optimizedStops,
          totalKm: metrics ? Math.round(metrics.distance) : route.totalKm,
          estTimeMinutes: metrics ? Math.round(metrics.duration) : route.estTimeMinutes
        };
        return updated;
      });
    } catch (err) {
      console.error("Error reoptimizing route:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    const element = document.getElementById('executive-report-export');
    if (!element) {
      console.error("Report element not found");
      setIsExporting(false);
      return;
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: isLightMode ? '#f8fafc' : '#030712'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Reporte_OptiFlot_iamanos_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("Error exporting PDF:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleApproveBudget = () => {
    // 1. Confirmación de seguridad
    if (!window.confirm("¿Estás seguro de APROBAR este presupuesto? \n\nEsta acción:\n1. Finalizará la fase de planeación.\n2. Guardará una versión definitiva del proyecto.\n3. Habilitará el acceso permanente en modo 'Solo Lectura'.")) {
      return;
    }

    // 2. Actualizar estado del proyecto a APPROVED
    const updatedProjects = projects.map(p =>
      p.id === activeProjectId
        ? { ...p, status: 'APPROVED' as const, updatedAt: new Date().toISOString() }
        : p
    );

    setProjects(updatedProjects);
    localStorage.setItem('iamanos_projects_metadata', JSON.stringify(updatedProjects));

    // 3. Forzar guardado del Blob completo con el nuevo status
    // Importante: saveProject usa el estado 'projects' actual, pero como acabamos de hacer setProjects(updatedProjects),
    // React podría no haber actualizado 'projects' aun en este closure.
    // Hack seguro: Pasamos un flag o, mejor, actualizamos el saveProject para que lea de updatedProjects si pudiéramos.
    // Alternativa robusta: Construir el objeto Project manualmente aquí y guardarlo.

    if (activeProjectId) {
      const approvedMetadata = updatedProjects.find(p => p.id === activeProjectId)!;
      const projectData: Project = {
        metadata: approvedMetadata,
        sites,
        config,
        optimizedRoutes,
        evidences
      };

      // Guardar comprimido
      const stringData = JSON.stringify(projectData);
      const compressedData = LZString.compressToUTF16(stringData);
      try {
        localStorage.setItem(`iamanos_project_${activeProjectId}`, compressedData);
      } catch (e) {
        // Fallback
        localStorage.setItem(`iamanos_project_${activeProjectId}`, stringData);
      }
    }

    // 4. Feedback visual y cierre
    alert(`✅ PROYECTO AUTORIZADO\n\nEl presupuesto ha sido aprobado exitosamente. El proyecto "${projectName}" ha sido archivado como DEFINITIVO y puede consultarse desde el Tablero Principal.`);
    setShowQuotation(false);

    // Redirigir a Dashboard
    setActiveStep(4);
    setActiveTab('COMMAND_CENTER');
  };



  const handleExportQuotationPDF = async (pageSelector: string = '.pdf-page', filenamePrefix: string = 'Expediente_Tecnico') => {
    setIsExporting(true);

    // 1. Identificar todas las "páginas" del template
    const pages = document.querySelectorAll(pageSelector);
    if (pages.length === 0) {
      console.error(`No pages found for PDF export with selector: ${pageSelector}`);
      setIsExporting(false);
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210; // A4 width mm

      // 2. Iterar sobre cada página visualmente definida
      for (let i = 0; i < pages.length; i++) {
        const pageElement = pages[i] as HTMLElement;

        // Preparar elemento para captura
        const originalPosition = pageElement.style.position;
        const originalLeft = pageElement.style.left;

        // Lo hacemos visible pero fuera del viewport si es necesario, 
        // aunque el diseño actual ya lo tiene en fixed left -9999.
        // Solo aseguramos que html2canvas lo vea bien.
        pageElement.style.position = 'absolute';
        pageElement.style.left = '0';
        pageElement.style.top = '0';
        pageElement.style.zIndex = '9999';

        const canvas = await html2canvas(pageElement, {
          scale: 1.5, // Reducir escala para menor peso (antes 2)
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff', // Fondo sólido obligatorio para JPEG
          windowWidth: 1000
        });

        // Restaurar estado original del elemento DOM
        pageElement.style.position = originalPosition;
        pageElement.style.left = originalLeft;

        // USA JPEG CON COMPRESIÓN en lugar de PNG
        const imgData = canvas.toDataURL('image/jpeg', 0.75);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Agregar al PDF
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight); // Usar alias JPEG (optimizado)
      }

      pdf.save(`${filenamePrefix}_${projectName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Error exporting PDF:", err);
    } finally {
      setIsExporting(false);
    }
  };



  const generateSchedule = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      // 1. Validación Previa de Datos
      const validSites = sites.filter(s => s.lat && s.lng && s.lat !== 0 && s.lng !== 0);
      if (validSites.length === 0) {
        throw new Error("No hay tiendas geocodificadas válidas. Ve al Paso 3 para normalizar direcciones.");
      }

      console.log("🚀 Iniciando Misión AntiGravity: MOTOR DE CORREDORES GEOGRÁFICOS...");

      // Configurar hub default desde depots
      const defaultHub = {
        id: depots[0].id,
        name: depots[0].name,
        lat: depots[0].lat,
        lng: depots[0].lng,
        city: depots[0].name
      };

      // Generar rutas por corredores
      let corridorRoutes = await CorridorRouteEngine.generateCorridorRoutes(
        validSites, // Usar solo sitios válidos
        {
          startDate: config.startDate,
          stopsPerDay: config.stopsPerDayPerRoute,
          avgServiceMinutes: config.avgServiceMinutesPerStop,
          bufferMinutes: config.bufferMinutesPerDay,
          defaultHub
        }
      );

      // Retry Logic: Si falla, intentar con restricciones más relajadas
      if (corridorRoutes.length === 0) {
        console.warn("⚠️ Intento 1 fallido - Reintentando con buffer expandido...");
        corridorRoutes = await CorridorRouteEngine.generateCorridorRoutes(
          validSites,
          {
            startDate: config.startDate,
            stopsPerDay: config.stopsPerDayPerRoute,
            avgServiceMinutes: config.avgServiceMinutesPerStop,
            bufferMinutes: config.bufferMinutesPerDay * 2, // Relax buffer
            defaultHub
          }
        );
      }

      if (corridorRoutes.length === 0) {
        throw new Error("No se pudieron generar rutas viables. Verifica que las tiendas no esten muy dispersas o reduce las restricciones.");
      }

      // Convertir al formato legacy para compatibilidad con la UI existente
      const allRoutesData = CorridorRouteEngine.convertToLegacyFormat(corridorRoutes, depots[0].id);

      setOptimizedRoutes(allRoutesData);

      // Actualizar sitios con la información de ruteo
      const finalSites = sites.map(s => {
        const found = allRoutesData.flatMap(r => r.stops).find(st => st.id === s.id);
        if (found) return found;
        return s;
      });
      setSites(finalSites);
      saveProject(finalSites, allRoutesData, evidences, config);
      setActiveStep(4);

      console.log("\n✅ MISIÓN ANTIGRAVITY COMPLETADA");

    } catch (err: any) {
      console.error("❌ Error crítico en Misión AntiGravity:", err);
      // Mensaje de error amigable para el usuario
      setError(typeof err === 'string' ? err : (err.message || "Error desconocido al generar rutas"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadEvidence = (notes: string, file: File | null) => {
    if (!currentStoreForEvidence) return;

    // Simular subida (en realidad solo agregamos al estado local)
    const newEvidence: Evidence = {
      id: crypto.randomUUID(),
      store_job_id: currentStoreForEvidence.store_job_id,
      route_id: currentStoreForEvidence.routeId,
      file_type: evidenceType === 'PHOTO' ? 'photo' : 'pdf',
      category: evidenceType === 'PHOTO' ? 'EVIDENCIA_INSTALACION' : 'ACUSE_RECIBIDO',
      uploaded_by: 'ADMIN',
      uploaded_at: new Date().toISOString(),
      notes,
      file_url: 'blob:simulated_url',
      checksum: 'sim_checksum',
      status: 'UPLOADED'
    };

    const updatedEvidences = [...evidences, newEvidence];
    setEvidences(updatedEvidences);
    saveProject(sites, optimizedRoutes, updatedEvidences, config);
    setEvidenceModalOpen(false);
  };

  const calculateBuffer = (km: number) => {
    const baseBuffer = km * 0.15;
    return Math.round((config.bufferPercent / 100) * baseBuffer * 10) / 10;
  };

  const steps = [
    { title: 'Proyectos', desc: 'Panel de Control' },
    { title: 'Ingesta AI', desc: 'CSV / Excel' },
    { title: 'Normalización', desc: 'GIS & Limpieza' },
    { title: 'Configuración', desc: 'Reglas de Negocio' },
    { title: 'Ejecución', desc: 'OptiFlot™ Engine' }
  ];

  const handleCreateNewProject = () => {
    setActiveProjectId(null);
    setSites([]);
    setOptimizedRoutes([]);
    setEvidences([]);
    setProjectName('PROYECTO_NUEVO_' + new Date().toISOString().split('T')[0]);
    setActiveStep(1);
    setFileContent('');
  };

  return (
    <div className={`min-h-screen transition-all duration-700 ${isLightMode ? 'bg-slate-50 text-slate-900' : 'bg-[#030712] text-white'}`}>
      {/* Header Ejecutivo Moderno */}
      <div className={`${isLightMode ? 'bg-white/80 border-slate-200 shadow-lg' : 'bg-slate-900/40 border-white/5 shadow-2xl'} backdrop-blur-2xl border-b px-12 py-8 flex items-center justify-between sticky top-0 z-50`}>
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveStep(0)}
              className="px-8 py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl text-[10px] font-black uppercase tracking-[0.3em] transition-all hover:scale-105 active:scale-95 flex items-center gap-3 shadow-xl"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
              PROYECTOS
            </button>
            <div>
              <h1 className={`text-4xl font-black tracking-tighter italic flex items-center gap-8 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                <div className="flex flex-col items-start text-left">
                  <p className="text-[18px] font-black tracking-tighter italic text-white mb-0 leading-none group-hover:text-blue-500 transition-colors flex items-center gap-2">
                    {projectName && <span className="text-blue-500 text-[10px] not-italic mr-1">PROJECT:</span>}
                    {projectName ? projectName.toUpperCase() : 'TARGET'}
                    {!projectName && <span className="text-blue-500">®</span>}
                  </p>
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.4em] mt-1">
                    {projectName ? 'Misión Activa' : 'Control Center'}
                  </p>
                </div>
                <div className="h-12 w-px bg-white/10 mx-2"></div>
                <div className="ml-6">
                  <button
                    onClick={() => {
                      if (optimizedRoutes.length === 0) {
                        alert("⚠️ MISION CONTROL: Optimiza las rutas primero para generar la cotización.");
                        return;
                      }
                      setShowQuotation(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20 flex items-center gap-3 transition-all hover:scale-105 active:scale-95 border border-emerald-500/30 cursor-pointer"
                  >
                    <span className="text-base">💰</span>
                    Cotizar Iniciativa
                  </button>
                </div>
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <p className={`text-[9px] font-bold uppercase tracking-[0.4em] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>PROJECT:</p>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value.toUpperCase())}
                  className={`bg-transparent border-none p-0 text-[10px] font-black uppercase tracking-widest focus:ring-0 w-64 ${isLightMode ? 'text-blue-600' : 'text-blue-400'}`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stepper Progresivo */}
        <div className="hidden lg:flex items-center gap-12">
          {steps.map((s, i) => (
            <div key={i} className={`flex flex-col items-center gap-2 transition-all duration-500 ${activeStep >= i ? 'opacity-100' : 'opacity-20'}`}>
              <div
                onClick={() => activeStep > i && setActiveStep(i)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] border-2 transition-all cursor-pointer ${activeStep === i ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-110' : activeStep > i ? 'bg-emerald-500 border-emerald-400 text-white' : (isLightMode ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-slate-900 border-slate-800 text-slate-500')}`}
              >
                {activeStep > i ? '✓' : i}
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{s.title}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-6">
          {lastSaved && (
            <div className="text-right mr-4">
              <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Auto-Guardado</p>
              <p className="text-[10px] font-bold text-slate-500">{lastSaved}</p>
            </div>
          )}
          <button
            onClick={() => setIsLightMode(!isLightMode)}
            className={`p-4 rounded-2xl transition-all ${isLightMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}
          >
            {isLightMode ? '🌙' : '☀️'}
          </button>
        </div>
      </div>

      <div className={`max-w-[1600px] mx-auto p-12 space-y-12 transition-colors duration-700 ${isLightMode ? 'bg-white' : ''}`}>
        {error && (
          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-500 flex items-center justify-between">
            <div className="flex items-center gap-4 text-red-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <span className="font-bold">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-slate-500 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {activeStep === 0 && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-5xl font-black tracking-tighter italic uppercase ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Control de Proyectos</h2>
                <p className={`${isLightMode ? 'text-slate-500' : 'text-slate-400'} text-xl mt-2 font-medium`}>Gestión centralizada de ruteo y evidencias.</p>
              </div>
              <button
                onClick={handleCreateNewProject}
                className="bg-blue-600 hover:bg-blue-500 px-10 py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-blue-600/30 flex items-center gap-4 transition-all hover:scale-105"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Nuevo Proyecto
              </button>
            </div>

            {projects.length === 0 ? (
              <div className={`${isLightMode ? 'bg-white border-slate-200 shadow-xl' : 'bg-slate-900/40 border-white/5 shadow-2xl'} p-32 rounded-[4rem] border flex flex-col items-center justify-center text-center`}>
                <div className="w-32 h-32 bg-slate-800/50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-white/5">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-500 uppercase tracking-widest">No hay proyectos activos</h3>
                <p className="text-slate-600 mt-4 max-w-sm">Carga un universo de datos para comenzar tu primera misión de ruteo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {projects.map(p => (
                  <div
                    key={p.id}
                    onClick={() => loadProject(p.id)}
                    className={`${isLightMode ? 'bg-white border-slate-200 hover:border-blue-500 shadow-lg' : 'bg-slate-900/40 border-white/5 hover:border-blue-500/30 shadow-2xl'} p-10 rounded-[3.5rem] border transition-all cursor-pointer group hover:-translate-y-2`}
                  >
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${p.status === 'EXECUTING' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                          {p.status}
                        </div>
                        <button
                          onClick={(e) => deleteProject(p.id, e)}
                          className={`p-2 rounded-lg transition-all ${isLightMode ? 'hover:bg-red-50 text-slate-400 hover:text-red-500' : 'hover:bg-red-500/10 text-slate-500 hover:text-red-500'}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 italic">{new Date(p.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mb-4">
                      <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">PROYECTO:</p>
                      <h4 className={`text-xl font-black uppercase italic tracking-tighter group-hover:text-blue-500 transition-colors break-words line-clamp-2 leading-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                        {p.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-6 mt-8">
                      <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Tiendas</p>
                        <p className={`text-lg font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{p.totalSites}</p>
                      </div>
                      <div className="w-px h-8 bg-white/5"></div>
                      <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Cuadrillas</p>
                        <p className={`text-lg font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{p.totalRoutes}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PASO 1: INGESTA */}
        {activeStep === 1 && (
          <div className={`${isLightMode ? 'bg-white border-slate-200 shadow-xl' : 'bg-slate-900/40 border-white/5 shadow-2xl backdrop-blur-3xl'} p-20 rounded-[4rem] border shadow-2xl flex flex-col items-center justify-center text-center py-20 animate-in zoom-in duration-500`}>

            {/* Project Name Input Section */}
            <div className="mb-16 w-full max-w-2xl">
              <div className="flex items-center gap-4 justify-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <span className="text-2xl">📁</span>
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.4em]">Paso 1 de 4</p>
                  <h3 className={`text-2xl font-black uppercase italic tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                    Crear Nuevo Proyecto
                  </h3>
                </div>
              </div>

              <div className={`${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-white/10'} rounded-3xl border p-8`}>
                <label className="block text-left mb-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre del Proyecto</span>
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ej: DESPLIEGUE_TARGET_FEBRERO_2026"
                  className={`w-full px-6 py-4 rounded-2xl text-lg font-bold ${isLightMode
                    ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                    : 'bg-slate-900/60 border-white/10 text-white placeholder:text-slate-600'
                    } border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none`}
                />
                <p className="text-[10px] text-slate-500 mt-3 text-left">
                  💡 Usa un nombre descriptivo para identificar fácilmente este proyecto
                </p>
              </div>
            </div>

            {/* File Upload Section */}
            <label
              htmlFor="master-upload"
              className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center mb-8 border-2 shadow-3xl group cursor-pointer transition-all ${projectName.trim()
                ? (isLightMode ? 'bg-blue-50 border-blue-100 hover:border-blue-500' : 'bg-blue-600/10 border-blue-600/20 hover:border-blue-500/50')
                : 'opacity-50 cursor-not-allowed bg-slate-800/20 border-slate-700'
                }`}
            >
              <svg className={`transition-transform ${projectName.trim() ? 'group-hover:scale-110' : ''}`} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={projectName.trim() ? "#2298E0" : "#666"} strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            </label>
            <h2 className={`text-4xl font-black tracking-tighter mb-4 italic uppercase ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Cargar Universo de Datos</h2>
            <p className={`${isLightMode ? 'text-slate-500' : 'text-slate-400'} text-lg max-w-xl mx-auto leading-relaxed font-medium`}>
              Sube tu archivo <strong>CSV o Excel (.xlsx, .xls)</strong> y el sistema realizará una <strong>limpieza GIS predictiva</strong> automáticamente.
            </p>
            <input
              type="file"
              id="master-upload"
              className="hidden"
              onChange={handleFileUpload}
              accept=".csv, .xlsx, .xls"
              disabled={!projectName.trim()}
            />
            <label
              htmlFor="master-upload"
              className={`mt-10 px-12 py-6 rounded-[2rem] font-black uppercase tracking-[0.3em] text-sm shadow-[0_32px_64px_-16px_rgba(37,99,235,0.4)] transition-all inline-flex items-center gap-4 ${projectName.trim()
                ? 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-105 active:scale-95 cursor-pointer'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              {projectName.trim() ? 'Seleccionar Archivo CSV' : 'Ingresa nombre del proyecto'}
            </label>

            {!projectName.trim() && (
              <p className="mt-6 text-amber-500 text-sm font-bold animate-pulse">
                ⚠️ Por favor, ingresa un nombre para el proyecto antes de continuar
              </p>
            )}

            <button
              onClick={() => setActiveStep(0)}
              className="mt-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] hover:text-white transition-colors"
            >
              ← Volver al Tablero de Proyectos
            </button>

            <div className="mt-16 w-full text-left">
              <SystemReadiness isLightMode={isLightMode} depotsCount={depots.length} />
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-700">
            <div className={`${isLightMode ? 'bg-white border-slate-200 shadow-xl' : 'bg-slate-800/20 border-white/5 shadow-2xl'} backdrop-blur-3xl p-12 rounded-[4rem] border flex flex-col md:flex-row md:items-center justify-between gap-12`}>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] italic animate-pulse">PROJECT: {projectName}</p>
                </div>
                <h3 className={`text-4xl font-black tracking-tight flex items-center gap-6 italic uppercase ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  Limpieza Masiva
                  <span className="bg-blue-500/10 text-blue-400 text-xs px-5 py-2 rounded-full border border-blue-500/20 not-italic tracking-widest">{sites.length} Tiendas</span>
                </h3>
                <p className={`${isLightMode ? 'text-slate-500' : 'text-slate-400'} mt-3 text-lg font-medium`}>Normalización de direcciones y geocodificación automática.</p>
              </div>
              <div className="flex flex-wrap gap-8 items-end">
                <button
                  onClick={startCleaning}
                  disabled={isCleaning}
                  className="group relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 disabled:opacity-50 rounded-2xl p-0.5 transition-all duration-300 hover:scale-[1.02] shadow-[0_20px_50px_-12px_rgba(16,185,129,0.5)]"
                >
                  <div className="relative bg-[#0f172a] hover:bg-[#0f172a]/90 h-full w-full rounded-[14px] px-8 py-4 flex items-center gap-6 transition-all">
                    {/* Icon Box */}
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-white text-emerald-400 transition-all duration-300">
                      {isCleaning ? (
                        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7l-8-5-8 5v5l8 5 8-5z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                      )}
                    </div>

                    <div className="text-left">
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">Proceso Automatizado</p>
                      <p className="text-lg font-black text-white italic tracking-tight">{isCleaning ? 'PROCESANDO DATA...' : 'INICIAR LIMPIEZA & GIS'}</p>
                    </div>

                    {/* Tech Decor */}
                    <div className="absolute top-0 right-0 p-2 opacity-30">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className={`${isLightMode ? 'bg-white border-slate-200 shadow-xl' : 'bg-slate-900/60 border-white/5 shadow-[0_64px_128px_-32px_rgba(0,0,0,0.6)]'} rounded-[4rem] overflow-hidden border backdrop-blur-md`}>
              <div className={`p-10 ${isLightMode ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-white/[0.02] text-slate-500 border-white/5'} text-[10px] font-black uppercase tracking-[0.3em] grid grid-cols-12 gap-8 border-b font-mono`}>
                <span className="col-span-1">#</span>
                <span className="col-span-2">{fileHeaders.find(h => ['NOMBRE', 'TIENDA', 'SITIO', 'NAME'].some(a => h.toUpperCase().includes(a))) || 'Tienda / Sitio'}</span>
                <span className="col-span-1">{fileHeaders.find(h => h.toUpperCase().includes('ID')) || 'ID Sitio'}</span>
                <span className="col-span-1">{fileHeaders.find(h => h.toUpperCase().includes('REGION')) || 'Región'}</span>
                <span className="col-span-5">{fileHeaders.find(h => h.toUpperCase().includes('DIRECC')) || 'Dirección Ejecutiva'}</span>
                <span className="col-span-2 text-right">Estatus Calidad</span>
              </div>
              <div className={`divide-y ${isLightMode ? 'divide-slate-100' : 'divide-slate-800/50'} max-h-[500px] overflow-y-auto custom-scrollbar`}>
                {sites.map((site, i) => (
                  <div key={i} className={`p-8 grid grid-cols-12 gap-6 text-sm items-center transition-all group ${isLightMode ? 'hover:bg-slate-50 border-b border-slate-50' : 'hover:bg-slate-800/40 border-b border-white/[0.02]'}`}>
                    <div className="col-span-1 font-mono font-black text-blue-500">
                      {i + 1}
                    </div>
                    <div className="col-span-2">
                      <p className={`font-black uppercase italic ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{site.name_sitio}</p>
                    </div>
                    <div className="col-span-1">
                      <span className={`px-4 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-tighter ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-slate-500'}`}>{site.site_id || '99'}</span>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{site.region || 'CENTRO'}</p>
                    </div>
                    <div className="col-span-5">
                      <p className={`text-[11px] font-bold truncate ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>{site.direccion_completa || '---'}</p>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Col. {site.colonia || 'S/C'} • CP: {site.cp || '00000'}</p>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <div
                        title={site.notes}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest cursor-help ${site.status === AddressStatus.OK
                          ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                          : site.status === AddressStatus.ERROR
                            ? 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                            : 'text-amber-500 bg-amber-400/10 border-amber-400/20'
                          }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${site.status === AddressStatus.OK ? 'bg-emerald-500' : 'bg-current animate-pulse'}`}></span>
                        {site.status === AddressStatus.ERROR ? 'ERROR CRÍTICO' : site.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-6">
              <button
                onClick={() => setActiveStep(3)}
                className="bg-blue-600 hover:bg-blue-500 px-14 py-6 rounded-[2rem] font-black flex items-center gap-4 transition-all hover:scale-105 shadow-2xl shadow-blue-600/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Configurar Cronograma
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            {/* Project Name Header */}
            <div className="flex items-center justify-between px-2">
              <div>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-2 italic animate-pulse">PROJECT: {projectName}</p>
                <h2 className={`text-3xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{projectName || 'Sin Nombre'}</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Fase de Optimización</span>
              </div>
            </div>

            {/* ALERT: PROJECT CAPACITY */}
            <div className={`p-8 rounded-[3rem] border-4 transition-all flex flex-col md:flex-row items-center gap-8 ${projectCapacity.status === CapacityStatus.SUFFICIENT ? (isLightMode ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-500/10 border-emerald-500/20') : 'bg-red-500/10 border-red-500/30'}`}>
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl ${projectCapacity.status === CapacityStatus.SUFFICIENT ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                {projectCapacity.status === CapacityStatus.SUFFICIENT ? '✅' : '⚠️'}
              </div>
              <div className="flex-1 space-y-2">
                <h3 className={`text-2xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  Capacidad {projectCapacity.status === CapacityStatus.SUFFICIENT ? 'OK' : 'INSUFICIENTE'}
                </h3>
                <p className={`text-sm font-medium ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                  {projectCapacity.status === CapacityStatus.SUFFICIENT
                    ? `Configuración sólida: ${projectCapacity.totalRoutes} cuadrillas pueden cubrir hasta ${projectCapacity.totalCapacity} tiendas en ${projectCapacity.workingDaysCount} días.`
                    : `Atención: Solo tienes capacidad para ${projectCapacity.totalCapacity} de ${projectCapacity.totalStores} tiendas. Se requieren al menos ${projectCapacity.extraRoutesNeeded} cuadrilla(s) adicional(es).`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* CONFIGURACIÓN BÁSICA (Paso B) */}
              <div className={`${isLightMode ? 'bg-white border-slate-200 shadow-xl' : 'bg-slate-900/60 border-slate-800 shadow-3xl'} p-10 rounded-[4rem] border space-y-8`}>
                <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-4">Reglas de Negocio (Paso B)</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-black tracking-widest uppercase italic">Fecha Inicio</label>
                    <input type="date" value={config.startDate} onChange={(e) => setConfig({ ...config, startDate: e.target.value })} className={`w-full ${isLightMode ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-900/50 border-white/10 text-white'} border rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500`} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-black tracking-widest uppercase italic">Fecha Fin</label>
                    <input type="date" value={config.endDate} onChange={(e) => setConfig({ ...config, endDate: e.target.value })} className={`w-full ${isLightMode ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-900/50 border-white/10 text-white'} border rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500`} />
                  </div>
                </div>

                {/* Explicación de Fechas AntiGravity */}
                <div className={`${isLightMode ? 'bg-blue-50/50 border-blue-100' : 'bg-blue-500/5 border-blue-500/10'} p-8 rounded-3xl border-2 border-dashed space-y-4`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">Resumen del Despliegue</p>
                    <span className="text-[10px] font-black italic text-slate-500 underline decoration-blue-500/30">Protocolo OptiFlot™</span>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>Inicia el:</p>
                      <p className={`text-xl font-black italic uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                        {(() => {
                          const parts = config.startDate?.split('-') || [];
                          if (parts.length < 3) return 'Fecha Inválida';
                          const [y, m, d] = parts.map(Number);
                          return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
                        })()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>Finaliza el:</p>
                      <p className={`text-xl font-black italic uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                        {(() => {
                          const parts = config.endDate?.split('-') || [];
                          if (parts.length < 3) return 'Fecha Inválida';
                          const [y, m, d] = parts.map(Number);
                          return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-blue-500/10 flex items-center justify-center gap-4">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest italic">
                      Campaña de {projectCapacity.workingDaysCount} días efectivos de operación
                    </p>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-slate-500 font-black tracking-widest uppercase italic">Modo de Rutas</label>
                    <div className="flex bg-black/20 p-1 rounded-xl">
                      <button
                        onClick={() => setConfig({ ...config, routesMode: RoutesMode.AUTO })}
                        className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${config.routesMode === RoutesMode.AUTO ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
                      >AUTO</button>
                      <button
                        onClick={() => setConfig({ ...config, routesMode: RoutesMode.MANUAL })}
                        className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${config.routesMode === RoutesMode.MANUAL ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
                      >MANUAL</button>
                    </div>
                  </div>

                  {config.routesMode === RoutesMode.MANUAL && (
                    <div className="flex items-center justify-between animate-in slide-in-from-right-4">
                      <label className="text-[10px] text-slate-500 font-black tracking-widest uppercase italic">Total Cuadrillas (N)</label>
                      <input
                        type="number" min="1" max="50"
                        value={config.routesTotalManual}
                        onChange={(e) => setConfig({ ...config, routesTotalManual: parseInt(e.target.value) })}
                        className={`w-24 ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'} border rounded-xl px-4 py-2 text-center font-bold`}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-slate-500 font-black tracking-widest uppercase italic">Tiendas por Día/Ruta</label>
                    <input
                      type="number" min="1" max="15"
                      value={config.stopsPerDayPerRoute}
                      onChange={(e) => setConfig({ ...config, stopsPerDayPerRoute: parseInt(e.target.value) })}
                      className={`w-24 ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'} border rounded-xl px-4 py-2 text-center font-bold`}
                    />
                  </div>
                </div>
              </div>

              {/* PARÁMETROS DE TIEMPO (Paso B) */}
              <div className={`${isLightMode ? 'bg-white border-slate-200 shadow-xl' : 'bg-slate-900/60 border-slate-800 shadow-3xl'} p-10 rounded-[4rem] border space-y-8`}>
                <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-4">Auditoría de Tiempo (Paso B)</h3>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className={`text-sm font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>TIEMPO DE SERVICIO (AVG)</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Minutos por cada parada</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="number" step="5" min="15" max="180"
                        value={config.avgServiceMinutesPerStop}
                        onChange={(e) => setConfig({ ...config, avgServiceMinutesPerStop: parseInt(e.target.value) })}
                        className={`w-24 ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'} border rounded-xl px-4 py-3 text-center font-black text-xl text-emerald-500`}
                      />
                      <span className="text-[10px] font-black text-slate-500 italic">MINS</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className={`text-sm font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>BUFFER DE CONTINGENCIA</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Minutos extra por día</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="number" step="5" min="0" max="120"
                        value={config.bufferMinutesPerDay || 30}
                        onChange={(e) => setConfig({ ...config, bufferMinutesPerDay: parseInt(e.target.value) })}
                        className={`w-24 ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'} border rounded-xl px-4 py-3 text-center font-black text-xl text-emerald-500`}
                      />
                      <span className="text-[10px] font-black text-slate-500 italic">MINS</span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase italic tracking-widest text-slate-500">
                      <span>Ventana Operativa (8:00 - 20:00)</span>
                      <span className="text-blue-500">Fixed Hard Rule</span>
                    </div>
                    <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex border border-white/5">
                      <div className="w-[15%] bg-slate-700"></div>
                      <div className="w-[50%] bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]"></div>
                      <div className="w-[35%] bg-slate-700"></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl animate-pulse">
                    <span className="text-xl">💡</span>
                    <p className="text-[10px] font-bold text-amber-500 uppercase leading-relaxed tracking-wider">
                      Nota: Si el tiempo total supera las 12h, el sistema marcará <span className="underline italic">OVERTIME</span> sin bloquear la ruta.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-8 pt-6">
              <button
                onClick={generateSchedule}
                disabled={isGenerating || (projectCapacity.status === CapacityStatus.INSUFFICIENT && config.routesMode === RoutesMode.AUTO)}
                className="w-full max-w-3xl bg-blue-600 hover:bg-blue-500 py-10 rounded-[3rem] font-black text-3xl italic tracking-tighter flex items-center justify-center gap-6 transition-all hover:scale-[1.02] shadow-[0_48px_96px_-12px_rgba(37,99,235,0.4)] disabled:opacity-30 group"
              >
                {isGenerating ? (
                  <>
                    <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    EJECUTANDO MISIÓN...
                  </>
                ) : (
                  <>
                    CREAR CRONOGRAMA MAESTRO
                    <svg className="group-hover:translate-x-3 transition-transform" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </>
                )}
              </button>

              <button
                onClick={() => setActiveStep(2)}
                className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] hover:text-white transition-colors"
              >
                ← Regresar a Auditoría GIS
              </button>
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-10 animate-in zoom-in-95 duration-700">
            {/* Project Name Header */}
            <div className="flex items-center justify-between px-2">
              <div>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-2 italic animate-pulse">PROJECT: {projectName}</p>
                <h2 className={`text-3xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{projectName || 'Sin Nombre'}</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Optimización Completa</span>
              </div>
            </div>

            {/* KPI Dashboard Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Rutas Totales', val: optimizedRoutes.length, icon: '🚚', color: 'text-blue-500' },
                { label: 'KM Estimados', val: `${optimizedRoutes.reduce((acc, r) => acc + (r.totalKm || 0), 0).toFixed(0)}`, icon: '📍', color: 'text-emerald-500' },
                { label: 'Cantidad de Tiendas', val: `${optimizedRoutes.reduce((acc, r) => acc + (r.stops?.length || 0), 0)}`, icon: '🏪', color: 'text-purple-500' },
                {
                  label: 'Días Trabajados',
                  val: (() => {
                    const totalDays = optimizedRoutes.reduce((acc, route) => {
                      const dates = (route.stops || [])
                        .map((s: any) => s.scheduled_date ? new Date(s.scheduled_date) : null)
                        .filter((d): d is Date => d !== null);

                      if (dates.length === 0) return acc + (route.stops?.length > 0 ? 1 : 0);

                      const times = dates.map(d => d.getTime());
                      const min = Math.min(...times);
                      const max = Math.max(...times);

                      // Difference in days + 1 (inclusive)
                      const diffDays = Math.floor((max - min) / (1000 * 60 * 60 * 24)) + 1;

                      return acc + diffDays;
                    }, 0);
                    return totalDays;
                  })(),
                  icon: '📅',
                  color: 'text-orange-500'
                }
              ].map((kpi, i) => (
                <div key={i} className={`${isLightMode ? 'bg-white border-slate-200 shadow-lg' : 'bg-slate-900/60 border-slate-800 shadow-xl backdrop-blur-xl'} border p-6 rounded-[2.5rem] transition-all`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>{kpi.label}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-2xl font-black ${kpi.color}`}>{kpi.val}</span>
                    <span className="text-2xl grayscale group-hover:grayscale-0 transition-all opacity-80">{kpi.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className={`${isLightMode ? 'bg-white border-slate-200 shadow-xl' : 'bg-slate-900/40 border-slate-800 shadow-2xl'} lg:col-span-2 p-10 rounded-[4rem] border transition-all`}>
                <div className="flex items-center justify-between mb-8">
                  <h4 className={`text-[10px] font-black uppercase tracking-[0.3em] ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>Carga de Trabajo por Día</h4>
                  <span className="text-xs font-bold text-blue-400">Distribución de Paradas</span>
                </div>
                <div className="h-64 w-full">
                  {workloadData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={workloadData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isLightMode ? '#e2e8f0' : '#ffffff10'} vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke={isLightMode ? '#64748b' : '#94a3b8'}
                          fontSize={9}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => {
                            const d = new Date(val + 'T00:00:00');
                            return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
                          }}
                        />
                        <YAxis stroke={isLightMode ? '#64748b' : '#94a3b8'} fontSize={9} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isLightMode ? '#fff' : '#0f172a',
                            borderColor: isLightMode ? '#e2e8f0' : '#ffffff10',
                            borderRadius: '1.5rem',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                          }}
                          itemStyle={{ padding: '2px 0' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '20px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                        {depots.map((d, i) => (
                          <Line
                            key={d.id}
                            type="monotone"
                            dataKey={d.name}
                            stroke={d.color}
                            strokeWidth={5}
                            dot={{ r: 6, strokeWidth: 3, fill: d.color, stroke: '#fff' }}
                            activeDot={{ r: 9, strokeWidth: 0 }}
                            animationDuration={2000}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-30">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
                      <p className="text-[10px] font-black uppercase mt-4 tracking-widest">Sin datos de cronograma</p>
                    </div>
                  )}
                </div>

                {/* Timeline de Rutas Mejorado - FECHAS (Solicitud Usuario V5) */}
                <div className="mt-10 pt-10 border-t border-white/5">
                  {/* Header con BASE_CDMX */}
                  <div className="flex justify-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-blue-500 text-xs font-black uppercase tracking-[0.3em]">BASE_CDMX</span>
                    </div>
                  </div>

                  {/* Calcular fechas dinámicamente */}
                  {(() => {
                    // Obtener todas las fechas del proyecto
                    const allDates = optimizedRoutes.flatMap(r =>
                      r.scheduledDays?.map((d: any) => d.date) ||
                      r.stops.filter((s: any) => s.scheduled_date).map((s: any) => s.scheduled_date) || []
                    ).filter(Boolean);

                    // Si no hay fechas, usar las del config
                    let projectDates: string[] = [];
                    if (allDates.length > 0) {
                      const sorted = [...new Set(allDates)].sort() as string[];
                      projectDates = sorted;
                    } else {
                      // Generar fechas desde config
                      const start = new Date(config.startDate + 'T00:00:00');
                      const end = new Date(config.endDate + 'T00:00:00');
                      const dates: string[] = [];
                      const current = new Date(start);
                      while (current <= end) {
                        if (config.workDays.includes(current.getDay())) {
                          dates.push(current.toISOString().split('T')[0]);
                        }
                        current.setDate(current.getDate() + 1);
                      }
                      projectDates = dates;
                    }

                    const startDate = projectDates.length > 0 ? new Date(projectDates[0] + 'T00:00:00') : new Date();
                    const endDate = projectDates.length > 0 ? new Date(projectDates[projectDates.length - 1] + 'T00:00:00') : new Date();
                    const totalDays = projectDates.length;

                    // Limitar a 15 fechas visibles para no saturar
                    const visibleDates = projectDates.slice(0, Math.min(15, projectDates.length));

                    const formatDate = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
                    const formatDateShort = (dateStr: string) => {
                      const d = new Date(dateStr + 'T00:00:00');
                      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
                    };

                    // Colores vibrantes por ruta
                    const routeColors = [
                      'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                      'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                      'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                      'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                      'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                      'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                    ];

                    return (
                      <>
                        {/* Título con Fechas Dinámicas */}
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h5 className="text-base font-black uppercase tracking-tight text-white italic">Timeline de Ejecución Diaria</h5>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                              Estimación de slots operativos {formatDate(startDate)} - {formatDate(endDate)} ({totalDays} días)
                            </p>
                          </div>
                          <div className="flex gap-6">
                            <span className="flex items-center gap-2 text-[8px] font-black text-slate-500 uppercase">
                              <div className="w-8 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
                              TRÁNSITO/SERVICIO
                            </span>
                            <span className="flex items-center gap-2 text-[8px] font-black text-slate-500 uppercase">
                              <div className="w-3 h-3 rounded-full bg-white/20 border border-white/30"></div>
                              DISPONIBLE
                            </span>
                          </div>
                        </div>

                        {/* Eje de FECHAS y rutas */}
                        <div className="overflow-x-auto custom-scrollbar">
                          <div className="min-w-[800px]">
                            {/* Date Headers */}
                            <div className="flex ml-20 border-b border-white/10 pb-3 mb-4">
                              {visibleDates.map((dateStr, idx) => {
                                const d = new Date(dateStr + 'T00:00:00');
                                const dayName = d.toLocaleDateString('es-MX', { weekday: 'short' });
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return (
                                  <div
                                    key={dateStr}
                                    className="flex-1 text-center px-1"
                                    style={{ minWidth: '50px' }}
                                  >
                                    <p className={`text-[8px] font-black uppercase tracking-wider ${isWeekend ? 'text-orange-500' : 'text-slate-600'}`}>
                                      {dayName}
                                    </p>
                                    <p className={`text-[9px] font-black ${isWeekend ? 'text-orange-400' : 'text-slate-400'}`}>
                                      {formatDateShort(dateStr)}
                                    </p>
                                  </div>
                                );
                              })}
                              {projectDates.length > 15 && (
                                <div className="flex-1 text-center px-1" style={{ minWidth: '50px' }}>
                                  <p className="text-[8px] font-black text-slate-600">...</p>
                                  <p className="text-[9px] font-black text-slate-500">+{projectDates.length - 15}</p>
                                </div>
                              )}
                            </div>

                            {/* Route Bars Container with Scroll */}
                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                              {optimizedRoutes.map((route, rIdx) => {
                                const totalStops = route.stops.length;
                                const routeDays = route.scheduledDays?.length || Math.ceil(totalStops / config.stopsPerDayPerRoute);

                                // Calcular posición de inicio y duración en base a fechas
                                const routeStartDate = route.startDate || route.scheduledDays?.[0]?.date || config.startDate;
                                const routeStartIdx = projectDates.indexOf(routeStartDate);
                                const leftPerc = Math.max(0, (routeStartIdx / Math.min(15, projectDates.length)) * 100);
                                const widthPerc = Math.min(100 - leftPerc, (routeDays / Math.min(15, projectDates.length)) * 100);

                                return (
                                  <div key={route.id} className="flex items-center gap-3 group">
                                    <div className="w-16 flex items-center gap-2 shrink-0">
                                      <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: route.color }}></div>
                                      <span className="text-[10px] font-black text-white uppercase tracking-tight">R-{String(route.id).padStart(2, '0')}</span>
                                    </div>
                                    <div className="flex-1 h-9 bg-black/20 rounded-full relative overflow-hidden border border-white/5 group-hover:bg-black/30 transition-all">
                                      <div
                                        className="absolute h-full rounded-full shadow-lg transition-all flex items-center justify-center"
                                        style={{
                                          left: `${leftPerc}%`,
                                          width: `${Math.max(15, widthPerc)}%`,
                                          background: routeColors[rIdx % routeColors.length],
                                          minWidth: '80px'
                                        }}
                                      >
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-black/10 rounded-full"></div>
                                        <span className="relative text-[9px] font-black text-white uppercase tracking-tight flex items-center gap-1 whitespace-nowrap px-2">
                                          {totalStops} TIENDAS <span className="text-white/50">|</span> {Math.round(route.totalKm)}KM
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Footer Stats */}
                            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                {optimizedRoutes.length} RUTAS • {new Set(optimizedRoutes.flatMap(r => r.stops.map(s => s.id))).size} TIENDAS ÚNICAS • {Math.round(optimizedRoutes.reduce((acc, r) => acc + (r.totalKm || 0), 0)).toLocaleString()} KM
                              </p>
                              <button
                                onClick={() => setShowRouteEditor(true)}
                                className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 transition-colors flex items-center gap-2"
                              >
                                ✏️ Editar Rutas
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className={`${isLightMode ? 'bg-white border-slate-200 shadow-xl' : 'bg-slate-900/40 border-slate-800 shadow-2xl'} p-10 rounded-[4rem] border flex flex-col justify-center transition-all`}>
                <h4 className={`text-[10px] font-black uppercase tracking-[0.3em] mb-10 text-center ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>Eficiencia por Base</h4>
                <div className="relative w-48 h-48 mx-auto">
                  <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    <circle cx="18" cy="18" r="15.9155" className={`${isLightMode ? 'stroke-slate-100' : 'stroke-slate-800'}`} strokeWidth="3" fill="none" />
                    <circle cx="18" cy="18" r="15.9155" className="stroke-blue-500" strokeWidth="3" strokeDasharray="65, 100" strokeLinecap="round" fill="none" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>65%</span>
                    <span className="text-[8px] font-black text-slate-500 uppercase">CDMX</span>
                  </div>
                </div>
                <div className="mt-10 flex flex-wrap justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/20"></div>
                    <span className={`text-[10px] font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>CDMX</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20"></div>
                    <span className={`text-[10px] font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>MTY</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-lg shadow-purple-500/20"></div>
                    <span className={`text-[10px] font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>GDL</span>
                  </div>
                </div>

                {/* Timeline de Rutas - Rendimiento Nacional (Idéntico al Command Center) */}
                <div className="mt-12 pt-12 border-t border-white/5">
                  {/* Header con BASE_CDMX */}
                  <div className="flex justify-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-blue-500 text-xs font-black uppercase tracking-[0.3em]">BASE_CDMX</span>
                    </div>
                  </div>

                  {/* Calcular fechas dinámicamente */}
                  {(() => {
                    // Obtener todas las fechas del proyecto
                    const allDates = optimizedRoutes.flatMap(r =>
                      r.scheduledDays?.map((d: any) => d.date) ||
                      r.stops.filter((s: any) => s.scheduled_date).map((s: any) => s.scheduled_date) || []
                    ).filter(Boolean);

                    // Si no hay fechas, usar las del config
                    let projectDates: string[] = [];
                    if (allDates.length > 0) {
                      const sorted = [...new Set(allDates)].sort() as string[];
                      projectDates = sorted;
                    } else {
                      // Generar fechas desde config
                      const start = new Date(config.startDate + 'T00:00:00');
                      const end = new Date(config.endDate + 'T00:00:00');
                      const dates: string[] = [];
                      const current = new Date(start);
                      while (current <= end) {
                        if (config.workDays.includes(current.getDay())) {
                          dates.push(current.toISOString().split('T')[0]);
                        }
                        current.setDate(current.getDate() + 1);
                      }
                      projectDates = dates;
                    }

                    const startDate = projectDates.length > 0 ? new Date(projectDates[0] + 'T00:00:00') : new Date();
                    const endDate = projectDates.length > 0 ? new Date(projectDates[projectDates.length - 1] + 'T00:00:00') : new Date();
                    const totalDays = projectDates.length;

                    // Limitar a 15 fechas visibles para no saturar
                    const visibleDates = projectDates.slice(0, Math.min(15, projectDates.length));

                    const formatDate = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
                    const formatDateShort = (dateStr: string) => {
                      const d = new Date(dateStr + 'T00:00:00');
                      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
                    };

                    // Colores vibrantes por ruta
                    const routeColors = [
                      'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                      'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                      'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                      'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                      'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                      'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                    ];

                    return (
                      <>
                        {/* Título con Fechas Dinámicas */}
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h5 className={`text-base font-black uppercase tracking-tight italic ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Timeline de Ejecución</h5>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                              Cronograma {formatDate(startDate)} - {formatDate(endDate)} ({totalDays} días hábiles)
                            </p>
                          </div>
                          <div className="flex gap-6">
                            <span className="flex items-center gap-2 text-[8px] font-black text-slate-500 uppercase">
                              <div className="w-8 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
                              OPERACIÓN
                            </span>
                          </div>
                        </div>

                        {/* Eje de RUTAS (X) y FECHAS (Y) - Matriz de Despliegue Vertical */}
                        {/* Eje de RUTAS (X) y FECHAS (Y) - Matriz de Despliegue Vertical (SCI-FI STICKY GRID) */}
                        <div className="relative rounded-[2.5rem] overflow-hidden border border-white/10 bg-[#0B1121] shadow-2xl ring-1 ring-white/5 group/container">

                          {/* Decorative Elements */}
                          <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 blur-[50px] pointer-events-none"></div>
                          <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] pointer-events-none"></div>

                          {/* SCROLL CONTAINER */}
                          <div className="overflow-auto custom-scrollbar max-h-[600px] relative">
                            <table className="w-full border-collapse text-left relative">

                              {/* --- HEADER ROW (Sticky Top) --- */}
                              <thead className="bg-[#0f172a] shadow-xl text-white sticky top-0 z-30">
                                <tr>
                                  {/* CORNER CELL (Sticky Left & Top) */}
                                  <th className="sticky left-0 top-0 z-40 bg-[#0f172a] p-4 min-w-[140px] border-b border-r border-white/10 shadow-[4px_4px_16px_rgba(0,0,0,0.5)]">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[8px] font-black text-blue-500 uppercase tracking-[0.2em]">AGRUPACIÓN</span>
                                      <div className="h-px w-full bg-gradient-to-r from-blue-500/50 to-transparent my-1"></div>
                                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">CRONOGRAMA</span>
                                    </div>
                                  </th>

                                  {/* ROUTE HEADERS */}
                                  {optimizedRoutes.map((route) => (
                                    <th key={route.id} className="p-3 border-b border-r border-white/5 min-w-[130px] relative group/col">
                                      <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white shadow-lg relative overflow-hidden" style={{ background: route.color }}>
                                          {/* Shine Effect */}
                                          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"></div>
                                          {String(route.id).replace(/\D/g, '')}
                                        </div>
                                        <div className="text-center">
                                          <div className="text-[9px] font-black text-white uppercase tracking-tight leading-tight">{route.driverName || 'Ruta'}</div>
                                          <div className="text-[8px] font-bold text-slate-500">{route.stops.length} Stops</div>
                                        </div>
                                      </div>
                                      {/* Col Highlight on Hover */}
                                      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500/0 group-hover/col:bg-blue-500/50 transition-all"></div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>

                              {/* --- BODY --- */}
                              <tbody className="divide-y divide-white/[0.02]">
                                {projectDates.map((dateStr, dIdx) => {
                                  const d = new Date(dateStr + 'T00:00:00');
                                  const dayName = d.toLocaleDateString('es-MX', { weekday: 'short' }).toUpperCase();
                                  const dayNumber = d.getDate();
                                  const monthName = d.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase();
                                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                                  return (
                                    <tr key={dateStr} className={`group/row hover:bg-white/[0.02] transition-colors ${isWeekend ? 'bg-amber-500/[0.02]' : ''}`}>

                                      {/* DATE COLUMN (Sticky Left) */}
                                      <td className={`sticky left-0 z-20 p-4 border-r border-white/10 shadow-[4px_0_16px_rgba(0,0,0,0.3)] backdrop-blur-md ${isLightMode ? 'bg-[#F8FAFC]' : 'bg-[#0B1121]'} group-hover/row:bg-[#11192b]`}>
                                        <div className="flex items-center justify-between">
                                          <div className={`flex flex-col items-center min-w-[30px] ${isWeekend ? 'opacity-100' : 'opacity-80'}`}>
                                            <span className={`text-[9px] font-black uppercase tracking-wider ${isWeekend ? 'text-amber-500' : 'text-slate-500'}`}>{dayName}</span>
                                            <span className={`text-xl font-black ${isWeekend ? 'text-amber-400' : (isLightMode ? 'text-slate-800' : 'text-white')}`}>{dayNumber}</span>
                                            <span className="text-[8px] font-bold text-slate-600 uppercase">{monthName}</span>
                                          </div>
                                          {isWeekend && <span className="text-sm">🏖️</span>}
                                        </div>
                                      </td>

                                      {/* CELLS */}
                                      {optimizedRoutes.map((route, rIdx) => {
                                        const scheduledDay = route.scheduledDays?.find((sd: any) => sd.date === dateStr);
                                        const isWorking = !!scheduledDay;

                                        // Fallback Logic
                                        const totalStops = route.stops.length;
                                        const routeDaysCount = Math.ceil(totalStops / config.stopsPerDayPerRoute);
                                        const routeStartDate = route.startDate || config.startDate;
                                        const routeStartIdx = projectDates.indexOf(routeStartDate);

                                        let isEstimatedActive = false;
                                        if (!route.scheduledDays) {
                                          isEstimatedActive = dIdx >= routeStartIdx && dIdx < (routeStartIdx + routeDaysCount);
                                        }

                                        const isActive = isWorking || isEstimatedActive;
                                        const stopsCount = scheduledDay ? scheduledDay.stores.length : (isEstimatedActive ? Math.round(totalStops / routeDaysCount) : 0);
                                        const kmCount = scheduledDay ? Math.round(scheduledDay.kmTotal) : (isEstimatedActive ? Math.round(route.totalKm / routeDaysCount) : 0);

                                        return (
                                          <td key={`${dateStr}-${route.id}`} className={`p-2 border-r border-white/[0.03] text-center w-[130px] h-[80px] relative transition-all duration-300 ${isActive ? 'bg-white/[0.01]' : ''}`}>
                                            {isActive ? (
                                              <div className="w-full h-full flex flex-col items-center justify-center p-2 rounded-xl border border-white/5 bg-[#172033] shadow-lg group hover:scale-105 hover:border-blue-500/50 hover:bg-[#1e293b] hover:z-10 transition-all cursor-pointer overflow-hidden relative">
                                                {/* Status Dot */}
                                                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: route.color }}></div>

                                                {/* Content */}
                                                <div className="flex flex-col items-center gap-1 z-10">
                                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">OBJETIVO</span>
                                                  <div className="flex items-baseline gap-1">
                                                    <span className="text-xl font-black text-white leading-none">{stopsCount}</span>
                                                    <span className="text-[9px] font-bold text-slate-500">TIENDAS</span>
                                                  </div>
                                                  <div className="w-full h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                                                    <div className="h-full w-full" style={{ backgroundColor: route.color, opacity: 0.8 }}></div>
                                                  </div>
                                                  <span className="text-[8px] font-mono text-blue-400 mt-0.5">{kmCount} KM</span>
                                                </div>

                                                {/* Hover Glow */}
                                                <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors pointer-events-none"></div>
                                              </div>
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center">
                                                <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                                              </div>
                                            )}
                                          </td>
                                        );
                                      })}

                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Footer Info */}
                          <div className="bg-[#0f172a] p-3 text-center border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20 relative">
                            <div className="flex items-center justify-center gap-6 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                              <span>🖱️ Scroll Doble Eje Habilitado</span>
                              <span className="text-blue-500">↔ Desliza Horizontal y Verticalmente</span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Main Result Interface */}
            <div className={`${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800'} border rounded-[4rem] overflow-hidden shadow-2xl backdrop-blur-2xl`}>
              {/* Tab Navigation (Mission Control Inspired) */}
              <div className={`flex p-6 ${isLightMode ? 'bg-slate-50 border-b border-slate-100' : 'bg-slate-900/60 border-b border-white/5'} backdrop-blur-xl justify-center gap-8`}>
                {[
                  { id: 'COMMAND_CENTER', label: 'CENTRO DE MANDO', icon: '🚨' },
                  { id: 'LIST', label: 'DETALLE DE RUTAS', icon: '📋' },
                  { id: 'MAP', label: 'MAPA LOGÍSTICO', icon: '🗺️' },
                  { id: 'CALENDAR', label: 'CRONOGRAMA MASTER', icon: '📅' },
                  { id: 'EVIDENCIAS', label: 'EVIDENCIAS EN VIVO', icon: '📸' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-8 py-5 rounded-[2.2rem] font-black text-[9px] uppercase tracking-[0.3em] transition-all duration-700 flex items-center gap-3 whitespace-nowrap ${activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-[0_0_40px_rgba(37,99,235,0.4)] scale-110'
                      : (isLightMode ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300')}`}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-10">
                {activeTab === 'COMMAND_CENTER' && (
                  <div className="space-y-12 animate-in zoom-in-95 duration-700 pb-20">
                    {/* Header Ejecutivo */}
                    <div className="flex items-center justify-between px-4">
                      <div>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-2 italic animate-pulse">PROJECT: {projectName}</p>
                        <h2 className={`text-4xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{projectName || 'Sin Nombre'}</h2>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">Mission Control • Dashboard Directivo</p>
                      </div>
                      <div className="flex items-center gap-6">
                        {/* Edit Routes Button */}
                        <button
                          onClick={() => setShowRouteEditor(true)}
                          className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isLightMode
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20'
                            }`}
                        >
                          <span>✏️</span>
                          Editar Rutas
                        </button>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sincronización</p>
                          <p className={`text-xs font-black uppercase italic ${isLightMode ? 'text-slate-900' : 'text-blue-400'}`}>ACTIVA — AI ENGINE 2.5</p>
                        </div>
                        <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                      {/* Avance Dial Gigante */}
                      <div className={`${isLightMode ? 'bg-white shadow-2xl border-slate-100' : 'bg-slate-900/60 border-white/5'} p-12 rounded-[4rem] border flex flex-col items-center justify-center relative overflow-hidden group col-span-1`}>
                        <div className="absolute inset-0 bg-blue-600/5 rotate-45 transform translate-y-32 blur-3xl"></div>
                        <div className="relative w-56 h-56">
                          <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90 drop-shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                            <circle cx="18" cy="18" r="15.9155" className={`${isLightMode ? 'stroke-slate-100' : 'stroke-slate-800'}`} strokeWidth="3.5" fill="none" />
                            <circle
                              cx="18" cy="18" r="15.9155"
                              className="stroke-blue-600"
                              strokeWidth="3.5"
                              strokeDasharray={`${Math.round((evidences.length / Math.max(sites.length, 1)) * 100)}, 100`}
                              strokeLinecap="round"
                              fill="none"
                              style={{ transition: 'stroke-dasharray 2s ease' }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-6xl font-black italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                              {Math.round((evidences.length / Math.max(sites.length, 1)) * 100)}%
                            </span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Avance Global</span>
                          </div>
                        </div>
                      </div>

                      {/* Performance & Velocity Cards */}
                      <div className="col-span-1 space-y-8">
                        <div className={`${isLightMode ? 'bg-white border-slate-100' : 'bg-white/[0.03] border-white/5'} p-8 rounded-[3rem] border flex items-center gap-6 group hover:translate-x-2 transition-all`}>
                          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">⚡</div>
                          <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Velocidad</p>
                            <p className={`text-2xl font-black italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{Math.round(evidences.length / Math.max(7, 1))} <span className="text-xs text-slate-500 font-bold uppercase italic">por día</span></p>
                          </div>
                        </div>
                        <div className={`${isLightMode ? 'bg-white border-slate-100' : 'bg-white/[0.03] border-white/5'} p-8 rounded-[3rem] border flex items-center gap-6 group hover:translate-x-2 transition-all`}>
                          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">✅</div>
                          <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tiendas Listas</p>
                            <p className={`text-2xl font-black italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{evidences.length} <span className="text-xs text-slate-500 font-bold uppercase italic">unidades</span></p>
                          </div>
                        </div>
                        <div className={`${isLightMode ? 'bg-white border-slate-100' : 'bg-white/[0.03] border-white/5'} p-8 rounded-[3rem] border flex items-center gap-6 group hover:translate-x-2 transition-all`}>
                          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🗓️</div>
                          <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Días Restantes</p>
                            <p className={`text-2xl font-black italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                              {Math.ceil((sites.length - evidences.length) / Math.max(evidences.length / 7, 5))} <span className="text-xs text-slate-500 font-bold uppercase italic">estimados</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* War Room Live Reel */}
                      <div className={`${isLightMode ? 'bg-slate-900 text-white' : 'bg-slate-900/40 border-white/5'} col-span-2 p-10 rounded-[4rem] border relative overflow-hidden flex flex-col`}>
                        <div className="flex items-center justify-between mb-8">
                          <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 italic">Sala de Guerra — Últimas 24h</h5>
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            <span className="text-[8px] font-black uppercase tracking-widest">En Vivo</span>
                          </span>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                          {evidences.length > 0 ? (
                            <div className="grid grid-cols-2 gap-6">
                              {evidences.slice(0, 4).map((ev, idx) => (
                                <div key={ev.id} className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 group cursor-pointer shadow-2xl">
                                  <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-[8px] font-black text-white uppercase tracking-widest">
                                    {idx + 1}
                                  </div>
                                  <img src={ev.file_url} className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="Evidencia" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">{ev.uploaded_by}</p>
                                    <p className="text-xs font-bold uppercase italic truncate">Sitio ID: {ev.store_job_id}</p>
                                  </div>
                                  <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[8px] font-black uppercase">
                                    {new Date(ev.uploaded_at).toLocaleTimeString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30">
                              <span className="text-5xl mb-6">📸</span>
                              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Esperando primeras transmisiones de campo</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      {/* Performance by Base */}
                      <div className={`${isLightMode ? 'bg-white border-slate-100' : 'bg-white/[0.01] border-white/5'} p-12 rounded-[4rem] border`}>
                        <h5 className={`text-2xl font-black uppercase italic tracking-tighter mb-10 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Desempeño por Nodo Logístico</h5>
                        <div className="space-y-8">
                          {depots.map(depot => {
                            const depotSites = sites.filter(s => s.depotId === depot.id);
                            const depotEvidences = evidences.filter(e => {
                              const site = sites.find(s => s.store_job_id === e.store_job_id);
                              return site?.depotId === depot.id;
                            });
                            const progress = depotSites.length > 0 ? (depotEvidences.length / depotSites.length) * 100 : 0;
                            return (
                              <div key={depot.id} className="space-y-3">
                                <div className="flex justify-between items-end">
                                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{depot.name}</p>
                                  <p className={`text-sm font-black italic ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{Math.round(progress)}%</p>
                                </div>
                                <div className={`h-2.5 w-full ${isLightMode ? 'bg-slate-100' : 'bg-white/5'} rounded-full overflow-hidden`}>
                                  <div
                                    className="h-full bg-blue-600 transition-all duration-1000 shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                                    style={{ width: `${progress}%`, backgroundColor: depot.color }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Daily Activity Chart (The same from dashboard but bigger here) */}
                      <div className={`${isLightMode ? 'bg-white border-slate-100' : 'bg-white/[0.01] border-white/5'} p-12 rounded-[4rem] border flex flex-col`}>
                        <h5 className={`text-2xl font-black uppercase italic tracking-tighter mb-10 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Curva de Ejecución Nacional</h5>
                        <div className="flex-1 flex items-end gap-6 h-64">
                          {Array.from(new Set(sites.map(s => s.date).filter(Boolean))).sort().map((date, i) => {
                            const shopsToday = sites.filter(s => s.date === date).length;
                            const installedToday = sites.filter(s => s.date === date && evidences.some(e => e.store_job_id === (s as any).store_job_id)).length;
                            const progressHeight = shopsToday > 0 ? (installedToday / shopsToday) * 100 : 0;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-4 group cursor-pointer h-full">
                                <div className={`w-full ${isLightMode ? 'bg-slate-200' : 'bg-white/5'} rounded-t-3xl relative h-full transition-all group-hover:scale-x-110`}>
                                  <div
                                    className={`absolute bottom-0 left-0 w-full bg-gradient-to-t from-blue-700 to-blue-500 rounded-t-3xl transition-all duration-1000 shadow-[0_-15px_30px_rgba(37,99,235,0.2)]`}
                                    style={{ height: `${progressHeight}%` }}
                                  ></div>
                                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-slate-900 text-white text-[8px] font-black px-2 py-1 rounded-lg">
                                    {Math.round(progressHeight)}%
                                  </div>
                                </div>
                                <span className={`text-[9px] font-black uppercase italic ${isLightMode ? 'text-slate-400' : 'text-slate-600'}`}>{(date as string)?.split('-').slice(1).join('/')}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-8 text-center bg-white/5 py-4 rounded-2xl">Visualización Dinámica de Productividad</p>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'LIST' && (
                  <div className="space-y-16 animate-in slide-in-from-left-4 duration-500 pb-20">

                    {/* 🚨 SECCIÓN DE TIENDAS EXCLUIDAS / ERRORES (Solicitud Crítica) */}
                    {(() => {
                      const assignedSiteIds = new Set(optimizedRoutes.flatMap(r => r.stops.map(s => s.id)));
                      const excludedSites = sites.filter(s => !assignedSiteIds.has(s.id));

                      if (excludedSites.length === 0) return null;

                      return (
                        <div className="mx-10 mb-8">
                          <div className="bg-red-500/10 border border-red-500/20 rounded-[2.5rem] p-10 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-700">
                            <div className="flex items-center gap-6 mb-6">
                              <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30 animate-pulse">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                              </div>
                              <div>
                                <h3 className={`text-3xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-red-600' : 'text-red-400'}`}>
                                  Atención: {excludedSites.length} Tiendas Excluidas
                                </h3>
                                <p className="text-[11px] font-black text-red-400/80 uppercase tracking-widest mt-1">
                                  Estas tiendas NO fueron incluidas en las rutas por errores de ubicación o datos.
                                </p>
                              </div>
                            </div>

                            <div className="overflow-x-auto custom-scrollbar rounded-3xl border border-red-500/10 bg-black/20">
                              <table className="w-full text-left">
                                <thead className="bg-red-500/20 text-red-200">
                                  <tr>
                                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest">ID Tienda</th>
                                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest">Nombre</th>
                                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest">Dirección Problema</th>
                                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest">Ciudad/Estado</th>
                                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest">Razón Exclusión</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-red-500/10">
                                  {excludedSites.map(site => (
                                    <tr key={site.id} className="hover:bg-red-500/5 transition-colors">
                                      <td className="py-4 px-6 font-mono font-bold text-red-300">{site.site_id}</td>
                                      <td className="py-4 px-6 font-bold text-white">{site.name_sitio}</td>
                                      <td className="py-4 px-6 text-xs text-slate-400">{site.direccion_completa}</td>
                                      <td className="py-4 px-6 text-xs text-slate-400">{site.city}, {site.state}</td>
                                      <td className="py-4 px-6">
                                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-red-500/30">
                                          {!site.lat || site.lat === 0 ? 'FALTA GEOLOCALIZACIÓN' : 'ERROR DE DATOS'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {Object.entries(
                      optimizedRoutes.reduce((acc, route) => {
                        const d = route.date || route.startDate || 'Sin Fecha';
                        if (!acc[d]) acc[d] = [];
                        acc[d].push(route);
                        return acc;
                      }, {} as Record<string, any[]>)
                    ).sort(([a], [b]) => a.localeCompare(b)).map(([date, routes]) => (
                      <div key={date} className="space-y-6">
                        {/* Header de Día — Estilo Ejecutivo Moderno */}
                        <div className={`flex items-center justify-between px-10 sticky top-0 ${isLightMode ? 'bg-slate-50 border-b border-slate-100' : 'bg-slate-950/90 backdrop-blur-xl border-b border-white/5'} py-6 z-20 rounded-t-[3rem]`}>
                          <div className="flex items-center gap-8">
                            <div className={`w-16 h-16 rounded-[1.5rem] ${isLightMode ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-blue-500/10 border border-blue-500/20 text-blue-400 font-black shadow-[0_0_32px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20'} flex items-center justify-center`}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                            </div>
                            <div>
                              <h5 className={`font-black ${isLightMode ? 'text-slate-900' : 'text-white'} text-2xl uppercase italic tracking-tight leading-none`}>
                                {date === 'Sin Fecha'
                                  ? date
                                  : (routes[0]?.startDate && routes[0]?.endDate
                                    ? (() => {
                                      const [sY, sM, sD] = routes[0].startDate.split('-').map(Number);
                                      const [eY, eM, eD] = routes[0].endDate.split('-').map(Number);
                                      return `${new Date(sY, sM - 1, sD).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} — ${new Date(eY, eM - 1, eD).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                                    })()
                                    : (() => {
                                      const [y, m, d] = date.split('-').map(Number);
                                      return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                                    })())}
                              </h5>
                              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                {(routes as any[]).length} Rutas Listas para Ejecución
                              </p>
                            </div>
                          </div>
                        </div>


                        {/* Listado Horizontal de Rutas */}
                        <div className="space-y-12 px-2">
                          {(routes as any[]).map((route: any) => (
                            <div key={route.id} className={`${isLightMode ? 'bg-white border-slate-200 shadow-xl' : 'bg-slate-900/20 border-white/5 shadow-2xl'} border rounded-[4rem] overflow-hidden backdrop-blur-md group transition-all duration-700`}>
                              {/* Summary Row (Horizontal Header) */}
                              <div className={`px-12 py-8 ${isLightMode ? 'bg-slate-50/50' : 'bg-gradient-to-r from-slate-900/60 to-transparent'} flex flex-wrap items-center justify-between gap-8 border-b ${isLightMode ? 'border-slate-100' : 'border-white/5'}`}>
                                <div className="flex items-center gap-6">
                                  <div className="w-16 h-16 rounded-[2rem] flex items-center justify-center font-black text-2xl text-white shadow-2xl transition-transform group-hover:scale-110 duration-500" style={{ backgroundColor: route.color || '#2298E0' }}>
                                    {route.id}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="text"
                                        value={route.driverName}
                                        onChange={(e) => setOptimizedRoutes(prev => prev.map(r => r.id === route.id ? { ...r, driverName: e.target.value.toUpperCase() } : r))}
                                        className={`bg-transparent border-none p-0 font-black ${isLightMode ? 'text-slate-900' : 'text-white'} text-xl uppercase italic tracking-tighter focus:ring-0 focus:outline-none w-auto min-w-[350px]`}
                                      />
                                      <span className={`px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-400 transition-colors`}>ID: CR-{route.id}</span>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                      Base Logística: <span className={isLightMode ? 'text-slate-900' : 'text-white'}>{route.base}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-8">
                                  <div className="text-center">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Capacidad</p>
                                    <p className={`text-xl font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{route.stops?.length || 0} <span className="text-[10px] text-slate-500 font-bold uppercase italic">tiendas</span></p>
                                  </div>
                                  <div className={`w-px h-10 ${isLightMode ? 'bg-slate-200' : 'bg-white/5'}`}></div>
                                  <div className="text-center">
                                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1.5">Métricas</p>
                                    <p className={`text-xl font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{Math.round(route.totalKm || 0)} <span className="text-[10px] text-slate-500 font-bold uppercase">KM</span></p>
                                  </div>
                                  <div className={`w-px h-10 ${isLightMode ? 'bg-slate-200' : 'bg-white/5'}`}></div>
                                  <div className="text-center">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1.5">Pernocta</p>
                                    {route.stops.some((s: any) => s.day_status === 'OVERTIME') ? (
                                      <span className="bg-red-500 text-white text-[10px] px-3 py-1 rounded-full font-black animate-pulse">⏱ OVERTIME</span>
                                    ) : (
                                      <span className="bg-emerald-500/10 text-emerald-500 text-[10px] px-3 py-1 rounded-full font-black border border-emerald-500/20">STATUS OK</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex gap-3">
                                  <button
                                    onClick={() => {
                                      const depot = depots.find(d => d.id === route.depotId) || depots[0];
                                      const origin = `${depot.lat},${depot.lng}`;
                                      const waypoints = route.stops.map((s: any) => `${s.lat},${s.lng}`).join('|');
                                      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${origin}&waypoints=${waypoints}&travelmode=driving`;
                                      window.open(mapsUrl, '_blank');
                                    }}
                                    className={`px-5 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-2xl group/btn ${isLightMode ? 'bg-white border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-500/30' : 'bg-slate-950 border border-white/5 text-slate-400 hover:text-blue-400 hover:border-blue-500/30'}`}
                                    title="Abrir en Google Maps"
                                  >
                                    <svg className="group-hover/btn:rotate-12 transition-transform duration-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
                                    GPS
                                  </button>

                                  <button
                                    onClick={() => exportService.downloadSingleRouteCSV(route, config, depots)}
                                    className={`px-5 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-2xl group/btn ${isLightMode ? 'bg-white border-slate-200 text-slate-500 hover:text-emerald-500 hover:border-emerald-500/30' : 'bg-slate-950 border border-white/5 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30'}`}
                                    title="Descargar Plan de Ruta (CSV)"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                    CSV
                                  </button>

                                  <button
                                    onClick={() => setDetailViewRoute(detailViewRoute === route.id ? null : route.id)}
                                    className={`px-6 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${detailViewRoute === route.id ? 'bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.4)]' : (isLightMode ? 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 shadow-xl' : 'bg-slate-950 border border-white/5 text-slate-400 hover:text-white shadow-2xl')}`}
                                  >
                                    {detailViewRoute === route.id ? 'CERRAR' : 'REPORTE'}
                                  </button>
                                </div>
                              </div>

                              {detailViewRoute === route.id && (
                                <div className="animate-in slide-in-from-top-4 duration-500 overflow-hidden">
                                  {/* Quick-Scan Horizontal Timeline (Horizontal Focus) */}
                                  <div className={`px-12 py-4 border-b flex items-center gap-2 overflow-x-auto no-scrollbar ${isLightMode ? 'bg-slate-50 border-slate-100' : 'bg-slate-950/20 border-white/5'}`}>
                                    <p className={`text-[9px] font-black uppercase tracking-widest mr-4 shrink-0 ${isLightMode ? 'text-slate-400' : 'text-slate-600'}`}>Secuencia:</p>
                                    {(route.stops || []).map((s: any, i: number) => (
                                      <div key={s.id} className="flex items-center shrink-0">
                                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-black transition-all flex-shrink-0 ${s.locked ? 'bg-amber-400/20 border-amber-400/40 text-amber-500' : (isLightMode ? 'bg-white border-slate-200 text-slate-400' : 'bg-slate-900 border-white/10 text-slate-500 group-hover:text-blue-400')}`}>
                                          {i + 1}
                                        </div>
                                        {i < route.stops.length - 1 && (
                                          <div className={`w-4 h-[1px] mx-1 ${isLightMode ? 'bg-slate-200' : 'bg-white/10'}`}></div>
                                        )}
                                      </div>
                                    ))}
                                  </div>

                                  {/* Spreadsheet-like Data Table (Horizontal Focus) */}
                                  <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse min-w-[1500px]">
                                      <thead>
                                        <tr className={isLightMode ? 'bg-slate-50' : 'bg-white/[0.02]'}>
                                          <th className={`py-6 px-10 text-[10px] font-black uppercase tracking-[0.2em] border-b ${isLightMode ? 'border-slate-100 text-slate-400' : 'border-white/5 text-slate-500'}`}>ORDEN</th>
                                          <th className={`py-6 px-4 text-[10px] font-black uppercase tracking-[0.2em] border-b ${isLightMode ? 'border-slate-100 text-slate-400' : 'border-white/5 text-slate-500'}`}>SITE ID</th>
                                          <th className={`py-6 px-6 text-[10px] font-black uppercase tracking-[0.2em] border-b ${isLightMode ? 'border-slate-100 text-slate-400' : 'border-white/5 text-slate-500'}`}>ID SITIO / TIENDA</th>
                                          <th className={`py-6 px-6 text-[10px] font-black uppercase tracking-[0.2em] border-b ${isLightMode ? 'border-slate-100 text-slate-400' : 'border-white/5 text-slate-500'}`}>UBICACIÓN</th>
                                          <th className={`py-6 px-6 text-[10px] font-black uppercase tracking-[0.2em] border-b ${isLightMode ? 'border-slate-100 text-slate-400' : 'border-white/5 text-slate-500'}`}>DIRECCIÓN</th>
                                          <th className={`py-6 px-6 text-[10px] font-black uppercase tracking-[0.2em] border-b ${isLightMode ? 'border-slate-100 text-slate-400' : 'border-white/5 text-slate-500'}`}>MÉTRICAS (KM / MIN)</th>
                                          <th className={`py-6 px-6 text-[10px] font-black uppercase tracking-[0.2em] border-b ${isLightMode ? 'border-slate-100 text-slate-400' : 'border-white/5 text-slate-500'}`}>STATUS</th>
                                        </tr>
                                      </thead>
                                      <tbody className={`divide-y ${isLightMode ? 'divide-slate-100' : 'divide-white/[0.03]'}`}>
                                        {(route.stops || []).map((stop: any, idx: number) => (
                                          <tr key={stop.id} className={`group/row ${isLightMode ? 'hover:bg-blue-500/5' : 'hover:bg-white/[0.04]'} transition-all`}>
                                            <td className="py-5 px-10">
                                              <div className="flex items-center gap-4">
                                                <span className={`w-10 h-10 rounded-xl border flex items-center justify-center text-[11px] font-black transition-all ${stop.locked ? 'bg-amber-400 text-slate-900 border-amber-500' : (isLightMode ? 'bg-white border-slate-200 text-slate-400' : 'bg-slate-950 border-slate-800 text-slate-500 group-hover/row:text-blue-400 group-hover/row:border-blue-500/30')}`}>
                                                  {idx + 1}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-5 px-4 font-mono">
                                              <span className={`text-[11px] font-black uppercase tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-slate-300'}`}>{stop.site_id || 'S/N'}</span>
                                            </td>
                                            <td className="py-5 px-6">
                                              <p className={`text-[11px] font-black uppercase italic ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{stop.name_sitio || stop.marca || 'SITIO DE TRABAJO'}</p>
                                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{stop.marca || 'INST POP'}</p>
                                            </td>
                                            <td className="py-5 px-6">
                                              <p className={`text-[10px] font-black uppercase ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{stop.city || stop.municipio || 'N/A'}</p>
                                              <p className="text-[9px] text-blue-500 font-bold uppercase italic">{stop.state || stop.estado || 'MÉXICO'}</p>
                                            </td>
                                            <td className="py-5 px-6 max-w-sm">
                                              <p className={`text-[10px] font-medium leading-relaxed truncate ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>{stop.direccion_completa}</p>
                                              {stop.formatted_address && <p className="text-[8px] text-slate-500 font-bold uppercase mt-1 opacity-60">GIS: {stop.formatted_address}</p>}
                                            </td>
                                            <td className="py-5 px-6">
                                              <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${isLightMode ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/10 text-blue-400'} border border-blue-500/20`}>
                                                    +{Math.round(stop.distance_km || 0)} KM
                                                  </span>
                                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${isLightMode ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400'} border border-emerald-500/20`}>
                                                    {stop.travel_time_minutes || 0} MIN
                                                  </span>
                                                </div>
                                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter italic">Tiempo Estimado Tránsito</p>
                                              </div>
                                            </td>
                                            <td className="py-5 px-6">
                                              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${(stop.day_status === 'OVERTIME')
                                                ? 'text-red-500 bg-red-500/10 border-red-500/20'
                                                : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${stop.day_status === 'OVERTIME' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                                                {stop.day_status || 'OK'}
                                              </div>
                                            </td>
                                            <td className="py-5 px-10 text-right">
                                              <div className="flex items-center justify-end gap-3 opacity-0 group-hover/row:opacity-100 transition-all transform translate-x-4 group-hover/row:translate-x-0">
                                                <button
                                                  onClick={() => {
                                                    const newRoutes = [...optimizedRoutes];
                                                    const rIdx = newRoutes.findIndex(r => r.id === route.id);
                                                    newRoutes[rIdx].stops[idx].locked = !newRoutes[rIdx].stops[idx].locked;
                                                    setOptimizedRoutes(newRoutes);
                                                  }}
                                                  className={`p-3 rounded-xl border transition-all ${stop.locked ? 'bg-amber-400/20 border-amber-400/40 text-amber-500 scale-110 shadow-lg' : (isLightMode ? 'bg-white border-slate-200 text-slate-400 hover:text-slate-900 shadow-sm' : 'bg-slate-950 border-white/5 text-slate-600 hover:text-white')}`}
                                                  title={stop.locked ? "Desbloquear Posición" : "Bloquear Posición"}
                                                >
                                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'CALENDAR' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-20">
                    <MasterScheduleGantt
                      routes={optimizedRoutes}
                      isLightMode={isLightMode}
                      onViewRoute={(r) => {
                        setDetailViewRoute(r.id);
                        setActiveTab('LIST');
                      }}
                      onViewDay={(route, day) => {
                        console.log('Ver día:', route.id, day);
                        setDetailViewRoute(route.id);
                        setActiveTab('LIST');
                      }}
                    />
                  </div>
                )}

                {activeTab === 'EVIDENCIAS' && (
                  <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-700">
                    {!activeRouteForEvidence ? (
                      <>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-4">
                          <div className="flex items-center gap-8">
                            <div>
                              <h3 className={`text-4xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Panel Operacional</h3>
                              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mt-2">Misión AntiGravity: Registro y Validación de Campo</p>
                            </div>
                            <div className={`flex p-1 rounded-2xl ${isLightMode ? 'bg-slate-100' : 'bg-white/5 shadow-inner'} ml-8`}>
                              <button
                                onClick={() => setEvidenceViewMode('ROUTES')}
                                className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${evidenceViewMode === 'ROUTES' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                              >
                                Por Cuadrillas
                              </button>
                              <button
                                onClick={() => setEvidenceViewMode('OPERATIONAL')}
                                className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${evidenceViewMode === 'OPERATIONAL' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                              >
                                Todas las Tiendas
                              </button>
                              <button
                                onClick={() => setEvidenceViewMode('MOBILE')}
                                className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${evidenceViewMode === 'MOBILE' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                              >
                                Terminal Móvil
                              </button>
                              <button
                                onClick={() => setEvidenceViewMode('CALENDAR')}
                                className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${evidenceViewMode === 'CALENDAR' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                              >
                                Calendario
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => exportService.generateEvidenceExport(optimizedRoutes, evidences)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 shadow-2xl flex items-center gap-4"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            Exportar Todo (ZIP)
                          </button>
                        </div>

                        {evidenceViewMode === 'CALENDAR' ? (
                          <div className="animate-in fade-in duration-1000">
                            <VisualCalendar
                              routes={optimizedRoutes}
                              isLightMode={isLightMode}
                              onViewRoute={(r) => setActiveRouteForEvidence(r)}
                            />
                          </div>
                        ) : evidenceViewMode === 'MOBILE' ? (
                          <div className="flex flex-col items-center py-20 animate-in zoom-in-95 duration-1000">
                            <div className="relative">
                              {/* Decoración de dispositivo */}
                              <div className="absolute -inset-4 border-8 border-slate-800 rounded-[5.5rem] pointer-events-none z-50 hidden lg:block"></div>
                              <EvidencePortal />
                            </div>
                            <p className="mt-12 text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic">Vista Previa de Dispositivo de Campo — AntiGravity Sync™</p>
                          </div>
                        ) : evidenceViewMode === 'ROUTES' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {optimizedRoutes.map((route) => {
                              const routeEvidences = evidences.filter(e => e.route_id === route.id);
                              const totalStops = route.stops.length;
                              const completedStops = route.stops.filter((s: any) =>
                                routeEvidences.some(e => e.store_job_id === s.store_job_id && e.category !== 'ACUSE_RECIBIDO') &&
                                routeEvidences.some(e => e.store_job_id === s.store_job_id && e.category === 'ACUSE_RECIBIDO')
                              ).length;
                              const progress = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

                              return (
                                <div
                                  key={route.id}
                                  onClick={() => setActiveRouteForEvidence(route)}
                                  className={`${isLightMode ? 'bg-white border-slate-200 hover:border-blue-500' : 'bg-slate-900/60 border-white/5 hover:border-blue-500/30 shadow-2xl'} p-10 rounded-[3.5rem] border transition-all cursor-pointer group hover:-translate-y-2`}
                                >
                                  <div className="flex items-center justify-between mb-8">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg ring-2 ring-white/10`} style={{ backgroundColor: `${route.color}20`, color: route.color }}>
                                      🚚
                                    </div>
                                    <div className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                                      Ruta {route.id}
                                    </div>
                                  </div>
                                  <h4 className={`text-2xl font-black uppercase italic tracking-tighter mb-2 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                                    Cuadrilla {route.id}
                                  </h4>
                                  <p className={`text-xs font-bold uppercase tracking-widest mb-8 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {totalStops} Tiendas • {Math.round(route.totalKm)} KM
                                  </p>

                                  <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                      <span className={`text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>Progreso Auditoría</span>
                                      <span className={`text-sm font-black ${isLightMode ? 'text-blue-600' : 'text-blue-400'}`}>{Math.round(progress)}%</span>
                                    </div>
                                    <div className={`h-3 w-full rounded-full overflow-hidden ${isLightMode ? 'bg-slate-100' : 'bg-white/5'}`}>
                                      <div
                                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000"
                                        style={{ width: `${progress}%` }}
                                      ></div>
                                    </div>
                                  </div>

                                  <button className={`mt-10 w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all ${isLightMode ? 'bg-slate-900 text-white hover:bg-blue-600' : 'bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white shadow-lg shadow-blue-500/10'}`}>
                                    Abrir Bitácora
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className={`${isLightMode ? 'bg-white border-slate-200 shadow-xl' : 'bg-slate-900/40 border-white/5 shadow-2xl'} p-10 rounded-[4rem] border overflow-hidden`}>
                            <div className="flex items-center justify-between mb-10">
                              <h5 className={`text-2xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Inventario Maestro de Sitios</h5>
                              <div className="flex gap-4">
                                <button
                                  onClick={() => setDashboardFilter('ALL')}
                                  className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${dashboardFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'}`}>
                                  Toda la Campaña
                                </button>
                                <button
                                  onClick={() => setDashboardFilter('PENDING')}
                                  className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${dashboardFilter === 'PENDING' ? 'bg-orange-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'}`}>
                                  Pendientes
                                </button>
                              </div>
                            </div>
                            <div className="max-h-[700px] overflow-y-auto custom-scrollbar">
                              <table className="w-full">
                                <thead>
                                  <tr className={`text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-400 border-slate-100' : 'text-slate-500 border-white/5'} border-b`}>
                                    <th className="text-left py-4 px-4 w-12">#</th>
                                    <th className="text-left py-4 px-4">Site ID</th>
                                    <th className="text-left py-4 px-4">Tienda</th>
                                    <th className="text-left py-4 px-4">Operación</th>
                                    <th className="text-left py-4 px-4">Evidencias</th>
                                    <th className="text-right py-4 px-4">Estatus</th>
                                  </tr>
                                </thead>
                                <tbody className={`divide-y ${isLightMode ? 'divide-slate-100' : 'divide-white/5'}`}>
                                  {sites.filter(s => s.routeId).filter(s => {
                                    const isInstalled = evidences.some(e => e.store_job_id === (s as any).store_job_id && e.category !== 'ACUSE_RECIBIDO') &&
                                      evidences.some(e => e.store_job_id === (s as any).store_job_id && e.category === 'ACUSE_RECIBIDO');
                                    return dashboardFilter === 'PENDING' ? !isInstalled : true;
                                  }).map((site, i) => {
                                    const siteEvs = evidences.filter(e => e.store_job_id === (site as any).store_job_id);
                                    const hasPhoto = siteEvs.some(e => e.category !== 'ACUSE_RECIBIDO');
                                    const hasAck = siteEvs.some(e => e.category === 'ACUSE_RECIBIDO');
                                    const isComplete = hasPhoto && hasAck;

                                    return (
                                      <tr key={i} className={`text-sm ${isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'} transition-colors group`}>
                                        <td className="py-6 px-4 font-mono font-black text-blue-500">{i + 1}</td>
                                        <td className="py-6 px-4 font-mono font-black text-slate-500">{site.site_id}</td>
                                        <td className="py-6 px-4">
                                          <p className={`font-black uppercase italic ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{site.name_sitio}</p>
                                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{site.city}, {site.state}</p>
                                        </td>
                                        <td className="py-6 px-4">
                                          <div className="flex items-center gap-3">
                                            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[9px] font-black uppercase">RUTA {site.routeId}</span>
                                            <span className="text-[9px] font-bold text-slate-500 uppercase">{site.date}</span>
                                          </div>
                                        </td>
                                        <td className="py-6 px-4">
                                          <div className="flex gap-2">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${hasPhoto ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 border-white/10 text-slate-700'}`} title="Fotos">
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                            </div>
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${hasAck ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white/5 border-white/10 text-slate-700'}`} title="Acuse">
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-6 px-4 text-right">
                                          {isComplete ? (
                                            <span className="text-emerald-500 text-[10px] font-black flex items-center justify-end gap-2 uppercase tracking-widest">
                                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
                                              SINCRONIZADA
                                            </span>
                                          ) : (
                                            <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest">PENDIENTE</span>
                                          )}
                                        </td>
                                        <td className="py-6 px-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={() => {
                                              const route = optimizedRoutes.find(r => r.id === site.routeId);
                                              if (route) setActiveRouteForEvidence(route);
                                            }}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                                            Ver Registro
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )} </>
                    ) : (
                      <div className="space-y-10">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setActiveRouteForEvidence(null)}
                            className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isLightMode ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'}`}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6" /></svg>
                            Volver a Listado
                          </button>
                          <div className="flex items-center justify-end gap-4">
                            <div className="text-right">
                              <h3 className={`text-3xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Bitácora Operativa</h3>
                              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mt-1">{activeRouteForEvidence.base} • {activeRouteForEvidence.stops.length} TIENDAS</p>
                            </div>
                            <div
                              className="w-16 h-16 rounded-full flex items-center justify-center border-4 text-xl font-black shadow-2xl transition-transform hover:scale-110"
                              style={{
                                backgroundColor: activeRouteForEvidence.color,
                                borderColor: isLightMode ? '#fff' : 'rgba(255,255,255,0.1)',
                                color: '#fff'
                              }}
                            >
                              R{activeRouteForEvidence.id.replace(/\D/g, '')}
                            </div>
                          </div>
                        </div>

                        {/* Grupos por Día */}
                        <div className="space-y-16">
                          {Object.entries(
                            activeRouteForEvidence.stops.reduce((acc: any, stop: any) => {
                              const d = stop.scheduled_date || 'Sin Fecha';
                              if (!acc[d]) acc[d] = [];
                              acc[d].push(stop);
                              return acc;
                            }, {})
                          ).sort(([a], [b]) => a.localeCompare(b)).map(([date, stops]: [string, any]) => (
                            <div key={date} className="space-y-8">
                              <div className={`flex items-center gap-6 px-10 py-6 sticky top-0 z-20 rounded-3xl backdrop-blur-3xl border ${isLightMode ? 'bg-slate-50/90 border-slate-200 shadow-sm' : 'bg-slate-950/80 border-white/5'}`}>
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shadow-xl ${isLightMode ? 'bg-blue-600 text-white' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                                  {stops[0].day_status === 'OVERTIME' ? '⏱️' : '📅'}
                                </div>
                                <div>
                                  <h4 className={`text-xl font-black uppercase italic tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                                    {(() => {
                                      if (!date) return 'Fecha desconocida';
                                      const parts = date.split('-');
                                      if (parts.length < 3) return date;
                                      const [y, m, d] = parts.map(Number);
                                      return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                                    })()}
                                  </h4>
                                  {stops[0].day_status === 'OVERTIME' && (
                                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest animate-pulse">Aviso: Jornada con OVERTIME</span>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-6 px-4">
                                {stops.sort((a: any, b: any) => a.stop_in_day - b.stop_in_day).map((stop: any) => {
                                  const stopEvidences = evidences.filter(e => e.store_job_id === stop.store_job_id);
                                  const hasAck = stopEvidences.some(e => e.category === 'ACUSE_RECIBIDO');
                                  const evidenceCount = stopEvidences.filter(e => e.category !== 'ACUSE_RECIBIDO').length;

                                  return (
                                    <div key={stop.store_job_id} className={`p-8 rounded-[2.5rem] border transition-all ${isLightMode ? 'bg-white border-slate-100 hover:shadow-xl' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}`}>
                                      <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                                        <div className="flex items-center gap-8 flex-1">
                                          <div className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-white/5'}`}>
                                            <span className="text-[10px] font-black text-slate-500 uppercase">STOP</span>
                                            <span className={`text-lg font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{stop.stop_in_day}</span>
                                          </div>
                                          <div>
                                            <div className="flex items-center gap-4 mb-1">
                                              <h5 className={`text-lg font-black uppercase italic ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{stop.name_sitio}</h5>
                                              {stop.status === AddressStatus.WARNING && <span className="text-amber-500 text-lg" title="Geocodificación Ambigua">⚠️</span>}
                                            </div>
                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>ID: {stop.site_id} • {stop.direccion_completa}</p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                          <div className="flex flex-col items-end gap-2 pr-6 border-r border-white/5">
                                            <div className="flex items-center gap-2">
                                              <span className={`text-[9px] font-black uppercase tracking-widest ${hasAck ? 'text-emerald-500' : 'text-slate-500'}`}>Acuse: {hasAck ? 'CARGADO' : 'PENDIENTE'}</span>
                                              <div className={`w-2 h-2 rounded-full ${hasAck ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className={`text-[9px] font-black uppercase tracking-widest ${evidenceCount >= 3 ? 'text-emerald-500' : 'text-slate-500'}`}>Evidencias: {evidenceCount}/3</span>
                                              <div className={`w-2 h-2 rounded-full ${evidenceCount >= 3 ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                                            </div>
                                          </div>

                                          <div className="flex gap-4">
                                            <button
                                              onClick={() => {
                                                setCurrentStoreForEvidence(stop);
                                                setEvidenceType('PHOTO');
                                                setEvidenceModalOpen(true);
                                              }}
                                              className={`px-8 py-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${isLightMode ? 'bg-blue-600 text-white shadow-lg' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white'}`}
                                            >
                                              Subir Evidencias
                                            </button>
                                            <button
                                              onClick={() => {
                                                setCurrentStoreForEvidence(stop);
                                                setEvidenceType('ACK');
                                                setEvidenceModalOpen(true);
                                              }}
                                              className={`px-8 py-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${isLightMode ? 'bg-emerald-600 text-white shadow-lg' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white'}`}
                                            >
                                              Subir Acuse
                                            </button>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Mini Preview de Archivos */}
                                      {stopEvidences.length > 0 && (
                                        <div className="mt-8 flex flex-wrap gap-4 pt-6 border-t border-white/5">
                                          {stopEvidences.map(ev => (
                                            <div key={ev.id} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-2 ${ev.category === 'ACUSE_RECIBIDO' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                              {ev.category === 'ACUSE_RECIBIDO' ? '📄 ACUSE' : '📸 EVIDENCIA'} • {ev.uploaded_at?.split('T')[1]?.substring(0, 5) || '00:00'}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'MAP' && (
                  <div className="space-y-10 animate-in zoom-in-95 duration-700">
                    <div className={`${isLightMode ? 'bg-slate-50 border-slate-100' : 'bg-slate-900/60 border-white/5 shadow-2xl backdrop-blur-3xl'} p-10 rounded-[4rem] border grid grid-cols-1 md:grid-cols-3 gap-10`}>
                      <div className="space-y-4">
                        <label className={`text-[10px] font-black uppercase tracking-[0.3em] ml-2 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>Filtrar Base</label>
                        <div className="relative">
                          <select
                            value={mapFilters.base}
                            onChange={(e) => setMapFilters({ ...mapFilters, base: e.target.value })}
                            className={`w-full ${isLightMode ? 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50' : 'bg-slate-950 border-white/10 text-white hover:bg-slate-900'} border rounded-2xl px-8 py-5 text-xs font-black focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer pr-12`}
                          >
                            <option value="Todas">Todas las Bases</option>
                            {depots.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                          </select>
                          <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6" /></svg>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className={`text-[10px] font-black uppercase tracking-[0.3em] ml-2 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>Seleccionar Día</label>
                        <div className="relative">
                          <select
                            value={mapFilters.date}
                            onChange={(e) => setMapFilters({ ...mapFilters, date: e.target.value })}
                            className={`w-full ${isLightMode ? 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50' : 'bg-slate-950 border-white/10 text-white hover:bg-slate-900'} border rounded-2xl px-8 py-5 text-xs font-black focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer pr-12`}
                          >
                            <option value="Todas">Todos los Días</option>
                            {[...new Set(optimizedRoutes.flatMap(r => r.stops.map((s: any) => s.scheduled_date)))].filter(Boolean).sort().map(d => (
                              <option key={d || ''} value={d || ''}>{d}</option>
                            ))}
                          </select>
                          <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6" /></svg>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className={`text-[10px] font-black uppercase tracking-[0.3em] ml-2 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>Seleccionar Ruta</label>
                        <div className="relative">
                          <select
                            value={mapFilters.routeId}
                            onChange={(e) => setMapFilters({ ...mapFilters, routeId: e.target.value })}
                            className={`w-full ${isLightMode ? 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50' : 'bg-slate-950 border-white/10 text-white hover:bg-slate-900'} border rounded-2xl px-8 py-5 text-xs font-black focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer pr-12`}
                          >
                            <option value="Todas">Todas las Rutas</option>
                            {optimizedRoutes
                              .filter(r => (mapFilters.base === 'Todas' || r.base === mapFilters.base) && (mapFilters.date === 'Todas' || r.date === mapFilters.date))
                              .map(r => <option key={r.id} value={r.id}>Ruta {r.id} ({r.base})</option>)}
                          </select>
                          <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6" /></svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      data-map-ready={mapReady}
                      className={`relative h-[800px] w-full rounded-[4rem] border overflow-hidden shadow-2xl flex flex-col items-center justify-center group ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-950 border-white/5'}`}
                    >
                      {/* Interactive Map Injected Here */}
                      <div id="google-map-container" className="absolute inset-0 w-full h-full"></div>

                      {/* Overlay and Loading Placeholder if API not ready */}
                      <div className={`absolute inset-0 pointer-events-none group-data-[map-ready=true]:hidden flex flex-col items-center justify-center transition-all duration-700 ${isLightMode ? 'bg-white/90' : 'bg-slate-950/90'}`}>
                        {mapError ? (
                          <div className="flex flex-col items-center text-center px-10">
                            <div className="w-24 h-24 bg-red-500/10 rounded-[2.5rem] border border-red-500/20 flex items-center justify-center mb-6">
                              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            </div>
                            <p className={`font-black uppercase tracking-[0.2em] text-sm mb-4 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Error de Visualización</p>
                            <p className="text-slate-500 text-xs max-w-xs leading-relaxed font-bold">{mapError}</p>
                          </div>
                        ) : (
                          <>
                            <div className="w-24 h-24 bg-blue-600/10 rounded-[2.5rem] border border-blue-500/20 flex items-center justify-center animate-pulse mb-6">
                              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2298E0" strokeWidth="2"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" /><path d="M9 3v15" /><path d="M15 6v15" /></svg>
                            </div>
                            <p className={`font-black uppercase tracking-[0.4em] text-sm italic animate-pulse ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Integración con Google Maps: Renderizando polilíneas...</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12">
              <button
                onClick={() => {
                  setOptimizedRoutes([]);
                  setActiveStep(3);
                }}
                className={`py-8 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 transition-all hover:scale-[1.02] shadow-2xl ${isLightMode ? 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200' : 'bg-slate-950 hover:bg-slate-900 text-white border border-white/5'}`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
                Reoptimizar
              </button>

              <button
                onClick={async () => {
                  setIsExporting(true);
                  await exportService.generateExportPackage(sites, optimizedRoutes, config, depots);
                  setIsExporting(false);
                }}
                disabled={isExporting}
                className={`py-8 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 transition-all hover:scale-[1.02] shadow-[0_32px_64px_-12px_rgba(16,185,129,0.3)] ${isExporting ? 'bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-500'} text-white`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                {isExporting ? 'Procesando...' : 'Descargar Paquete Maestro (Excel+ZIP)'}
              </button>

              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className={`py-8 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 transition-all hover:scale-[1.02] shadow-[0_32px_64px_-12px_rgba(37,99,235,0.4)] ${isExporting ? 'bg-slate-700' : 'bg-blue-600 hover:bg-blue-500'} text-white`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
                {isExporting ? 'Generando...' : 'Exportar Reporte Ejecutivo (PDF)'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <ExecutiveReport
          routes={optimizedRoutes}
          sites={sites}
          config={config}
          isLightMode={isLightMode}
        />
      </div>
      {/* Modal de Carga de Evidencias / Acuses (AntiGravity Audit) */}
      {
        evidenceModalOpen && currentStoreForEvidence && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl bg-slate-950/60 transition-all duration-500 animate-in fade-in">
            <div className={`${isLightMode ? 'bg-white' : 'bg-slate-900'} w-full max-w-2xl rounded-[4rem] border ${isLightMode ? 'border-slate-200 shadow-2xl' : 'border-white/10 shadow-[0_0_100px_rgba(37,99,235,0.2)]'} overflow-hidden`}>
              {/* Header Modal */}
              <div className={`p-12 border-b ${isLightMode ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${evidenceType === 'PHOTO' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {evidenceType === 'PHOTO' ? '📸 Módulo Evidencia' : '📄 Módulo Acuse'}
                  </span>
                  <button onClick={() => setEvidenceModalOpen(false)} className="text-slate-500 hover:text-white transition-all">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
                <h3 className={`text-4xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  {currentStoreForEvidence.name_sitio}
                </h3>
                <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Ruta {currentStoreForEvidence.routeId} • Stop {currentStoreForEvidence.stop_in_day} • {currentStoreForEvidence.scheduled_date}
                </p>
              </div>

              <div className="p-12 space-y-10">
                <div className="space-y-4">
                  <label className={`text-[10px] font-black uppercase tracking-[0.3em] ml-2 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {evidenceType === 'PHOTO' ? 'Categoría de Evidencia' : 'Tipo de Documento'}
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {evidenceType === 'PHOTO' ? (
                      ['EVIDENCIA_INSTALACION', 'EVIDENCIA_MANTENIMIENTO', 'EVIDENCIA_ENTREGA'].map(cat => (
                        <button
                          key={cat}
                          className={`px-6 py-4 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${isLightMode ? 'border-slate-200 hover:bg-slate-50 text-slate-600' : 'border-white/5 bg-white/5 hover:bg-white/10 text-slate-400'}`}
                        >
                          {cat.replace('_', ' ')}
                        </button>
                      ))
                    ) : (
                      <button className="px-6 py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest col-span-2">
                        ACUSE DE RECIBIDO (FIRMADO)
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className={`text-[10px] font-black uppercase tracking-[0.3em] ml-2 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>Notas de Campo</label>
                  <textarea
                    id="evidence-notes"
                    placeholder="Escribe detalles sobre la instalación o novedades..."
                    className={`w-full h-32 rounded-3xl p-6 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isLightMode ? 'bg-slate-50 border border-slate-200 text-slate-900' : 'bg-white/5 border border-white/10 text-white'}`}
                  />
                </div>

                <div className="flex items-center gap-6">
                  <button
                    onClick={() => {
                      const notes = (document.getElementById('evidence-notes') as HTMLTextAreaElement)?.value || '';
                      handleUploadEvidence(notes, null);
                    }}
                    className={`flex-1 py-6 rounded-3xl font-black text-xs uppercase tracking-[0.3em] transition-all shadow-xl ${evidenceType === 'PHOTO' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                  >
                    Confirmar y Subir
                  </button>
                  <button
                    onClick={() => setEvidenceModalOpen(false)}
                    className={`flex-1 py-6 rounded-3xl font-black text-xs uppercase tracking-[0.3em] transition-all border ${isLightMode ? 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50' : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/10'}`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      {/* Cotización Master iamanos (Quotation Overlay) */}
      {showQuotation && quotationData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 md:p-20 transition-all animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-[#030712]/90 backdrop-blur-2xl" onClick={() => setShowQuotation(false)}></div>
          <div id="quotation-export-container" className={`relative w-full max-w-6xl max-h-full overflow-y-auto ${isLightMode ? 'bg-white shadow-[0_40px_100px_rgba(0,0,0,0.1)]' : 'bg-[#0f172a] shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10'} rounded-[5rem] p-16 md:p-24 animate-in zoom-in-95 duration-500`}>
            {/* Header de Cotización */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-20 border-b border-white/5 pb-10">
              <div className="flex items-center gap-10">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-6">
                    <img src={targetLogo} alt="Target" className="h-32 w-auto object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.6)]" />
                    <div className="flex flex-col">
                      <span className="text-white text-lg font-black uppercase tracking-widest leading-none">Inversión Logística Target</span>
                      <span className="text-emerald-500 text-xs font-black bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20 uppercase tracking-[0.2em] mt-2 self-start">Sello de Autorización</span>
                    </div>
                  </div>
                </div>
                <div className="h-16 w-px bg-white/10 hidden md:block"></div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <span className="text-lg">💰</span>
                    </div>
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Propuesta de Inversión OptiFlot™</span>
                  </div>
                  <h2 className={`text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                    <span className="text-emerald-500">{projectName || 'Proyecto'}</span>
                  </h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Cotización Master</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuotation(false)}
                className="p-6 bg-white/5 hover:bg-white/10 rounded-3xl text-slate-400 hover:text-white transition-all border border-white/5 group"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover:rotate-90 transition-transform duration-300"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Grid de Cotización */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
              {/* Desglose de Operación */}
              <div className="space-y-12">
                <div className="pb-8 border-b border-white/5">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-10">Desglose de Logística</h3>

                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 font-black italic">KM</div>
                        <div>
                          <p className={`text-sm font-black italic uppercase ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Kilometraje de Operación</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total km calculados por ruta</p>
                        </div>
                      </div>
                      <p className={`text-2xl font-black italic ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                        {Math.round(quotationData.quotedKm).toLocaleString()} <span className="text-xs text-slate-500 not-italic uppercase">km</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20 font-black italic">CAL</div>
                        <div>
                          <p className={`text-sm font-black italic uppercase ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Días de Despliegue Total</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Suma de todas las rutas activas</p>
                        </div>
                      </div>
                      <p className={`text-2xl font-black italic ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                        {quotationData.totalRouteDays} <span className="text-xs text-slate-500 not-italic uppercase">Días</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20 font-black italic">VAN</div>
                        <div>
                          <p className={`text-sm font-black italic uppercase ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Flota de Instalación</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Unidades con 2 técnicos por seguridad</p>
                        </div>
                      </div>
                      <p className={`text-2xl font-black italic ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                        {quotationData.routesCount} <span className="text-xs text-slate-500 not-italic uppercase">Rutas</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`${isLightMode ? 'bg-slate-50' : 'bg-white/5'} p-10 rounded-[3rem] border border-white/5 shadow-inner`}>
                  <div className="flex items-center gap-4 mb-6">
                    <span className="text-2xl">🛡️</span>
                    <h4 className={`text-xs font-black uppercase tracking-widest ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Protocolo de Seguridad Included</h4>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                      Todas las rutas de iamanos incluyen un esquema de seguridad de <span className="text-white font-black">DOBLE OPERADOR</span> para garantizar la integridad de la carga y el cumplimiento de cronogramas sin fatiga.
                    </p>
                    <ul className="grid grid-cols-2 gap-4 mt-6">
                      {['Hospedaje Business', 'Plan Alimenticio x2', 'Monitoreo GPS 24/7', 'Seguro de Cobertura'].map(item => (
                        <li key={item} className="flex items-center gap-3 text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            {/* Tarjeta de Valor Final */}
            <div className={`${isLightMode ? 'bg-slate-900 text-white shadow-3xl' : 'bg-blue-600 text-white shadow-[0_80px_160px_-40px_rgba(37,99,235,0.4)]'} p-16 md:p-24 rounded-[5rem] flex flex-col justify-between transform lg:rotate-1 relative overflow-hidden group col-span-1 lg:col-span-2 mt-10`}>
              <div className="absolute top-0 right-0 w-[60rem] h-[60rem] bg-white/10 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-50"></div>
              <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-black/20 blur-[100px] rounded-full translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

              <div className="relative space-y-20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-[0.5em] text-blue-100/60 mb-2">Presupuesto Ejecutado</p>
                    <h4 className="text-6xl md:text-7xl font-black uppercase italic tracking-tighter">Inversión Logística</h4>
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100/60 mb-2">Estatus Fiscal</p>
                    <p className="text-xs font-black uppercase italic tracking-widest bg-white/10 px-4 py-2 rounded-xl border border-white/10">Válido por 15 días</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                  <div className="space-y-6 p-10 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-md">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-200/60">Costo por Cuadrillas</p>
                    <div className="flex items-baseline gap-3">
                      <p className="text-5xl font-black italic tracking-tighter">${Math.round(quotationData.totalViaticos).toLocaleString()}</p>
                      <span className="text-xs font-black uppercase text-blue-200/60">MXN</span>
                    </div>
                    <p className="text-[10px] font-bold text-blue-100/40 uppercase tracking-widest leading-relaxed">Calculado a $2,000 diarios por cuadrilla activa</p>
                  </div>

                  <div className="space-y-6 p-10 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-md">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-200/60">Gastos de Ruta (Km)</p>
                    <div className="flex items-baseline gap-3">
                      <p className="text-5xl font-black italic tracking-tighter">${Math.round(quotationData.fuelCost).toLocaleString()}</p>
                      <span className="text-xs font-black uppercase text-blue-200/60">MXN</span>
                    </div>
                    <p className="text-[10px] font-bold text-blue-100/40 uppercase tracking-widest leading-relaxed">Gasolina, Desgaste, Casetas e Imprevistos ($15/km)</p>
                  </div>
                </div>

                <div className="pt-10 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-10">
                  <div>
                    <p className="text-[14px] font-black uppercase tracking-[0.5em] text-blue-100 mb-2 opacity-80">Total del Proyecto</p>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">IVA INCLUIDO (PROYECCIÓN FINAL)</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="text-4xl mt-6 font-black opacity-40">$</span>
                    <p className="text-[80px] md:text-[120px] leading-[0.85] font-black italic tracking-tighter drop-shadow-2xl">
                      {Math.round(quotationData.totalProjectValue).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mt-8 border-t border-white/10 pt-8">
                  <div>
                    <p className="text-[10px] font-bold text-blue-200/50 uppercase">Subtotal Operativo</p>
                    <p className="text-xl font-black">${Math.round(quotationData.subtotal).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase">Utilidad / Gestión (30%)</p>
                    <p className="text-xl font-black text-emerald-400">+ ${Math.round(quotationData.margin).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="mt-20 flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                    <span className="text-2xl">📜</span>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest max-w-xs leading-relaxed opacity-60">
                    Esta cotización incluye todos los gastos de traslado, alimentación y pernocta para el despliegue nacional a cargo de iamanos (2 instaladores por unidad).
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="bg-emerald-600 text-white px-12 py-8 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl hover:bg-emerald-500 transition-all flex items-center gap-4 active:scale-95 group z-50 relative"
                    >
                      {isExporting ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <span className="group-hover:-translate-y-1 transition-transform">📄</span>
                      )}
                      PDF / Entregables
                    </button>

                    {showExportMenu && (
                      <>
                        <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm" onClick={() => setShowExportMenu(false)}></div>
                        <div className="absolute bottom-full right-0 mb-4 w-96 bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 z-50 animate-in slide-in-from-bottom-4 zoom-in-95 duration-200">
                          <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 border-b border-slate-100 pb-2">Selecciona el Formato</h5>

                          <button
                            onClick={() => {
                              setShowExportMenu(false);
                              handleExportQuotationPDF('.pdf-page-exec', 'Propuesta_Ejecutiva');
                            }}
                            className="w-full text-left p-4 rounded-2xl hover:bg-slate-50 transition-colors flex items-center gap-4 group mb-2 border border-transparent hover:border-slate-200"
                          >
                            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl shadow-lg group-hover:scale-110 transition-transform">💎</div>
                            <div>
                              <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 uppercase">Propuesta Ejecutiva</p>
                              <p className="text-[10px] text-slate-400 font-medium">Resumen financiero de alto impacto. Ideal para Dirección.</p>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setShowExportMenu(false);
                              handleExportQuotationPDF('.pdf-page', 'Expediente_Tecnico');
                            }}
                            className="w-full text-left p-4 rounded-2xl hover:bg-slate-50 transition-colors flex items-center gap-4 group border border-transparent hover:border-slate-200"
                          >
                            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xl shadow-lg group-hover:scale-110 transition-transform">🛠</div>
                            <div>
                              <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 uppercase">Expediente Técnico</p>
                              <p className="text-[10px] text-slate-400 font-medium">Desglose operativo completo ruta por ruta.</p>
                            </div>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleApproveBudget}
                    className="bg-white text-blue-600 px-12 py-8 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl hover:scale-105 transition-all flex items-center gap-4 active:scale-95"
                  >
                    <span>📑</span> Aprobar Inversión
                  </button>
                </div>
              </div>
            </div>

            {/* Template Oculto para PDF Formal con Paginación Inteligente */}
            <div id="pdf-container" className="fixed left-[-9999px] top-0">

              {/* Lógica de Paginación (IIFE) */}
              {(() => {
                const MAX_PAGE_HEIGHT = 800;
                const BASE_ROUTE_HEADER = 160;
                const STOP_ROW_HEIGHT = 55;

                const pdfPages: any[][] = [];
                let currentPageRoutes: any[] = [];
                let currentPageHeight = 0;

                optimizedRoutes.forEach((route) => {
                  const totalRouteHeight = BASE_ROUTE_HEADER + (route.stops.length * STOP_ROW_HEIGHT);

                  // Caso 1: La ruta cabe completa en la página actual
                  if (currentPageHeight + totalRouteHeight < MAX_PAGE_HEIGHT) {
                    currentPageRoutes.push(route);
                    currentPageHeight += totalRouteHeight;
                  }
                  // Caso 2: La ruta es GIGANTE (Mayor que una página entera) -> Fracturar
                  else if (totalRouteHeight > MAX_PAGE_HEIGHT) {
                    // Si ya habia algo en la página actual, la cerramos
                    if (currentPageRoutes.length > 0) {
                      pdfPages.push(currentPageRoutes);
                      currentPageRoutes = [];
                      currentPageHeight = 0;
                    }

                    // Fracturar la ruta en chunks
                    // Fracturar la ruta en chunks
                    let remainingStops = [...route.stops];
                    let currentGlobalIndex = 0; // Trackear índice real
                    let part = 1;

                    while (remainingStops.length > 0) {
                      const availableHeight = MAX_PAGE_HEIGHT - BASE_ROUTE_HEADER;
                      const maxStops = Math.floor(availableHeight / STOP_ROW_HEIGHT);

                      const chunk = remainingStops.slice(0, maxStops);

                      const routePart = {
                        ...route,
                        stops: chunk,
                        isSplit: true,
                        part,
                        startIndex: currentGlobalIndex, // Guardar donde empieza
                        totalParts: Math.ceil(route.stops.length / maxStops)
                      };

                      pdfPages.push([routePart]);

                      remainingStops = remainingStops.slice(maxStops);
                      currentGlobalIndex += chunk.length; // Avanzar el índice
                      part++;
                    }
                  }
                  // Caso 3: La ruta cabe en una NUEVA página, pero no en la actual
                  else {
                    pdfPages.push(currentPageRoutes);
                    currentPageRoutes = [route];
                    currentPageHeight = totalRouteHeight;
                  }
                });

                // Empujar el último remanente
                if (currentPageRoutes.length > 0) {
                  pdfPages.push(currentPageRoutes);
                }

                return (
                  <>
                    {/* --- PÁGINA 1: PORTADA EJECUTIVA --- */}
                    <div className="pdf-page w-[800px] min-h-[1123px] bg-white text-slate-900 font-sans relative flex flex-col justify-between border border-gray-100">
                      {/* Fondo Corporativo Sutil */}
                      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-50 rounded-bl-full opacity-50 z-0 pointer-events-none"></div>

                      <div className="p-16 relative z-10 flex-1 flex flex-col">
                        {/* Header Portada */}
                        <div className="flex items-start justify-between border-b-4 border-[#CC0000] pb-8 mb-16">
                          <img src={targetLogo} alt="Target Logo" className="h-44 w-auto object-contain" />
                          <div className="text-right">
                            <h1 className="text-6xl font-black text-[#003399] uppercase tracking-tighter mb-2">Expediente</h1>
                            <p className="text-[#CC0000] font-bold text-xl uppercase tracking-[0.3em]">Propuesta Económica</p>
                            <p className="text-slate-400 text-sm mt-4 font-bold">{new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          </div>
                        </div>

                        {/* Card Principal */}
                        <div className="bg-[#003399] text-white p-12 rounded-[2rem] mb-16 shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16"></div>

                          <p className="text-blue-200 font-bold uppercase tracking-widest text-xs mb-2">Proyecto / Campaña</p>
                          <h2 className="text-4xl font-black italic uppercase tracking-tight mb-12 relative z-10">{projectName}</h2>

                          <div className="grid grid-cols-3 gap-10 border-t border-blue-800/50 pt-10 relative z-10">
                            <div>
                              <p className="text-[10px] text-blue-200 uppercase font-black tracking-widest mb-1">Cobertura</p>
                              <p className="text-3xl font-black italic">{new Set(optimizedRoutes.flatMap(r => r.stops.map(s => s.id))).size} <span className="text-sm font-normal text-blue-300 not-italic">Puntos</span></p>
                            </div>
                            <div>
                              <p className="text-[10px] text-blue-200 uppercase font-black tracking-widest mb-1">Logística</p>
                              <p className="text-3xl font-black italic">{quotationData.routesCount} <span className="text-sm font-normal text-blue-300 not-italic">Rutas</span></p>
                            </div>
                            <div>
                              <p className="text-[10px] text-blue-200 uppercase font-black tracking-widest mb-1">Duración</p>
                              <p className="text-3xl font-black italic">{quotationData.totalRouteDays} <span className="text-sm font-normal text-blue-300 not-italic">Días</span></p>
                            </div>
                          </div>
                        </div>

                        {/* Desglose Financiero */}
                        <div className="mb-8 bg-slate-50 p-10 rounded-3xl border border-slate-200">
                          <h3 className="text-sm font-black text-[#003399] uppercase tracking-widest mb-8 border-b border-slate-200 pb-4 flex items-center gap-3">
                            <span>📊</span> Desglose de Inversión
                          </h3>
                          <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-200">
                              <tr>
                                <td className="py-5 px-4 font-bold text-slate-700">Gastos Operativos de Ruta (Gasolina, Peajes - $15/km)</td>
                                <td className="py-5 px-4 text-right font-mono font-bold text-slate-900">${Math.round(quotationData.fuelCost).toLocaleString()}</td>
                              </tr>
                              <tr>
                                <td className="py-5 px-4 font-bold text-slate-700">Viáticos y Cuadrillas Técnicas ($2,000/día)</td>
                                <td className="py-5 px-4 text-right font-mono font-bold text-slate-900">${Math.round(quotationData.totalViaticos).toLocaleString()}</td>
                              </tr>
                              <tr>
                                <td className="py-5 px-4 font-bold text-emerald-600">Gestión Integral y Supervisión (Fee)</td>
                                <td className="py-5 px-4 text-right font-mono font-bold text-emerald-600">+ ${Math.round(quotationData.margin).toLocaleString()}</td>
                              </tr>
                            </tbody>
                            <tfoot className="border-t-2 border-slate-900">
                              <tr>
                                <td className="py-8 px-4 font-black uppercase text-xl text-[#003399]">Inversión Total</td>
                                <td className="py-8 px-4 text-right font-black text-4xl text-[#CC0000] italic">${Math.round(quotationData.totalProjectValue).toLocaleString()}</td>
                              </tr>
                            </tfoot>
                          </table>
                          <p className="text-right text-[9px] text-slate-400 mt-4 font-bold uppercase tracking-widest">* Precios más IVA • Moneda Nacional (MXN)</p>
                        </div>
                      </div>

                      {/* Footer Portada */}
                      <div className="bg-[#003399] p-8 text-white">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-blue-200/80 max-w-md font-medium">Propuesta válida por 15 días naturales. Sujeta a disponibilidad de equipos al momento de la confirmación.</p>
                          <p className="text-xs font-black uppercase tracking-widest">PÁGINA 1 DE {pdfPages.length + 2}</p>
                        </div>
                      </div>
                    </div>

                    {/* --- PÁGINAS DINÁMICAS DE RUTAS --- */}
                    {pdfPages.map((pageRoutes, pageIndex) => (
                      <div key={pageIndex} className="pdf-page w-[800px] min-h-[1123px] bg-white text-slate-900 font-sans relative flex flex-col justify-between border border-gray-200 overflow-hidden">

                        <div className="p-12 pb-0 flex-1">
                          {/* Header de Página */}
                          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-6 mb-10">
                            <div className="flex items-center gap-4">
                              <img src={targetLogo} className="h-14 object-contain" alt="Target" />
                              <div className="h-8 w-px bg-slate-200"></div>
                              <span className="text-[11px] uppercase font-bold tracking-[0.2em] text-slate-400">Expediente Técnico</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-black text-[#003399] uppercase tracking-widest">Detalle Operativo</span>
                              <span className="text-[10px] font-bold text-slate-400">Hoja {pageIndex + 1}</span>
                            </div>
                          </div>

                          {/* Contenedor de Rutas de la Página */}
                          <div className="space-y-10">
                            {pageRoutes.map((route, rIdx) => (
                              <div key={`${route.id}-${rIdx}`} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                {/* Route Header Corporativo */}
                                <div className="bg-[#0f172a] text-white px-8 py-5 flex items-center justify-between relative overflow-hidden">
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#CC0000]"></div>
                                  <div className="flex items-center gap-6 relative z-10">
                                    <div className="bg-white text-[#0f172a] text-lg font-black w-14 h-14 rounded-xl flex items-center justify-center shadow-lg">
                                      {String(route.id).replace(/\D/g, '')}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-3">
                                        <p className="text-lg font-bold uppercase tracking-wide">{route.driverName || 'Operador Asignado'}</p>
                                        {route.isSplit && (
                                          <span className="flex-shrink-0 bg-amber-500 text-black text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-widest shadow-md whitespace-nowrap">
                                            PARTE {route.part}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-400 uppercase font-medium mt-0.5">
                                        {route.isSplit ? 'Continuación de ruta...' : `${route.stops.length} Tiendas • ${route.direction || 'Ruta Nacional'}`}
                                      </p>
                                    </div>
                                  </div>

                                  {!route.isSplit && (
                                    <div className="text-right relative z-10">
                                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Total Ruta</p>
                                      <p className="text-2xl font-black text-white">{Math.round(route.totalKm).toLocaleString()} <span className="text-base font-normal text-slate-500">KM</span></p>
                                    </div>
                                  )}
                                </div>

                                {/* Tabla de Tiendas - Más Legible */}
                                <div className="p-4">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                                        <th className="py-3 pl-6 text-left w-12 font-bold">#</th>
                                        <th className="py-3 text-left font-bold">Punto de Venta</th>
                                        <th className="py-3 text-left font-bold">Ubicación / Ciudad</th>
                                        <th className="py-3 px-6 text-right font-bold">ID</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {route.stops.map((stop: any, sIdx: number) => (
                                        <tr key={sIdx} className="hover:bg-blue-50/50 transition-colors text-[11px] group">
                                          <td className="py-3 pl-6 text-slate-400 font-bold font-mono group-hover:text-blue-500">
                                            {(route.startIndex !== undefined ? route.startIndex : 0) + sIdx + 1}
                                          </td>
                                          <td className="py-3 font-bold text-slate-700 uppercase group-hover:text-slate-900">{stop.name_sitio}</td>
                                          <td className="py-3 text-slate-500 font-medium uppercase">{stop.city || stop.municipio || stop.estado}</td>
                                          <td className="py-3 px-6 text-right text-slate-400 font-mono text-[10px] bg-slate-50/50">{stop.site_id || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {route.isSplit && (
                                  <div className="bg-amber-50 px-6 py-2 text-[9px] font-bold text-amber-600 uppercase tracking-widest text-center border-t border-amber-100">
                                    Continúa en siguiente página...
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Footer Página */}
                        <div className="bg-slate-50 p-6 border-t border-slate-200 mt-auto">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-[0.2em]">Target Instalaciones POP • Confidential</p>
                            <p className="text-[10px] font-black text-[#003399]">PÁGINA {pageIndex + 2} DE {pdfPages.length + 2}</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* --- PÁGINA FINAL: FIRMAS --- */}
                    <div className="pdf-page w-[800px] min-h-[1123px] bg-white text-slate-900 p-20 font-sans relative flex flex-col justify-between border border-gray-100">
                      <div className="flex-1 flex flex-col justify-center">
                        <div className="flex items-center justify-center mb-16">
                          <img src={targetLogo} className="h-32 object-contain" alt="Target" />
                        </div>

                        <div className="text-center max-w-2xl mx-auto mb-20">
                          <h2 className="text-3xl font-black text-[#0f172a] uppercase tracking-tighter mb-8">Autorización de Proyecto</h2>
                          <div className="w-20 h-1 bg-[#CC0000] mx-auto mb-8"></div>
                          <p className="text-slate-500 text-sm leading-8 font-medium">
                            Al firmar este documento, el cliente confirma la aceptación de la propuesta económica y los términos de servicio.
                            La ejecución del proyecto <strong className="text-slate-900">"{projectName}"</strong> se programará inmediatamente tras la confirmación.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-24 px-8">
                          <div className="border-t-2 border-slate-900 pt-8 text-center">
                            <p className="text-sm font-black uppercase text-slate-900 mb-2">Target Instalaciones POP</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gerencia de Operaciones</p>
                          </div>
                          <div className="border-t-2 border-slate-900 pt-8 text-center">
                            <p className="text-sm font-black uppercase text-slate-900 mb-2">{projectName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Firma Autorizada</p>
                          </div>
                        </div>
                      </div>

                      <div className="text-center">
                        <p className="text-[9px] text-slate-300 uppercase font-black tracking-[0.5em] mb-4">Powered by OptiFlot™ AI Engine</p>
                        <p className="text-xs font-black text-[#003399] uppercase">PÁGINA FINAL</p>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* --- NUEVO TEMPLATE: PROPUESTA EJECUTIVA (HIGH IMPACT) --- */}
            <div id="pdf-executive-container" className="fixed left-[-9999px] top-0">
              {/* Página 1: Portada de Impacto */}
              <div className="pdf-page-exec w-[800px] min-h-[1123px] bg-[#0f172a] text-white p-0 font-sans relative flex flex-col overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-blue-900/20 to-transparent"></div>
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2"></div>

                <div className="relative z-10 p-24 h-full flex flex-col justify-between">
                  <div>
                    <img src={targetLogo} className="h-40 brightness-0 invert opacity-100 mb-16" alt="Target Logo" />
                    <p className="text-xl font-bold text-blue-400 uppercase tracking-[0.4em] mb-6">Propuesta Comercial</p>
                    <h1 className="text-7xl font-black uppercase leading-[0.9] tracking-tighter mb-4">
                      {projectName || 'Proyecto Nacional'}
                    </h1>
                    <div className="w-24 h-3 bg-red-600 mt-8 mb-12"></div>
                    <p className="text-2xl text-slate-400 font-light max-w-lg leading-relaxed">
                      Estrategia integral de despliegue y logística para cobertura nacional de puntos de venta.
                    </p>
                  </div>

                  <div>
                    <div className="border border-white/10 bg-white/5 backdrop-blur-sm p-10 rounded-3xl">
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Inversión Total Estimada</p>
                      <p className="text-8xl font-black tracking-tighter text-white">
                        <span className="text-4xl align-top opacity-50">$</span>{Math.round(quotationData.totalProjectValue).toLocaleString()}
                      </p>
                      <p className="text-right text-xs font-bold text-emerald-400 uppercase tracking-widest mt-4">IVA Incluido • Validez 15 Días</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Página 2: Resumen Ejecutivo y Firmas */}
              <div className="pdf-page-exec w-[800px] min-h-[1123px] bg-white text-slate-900 p-20 font-sans relative flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b-4 border-slate-900 pb-8 mb-16">
                    <h2 className="text-4xl font-black uppercase tracking-tighter">Resumen de Inversión</h2>
                    <img src={targetLogo} className="h-12 grayscale" alt="" />
                  </div>

                  <div className="grid grid-cols-2 gap-12 mb-16">
                    <div className="bg-slate-50 p-10 rounded-3xl">
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Alcance</p>
                      <div className="space-y-6">
                        <div>
                          <p className="text-4xl font-black text-slate-900">{new Set(optimizedRoutes.flatMap(r => r.stops.map(s => s.id))).size}</p>
                          <p className="text-xs font-bold text-slate-500 uppercase">Puntos de Venta</p>
                        </div>
                        <div>
                          <p className="text-4xl font-black text-slate-900">{optimizedRoutes.length}</p>
                          <p className="text-xs font-bold text-slate-500 uppercase">Rutas Logísticas</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-10 rounded-3xl">
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Métricas</p>
                      <div className="space-y-6">
                        <div>
                          <p className="text-4xl font-black text-blue-600">{Math.round(quotationData.totalKm).toLocaleString()} km</p>
                          <p className="text-xs font-bold text-slate-500 uppercase">Recorrido Total</p>
                        </div>
                        <div>
                          <p className="text-4xl font-black text-emerald-600">${Math.round(quotationData.fuelCost).toLocaleString()}</p>
                          <p className="text-xs font-bold text-slate-500 uppercase">Víaticos y Operación</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-between items-center py-4 border-b border-slate-100">
                      <p className="text-lg font-bold text-slate-600 uppercase">Costo Operativo Base</p>
                      <p className="text-xl font-bold text-slate-900">${Math.round(quotationData.subtotal).toLocaleString()}</p>
                    </div>
                    <div className="flex justify-between items-center py-4 border-b border-slate-100">
                      <p className="text-lg font-bold text-slate-600 uppercase">Gestión y Logística</p>
                      <p className="text-xl font-bold text-slate-900">${Math.round(quotationData.margin).toLocaleString()}</p>
                    </div>
                    <div className="flex justify-between items-center py-8 border-t-2 border-slate-900 mt-4">
                      <p className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Total Proyecto</p>
                      <p className="text-5xl font-black text-blue-600 tracking-tighter">${Math.round(quotationData.totalProjectValue).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-20">
                  <p className="text-center text-sm text-slate-500 mb-12 max-w-xl mx-auto leading-relaxed">
                    Esta propuesta representa un compromiso formal de servicio por parte de Target Instalaciones POP.
                  </p>
                  <div className="grid grid-cols-2 gap-20">
                    <div className="text-center">
                      <div className="h-px bg-slate-300 mb-4 w-3/4 mx-auto"></div>
                      <p className="text-xs font-black uppercase text-slate-900">Target Instalaciones POP</p>
                    </div>
                    <div className="text-center">
                      <div className="h-px bg-slate-300 mb-4 w-3/4 mx-auto"></div>
                      <p className="text-xs font-black uppercase text-slate-900">Cliente / Autorización</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )
      }

      {/* Route Editor Modal */}
      {
        showRouteEditor && optimizedRoutes.length > 0 && (
          <RouteEditor
            routes={optimizedRoutes}
            isLightMode={isLightMode}
            onRoutesUpdate={(updatedRoutes) => {
              setOptimizedRoutes(updatedRoutes);
              setUnsavedChanges(true);
              saveProject(sites, updatedRoutes, evidences, config);
            }}
            onClose={() => setShowRouteEditor(false)}
          />
        )
      }
    </div >
  );
};


export default RoutePlanner;
