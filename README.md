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

Configura las variables para la correcta conexión a la base de datos desde el archivo `./backend/config/config.js`. Asegúrate de ajustar los valores según tu entorno local:

```json
module.exports = {
    // Configuración token login
    SECRET: "api-secret-",
    // Configuración base de datos.
    HOST: "localhost",
    PORT: 1433, // Puerto predeterminado para SQL Server
    USER: "user_bdd",
    PASSWORD: "pass_bdd",
    DB: "databse",
    dialect: "mssql", // Indica que estás utilizando SQL Server

    // Clave para eliminar recursos.
    DELETE_SECRET: "b1234", // Asumo que DELETE_SECRET es diferente de SECRET
}
```

Debes tener acceso al servidor de base de datos con las tablas necesarias (pedir credenciales al administrador del sistema). Si quieres hacer pruebas, idealmente tener una base de datos local.

Finalmente, dentro de backend puedes ejecuta el servidor:

```bash
npm run dev
```

Deberías ver un log indicando que la base de datos fue leida correctamente, de lo contrario, revisa la configuración de la base de datos.

#### 2. Configurar el Frontend

Navega a la carpeta del frontend:

```bash
cd front
```

Instala las dependencias:

```bash
npm install
```

Una vez instalado, sigue los pasos indicados en el archivo `front/README.md` para configurar y ejecutar el frontend.

Finalmente, inicia el servidor de desarrollo del frontend:

```bash
npm run serve
```

Deberías ver un login en la URL que te indica vuejs.

---

## Ejecutar la Aplicación

### Terminal 1: Iniciar el Backend

```bash
cd backend
npm run dev
```

El servidor de la API debería estar corriendo en `http://localhost:3000`. Al arrancar por primera vez, Sequelize creará automáticamente las tablas en la base de datos configurada. Para ello, es necesario contar con una base de datos local (o remota).

Dentro de backend hay archivos con datos de prueba para insertar usuarios y órdenes de trabajo (OTs) en la base de datos (`./src/libs`). Pero, idealmente, descargar una muestra de la base de datos desde el servidor de producción.

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

El backend se ejecuta utilizando `pm2`. Para más información sobre `pm2`, consulta la [documentación oficial](https://pm2.keymetrics.io/docs/usage/quick-start/).

----

Para aplicar modificaciones en el frontend de producción, primero debes
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
