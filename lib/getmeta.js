var presentation = {
    'S_DOOR':               {role: 'indicator.door',        type: 'boolean',    def: false},
    'S_MOTION':             {role: 'indicator.motion',      type: 'boolean',    def: false},
    'S_SMOKE':              {role: 'indicator.alarm.smoke', type: 'boolean',    def: false},
    'S_LIGHT':              {role: 'switch.light',          type: 'boolean',    def: false},
    'S_DIMMER':             {role: 'level.dimmer',          type: 'number',     def: 0, min: 0, max: 100, unit: '%'},
    'S_COVER':              {role: 'level.blind',           type: 'number',     def: 0, min: 0, max: 100, unit: '%'},
    'S_TEMP':               {role: 'value.temperature',     type: 'number',     def: 0, unit: '°C'},
    'S_HUM':                {role: 'value.humidity',        type: 'number',     def: 0, min: 0, max: 100, unit: '%'},
    'S_BARO':               {role: 'value.pressure',        type: 'number',     def: 0, min: 0, unit: 'P'},
    'S_WIND':               {role: 'value.direction',       type: 'number',     def: 0, min: 0, max: 360, unit: '°'},
    'S_RAIN':               {role: 'value.rain',            type: 'number',     def: 0, min: 0, unit: 'mm'},
    'S_UV':                 {role: 'value.uv',              type: 'number',     def: 0, min: 0, max: 100, unit: '%'},
    'S_WEIGHT':             {role: 'value.weight',          type: 'number',     def: 0, min: 0, unit: 'Kg'},
    'S_POWER':              {role: 'value.power.consumption', type: 'number',   def: 0, min: 0, unit: 'W'},
    'S_HEATER':             {role: 'level.temperature',     type: 'number',     def: 0, min: 0, unit: '°C'},
    'S_DISTANCE':           {role: 'value.distance',        type: 'number',     def: 0, unit: 'm'},
    'S_LIGHT_LEVEL':        {role: 'value.brightness',      type: 'number',     def: 0, min: 0, max: 100, unit: '%'},
    'S_ARDUINO_NODE':       {role: '',                      type: 'string'},
    'S_ARDUINO_RELAY':      {role: '',                      type: 'string'},
    'S_LOCK':               {role: 'state.lock',            type: 'boolean'}, // 1=Locked, 0=Unlocked
    'S_IR':                 {role: 'state',                 type: 'string'},
    'S_WATER':              {role: 'indicator.alarm.water', type: 'number',     def: 0, min: 0, unit: 'l'},
    'S_AIR_QUALITY':        {role: 'state',                 type: 'number'},
    'S_CUSTOM':             {role: 'state',                 type: 'string'},
    'S_DUST':               {role: 'indicator.alarm.dust',  type: 'number',     def: 0, min: 0, max: 100, unit: '%'},
    'S_SCENE_CONTROLLER':   {role: 'state',                 type: 'number',     def: 0, min: 0, max: 100, unit: '%'},
    'S_RGB_LIGHT':          {role: 'state.rgb',             type: 'string'}, //ff0000
    'S_RGBW_LIGHT':         {role: 'state.rgbw',            type: 'string'}, //ff0000ff
    'S_COLOR_SENSOR':       {role: 'value.rgb',             type: 'string'}, //ff0000
    'S_HVAC':               {role: 'level.temperature',     type: 'number',     def: 0, min: 0, unit: '°C'},
    'S_MULTIMETER':         {role: 'value',                 type: 'number',     def: 0},
    'S_SPRINKLER':          {role: 'state.water',           type: 'boolean',    def: false},
    'S_WATER_LEAK':         {role: 'indicator.alarm.water', type: 'boolean',    def: false},
    'S_SOUND':              {role: 'value.sound',           type: 'number',     def: 0},
    'S_VIBRATION':          {role: 'indicator.vibration',   type: 'boolean',    def: false},
    'S_MOISTURE':           {role: 'value.moisture',        type: 'number',     def: 0, min: 0, max: 100, unit: '%'}
};

function getMetaInfo(packet) {
    var type = presentation[packet.subType];
    if (!type) {
        type = {
            type: 'string',
            role: 'state'
        }
    }

    return {
        _id:        packet.id + '.' + packet.childId + (packet.subType ? '.' + packet.subType : ''),
        common: {
            name:   packet.payload || (packet.id + '.' + packet.childId + '.' + (packet.subType ? '.' + packet.subType : '')),
            type:   type.type,
            role:   type.role,
            min:    type.min,
            max:    type.max,
            unit:   type.unit,
            def:    type.def
        },
        native: {
            id:      packet.id,
            childId: packet.childId,
            subType: packet.subType
        },
        type: 'state'
    }
}

module.exports.getMetaInfo = getMetaInfo;