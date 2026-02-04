# 🔍 ANÁLISIS COMPLETO: Botón "INICIAR LIMPIEZA & GIS"

## 📍 UBICACIÓN EN EL CÓDIGO
**Archivo:** `components/RoutePlanner.tsx`  
**Función:** `startCleaning()` (línea 755-814)  
**Botón:** Se activa en el **PASO 2** cuando tienes tiendas cargadas

---

## ⚙️ ¿QUÉ HACE ESTE BOTÓN? (Paso a Paso)

### **INICIO** (Líneas 756-761)
```typescript
setIsCleaning(true);    // ← Activa indicador de "Procesando..."
setError(null);         // ← Limpia errores previos
const updatedSites = [...sites];  // ← Copia las tiendas del estado
let processedCount = 0;  // ← Contador de tiendas procesadas
```

**¿Qué significa?**
- Toma las **220 tiendas** (o las que tenga tu archivo) que ya están en memoria
- Crea una copia para modificarlas sin afectar el original
- Prepara el contador

---

### **PROCESO PRINCIPAL** (Líneas 763-803)

El botón ejecuta un **BUCLE** que recorre **CADA UNA** de las 220 tiendas:

```typescript
for (let i = 0; i < updatedSites.length; i++) {
  const site = updatedSites[i];
```

#### **Para CADA tienda, hace lo siguiente:**

### **1. VALIDAR SI YA ESTÁ GEOCODIFICADA** (Línea 765)
```typescript
if (site.lat && site.lng && site.status === AddressStatus.OK) continue;
```

**¿Qué verifica?**
- ✅ ¿La tienda YA tiene latitud (lat)?
- ✅ ¿La tienda YA tiene longitud (lng)?
- ✅ ¿El status es "OK"?

**Si SÍ → La salta (no la procesa)**  
**Si NO → Continúa al siguiente paso**

---

### **2. CONSTRUIR DIRECCIÓN COMPLETA** (Línea 767)
```typescript
const cleanAddress = LogicEngine.deriveFullAddress(site);
```

**¿Qué hace?**
Toma los datos de la tienda:
- `direccion_completa`
- `colonia`
- `ciudad` (city)
- `estado` (state)
- `cp` (código postal)

Y construye una dirección limpia tipo:
```
"Av. Insurgentes 123, Col. Roma, Ciudad de México, CDMX, 06700"
```

---

### **3. GEOCODIFICAR CON GOOGLE MAPS** (Línea 768)
```typescript
const result = await googleMapsService.geocode(cleanAddress);
```

**🌍 AQUÍ SE CONECTA A GOOGLE MAPS API**

**¿Qué envía?**
- La dirección limpia construida arriba

**¿Qué recibe?**
```json
{
  "lat": 19.4326,
  "lng": -99.1332,
  "place_id": "ChIJ...",
  "formatted_address": "Av Insurgentes Sur 123...",
  "partial_match": false
}
```

**⚠️ IMPORTANTE:** 
- Si Google Maps no encuentra la dirección → `result = null`
- Si la encuentra parcialmente → `partial_match = true`
- Si la encuentra exacta → `partial_match = false`

---

### **4. VALIDACIÓN GEOGRÁFICA (REVERSE GEOCODING)** (Línea 773)
```typescript
const geoValidation = await googleMapsService.reverseGeocode(result.lat, result.lng);
```

**¿Qué hace?**
Toma las coordenadas que Google devolvió y **pregunta de nuevo**:
- "Oye Google, ¿qué dirección hay en lat 19.4326, lng -99.1332?"

**¿Para qué?**
Para verificar que las coordenadas coincidan con el estado que dice el archivo.

**Ejemplo:**
- Tu archivo dice: "Tienda en **CDMX**"
- Google geocodifica y da coordenadas
- Reverse geocoding verifica: "Estas coordenadas están en **CDMX**"
- ✅ Si coincide → OK
- ❌ Si no coincide → ERROR

---

### **5. VALIDAR ESTADO** (Líneas 779-786)
```typescript
const stateMatch = site.state && geoValidation.state &&
  (geoValidation.state.toUpperCase().includes(site.state.toUpperCase()) ||
   site.state.toUpperCase().includes(geoValidation.state.toUpperCase()));

if (!stateMatch) {
  status = AddressStatus.ERROR;
  notes = `DISCREPANCIA: El archivo dice ${site.state}, pero las coordenadas ubican en ${geoValidation.state}.`;
}
```

**¿Qué verifica?**
Compara:
- **Estado del archivo:** CDMX
- **Estado de Google:** Ciudad de México

Si NO coinciden → Marca ERROR

---

### **6. ACTUALIZAR LA TIENDA** (Líneas 789-798)
```typescript
updatedSites[i] = {
  ...updatedSites[i],
  lat: result.lat,              // ← Coordenadas de Google
  lng: result.lng,
  place_id: result.place_id,
  formatted_address: result.formatted_address,
  confidence_score: result.partial_match ? 0.6 : 1.0,
  status,
  notes
};
```

**¿Qué guarda?**
- ✅ Latitud y longitud (coordenadas GPS)
- ✅ ID de Google Maps (place_id)
- ✅ Dirección formateada por Google
- ✅ Confianza (0.6 si es parcial, 1.0 si es exacta)
- ✅ Status (OK, WARNING, ERROR)
- ✅ Notas explicativas

---

### **7. SI FALLA** (Líneas 799-802)
```typescript
} else {
  updatedSites[i].status = AddressStatus.ERROR;
  updatedSites[i].notes = 'No se pudo geocodificar (ERROR)';
}
```

**¿Cuándo pasa esto?**
- Google no encontró la dirección
- La API key está mal
- Error de red

---

### **FINAL** (Líneas 805-807)
```typescript
console.log("Limpieza terminada. Sitios procesados:", processedCount);
setSites(updatedSites);  // ← Guarda las 220 tiendas con coordenadas
setActiveStep(3);        // ← Avanza al paso 3 (Configuración)
```

---

## 🔍 **POSIBLE ORIGEN DEL PROBLEMA**

### **Escenario 1: No Modifica el Número de Tiendas**
```typescript
const updatedSites = [...sites];  // Copia las 220
// ... procesa cada una ...
setSites(updatedSites);  // Guarda las 220
```

**✅ CONCLUSIÓN:** Este botón **NO elimina tiendas**, solo las geocodifica.

### **Escenario 2: El Problema Está ANTES**
Si tu archivo tiene 220 tiendas pero después de presionar este botón solo ves 148, el problema está en:

**A) En `processFileRows` (cuando cargas el archivo)**
- Puede estar filtrando tiendas "inválidas"
- Puede estar deduplicando basado en ID o dirección

**B) En el conteo del Dashboard**
- Puede estar contando MAL (solucionado en nuestros fixes)

---

## 📊 **FLUJO COMPLETO**

```
1. Usuario carga archivo Excel
   ↓
2. processFileRows() lee filas
   ↓ (AQUÍ PUEDE FILTRAR/DEDUPLICAR)
3. setSites(validData)  ← Guarda X tiendas
   ↓
4. Usuario presiona "INICIAR LIMPIEZA & GIS"
   ↓
5. startCleaning() procesa TODAS las X tiendas
   ↓
6. Google Maps geocodifica cada una
   ↓
7. setSites(updatedSites)  ← Guarda las MISMAS X tiendas (con coordenadas)
   ↓
8. Avanza a PASO 3
```

---

## ⚠️ **DIAGNÓSTICO**

**Pregunta crítica:**
¿Cuántas tiendas muestra la app ANTES de presionar "INICIAR LIMPIEZA & GIS"?

**Si dice 220 ANTES:**
- El problema NO está en este botón
- El problema está en `generateSchedule()` (generación de rutas)

**Si dice 148 ANTES:**
- El problema está en `processFileRows()` (carga del archivo)
- Está filtrando/deduplicando 72 tiendas incorrectamente

---

## 🧪 **CÓMO VERIFICAR**

1. **Carga tu archivo de 220 tiendas**
2. **Abre consola (F12)**
3. **Antes de presionar el botón, escribe:**
   ```javascript
   console.log("Tiendas antes de limpiar:", sites.length);
   ```
4. **Presiona "INICIAR LIMPIEZA & GIS"**
5. **Cuando termine, escribe:**
   ```javascript
   console.log("Tiendas después de limpiar:", sites.length);
   ```

**Si los números son diferentes → El botón está eliminando tiendas (BUG)**  
**Si los números son iguales → El problema está en otro lado**

---

¿Quieres que pruebe eso ahora para confirmar dónde está el problema?
