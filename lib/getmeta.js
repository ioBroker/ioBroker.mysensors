var presentation = {
    'S_DOOR':               {index: 0,  role: 'door',              vars: ['V_TRIPPED']},
    'S_MOTION':             {index: 1,  role: 'motion',            vars: ['V_TRIPPED']},
    'S_SMOKE':              {index: 2,  role: 'alarm.smoke',       vars: ['V_TRIPPED']},
    'S_LIGHT':              {index: 3,  role: 'light',             vars: ['V_STATUS', 'V_WATT']},
    'S_DIMMER':             {index: 4,  role: 'dimmer',            vars: ['V_PERCENTAGE', 'V_STATUS', 'V_WATT']},
    'S_COVER':              {index: 5,  role: 'blind',             vars: ['V_PERCENTAGE', 'V_UP', 'V_DOWN', 'V_STOP']},
    'S_TEMP':               {index: 6,  role: 'temperature',       vars: ['V_TEMP']},
    'S_HUM':                {index: 7,  role: 'humidity',          vars: ['V_HUM']},
    'S_BARO':               {index: 8,  role: 'pressure',          vars: ['V_PRESSURE']},
    'S_WIND':               {index: 9,  role: 'direction',         vars: ['V_WIND', 'V_GUST']},
    'S_RAIN':               {index: 10, role: 'rain',              vars: ['V_RAIN', 'V_RAINRATE']},
    'S_UV':                 {index: 11, role: 'uv',                vars: ['V_UV']},
    'S_WEIGHT':             {index: 12, role: 'weight',            vars: ['V_WEIGHT', 'V_IMPEDANCE']},
    'S_POWER':              {index: 13, role: 'power.consumption', vars: ['V_WATT', 'V_KWH']},
    'S_HEATER':             {index: 14, role: 'temperature',       vars: ['V_HVAC_SETPOINT_HEAT', 'V_HVAC_FLOW_STATE', 'V_TEMP']},
    'S_DISTANCE':           {index: 15, role: 'distance',          vars: ['V_DISTANCE', 'V_UNIT_PREFIX']},
    'S_LIGHT_LEVEL':        {index: 16, role: 'brightness',        vars: ['V_LIGHT_LEVEL', 'V_LEVEL']},
    'S_ARDUINO_NODE':       {index: 17, role: '',                  vars: []},
    'S_ARDUINO_RELAY':      {index: 18, role: '',                  vars: []},
    'S_LOCK':               {index: 19, role: 'lock',              vars: ['V_LOCK_STATUS']},
    'S_IR':                 {index: 20, role: '',                  vars: ['V_IR_SEND', 'V_IR_RECEIVE']},
    'S_WATER':              {index: 21, role: 'water',             vars: ['V_FLOW', 'V_VOLUME']},
    'S_AIR_QUALITY':        {index: 22, role: '',                  vars: ['V_LEVEL', 'V_UNIT_PREFIX']},
    'S_CUSTOM':             {index: 23, role: '',                  vars: ['']},
    'S_DUST':               {index: 24, role: 'alarm.dust',        vars: ['V_LEVEL', 'V_UNIT_PREFIX']},
    'S_SCENE_CONTROLLER':   {index: 25, role: '',                  vars: ['V_SCENE_ON', 'V_SCENE_OFF']},
    'S_RGB_LIGHT':          {index: 25, role: 'rgb',               vars: ['V_RGB', 'V_WATT']},
    'S_RGBW_LIGHT':         {index: 26, role: 'rgbw',              vars: ['V_RGBW', 'V_WATT']},
    'S_COLOR_SENSOR':       {index: 27, role: 'rgb',               vars: ['V_RGB']},
    'S_HVAC':               {index: 28, role: 'temperature',       vars: ['V_HVAC_SETPOINT_HEAT', 'V_HVAC_SETPOINT_COLD', 'V_HVAC_FLOW_STATE', 'V_HVAC_FLOW_MODE', 'V_HVAC_SPEED']},
    'S_MULTIMETER':         {index: 29, role: '',                  vars: ['V_VOLTAGE', 'V_CURRENT', 'V_IMPEDANCE']},
    'S_SPRINKLER':          {index: 31, role: 'water',             vars: ['V_STATUS', 'V_TRIPPED']},
    'S_WATER_LEAK':         {index: 32, role: 'alarm.water',       vars: ['V_TRIPPED']},
    'S_SOUND':              {index: 33, role: 'sound',             vars: ['V_LEVEL', 'V_TRIPPED']},
    'S_VIBRATION':          {index: 34, role: 'vibration',         vars: ['V_TRIPPED', 'V_LEVEL']},
    'S_MOISTURE':           {index: 35, role: 'moisture',          vars: ['V_LEVEL', 'V_TRIPPED']}
};

var vars = {
    'V_TEMP':               {index: 0,  role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: '°C'},     //Temperature
    'V_HUM':                {index: 1,  role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, max: 100, unit: '%'},     //Humidity
    'V_STATUS':             {index: 2,  role: 'state',     type: 'boolean',    read: true, write: true , def: false},     //Binary status. 0=off 1=on
    'V_PERCENTAGE':         {index: 3,  role: 'value',     type: 'number',     read: true, write: true , def: 0, min: 0, max: 100, unit: '%'},     //Percentage value. 0-100 (%)
    'V_PRESSURE':           {index: 4,  role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, max: 100, unit: '%'},     //Atmospheric Pressure
    'V_FORECAST':           {index: 5,  role: 'value',     type: 'string',     read: true, write: false},     //Whether forecast. One of "stable", "sunny", "cloudy", "unstable", "thunderstorm" or "unknown"
    'V_RAIN':               {index: 6,  role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: '%'},     //Amount of rain
    'V_RAINRATE':           {index: 7,  role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'mm'},     //Rate of rain
    'V_WIND':               {index: 8,  role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'kmh'},     //Windspeed
    'V_GUST':               {index: 9,  role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'kmh'},     //Gust
    'V_DIRECTION':          {index: 10, role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: '°'},     //Wind direction
    'V_UV':                 {index: 11, role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: '%'},     //UV light level
    'V_WEIGHT':             {index: 12, role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'kg'},     //Weight (for scales etc)
    'V_DISTANCE':           {index: 13, role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'm'},     //Distance
    'V_IMPEDANCE':          {index: 14, role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'Om'},     //Impedance value
    'V_ARMED':              {index: 15, role: 'indicator', type: 'boolean',    read: true, write: false, def: false},     //Armed status of a security sensor. 1=Armed, 0=Bypassed
    'V_TRIPPED':            {index: 16, role: 'indicator', type: 'boolean',    read: true, write: false, def: false},     //Tripped status of a security sensor. 1=Tripped, 0=Untripped
    'V_WATT':               {index: 17, role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'W'},     //Watt value for power meters
    'V_KWH':                {index: 18, role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'KWH'},     //Accumulated number of KWH for a power meter
    'V_SCENE_ON':           {index: 19, role: 'button',    type: 'boolean',    read: true, write: true , def: false},     //Turn on a scene
    'V_SCENE_OFF':          {index: 20, role: 'button',    type: 'boolean',    read: true, write: true , def: false},     //Turn of a scene
    'V_HVAC_FLOW_STATE':    {index: 21, role: 'state',     type: 'string',     read: true, write: true},     //Mode of header. One of "Off", "HeatOn", "CoolOn", or "AutoChangeOver"
    'V_HVAC_SPEED':         {index: 22, role: 'state',     type: 'string',     read: true, write: true},     //HVAC/Heater fan speed ("Min", "Normal", "Max", "Auto")
    'V_LIGHT_LEVEL':        {index: 23, role: 'level',     type: 'number',     read: true, write: true, def: 0, min: 0, max: 100, unit: '%'},     //Uncalibrated light level. 0-100%. Use V_LEVEL for light level in lux.
    'V_VAR1':               {index: 24, role: 'state',     type: 'string',     read: true, write: true},     //Custom value
    'V_VAR2':               {index: 25, role: 'state',     type: 'string',     read: true, write: true},     //Custom value
    'V_VAR3':               {index: 26, role: 'state',     type: 'string',     read: true, write: true},     //Custom value
    'V_VAR4':               {index: 27, role: 'state',     type: 'string',     read: true, write: true},     //Custom value
    'V_VAR5':               {index: 28, role: 'state',     type: 'string',     read: true, write: true},     //Custom value
    'V_UP':                 {index: 29, role: 'button',    type: 'boolean',    read: true, write: false, def: false},     //Window covering. Up.
    'V_DOWN':               {index: 30, role: 'button',    type: 'boolean',    read: true, write: false, def: false},     //Window covering. Down.
    'V_STOP':               {index: 31, role: 'button',    type: 'boolean',    read: true, write: false, def: false},     //Window covering. Stop.
    'V_IR_SEND':            {index: 32, role: 'state',     type: 'string',     read: true, write: true},     //Send out an IR-command
    'V_IR_RECEIVE':         {index: 33, role: 'state',     type: 'string',     read: true, write: false},     //This message contains a received IR-command
    'V_FLOW':               {index: 34, role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'm'},     //Flow of water (in meter)
    'V_VOLUME':             {index: 35, role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'l'},               //Water volume
    'V_LOCK_STATUS':        {index: 36, role: 'state',     type: 'boolean',    read: true, write: false, def: false},                              //Set or get lock status. 1=Locked, 0=Unlocked
    'V_LEVEL':              {index: 37, role: 'level',     type: 'number',     read: true, write: false},                                              //Used for sending level-value
    'V_VOLTAGE':            {index: 38, role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'V'},               //Voltage level
    'V_CURRENT':            {index: 39, role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'A'},               //Current level
    'V_RGB':                {index: 40, role: 'state',     type: 'string',     read: true, write: false, def: '000000'},                           //RGB value transmitted as ASCII hex string (I.e "ff0000" for red)
    'V_RGBW':               {index: 41, role: 'state',     type: 'string',     read: true, write: false, def: '00000000'},                         //RGBW value transmitted as ASCII hex string (I.e "ff0000ff" for red + full white)
    'V_ID':                 {index: 42, role: 'state',     type: 'string',     read: true, write: false},                                              //Optional unique sensor id (e.g. OneWire DS1820b ids)
    'V_UNIT_PREFIX':        {index: 43, role: 'state',     type: 'string',     read: true, write: false},                                              //Allows sensors to send in a string representing the unit prefix to be displayed in GUI. This is not parsed by controller! E.g. cm, m, km, inch.
    'V_HVAC_SETPOINT_COOL': {index: 44, role: 'level',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'C°'},    //HVAC cold setpoint
    'V_HVAC_SETPOINT_HEAT': {index: 45, role: 'level',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'C°'},    //HVAC/Heater setpoint
    'V_HVAC_FLOW_MODE':     {index: 46, role: 'value',     type: 'number',     read: true, write: false, def: 0, min: 0, unit: 'm' }     //Flow m
};

function getMetaInfo(packet, ip, port, config) {
    var type = presentation[packet.subType];
    if (!type) {
        type = {
            type: 'string',
            role: 'state',
            vars: [],
            index: packet.subType
        };
    }

    var result = [
        {
            _id:            (ip ? ip.replace(/\./g, '_') + '.'  : '') + packet.id + '.' + packet.childId + '_' + packet.subType.replace('S_', '') + '.' + packet.subType,
            common: {
                name:       packet.payload || ((ip ? ip.replace(/\./g, '.') + '_'  : '') + packet.id + '.' + packet.childId + '_' + packet.subType.replace('S_', '') + '.' + packet.subType),
                role:       type.role
            },
            native: {
                ip:         ip,
                id:         packet.id,
                childId:    packet.childId,
                subType:    packet.subType,
                subTypeNum: type.index
            },
            type: 'channel'
        }
    ];

    for (var v = 0; v < type.vars.length; v++) {
        var variable = vars[type.vars[v]];
        var id = (ip ? ip.replace(/\./g, '_') + '.'  : '') + packet.id + '.' + packet.childId + '_' + packet.subType.replace('S_', '') + '.' + packet.subType + '.' + type.vars[v];
        result.push({
            _id:            (ip ? ip.replace(/\./g, '_') + '.'  : '') + packet.id + '.' + packet.childId + '_' + packet.subType.replace('S_', '') + '.' + packet.subType + '.' + type.vars[v],
            common: {
                name:       packet.payload ? (packet.payload + '.' + type.vars[v]) : id,
                type:       variable.type,
                role:       variable.role + (type.role ? '.' + type.role : ''),
                min:        variable.min,
                max:        variable.max,
                unit:       variable.unit,
                def:        variable.def,
                read:       variable.read,
                write:      variable.write
            },
            native: {
                ip:         ip,
                id:         packet.id,
                childId:    packet.childId,
                subType:    packet.subType,
                subTypeNum: type.index,
                varType:    type.vars[v],
                varTypeNum: variable.index
            },
            type: 'state'
        });
    }

    // add battery object for node
    result.push({
        _id:            (ip ? ip.replace(/\./g, '_') + '.'  : '') + packet.id + '.S_BATTERY',
        common: {
            name:       packet.payload || ((ip ? ip.replace(/\./g, '_') + '.'  : '') + packet.id + '.S_BATTERY'),
            type:       'number',
            role:       'value.battery',
            min:        0,
            max:        100,
            unit:       '%',
            def:        100,
            read:       true,
            write:      false
        },
        native: {
            ip:         ip,
            id:         packet.id,
            varType:    'I_BATTERY_LEVEL'
        },
        type: 'state'
    });

    if (config == 'Imperial') {
        for (var i = 0; i < result.length; i++) {
            if (result[i].common.unit === '°C') result[i].common.unit = '°F';
        }
    }

    return result;
}

module.exports.getMetaInfo = getMetaInfo;