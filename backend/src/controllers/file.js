// =========================================
// IMPORTS Y CONFIGURACIÓN
// =========================================

const XLSX = require('xlsx');
const XlsxPopulate = require('xlsx-populate');
const { Op, Sequelize } = require("sequelize");

// Modelo de la Base de Datos
const Data = require('../models/data');

// =========================================
// FUNCIONES AUXILIARES INTERNAS
// =========================================

/**
 * Mapea los datos de un array de objetos a un formato compatible con el modelo `Data`.
 * Utiliza los nombres de las columnas del archivo Excel como claves.
 * @param {Array<object>} data - El array de objetos extraído del archivo Excel.
 * @returns {Array<object>} Un array de objetos listos para ser insertados en la base de datos.
 */
function mapData(data) {
    return data.map(item => {
        return {
            ot: item['Orden de trabajo'].split("#OT").pop(),
            item: item['Secuencia de operaciones'],
            resource: item['Centro de trabajo de fabricación'],
            estimated_time: Number((item['EJECUCION RUTA'] * 60).toFixed(5)), // Fabricación
            assembly_time: Number((item['CONFIGURACION RUTA'] * 60).toFixed(5)), // Montaje
            state: 'No iniciado',
            operation_name: item['Nombre de la operación'],
            planned_quantity: item['Cantidad de entrada']
        };
    });
}

/**
 * Mapea los datos de un array de objetos a un formato compatible con el modelo `Data`.
 * Utiliza el índice de la columna en lugar del nombre.
 * @param {Array<object>} data - El array de objetos extraído del archivo Excel.
 * @returns {Array<object>} Un array de objetos listos para ser insertados en la base de datos.
 */
function mapDataId(data) {
    return data.map(item => {
        var values = Object.values(item);
        return {
            ot: values[0].split("#OT").pop(),
            item: values[1],
            resource: values[2],
            estimated_time: values[3], // Fabricación
            assembly_time: values[4], // Montaje
            state: 'No iniciado',
            operation_name: values[5]
        };
    });
}

// =========================================
// FUNCIÓN PRINCIPAL DE CARGA
// =========================================

/**
 * Procesa un archivo Excel subido, extrae los datos, los mapea y los guarda en la base de datos.
 * Evita duplicados basándose en la combinación de 'ot', 'item' y 'resource'.
 * @param {object} req - Objeto de solicitud de Express, contiene el archivo subido.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.upload = async function (req, res) {
    console.log('Subiendo el archivo...');
    try {
        const filePath = req.files[0].path;
        const columns = [
            'Orden de trabajo', 'Secuencia de operaciones', 'Centro de trabajo de fabricación',
            'CONFIGURACION RUTA', 'EJECUCION RUTA', 'Estado', 'Nombre de la operación', 'Cantidad de entrada'
        ];
        
        const workbook = XLSX.readFile(filePath);
        const workbookHeaders = XLSX.readFile(filePath, { sheetRows: 1 });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const columnsArray = XLSX.utils.sheet_to_json(workbookHeaders.Sheets[sheetName], { header: 1 })[0];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        let mappedData;
        if (columns.every(item => columnsArray.includes(item))) {
            console.log('Las columnas coinciden por nombre.');
            mappedData = mapData(data);
        } else {
            console.log('Las columnas no coinciden, mapeando por índice.');
            mappedData = mapDataId(data);
        }
        
        for (let data of mappedData) {
            // Busca si ya existe un registro idéntico para evitar duplicados.
            const finded_data = await Data.findOne({
                where: {
                    ot: data.ot,
                    item: data.item,
                    resource: data.resource
                }
            });

            if (finded_data !== null) {
                continue; // Si ya existe, salta al siguiente
            }

            // Crea y guarda el nuevo registro
            const new_data = new Data({
                ot: data.ot,
                item: data.item,
                resource: data.resource,
                estimated_time: data.estimated_time,
                assembly_time: data.assembly_time,
                state: data.state,
                operation_name: data.operation_name,
                // Por simplicidad, se utiliza n_times_paused para guardar la cantidad esperada.
                n_times_paused: data.planned_quantity 
            });
            await new_data.save();
        }

        res.status(200).json({ message: 'Datos insertados en la base de datos' });
    } catch (error) {
        console.error("Error al procesar el archivo:", error);
        res.status(500).json({ message: 'Error al procesar el archivo' });
    }
};