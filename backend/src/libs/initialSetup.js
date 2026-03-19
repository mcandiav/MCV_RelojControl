var fs = require('fs');
const path = require("path");
const User = require('../models/user')
const Workplace = require('../models/workplace')

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
            for(ot of data_split) {
                promises.push(new Workplace({name: ot}).save());
            }
            Promise.all(promises)
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
            var data = fs.readFileSync(filepath, 'utf8')
            var data_split = data.split("\n")
            // console.log(data_split)

            const workplace_dic = {
                "IN": 1,
                "ES": 2,
                "ME": 3,
                "ALL": 4
            }
            const promises = [];
            for (data of data_split){
                info = data.split(":")
                if (!info[0] || !info[3] || !info[4]) continue;
                var name = info[0]
                var lastname = info[1]
                var role = info[2] == 'user' ? 1:0
                var username = info[3]
                var password = info[4]
                var workplace = workplace_dic[info[5]]
                console.log(name, lastname, role, username, password, workplace)
    
                var newUser = new User({
                    username: username,
                    name: name,
                    lastname: lastname,
                    password: password,
                    RoleId: role,
                    WorkplaceId: workplace
                })
            
               await newUser.save()
            }
        }
    } catch (error) {
        console.log(error)
    }
}

module.exports = { load_data_workplaces, load_users }