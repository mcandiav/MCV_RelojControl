var fs = require('fs');
const path = require("path");
const Resource = require('../models/resource')
const User = require('../models/user')
const Role = require('../models/role')
const Workplace = require('../models/workplace')

async function load_data(){
    try {
        const count = await Resource.findAll()
        
        const promises = [];
        if (count.length == 0 ){
            var data = fs.readFileSync(path.resolve(__dirname, "./ots.txt"), 'utf8')
            var data_split = data.split("\n")
            for(ot of data_split) {
                promises.push(new Resource({ot: ot}).save());
            }
            Promise.all(promises)
        }
    } catch (error) {
        console.log(error)
    }
}

async function load_data_workplaces(){
    try {
        const count = await Workplace.findAll()
        
        const promises = [];
        if (count.length == 0 ){
            var data = fs.readFileSync(path.resolve(__dirname, "./tareas.txt"), 'utf8')
            var data_split = data.split("\n")
            console.log(data_split)
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
            var data = fs.readFileSync(path.resolve(__dirname, "./usuarios.txt"), 'utf8')
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

module.exports = { load_data, load_data_workplaces, load_users }