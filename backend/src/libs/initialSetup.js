var fs = require('fs');
const path = require("path");
const User = require('../models/user')
const Workplace = require('../models/workplace')
const Role = require('../models/role')
const config = require('../config/config')

/**
 * Garantiza filas Role `admin` y `operario` (la semilla de usuarios depende de esto).
 */
async function ensureDefaultRoles() {
    const all = await Role.findAll();
    const have = new Set(all.map((r) => String(r.name || '').toLowerCase()));
    if (!have.has('admin')) {
        await Role.create({ name: 'admin' });
        console.log('Rol por defecto "admin" creado.');
    }
    if (!have.has('operario')) {
        await Role.create({ name: 'operario' });
        console.log('Rol por defecto "operario" creado.');
    }
}

async function load_data_workplaces(){
    try {
        const count = await Workplace.findAll()
        
        const promises = [];
        if (count.length == 0 ){
            let data_split = ['ME', 'ES', 'ALL'];
            const filepath = path.resolve(__dirname, "./tareas.txt");
            if (fs.existsSync(filepath)) {
                const data = fs.readFileSync(filepath, 'utf8');
                data_split = data.split("\n").filter(Boolean);
            }
            for (const ot of data_split) {
                promises.push(new Workplace({ name: ot }).save());
            }
            await Promise.all(promises);
        }
    } catch (error) {
        console.log(error)
    }
}

async function load_users(){
    try {       
        const count = await User.findAll()

        if (count.length <= 10 ){
            const filepath = path.resolve(__dirname, "./usuarios.txt");
            if (!fs.existsSync(filepath)) {
                console.log('Seed usuarios.txt no encontrado, se omite carga inicial de usuarios.');
                return;
            }
            const roles = await Role.findAll();
            const roleByLower = (n) =>
                roles.find((r) => String(r.name || '').toLowerCase() === n);
            const adminRole = roleByLower('admin');
            const operarioRole = roleByLower('operario');
            if (!adminRole || !operarioRole) {
                console.log(
                    'No se pueden cargar usuarios: faltan roles "admin" u "operario" en la BD.'
                );
                return;
            }

            var data = fs.readFileSync(filepath, 'utf8')
            var data_split = data.split("\n")
            // console.log(data_split)

            const workplace_dic = {
                "IN": 1,
                "ES": 2,
                "ME": 3,
                "ALL": 4
            }
            for (const data of data_split) {
                info = data.split(":")
                if (!info[0] || !info[3] || !info[4]) continue;
                var name = info[0]
                var lastname = info[1]
                const roleToken = String(info[2] || '').toLowerCase().trim()
                // usuarios.txt usa "user" para operarios y "admin" para administradores
                const roleId =
                    roleToken === 'admin' ? adminRole.id : operarioRole.id
                var username = info[3]
                var password = info[4]
                var workplace = workplace_dic[info[5]]
                console.log(name, lastname, roleToken, username, password, workplace)
    
                var newUser = new User({
                    username: username,
                    name: name,
                    lastname: lastname,
                    password: password,
                    RoleId: roleId,
                    WorkplaceId: workplace
                })
            
               await newUser.save()
            }
        }
    } catch (error) {
        console.log(error)
    }
}

/**
 * Sin usuarios.txt en el contenedor la lista de operarios queda vacía.
 * Si la BD no tiene ningún usuario, crea admin + operarios de prueba (PIN 1234).
 */
async function ensureSandboxDemoUsers() {
    if (!config.AUTO_SEED_DEMO_USERS) return;

    const totalUsers = await User.count();
    if (totalUsers > 0) return;

    const roles = await Role.findAll();
    const adminRole = roles.find((r) => String(r.name || '').toLowerCase() === 'admin');
    const operarioRole = roles.find((r) => String(r.name || '').toLowerCase() === 'operario');
    const wp = await Workplace.findOne({ order: [['id', 'ASC']] });

    if (!adminRole || !operarioRole || !wp) {
        console.log('ensureSandboxDemoUsers: omitido (falta rol admin/operario o workplace).');
        return;
    }

    const pin = '1234';
    await User.create({
        username: 'admin',
        name: 'Admin',
        lastname: 'Sistema',
        password: pin,
        RoleId: adminRole.id,
        WorkplaceId: wp.id
    });

    const operarios = [
        ['Juan', 'Perez', 'jperez'],
        ['Maria', 'Gomez', 'mgomez'],
        ['Pedro', 'Lopez', 'plopez'],
        ['Ana', 'Diaz', 'adiaz']
    ];
    for (const [name, lastname, username] of operarios) {
        await User.create({
            username,
            name,
            lastname,
            password: pin,
            RoleId: operarioRole.id,
            WorkplaceId: wp.id
        });
    }

    console.log(
        'Usuarios demo creados (BD vacía, sin usuarios.txt): admin + jperez, mgomez, plopez, adiaz — PIN 1234. ' +
            'Desactivar con AUTO_SEED_DEMO_USERS=false.'
    );
}

module.exports = {
    load_data_workplaces,
    load_users,
    ensureDefaultRoles,
    ensureSandboxDemoUsers
}