# Sistema de Gestión de Tiempos - Bignotti

Este repositorio contiene el código fuente completo para el **Sistema de Gestión de Tiempos**, una aplicación **full-stack** diseñada para la administración y seguimiento en tiempo real de órdenes de trabajo (OTs) en un entorno de producción.

---
## Arquitectura del Proyecto

El repositorio está dividido en dos carpetas principales:

- **/backend/**: Una API RESTful construida con Node.js y Express. Se encarga de la lógica de negocio, la gestión de la base de datos con Sequelize y la autenticación de usuarios.
- **/frontend/**: Una Single-Page Application (SPA) construida con Vue.js y Vuetify. Proporciona la interfaz de usuario para que administradores y operarios interactúen con el sistema.

---

## Stack de Tecnologías

### Backend
- Node.js (v16.16.0)
- Express.js
- Sequelize (ORM para bases de datos SQL)
- PostgreSQL (o cualquier base de datos compatible con Sequelize)
- JSON Web Tokens (JWT) para autenticación
- Bcrypt-nodejs para encriptación de contraseñas

### Frontend
- Vue.js
- Vuex para la gestión de estado
- Vue Router para el enrutamiento
- Vuetify como librería de componentes de UI
- Axios para las peticiones a la API
- ExcelJS y Moment.js para el manejo de reportes y fechas

---

## Puesta en Marcha (Entorno de Desarrollo)

Para ejecutar el proyecto completo localmente, necesitas tener ambos servicios (backend y frontend) corriendo simultáneamente.

### Prerrequisitos
- Node.js: Se requiere la versión **v16.16.0**. Se recomienda usar **NVM** (Node Version Manager) para gestionar la versión:

```bash
nvm install 16.16.0
nvm use 16.16.0
```

- npm (versión 8.11.0 o compatible)
- Servidor de Base de Datos: Una instancia de PostgreSQL (o compatible) debe estar instalada y corriendo.
- Base de Datos Creada: Debes crear manualmente una base de datos vacía. Por defecto, el backend buscará una llamada **timer_db**.

### Instalación y Configuración

Desde la raíz del repositorio:

#### 1. Configurar el Backend

Navega a la carpeta del backend:

```bash
cd backend
```

Instala las dependencias:

```bash
npm install
```

Crea un archivo `.env` a partir del ejemplo y configúralo con los datos de tu base de datos:

```env
# backend/.env
PORT=3000
SECRET=tu_secreto_para_jwt
DB_USER=postgres
DB_PASSWORD=tu_contraseña
DB_HOST=localhost
DB_NAME=timer_db
DB_PORT=5432
```

#### 2. Configurar el Frontend

Navega a la carpeta del frontend:

```bash
cd front
```

Instala las dependencias:

```bash
npm install
```

Crea un archivo `.env` para apuntar a la URL del backend:

```env
# front/.env
VUE_APP_API_URL=http://localhost:3000/api
```

---

## Ejecutar la Aplicación

### Terminal 1: Iniciar el Backend

```bash
cd backend
npm start
```

El servidor de la API debería estar corriendo en `http://localhost:3000`. Al arrancar por primera vez, Sequelize creará automáticamente las tablas en la base de datos configurada.

### Terminal 2: Iniciar el Frontend

```bash
cd front
npm run serve
```

La aplicación web estará disponible en `http://localhost:8080`.

---

## Estructura de Componentes y Modelos

Para una descripción detallada de la estructura interna, los modelos de la base de datos y los componentes de Vue, consulta los archivos `README.md` específicos dentro de cada carpeta.

* backend readme: `backend/README.md` ([Ver aquí](./backend/README.md))
* frontend readme: `frontend/README.md` ([Ver aquí](./front/README.md))

## Donde se encuentra alojado el proyecto

El proyecto está alojado en un servidor privado dentro de la red de la empresa.
El frontend y el backend se encuentran en `C:\Users\cstears\Desktop\timer`. Para hacer modificaciones del backend, basta con reemplazar los archivos en la carpeta `backend` y reiniciar el proceso (idealmente cambiar solo los archivos que modificas).

Para aplicar modificaciones en el frontend en producción, primero debes
ejecutar el comando:

```bash
npm run build
```

Es recomendable realizar este proceso en tu máquina local. Esto generará los archivos estáticos necesarios, los cuales se encontrarán en la carpeta `dist`.

Luego, debes reemplazar dichos archivos en el servidor de producción, en la ruta:

```bash
C:\inetpub\wwwroot
```

Finalmente, para visualizar correctamente los cambios en todos los
entornos de la empresa, puede ser necesario limpiar la caché del
navegador utilizando la combinación de teclas `Ctrl + F5` (en cada computador).
