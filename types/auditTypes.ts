// 🔍 TIPOS PARA AUDITORÍA DE IMPORTACIÓN DE DATOS

export enum AuditStatus {
    OK = 'OK',
    NORMALIZADO = 'NORMALIZADO',
    DUPLICADO_MISMO_PLACE_ID = 'DUPLICADO_MISMO_PLACE_ID',
    DUPLICADO_COORDENADAS_IGUALES = 'DUPLICADO_COORDENADAS_IGUALES',
    DUPLICADO_POR_CERCANIA = 'DUPLICADO_POR_CERCANIA',
    DUPLICADO_TEXTO_DIRECCION_CP = 'DUPLICADO_TEXTO_DIRECCION_CP',
    NO_ENCONTRADO_EN_MAPS = 'NO_ENCONTRADO_EN_MAPS',
    DIRECCION_INCOMPLETA = 'DIRECCION_INCOMPLETA',
    DIRECCION_AMBIGUA = 'DIRECCION_AMBIGUA',
    COINCIDENCIA_BAJA_CONFIANZA = 'COINCIDENCIA_BAJA_CONFIANZA',
    CP_INVALIDO = 'CP_INVALIDO',
    CAMPOS_OBLIGATORIOS_FALTANTES = 'CAMPOS_OBLIGATORIOS_FALTANTES',
    ERROR_API = 'ERROR_API',
    EXCLUIDO_POR_USUARIO = 'EXCLUIDO_POR_USUARIO',
    PENDIENTE_REVISION = 'PENDIENTE_REVISION'
}

export enum FinalDecision {
    SE_QUEDA = 'SE_QUEDA',
    SE_FUSIONA = 'SE_FUSIONA',
    SE_EXCLUYE = 'SE_EXCLUYE',
    PENDIENTE = 'PENDIENTE'
}

export interface OriginalRowData {
    row_uid: string; // IMPORT_YYYYMMDD_HHMM_INDEX
    rowIndex: number;
    nombre: string;
    direccion: string;
    cp: string;
    ciudad: string;
    estado: string;
    raw_data: Record<string, any>; // Todos los campos originales
}

export interface ProcessedRowData {
    row_uid: string;
    nombre_normalizado: string;
    direccion_normalizada: string;
    cp_normalizado: string;
    ciudad_normalizada: string;
    estado_normalizado: string;
    lat?: number;
    lng?: number;
    place_id?: string;
    formatted_address?: string;
    confidence_score: number; // 0-1
    location_type?: string; // ROOFTOP, RANGE_INTERPOLATED, etc
    geocoding_error?: string;
}

export interface DuplicateInfo {
    duplicatedWith: string[]; // Array de row_uid duplicados
    duplicateType: 'PLACE_ID' | 'COORDINATES' | 'PROXIMITY' | 'TEXT';
    suggestedMainRow?: string; // row_uid de la fila principal sugerida
    distanceMeters?: number; // Para duplicados por cercanía
    similarity?: number; // 0-1 para similitud de texto
}

export interface TechnicalEvidence {
    place_id?: string;
    lat?: number;
    lng?: number;
    distancia_m?: number;
    confidence_score?: number;
    error_code?: string;
    api_response?: string;
}

export interface AuditEntry {
    row_uid: string;
    original: OriginalRowData;
    processed: ProcessedRowData;
    status: AuditStatus;
    status_final: FinalDecision;
    motivo_principal: string;
    motivos_secundarios: string[];
    explicacion_humana: string;
    evidencia_tecnica: TechnicalEvidence;
    recomendacion_correccion: string;
    duplicateInfo?: DuplicateInfo;
    userActions: UserAction[];
    isWhitelisted: boolean; // Usuario ignoró el duplicado
    timestamp: string;
}

export interface UserAction {
    action: 'CONSERVAR' | 'FUSIONAR' | 'EDITAR' | 'IGNORAR_DUPLICADO' | 'EXCLUIR';
    timestamp: string;
    mergeWith?: string; // row_uid si es fusión
    editedAddress?: string; // Nueva dirección si es edición
    reason?: string; // Razón de exclusión
}

export interface AuditSummary {
    totalOriginal: number;
    totalProcesado: number;
    totalFusionadas: number;
    totalExcluidas: number;
    totalPendientes: number;
    erroresCriticos: number;

    porcentajes: {
        seQueda: number;
        seFusiona: number;
        seExcluye: number;
        pendiente: number;
    };

    motivosRanking: Array<{
        motivo: string;
        count: number;
        percentage: number;
    }>;

    casosRepresentativos: Record<string, AuditEntry[]>;
}

export interface ImportAuditData {
    importId: string; // IMPORT_YYYYMMDD_HHMM
    timestamp: string;
    fileName: string;
    entries: AuditEntry[];
    summary: AuditSummary;
    isApproved: boolean;
    approvalTimestamp?: string;
}
