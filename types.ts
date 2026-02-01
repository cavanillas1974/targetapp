export enum AddressStatus {
  OK = 'OK',
  MISSING_DATA = 'Datos incompletos',
  AMBIGUOUS = 'Ambigua',
  NO_GEOCODE = 'No geocodifica',
  PENDING = 'Pendiente',
  HUMAN_REVIEW = 'Revisión Humana',
  ERROR = 'Error Crítico',
  WARNING = 'WARNING'
}

export enum CapacityStatus {
  SUFFICIENT = 'SUFFICIENT',
  INSUFFICIENT = 'INSUFFICIENT'
}

export enum RoutesMode {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL'
}

export enum ProgressionMode {
  RADIAL = 'RADIAL',
  CORRIDOR = 'CORRIDOR'
}

export enum RouteMode {
  CIRCULAR = 'CIRCULAR', // Regreso a base
  LINEAR = 'LINEAR'      // Termina en última tienda
}

export interface Depot {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  routes_count: number;
  color: string;
}

export interface SiteRecord {
  id: string; // Internal UUID
  site_id: string; // Columna ID_TIENDA
  name_sitio: string; // Columna NOMBRE_TIENDA
  marca: string;
  region: string;
  ranking?: string;
  city: string;
  state: string;
  municipio: string;
  cp: string;
  colonia: string;
  direccion_completa: string;
  full_address_derived: string;

  // Geocoding Data
  lat?: number;
  lng?: number;
  place_id?: string;
  formatted_address?: string;
  confidence_score: number; // 0-1

  status: AddressStatus;
  notes?: string;

  // Logic fields
  depotId?: string;
  routeId?: string;
  sequence?: number;
  date?: string;
  locked?: boolean;

  // Planning fields (Misión AntiGravity)
  scheduled_date?: string;
  stop_in_day?: number;
  day_in_project?: number;
  sequence_in_route?: number;

  // Metrics fields
  km_day_total?: number;
  minutes_travel_day_total?: number;
  minutes_service_day_total?: number;
  minutes_day_total?: number;
  day_status?: 'OK' | 'OVERTIME';

  raw_data?: Record<string, string>; // Preserva todas las columnas originales del CSV
}

export interface Route {
  id: string;
  depotId: string;
  driverName: string;
  secondaryDriverName: string;
  color: string;
  stops: SiteRecord[];
  totalKm: number;
  estTimeMinutes: number;
  date?: string;
}

export interface PlannerConfig {
  startDate: string;
  endDate: string;
  workDays: number[]; // 0-6 (0 is Sunday)
  nonWorkingDays: number[];
  stopsPerDayPerRoute: number;
  routesMode: RoutesMode;
  plannerMode?: 'AI' | 'MANUAL';
  routeMode: RouteMode;
  progressionMode: ProgressionMode;
  dailyReturnToDepot: boolean;
  corridorTarget?: { lat: number, lng: number, name: string };
  routesTotalManual?: number;
  avgServiceMinutesPerStop: number;
  bufferMinutesPerDay: number;
}

export interface ProjectCapacity {
  status: CapacityStatus;
  workingDaysCount: number;
  totalRoutes: number;
  totalCapacity: number;
  totalStores: number;
  unassignedStores: number;
  extraRoutesNeeded: number;
}

export interface SavedEvidence {
  id: string;
  siteId: string;
  siteName: string;
  driverName: string;
  photoBefore?: string;
  photoAfter?: string;
  signature?: string;
  timestamp: string;
  gps?: { lat: number; lng: number };
  comments: string;
  checklist: {
    limpieza: boolean;
    nivelado: boolean;
    materialRecibido: boolean;
    evidenciaInstalacion: boolean;
  };
}

export interface Evidence {
  id: string;
  store_job_id: string;
  route_id: string;
  file_type: 'photo' | 'video' | 'pdf';
  category: 'EVIDENCIA_INSTALACION' | 'EVIDENCIA_MANTENIMIENTO' | 'EVIDENCIA_ENTREGA' | 'ACUSE_RECIBIDO';
  uploaded_by: string;
  uploaded_at: string;
  notes?: string;
  file_url: string;
  checksum: string;
  status: 'UPLOADED' | 'APPROVED' | 'REJECTED';
}

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  totalSites: number;
  totalRoutes: number;
  status: 'PLANNING' | 'EXECUTING' | 'COMPLETED' | 'APPROVED';
}

export interface Project {
  metadata: ProjectMetadata;
  sites: SiteRecord[];
  config: PlannerConfig;
  optimizedRoutes: Route[];
  evidences: Evidence[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// ============ TIPOS PARA MOTOR DE CORREDORES ============

export interface RouteHub {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  isDefault?: boolean;
}

export interface OvernightLocation {
  name: string;
  lat: number;
  lng: number;
  nearestCity: string;
  distanceToNextStore: number;
  reason: string;
}

export interface ScheduledDayInfo {
  dayNumber: number;
  date: string;
  storeCount: number;
  kmTotal: number;
  minutesTotal: number;
  overnightLocation?: OvernightLocation;
  startCity: string;
  endCity: string;
}

export interface CorridorInfo {
  id: string;
  name: string;
  direction: string;
  region: string;
  storeCount: number;
}

export interface ExtendedRoute extends Route {
  corridorId?: string;
  corridorName?: string;
  direction?: string;
  hub?: RouteHub;
  scheduledDays?: ScheduledDayInfo[];
}
