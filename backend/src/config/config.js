// module.exports = {
//     // Configuracion token login
//     SECRET: "api-secret-od",
//     // Configuracion base de datos.
//     HOST: "localhost",
//     PORT: 3306,
//     USER: "root",
//     PASSWORD: "new_password",
//     DB: "orders",
//     dialect: "mariadb",

//     // Clave para eliminar recursos.
//     SECRET: "b1234",
// }

module.exports = {
    // Configuración token login
    SECRET: "api-secret-od",
    // Configuración base de datos.
    HOST: "localhost",
    PORT: 1433, // Puerto predeterminado para SQL Server
    USER: "SA",
    PASSWORD: "Password1234!",
    DB: "test",
    dialect: "mssql", // Indica que estás utilizando SQL Server

    // Clave para eliminar recursos.
    DELETE_SECRET: "b1234", // Asumo que DELETE_SECRET es diferente de SECRET
}
