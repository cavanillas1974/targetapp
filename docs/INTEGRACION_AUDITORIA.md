# 🚀 GUÍA DE INTEGRACIÓN: Sistema de Auditoría de Importación

## ✅ ARCHIVOS CREADOS

### 1. **Tipos** (`types/auditTypes.ts`)
- `AuditStatus` (15 estados diferentes)
- `FinalDecision` (SE_QUEDA, SE_FUSIONA, SE_EXCLUYE, PENDIENTE)
- `OriginalRowData`, `ProcessedRowData`, `AuditEntry`
- `ImportAuditData`, `AuditSummary`

### 2. **Utilidades**
- `utils/duplicateDetectionEngine.ts` - Motor de 4 niveles de detección
- `utils/importAuditProcessor.ts` - Procesador y generador de auditorías

### 3. **Componentes**
- `components/DataAuditScreen.tsx` - Pantalla principal de auditoría

---

## 🔧 INTEGRACIÓN EN `RoutePlanner.tsx`

### **Paso 1: Agregar imports**

```typescript
import { ImportAuditProcessor } from '../utils/importAuditProcessor';
import { ImportAuditData } from '../types/auditTypes';
import { DataAuditScreen } from './DataAuditScreen';
```

### **Paso 2: Agregar estados**

```typescript
const [auditData, setAuditData] = useState<ImportAuditData | null>(null);
const [showAuditScreen, setShowAuditScreen] = useState(false);
```

### **Paso 3: Modificar `processFileRows`**

**ANTES (línea ~700):**
```typescript
setSites(data);
saveProject(data, [], [], config);
setActiveStep(2);
```

**DESPUÉS:**
```typescript
// Generar auditoría ANTES de guardar
const audit = await ImportAuditProcessor.processImport(data, fileInput?.files?.[0]?.name || 'archivo.xlsx');
setAuditData(audit);
setShowAuditScreen(true);
// NO avanzar al paso 2 aún
```

### **Paso 4: Agregar handler de aprobación**

```typescript
const handleAuditApproval = (approvedData: ImportAuditData) => {
  // Filtrar solo las tiendas que SE_QUEDAN
  const finalSites = approvedData.entries
    .filter(e => e.status_final === FinalDecision.SE_QUEDA)
    .map(e => {
      // Reconstruir SiteRecord desde AuditEntry
      return {
        ...e.original.raw_data,
        lat: e.processed.lat,
        lng: e.processed.lng,
        place_id: e.processed.place_id,
        formatted_address: e.processed.formatted_address,
        confidence_score: e.processed.confidence_score
      } as SiteRecord;
    });

  console.log(`✅ Aprobadas ${finalSites.length} de ${approvedData.entries.length} tiendas`);
  
  setSites(finalSites);
  saveProject(finalSites, [], [], config);
  setShowAuditScreen(false);
  setActiveStep(2); // AHORA SÍ avanzar
};

const handleAuditCancel = () => {
  setShowAuditScreen(false);
  setAuditData(null);
  // Volver a paso de carga de archivo
};
```

### **Paso 5: Agregar condicional en el render**

```typescript
// ANTES del return principal de RoutePlanner
if (showAuditScreen && auditData) {
  return (
    <DataAuditScreen
      auditData={auditData}
      onApprove={handleAuditApproval}
      onCancel={handleAuditCancel}
    />
  );
}

// ... resto del código normal de RoutePlanner
```

---

## 🎯 FLUJO COMPLETO

```
1. Usuario sube Excel
   ↓
2. Se ejecuta processFileRows()
   ↓
3. Se normaliza y geocodifica TODAS las filas
   ↓
4. ImportAuditProcessor.processImport()
   ↓
5. Se muestra DataAuditScreen (nueva pantalla)
   ↓
6. Usuario revisa:
   - Duplicados detectados
   - Errores de geocodificación
   - Normalizaciones
   ↓
7. Usuario decide:
   - Fusionar duplicados
   - Conservar/Excluir tiendas
   - Editar direcciones
   ↓
8. Usuario presiona "Aprobar para Cronograma"
   ↓
9. Solo tiendas con status_final = SE_QUEDA pasan
   ↓
10. Se guarda proyecto con tiendas finales
   ↓
11. Avanza al paso 2 (Limpieza/GIS)
```

---

## 📊 EXPORTACIÓN (Fase 3 - Pendiente)

### **Excel Comparativo**

```typescript
import * as XLSX from 'xlsx';

const exportExcelComparison = (auditData: ImportAuditData) => {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Original
  const originalData = auditData.entries.map(e => ({
    ID: e.row_uid,
    Nombre: e.original.nombre,
    Dirección: e.original.direccion,
    CP: e.original.cp,
    Ciudad: e.original.ciudad,
    Estado: e.original.estado
  }));
  const ws1 = XLSX.utils.json_to_sheet(originalData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Original');

  // Hoja 2: Procesado
  const processedData = auditData.entries.map(e => ({
    ID: e.row_uid,
    Nombre_Normalizado: e.processed.nombre_normalizado,
    Dirección_Normalizada: e.processed.direccion_normalizada,
    Lat: e.processed.lat,
    Lng: e.processed.lng,
    Place_ID: e.processed.place_id,
    Confianza: e.processed.confidence_score
  }));
  const ws2 = XLSX.utils.json_to_sheet(processedData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Procesado');

  // Hoja 3: Decisiones
  const decisionsData = auditData.entries.map(e => ({
    ID: e.row_uid,
    Status: e.status,
    Decisión: e.status_final,
    Motivo: e.motivo_principal,
    Explicación: e.explicacion_humana,
    Recomendación: e.recomendacion_correccion
  }));
  const ws3 = XLSX.utils.json_to_sheet(decisionsData);
  XLSX.utils.book_append_sheet(wb, ws3, 'Decisiones');

  XLSX.writeFile(wb, `Auditoria_${auditData.importId}.xlsx`);
};
```

### **PDF Ejecutivo** (Usar tu sistema de PDF existente)

```typescript
const exportPDFReport = (auditData: ImportAuditData) => {
  // Crear sección de reporte ejecutivo
  const reportElement = document.getElementById('audit-summary-export');
  // Usar tu lógica de html2canvas + jsPDF existente
};
```

---

## 🔒 CONTROL DE CALIDAD (Gating)

### **Errores Críticos que Bloquean**

```typescript
const CRITICAL_STATUSES = [
  AuditStatus.NO_ENCONTRADO_EN_MAPS,
  AuditStatus.DIRECCION_INCOMPLETA,
  AuditStatus.CAMPOS_OBLIGATORIOS_FALTANTES,
  AuditStatus.CP_INVALIDO
];

const canApprove = auditData.entries.filter(e =>
  CRITICAL_STATUSES.includes(e.status) &&
  e.status_final !== FinalDecision.SE_EXCLUYE
).length === 0;
```

**Mensaje al usuario:**
```
⚠️ No puedes aprobar hasta resolver:
- 15 direcciones no encontradas en Maps
- 8 códigos postales inválidos
- 3 campos obligatorios faltantes

Opciones:
1. Corregir las direcciones
2. Marcar como "Excluir del cronograma"
```

---

## 🎨 PERSONALIZACIÓN

### **Colores de Badges**

Edita en `getStatusBadge()`:
```typescript
[AuditStatus.OK]: { color: 'bg-green-500', text: 'OK' },
[AuditStatus.DUPLICADO_MISMO_PLACE_ID]: { color: 'bg-yellow-500', text: 'DUP: PLACE_ID' },
```

### **Umbrales de Detección**

Edita en `duplicateDetectionEngine.ts`:
```typescript
// Cambiar distancia de cercanía (default: 30m)
detectDuplicatesByProximity(entries, 50) // 50 metros

// Cambiar similitud de texto (default: 0.7)
if (nameSimilarity > 0.8 || addressSimilarity > 0.7)
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Copiar archivos creados al proyecto
- [ ] Agregar imports en `RoutePlanner.tsx`
- [ ] Agregar estados `auditData` y `showAuditScreen`
- [ ] Modificar `processFileRows` para generar auditoría
- [ ] Agregar handlers `handleAuditApproval` y `handleAuditCancel`
- [ ] Agregar condicional de render
- [ ] Probar con archivo de 220 tiendas
- [ ] Verificar detección de duplicados
- [ ] Verificar gating (errores críticos)
- [ ] Implementar es exportación Excel (opcional)
- [ ] Implementar exportación PDF (opcional)

---

## 🧪 PRUEBAS

### **Caso 1: Archivo sin duplicados**
```
Input: 100 tiendas únicas
Esperado: 100 SE_QUEDA, 0 SE_FUSIONA, 0 errores críticos
```

### **Caso 2: Archivo con duplicados por place_id**
```
Input: Tienda A (place_id: ABC) + Tienda B (place_id: ABC)
Esperado: A = SE_QUEDA, B = SE_FUSIONA con A
```

### **Caso 3: Direcciones incompletas**
```
Input: "Calle", sin número
Esperado: DIRECCION_INCOMPLETA, no puede aprobar hasta corregir
```

### **Caso 4: CP inválido**
```
Input: CP = "ABC123" o "1234" (no 5 dígitos)
Esperado: CP_INVALIDO, badge rojo, bloquea aprobación
```

---

¿Listo para integrar? Dime si quieres que continúe con la exportación o ajustes adicionales.
