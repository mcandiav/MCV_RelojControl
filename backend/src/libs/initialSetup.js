var fs = require('fs');
const path = require("path");
const User = require('../models/user')
const Workplace = require('../models/workplace')
const ShiftCloseSlot = require('../models/shift_close_slot')
const config = require('../config/config')

/**
 * Tres slots de cierre de turno (arquitectura v6).
 * Operación actual: 2 turnos activos (08:00 y 17:00) + 1 slot técnico deshabilitado (03:00).
 * Prioridad: NS_SHIFT_BATCH_TIMES (coma) > NS_SHIFT_BATCH_TIME + dos por defecto > 08:00,17:00,03:00
 */
async function ensureShiftCloseSlots() {
  try {
    let d1 = '08:00';
    let d2 = '17:00';
    let d3 = '03:00';
    let e1 = true;
    let e2 = true;
    let e3 = false;

    const multi = process.env.NS_SHIFT_BATCH_TIMES;
    if (multi && String(multi).trim()) {
      const parts = String(multi)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length >= 3) {
        [d1, d2, d3] = [parts[0], parts[1], parts[2]];
        [e1, e2, e3] = [true, true, true];
      } else if (parts.length === 2) {
        [d1, d2] = [parts[0], parts[1]];
        [e1, e2, e3] = [true, true, false];
      } else if (parts.length === 1) {
        d1 = parts[0];
        [e1, e2, e3] = [true, false, false];
      }
    } else if (config.NS_SHIFT_BATCH_TIME && String(config.NS_SHIFT_BATCH_TIME).trim()) {
      d1 = String(config.NS_SHIFT_BATCH_TIME).trim();
      [e1, e2, e3] = [true, true, false];
    }

    const defaults = [d1, d2, d3];
    const enabledDefaults = [e1, e2, e3];
    for (let seq = 1; seq <= 3; seq += 1) {
      const hhmm = defaults[seq - 1];
      await ShiftCloseSlot.findOrCreate({
        where: { sequence: seq },
        defaults: { hhmm, enabled: enabledDefaults[seq - 1] }
      });
    }

    // Migración suave: si la tabla sigue con default legado 07/15/23, pasar a 08/17 activos + 03 deshabilitado.
    // No toca configuraciones personalizadas ni cuando hay variables de entorno explícitas.
    if (!multi && !(config.NS_SHIFT_BATCH_TIME && String(config.NS_SHIFT_BATCH_TIME).trim())) {
      const slots = await ShiftCloseSlot.findAll({ order: [['sequence', 'ASC']] });
      const bySeq = new Map(slots.map((s) => [Number(s.sequence), s]));
      const s1 = bySeq.get(1);
      const s2 = bySeq.get(2);
      const s3 = bySeq.get(3);
      const isLegacyDefault =
        s1 && s2 && s3 &&
        String(s1.hhmm) === '07:00' &&
        String(s2.hhmm) === '15:00' &&
        String(s3.hhmm) === '23:00';

      if (isLegacyDefault) {
        await ShiftCloseSlot.update({ hhmm: '08:00', enabled: true }, { where: { sequence: 1 } });
        await ShiftCloseSlot.update({ hhmm: '17:00', enabled: true }, { where: { sequence: 2 } });
        await ShiftCloseSlot.update({ hhmm: '03:00', enabled: false }, { where: { sequence: 3 } });
      }
    }
  } catch (error) {
    console.error('ensureShiftCloseSlots:', error);
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
            for (const data of data_split) {
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

module.exports = { load_data_workplaces, load_users, ensureShiftCloseSlots }
