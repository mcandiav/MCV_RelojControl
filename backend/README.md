# Sistema de Gestión de Tiempos (Bignotti)

Este repositorio contiene el backend para el **Sistema de Gestión de Tiempos y Órdenes de Trabajo**.  
La aplicación está construida con **Node.js** y **Express**, y se encarga de gestionar usuarios, órdenes de trabajo (OTs), el seguimiento del tiempo de los operarios y la generación de reportes.

Las versiones instaladas y probadas son:
- Node.js v16.16.1
- npm v6.14.12
---

## Tabla de Contenidos

- [Características Principales](#características-principales)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Puesta en Marcha](#puesta-en-marcha)
  - [Prerrequisitos](#prerrequisitos)
  - [Instalación](#instalación)
- [Modelos de Base de Datos](#modelos-de-base-de-datos)
- [API Endpoints](#api-endpoints)
  - [Autenticación](#autenticación-apiauth)
  - [Órdenes de Trabajo](#órdenes-de-trabajo-apiorders)
  - [Carga de Archivos](#carga-de-archivos-apifiles)

---

## Características Principales

- **Autenticación y Autorización**  
  Registro e inicio de sesión con **JWT**, roles de usuario (Administrador y Operario) y contraseñas encriptadas.

- **Gestión de Órdenes (CRUD)**  
  Creación, lectura, actualización y eliminación de órdenes de trabajo.

- **Control de Tiempo**  
  Los operarios pueden iniciar, pausar y detener el trabajo, registrando intervalos precisos para cada etapa (montaje, ejecución, pausa).

- **Carga Masiva de Datos**  
  Importación de órdenes de trabajo mediante archivos **Excel (.xlsx)**.

- **Generación de Reportes**  
  Cumplimiento, productividad y control de tiempo.

- **Gestión de Usuarios**  
  Administración de usuarios, roles y puestos de trabajo.

---

## Tecnologías Utilizadas

- **Node.js** – Entorno de ejecución JavaScript.
- **Express.js** – Framework para la API REST.
- **Sequelize** – ORM para la base de datos (**MSSQL**).
- **Bcrypt-nodejs** – Encriptación de contraseñas.
- **JWT (JSON Web Token)** – Seguridad y sesiones.
- **Multer** – Middleware para subida de archivos.
- **XLSX** – Lectura y procesamiento de archivos Excel.

---

## Puesta en Marcha

### Prerrequisitos

- Node.js (se recomienda usar **NVM** para instalar las diferentes versiones de node).
- npm.
- Una base de datos SQL (mssql).
- Acceso al servidor de base de datos con las tablas necesarias (pedir credenciales al administrador del sistema).
- Si quieres hacer pruebas, idealmente tener una base de datos local.

### Instalación

Clonar el repositorio:

```bash
git clone https://github.com/tu-usuario/tu-repositorio.git
cd tu-repositorio
```

Instalar dependencias:

```bash
npm install
```

Configurar variables de entorno en un archivo `.env`:

```env
# Configuración del servidor
PORT=3000

# Secreto JWT
SECRET=tu-secreto-super-secreto

# Configuración de la base de datos
DB_USER=postgres
DB_PASSWORD=admin
DB_HOST=localhost
DB_NAME=timer_db
DB_PORT=5432
```

Ejecutar el servidor:

```bash
npm start
```

El servidor estará disponible en `http://localhost:3000`.

---

## Modelos de Base de Datos

### User

- Información de los usuarios.
- Contraseñas encriptadas mediante hook `beforeCreate`.
- Relaciones: pertenece a un **Role**, a un **Workplace** y tiene muchos **Log, Record, Registry y TaskIntervals**.

### Role

- Define permisos (admin, operario).
- Relaciones: tiene muchos **User**.

### Workplace

- Define puestos de trabajo o centros de costo.
- Relaciones: tiene muchos **User**.

### Data

- Contiene la información original y planificada de cada OT (desde Excel).
- Relaciones: tiene muchos **Registry** y **TaskIntervals**.

### Record

- Representa una OT activa gestionada por un operario.
- Contiene estado en tiempo real (En montaje, En curso, Pausado).
- Relaciones: pertenece a **User**, tiene muchos **Registry**.

### Finalized

- Copia inmutable de **Record** al completar una tarea.
- Sirve de historial.
- Relaciones: tiene muchos **Registry**.

### Registry

- Log de alto nivel de cada trabajo.
- Registra inicio y fin de una OT.
- Relaciones: pertenece a **User, Data, Record y Finalized**.

### TaskIntervals

- Tabla clave para control de tiempo.
- Registra intervalos de trabajo/pausa.
- Relaciones: pertenece a **User** y **Data**.

### Log

- Registro de inicio y cierre de sesión de usuarios.
- Relaciones: pertenece a **User**.

### Tablas Auxiliares

- **Count**: contador incremental.
- **Discharged**: marca órdenes ya procesadas en otro sistema.

---

## API Endpoints

### Autenticación (`/api/auth`)

- `POST /signin` – Iniciar sesión.
- `POST /signup` – Registrar usuario (Admin).
- `POST /signout` – Cerrar sesión.
- `GET /me` – Datos del usuario autenticado.
- `GET /users` – Listar usuarios (Admin).
- `PUT /users/:id` – Actualizar usuario (Admin).
- `DELETE /users/:id` – Eliminar usuario (Admin).

### Órdenes de Trabajo (`/api/orders`)

- `GET /` – Listar órdenes.
- `POST /` – Crear orden (Admin).
- `POST /edit` – Editar orden (Admin).
- `POST /delete` – Eliminar orden (Admin).
- `POST /deleteAll` – Eliminar todas las órdenes (Admin).
- `POST /play` – Iniciar/reanudar trabajo en orden.
- `POST /pause` – Pausar trabajo en orden.
- `POST /stop` – Finalizar trabajo en orden.
- `GET /download` – Descargar reporte (Admin).
- `GET /workers` – Listar actividad de operarios.
- `POST /report` – Reporte mensual.
- `POST /reportbyDay` – Reporte diario.
- `POST /timerReport` – Reporte detallado.
- `GET /inconsistency` – Detectar órdenes inconsistentes.
- `POST /fixInconsistency` – Corregir órdenes inconsistentes.
- `GET /roles` – Listar roles.
- `GET /workplaces` – Listar puestos de trabajo.

### Carga de Archivos (`/api/files`)

- `POST /upload` – Subir archivo Excel (.xlsx).

---

## Notas
- Se deben pedir los accesos al servidor donde se encuentra la aplicación para descargar la base de datos y hacer pruebas locales.
