# Frontend - Sistema de Gestión de Tiempos Bignotti

Este repositorio contiene el código fuente del frontend para el Sistema de Gestión de Tiempos y Órdenes de Trabajo. La aplicación está desarrollada con **Vue.js** y la librería de componentes **Vuetify**, que proporciona la interfaz de usuario para que los operarios y administradores interactúen con el sistema.

## Características Principales

* **Interfaz Reactiva:** Construida como una Single-Page Application (SPA).
* **Autenticación:** Vistas de Login para el ingreso seguro de usuarios.
* **Visualización de Datos:** Tabla de datos principal para listar, buscar y filtrar las órdenes de trabajo.
* **Gestión de Órdenes:** Componentes modales para crear, editar y eliminar órdenes de trabajo.
* **Control de Tareas:** Botones interactivos (`Play`, `Pause`, `Stop`) para gestionar el ciclo de vida de cada tarea.
* **Reportes y Descargas:** Vistas dedicadas para generar y descargar reportes de actividad y cumplimiento en formato Excel.
* **Gestión de Usuarios (Admin):** Interfaz para la creación y administración de usuarios del sistema.
* **Notificaciones Globales:** Sistema de alertas para dar feedback al usuario sobre las acciones realizadas.

## Tecnologías Utilizadas

* **Vue.js:** Framework principal para la construcción de la interfaz.
* **Vuex:** Para la gestión centralizada del estado de la aplicación.
* **Vue Router:** Para la gestión de las rutas y la navegación.
* **Vuetify:** Librería de componentes de Material Design.
* **Axios:** Para realizar las peticiones HTTP al backend.
* **ExcelJS:** Para la generación de reportes en formato `.xlsx` del lado del cliente.
* **Moment.js:** Para el manejo y formato de fechas y horas.

## Puesta en Marcha

Sigue estos pasos para configurar y ejecutar el proyecto en un entorno de desarrollo local.

### **Prerrequisitos**

* **Node.js:** Se recomienda usar NVM (Node Version Manager). La versión requerida es:
    ```bash
    nvm use v10.24.1
    ```
* **npm**

### **Instalación**

1.  **Clona el repositorio:**
    ```bash
    git clone [https://github.com/tu-usuario/tu-repositorio.git](https://github.com/tu-usuario/tu-repositorio.git)
    cd tu-repositorio/frontend 
    ```
    *(Asegúrate de estar en la carpeta del frontend si estás usando un monorepo)*

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```

3.  **Configura las variables de entorno:**
    Crea un archivo `.env` en la raíz del proyecto de frontend para apuntar a la URL del backend.
    ```env
    # Archivo .env
    VUE_APP_API_URL=http://localhost:3000/api
    ```

4.  **Inicia el servidor de desarrollo:**
    ```bash
    npm run serve
    ```
    La aplicación estará disponible en `http://localhost:8080` (o el puerto que indique la terminal).
    Debes verificar que el backend esté corriendo para que la aplicación funcione correctamente. Además, en la linea 13 del archivo `src/main.js`, asegúrate de colocar la URL correcta del backend, de lo contrario el frontend no se podra comunicar con el backend.

5.  **Compila para producción:**
    ```bash
    npm run build
    ```
    Esto generará los archivos estáticos en la carpeta `dist/` listos para ser desplegados a wwwroot de windows, que es donde esta alojado el frontend.

## Estructura del Proyecto

A continuación se describe la función de las carpetas y archivos más importantes del proyecto.

* `public/`
    Contiene el archivo `index.html` principal y los recursos estáticos que no son procesados por Webpack, como el `favicon.ico`.

* `src/`
    Es la carpeta principal que contiene todo el código fuente de la aplicación Vue.

* `src/main.js`
    El punto de entrada de la aplicación. Aquí se inicializa Vue, Vuex, Vue Router y Vuetify.

* `src/App.vue`
    El componente raíz de la aplicación que contiene la estructura principal de la interfaz, como la barra de navegación y el contenedor para las vistas.

* `src/assets/`
    Almacena los recursos estáticos locales como imágenes y logos que serán procesados por Webpack.

* `src/components/`
    Contiene todos los componentes reutilizables de la aplicación, organizados por funcionalidad.
    * `alert/`: Componentes para mostrar notificaciones o alertas globales.
    * `navegation/`: Componentes de la navegación principal, como la barra superior (`appbar.vue`).
    * `upload_file/`: Componentes para la carga de archivos, como el Excel de OTs.
    * `user/`: Componentes relacionados con la gestión de usuarios (formularios de creación, edición, etc.).
    * `work_order/`: **El directorio más importante.** Contiene todos los componentes relacionados con las órdenes de trabajo.
        * `tableData.vue`: La tabla principal que muestra, filtra y pagina las OTs.
        * `playButton.vue`, `pauseButton.vue`, `stopButton.vue`: Botones de acción para controlar el estado de una tarea.
        * `createOrder.vue`, `editButton.vue`, `deleteButton.vue`: Componentes para las operaciones CRUD sobre las OTs.
        * `listWorkers.vue`, `report.vue`, `timerReport.vue`: Componentes modales para generar y visualizar reportes.
        * `bkup/`: Esta carpeta parece ser un respaldo de componentes antiguos. Se podría considerar eliminarla para mantener el código limpio.

* `src/plugins/`
    Archivos de configuración para los plugins de Vue, como `vuetify.js`.

* `src/router/`
    Contiene la configuración de las rutas de la aplicación. `index.js` define qué componente se renderiza para cada URL (ej. `/`, `/login`).

* `src/store/`
    Configuración del store de **Vuex** para la gestión del estado global.
    * `auth.js`: Gestiona el estado de autenticación, el token y los datos del usuario.
    * `order.js`: Maneja el estado de las órdenes de trabajo, como la lista principal, búsquedas y filtros.
    * `alert.js`: Controla el estado de las notificaciones globales.

* `src/views/`
    Contiene los componentes de página principales que son renderizados por Vue Router.
    * `Home.vue`: La vista principal después de iniciar sesión, que usualmente contiene la tabla de órdenes.
    * `Login.vue`: La vista para el inicio de sesión.
    * `NotFound.vue`: Página que se muestra cuando una ruta no existe.