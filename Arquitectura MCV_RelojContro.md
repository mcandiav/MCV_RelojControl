# Arquitectura MCV_RelojContro

## 1. Propósito

Este documento describe la arquitectura funcional y técnica del proyecto **MCV_RelojControl** (referenciado en este documento con el nombre solicitado **MCV_RelojContro**), con el objetivo de que el repositorio tenga una guía clara para desarrollo, mantenimiento y evolución.

El sistema está orientado a la **gestión de tiempos y órdenes de trabajo**, permitiendo:

- autenticación de usuarios
- administración de órdenes de trabajo
- control de ejecución por operarios
- registro de pausas e intervalos
- generación de reportes
- carga masiva de datos desde Excel

---

## 2. Visión general de la arquitectura

La solución sigue una arquitectura **cliente-servidor** separada en dos grandes módulos:

- **Frontend (`front/`)**
  - Aplicación SPA construida con **Vue.js** y **Vuetify**.
  - Responsable de la experiencia de usuario, navegación, visualización de datos y ejecución de acciones del negocio desde la interfaz.

- **Backend (`backend/`)**
  - API REST construida con **Node.js + Express**.
  - Responsable de autenticación, reglas de negocio, acceso a datos, reportes, carga de archivos y trazabilidad del trabajo.

- **Base de datos MSSQL**
  - Persistencia central del sistema.
  - Almacena usuarios, roles, órdenes, registros de ejecución, intervalos de tiempo, logs y datos históricos.

### Diagrama lógico simplificado

```text
[Usuario/Operario/Admin]
        |
        v
[Frontend Vue.js SPA]
        |
   HTTP + JSON
        |
        v
[Backend API Express]
        |
   Sequelize ORM
        |
        v
[Base de datos MSSQL]
```

---

## 3. Principios arquitectónicos

La arquitectura actual responde a los siguientes principios:

### 3.1 Separación de responsabilidades
- El frontend gestiona interacción, vistas, formularios y estado de UI.
- El backend concentra reglas de negocio, seguridad y persistencia.
- La base de datos mantiene el estado transaccional e histórico.

### 3.2 Centralización del negocio
Las operaciones críticas como iniciar, pausar, detener trabajo, consolidar registros, generar reportes o validar permisos deben residir en el backend.

### 3.3 Trazabilidad operativa
El sistema prioriza el registro histórico de eventos de trabajo mediante entidades como `Registry`, `TaskIntervals`, `Record`, `Finalized` y `Log`.

### 3.4 Evolución incremental
La estructura actual permite seguir extendiendo módulos sin reescribir la solución completa, aunque a futuro conviene fortalecer capas internas del backend.

---

## 4. Componentes principales

## 4.1 Frontend

### Responsabilidades
- login y navegación
- visualización de órdenes de trabajo
- acciones operativas: play, pause, stop
- administración de usuarios
- carga de archivos
- generación y descarga de reportes
- notificaciones globales

### Estructura relevante

```text
front/
  src/
    main.js
    App.vue
    components/
      alert/
      navegation/
      upload_file/
      user/
      work_order/
    router/
    store/
    views/
```

### Submódulos importantes

#### `src/store/`
Gestiona el estado global con Vuex.

- `auth.js`: sesión, token y datos del usuario.
- `order.js`: listado, búsqueda y estado de órdenes.
- `alert.js`: mensajes globales al usuario.

#### `src/router/`
Controla navegación y vistas principales.

#### `src/components/work_order/`
Es el núcleo funcional de la UI. Aquí viven los componentes que manipulan el ciclo de vida de la orden de trabajo.

### Patrón aplicado en frontend
Se observa una arquitectura típica SPA basada en:
- componentes reutilizables
- estado centralizado
- navegación desacoplada
- consumo de API mediante Axios

---

## 4.2 Backend

### Responsabilidades
- autenticación y autorización
- exposición de endpoints REST
- validaciones de negocio
- acceso a datos mediante ORM
- procesamiento de carga Excel
- generación de reportes
- auditoría básica de eventos

### Capas lógicas actuales
Aunque el proyecto está implementado como una API Node/Express tradicional, conceptualmente puede entenderse en estas capas:

```text
[Routes / Endpoints]
        |
[Controllers / lógica HTTP]
        |
[Servicios / reglas de negocio]
        |
[Modelos Sequelize]
        |
[SQL Server]
```

### Endpoints funcionales principales

#### Autenticación
- `POST /api/auth/signin`
- `POST /api/auth/signup`
- `POST /api/auth/signout`
- `GET /api/auth/me`
- gestión de usuarios

#### Órdenes
- CRUD de órdenes
- acciones de ejecución (`play`, `pause`, `stop`)
- consultas de operarios
- reportes
- detección y corrección de inconsistencias

#### Archivos
- `POST /api/files/upload`

### Tecnologías del backend
- Node.js
- Express.js
- Sequelize
- MSSQL
- JWT
- Bcrypt
- Multer
- XLSX

---

## 4.3 Base de datos

La base de datos es el núcleo de persistencia y trazabilidad. Las entidades más importantes son:

### `User`
Representa usuarios del sistema.
Relaciones con roles, puestos de trabajo y registros operativos.

### `Role`
Define perfil y permisos.

### `Workplace`
Representa el puesto de trabajo o centro operativo.

### `Data`
Contiene la información base o planificada de las órdenes de trabajo importadas.

### `Record`
Representa la orden activa en ejecución.

### `Finalized`
Conserva el histórico consolidado de órdenes terminadas.

### `Registry`
Log funcional de inicio y fin de una orden.

### `TaskIntervals`
Entidad clave para el control de tiempos reales, pausas y actividad del operario.

### `Log`
Registro de sesiones o actividad general del usuario.

### Tablas auxiliares
- `Count`
- `Discharged`

---

## 5. Flujos principales del sistema

## 5.1 Inicio de sesión

```text
Usuario -> Frontend -> API /api/auth/signin -> JWT -> Frontend
```

Resultado:
- el frontend almacena el token
- se habilitan vistas según rol
- se consume la API autenticada

## 5.2 Ejecución de una orden

```text
Operario -> Play/Pause/Stop en UI -> API /api/orders/... ->
actualización de Record / Registry / TaskIntervals -> persistencia en BD
```

Resultado:
- trazabilidad del trabajo
- control temporal real
- posibilidad de reportería posterior

## 5.3 Carga masiva desde Excel

```text
Admin -> Frontend -> upload archivo -> API /api/files/upload ->
parseo XLSX -> validación -> persistencia en Data/órdenes
```

## 5.4 Generación de reportes

```text
Usuario/Admin -> UI reportes -> API report -> consulta BD ->
consolidación -> descarga/exportación
```

---

## 6. Estilo arquitectónico

El sistema implementa un estilo **monolito distribuido por frontend + backend**, donde:

- el frontend es un cliente independiente
- el backend es un monolito de negocio con API REST
- la persistencia se centraliza en una sola base de datos

Este enfoque es correcto para el tamaño actual del sistema porque:
- simplifica despliegue
- reduce complejidad operativa
- facilita desarrollo por un equipo pequeño o mediano
- mantiene bajo costo de mantenimiento inicial

---

## 7. Despliegue actual

Según la documentación del repositorio:

### Frontend
- se compila con `npm run build`
- los artefactos generados en `dist/` se publican en:

```text
C:\inetpub\wwwroot
```

### Backend
- se ejecuta en un servidor Windows dentro de la red privada
- se administra con `pm2`
- el código backend se despliega reemplazando archivos en la carpeta correspondiente y reiniciando el proceso

### Base de datos
- alojada de forma separada y accesible por configuración en `backend/config/config.js`
- usa puerto típico de SQL Server (`1433`)

---

## 8. Riesgos y deuda técnica observable

A nivel arquitectónico, existen algunos puntos a vigilar:

### 8.1 Configuración sensible en archivo fuente
La configuración actual del backend se describe en `config.js`. Esto puede dificultar segregación de ambientes y manejo seguro de secretos.

**Recomendación:** migrar a variables de entorno por ambiente.

### 8.2 Diferencias de versiones Node frontend/backend
La documentación menciona versiones distintas de Node entre frontend y backend.

**Recomendación:** formalizar una matriz de compatibilidad o usar archivos `.nvmrc` por módulo.

### 8.3 Posible acoplamiento fuerte entre UI y endpoints
Si la lógica de pantallas depende de contratos no versionados, los cambios pueden romper operación.

**Recomendación:** documentar contrato API y estandarizar DTOs/respuestas.

### 8.4 Monolito backend sin capas explícitas fuertes
Aunque funcional, con el crecimiento del proyecto puede dificultar pruebas, mantenibilidad y evolución.

**Recomendación:** reforzar organización por dominios o módulos de aplicación.

### 8.5 Despliegue manual
El reemplazo manual de archivos en servidor puede introducir errores operativos.

**Recomendación:** avanzar hacia un pipeline de build y release controlado.

---

## 9. Recomendaciones de evolución

## 9.1 Corto plazo
- agregar este documento al índice del `README.md`
- documentar estructura real del backend por carpetas
- documentar contratos de endpoints
- centralizar variables de entorno
- definir convención de logs y manejo de errores

## 9.2 Mediano plazo
- separar servicios de negocio del código HTTP
- incorporar validaciones consistentes de entrada
- agregar pruebas unitarias y de integración
- normalizar respuestas API
- documentar modelo entidad-relación

## 9.3 Largo plazo
- evaluar modularización por dominios
- incorporar observabilidad básica
- automatizar despliegue
- incorporar versionado de API
- estudiar desacople de reportería pesada si crece el volumen

---

## 10. Propuesta de organización objetivo

Sin romper la solución actual, una evolución recomendable para backend sería:

```text
backend/
  src/
    modules/
      auth/
      orders/
      users/
      reports/
      files/
    shared/
      middleware/
      utils/
      config/
      errors/
    models/
```

Y para frontend:

```text
front/
  src/
    modules/
      auth/
      orders/
      reports/
      users/
    shared/
      components/
      services/
      store/
      utils/
```

Esto facilitaría:
- mantenibilidad
- reuso
- escalabilidad funcional
- trazabilidad del dominio

---

## 11. Decisiones arquitectónicas vigentes

1. **SPA en Vue.js** para productividad de interfaz y experiencia de uso fluida.
2. **API REST en Express** para exponer la lógica del negocio.
3. **Sequelize + MSSQL** como capa de persistencia relacional.
4. **JWT** para autenticación stateless.
5. **Carga Excel** como mecanismo de integración operacional.
6. **Modelo histórico con entidades activas y finalizadas** para trazabilidad del trabajo.

---

## 12. Resumen ejecutivo

**MCV_RelojContro** es un sistema de gestión de tiempos y órdenes de trabajo compuesto por un frontend SPA en Vue.js, un backend REST en Node.js/Express y una base de datos MSSQL.

Su fortaleza principal está en:
- la separación frontend/backend
- la trazabilidad operativa
- la capacidad de control temporal
- la reportería y carga masiva

Su principal oportunidad de mejora está en:
- fortalecer capas internas del backend
- profesionalizar configuración y despliegue
- documentar mejor contratos, modelos y decisiones técnicas

---

## 13. Ubicación recomendada del documento

Este archivo fue creado en la **raíz del repositorio** para que herramientas como **Cursor** lo detecten fácilmente junto al `README.md` principal.
