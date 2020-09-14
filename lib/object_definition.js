const object_definitions = {
    'createscene': {
        type: 'state',
        common: {
            name: 'Create a new scene',
            type: 'string',
            role: 'state',
            read: false,
            write: true
        },
        native: {}
    },
    'recall': {
        type: 'state',
        common: {
            name: 'Activate scene',
            type: 'boolean',
            role: 'button.press',
            def: false,
            read: false,
            write: true
        },
        native: {}
    },
    'store': {
        type: 'state',
        common: {
            name: 'Store scene',
            type: 'boolean',
            role: 'button.press',
            def: false,
            read: false,
            write: true
        },
        native: {}
    },
    'delete': {
        type: 'state',
        common: {
            name: 'Delete',
            type: 'boolean',
            role: 'button.press',
            def: false,
            read: false,
            write: true
        },
        native: {}
    },
     'addtogroup': {
                 type: 'state',
                 common: {
                     name: 'Add to group',
                     type: 'number',
                     role: 'state',
                     read: false,
                     write: true
                 },
                 native: {}
             },
     'removefromgroup': {
                 type: 'state',
                 common: {
                     name: 'Remove light from group',
                     type: 'number',
                     role: 'state',
                     read: false,
                     write: true
                 },
                 native: {}
             },
    'removegroups': {
        type: 'state',
        common: {
            name: 'Remove from all groups',
            type: 'boolean',
            role: 'button.press',
            def: false,
            read: false,
            write: true
        },
        native: {}
    },
    'removescenes': {
        type: 'state',
        common: {
            name: 'Remove from all scenes',
            type: 'boolean',
            role: 'button.press',
            def: false,
            read: false,
            write: true
        },
        native: {}
    },
    'lightcount': {
        type: 'state',
        common: {
            name: 'Lightcount',
            type: 'number',
            role: 'indicator',
            read: true,
            write: false
        },
        native: {}
    },
     'orientation': {
                 type: 'state',
                 common: {
                     name: 'Orientation',
                     type: 'array',
                     role: 'state',
                     read: true,
                     write: false
                 },
                 native: {}
             },
 'pending': {
             type: 'state',
             common: {
                 name: 'Pending',
                 type: 'array',
                 role: 'state',
                 read: true,
                 write: false
             },
             native: {}
         },
     'xy': {
                 type: 'state',
                 common: {
                     name: 'xy',
                     type: 'string',
                     role: 'color.CIE',
                     def: '0.10000, 0.10000',
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'alarm': {
                 type: 'state',
                 common: {
                     name: 'Alarm',
                     type: 'boolean',
                     role: 'sensor.alarm',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'all_on': {
                 type: 'state',
                 common: {
                     name: 'All on',
                     type: 'boolean',
                     role: 'indicator',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'any_on': {
                 type: 'state',
                 common: {
                     name: 'Any on',
                     type: 'boolean',
                     role: 'indicator',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'boost': {
                 type: 'state',
                 common: {
                     name: 'Boost',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'carbonmonoxide': {
                 type: 'state',
                 common: {
                     name: 'Carbonmonoxide',
                     type: 'boolean',
                     role: 'sensor.alarm',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'configured': {
                 type: 'state',
                 common: {
                     name: 'Configured',
                     type: 'boolean',
                     role: 'indicator',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'displayflipped': {
                 type: 'state',
                 common: {
                     name: 'Display flipped',
                     type: 'boolean',
                     role: 'indicator',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'fire': {
                 type: 'state',
                 common: {
                     name: 'Fire alarm',
                     type: 'boolean',
                     role: 'sensor.alarm.fire',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'flag': {
                 type: 'state',
                 common: {
                     name: 'Flag',
                     type: 'boolean',
                     role: 'indicator',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'ledindication': {
                 type: 'state',
                 common: {
                     name: 'Led indication',
                     type: 'boolean',
                     role: 'indicator',
                     def: false,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'on': {
                 type: 'state',
                 common: {
                     name: 'On',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'off': {
                 type: 'state',
                 common: {
                     name: 'Off',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'locked': {
                 type: 'state',
                 common: {
                     name: 'Locked',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'usertest': {
                 type: 'state',
                 common: {
                     name: 'User test',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'toggle': {
                 type: 'state',
                 common: {
                     name: 'Toggle',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'lowbattery': {
                 type: 'state',
                 common: {
                     name: 'Low battery',
                     type: 'boolean',
                     role: 'indicator.lowbat',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'open': {
                 type: 'state',
                 common: {
                     name: 'Open',
                     type: 'boolean',
                     role: 'sensor.open',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'vibration': {
                 type: 'state',
                 common: {
                     name: 'Vibration',
                     type: 'boolean',
                     role: 'sensor.vibration',
                     def: false,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'water': {
                 type: 'state',
                 common: {
                     name: 'Water detected',
                     type: 'boolean',
                     role: 'sensor.alarm.flood',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'scheduleron': {
                 type: 'state',
                 common: {
                     name: 'Scheduleron',
                     type: 'boolean',
                     role: 'state',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'tampered': {
                 type: 'state',
                 common: {
                     name: 'Tampered',
                     type: 'boolean',
                     role: 'state',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'dark': {
                 type: 'state',
                 common: {
                     name: 'Dark',
                     type: 'boolean',
                     role: 'state',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'daylight': {
                 type: 'state',
                 common: {
                     name: 'Daylight',
                     type: 'boolean',
                     role: 'state',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'bri': {
                 type: 'state',
                 common: {
                     name: 'Brightness',
                     type: 'number',
                     role: 'level.brightness',
                     def: 254,
                     min: 0,
                     max: 254,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'buttonevent': {
                 type: 'state',
                 common: {
                     name: 'Buttonevent',
                     type: 'number',
                     role: 'state',
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'colorspeed': {
                 type: 'state',
                 common: {
                     name: 'Color speed',
                     type: 'number',
                     role: 'state',
                     def: 255,
                     min: 1,
                     max: 255,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'configid': {
                 type: 'state',
                 common: {
                     name: 'Config ID',
                     type: 'number',
                     role: 'state',
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'consumption': {
                 type: 'state',
                 common: {
                     name: 'Consumption',
                     type: 'number',
                     role: 'value.power.consumption',
                     def: 0,
                     unit: 'Wh',
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'ct': {
                 type: 'state',
                 common: {
                     name: 'Color temperature',
                     type: 'number',
                     role: 'level.color.temperature',
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'current': {
                 type: 'state',
                 common: {
                     name: 'Current',
                     type: 'number',
                     role: 'value.current',
                     def: 0,
                     unit: 'mA',
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'delay': {
                 type: 'state',
                 common: {
                     name: 'Delay',
                     type: 'number',
                     role: 'state',
                     def: 0,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'duration': {
                 type: 'state',
                 common: {
                     name: 'Duration',
                     type: 'number',
                     role: 'value',
                     def: 600,
                     min: 0,
                     max: 600,
                     unit: 's',
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'group': {
                 type: 'state',
                 common: {
                     name: 'Group',
                     type: 'number',
                     role: 'state',
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'heatsetpoint': {
                 type: 'state',
                 common: {
                     name: 'Heatsetpoint',
                     type: 'number',
                     role: 'level.temperature',
                     def: 20.00,
                     unit: '°C',
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'level': {
                 type: 'state',
                 common: {
                     name: 'Level',
                     type: 'number',
                     role: 'level.dimmer',
                     def: 100,
                     min: 0,
                     max: 100,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'lightlevel': {
                 type: 'state',
                 common: {
                     name: 'Lightlevel',
                     type: 'number',
                     role: 'value',
                     def: 0,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'lux': {
                 type: 'state',
                 common: {
                     name: 'Lux',
                     type: 'number',
                     role: 'value.brightness',
                     def: 0,
                     unit: 'Lux',
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'offset': {
                 type: 'state',
                 common: {
                     name: 'Offset',
                     type: 'number',
                     role: 'state',
                     def: 0,
                     min: -500,
                     max: 500,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'power': {
                 type: 'state',
                 common: {
                     name: 'Power',
                     type: 'number',
                     role: 'value.power',
                     def: 0,
                     unit: 'W',
                     read: true,
                     write: false
                 },
                 native: {}
             },
    "sat": {
        type: "state",
        common: {
            name: "Saturation",
            "type": "number",
            "role": "level.color.saturation",
            "read": true,
            "write": true,
            "min": 0,
            "max": 254,
            "def": 254
        }
    },
     'sensitivity': {
                 type: 'state',
                 common: {
                     name: 'Sensitivity',
                     type: 'number',
                     role: 'state',
                     def: 0,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'sensitivitymax': {
                 type: 'state',
                 common: {
                     name: 'Sensitivity maximum',
                     type: 'number',
                     role: 'state',
                     def: 0,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'speed': {
                 type: 'state',
                 common: {
                     name: 'Speed',
                     type: 'number',
                     role: 'state',
                     def: 0,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'status': {
                 type: 'state',
                 common: {
                     name: 'Status',
                     type: 'number',
                     role: 'state',
                     def: 0,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'sunriseoffset': {
                 type: 'state',
                 common: {
                     name: 'Sunrise offset',
                     type: 'number',
                     role: 'state',
                     def: 0,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'sunsetoffset': {
                 type: 'state',
                 common: {
                     name: 'Sunset offset',
                     type: 'number',
                     role: 'state',
                     def: 0,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'tholddark': {
                 type: 'state',
                 common: {
                     name: 'Thold dark',
                     type: 'number',
                     role: 'value.health.calories',
                     def: 0,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'tholdoffset': {
                 type: 'state',
                 common: {
                     name: 'Thold offset',
                     type: 'number',
                     role: 'value',
                     def: 0,
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'tiltangle': {
                 type: 'state',
                 common: {
                     name: 'Tilt angle',
                     type: 'number',
                     role: 'value.tilt',
                     def: 0,
                     unit: '°',
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'transitiontime': {
                 type: 'state',
                 common: {
                     name: 'Transition time',
                     type: 'number',
                     role: 'state',
                     def: 0,
                     unit: 's',
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'vibrationstrength': {
                 type: 'state',
                 common: {
                     name: 'Vibrationstrength',
                     type: 'number',
                     role: 'value',
                     def: 0,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'valve': {
                 type: 'state',
                 common: {
                     name: 'Valve',
                     type: 'number',
                     role: 'value.valve',
                     def: 0,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'voltage': {
                 type: 'state',
                 common: {
                     name: 'Voltage',
                     type: 'number',
                     role: 'value.voltage',
                     def: 0,
                     unit: 'V',
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'alert': {
                 type: 'state',
                 common: {
                     name: 'Alert',
                     type: 'string',
                     role: 'state',
                     def: 'none',
                     states: {none: 'none', select: 'select', lselect: 'lselect', blink: 'blink'},
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'colormode': {
                 type: 'state',
                 common: {
                     name: 'Color mode',
                     type: 'string',
                     role: 'state',
                     states: {hs: 'Hue and saturation', xy: 'CIE xy values', ct: 'Color temperature'},
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'effect': {
                 type: 'state',
                 common: {
                     name: 'Effect',
                     type: 'string',
                     role: 'state',
                     def: 'none',
                     states: {none: 'none', colorloop: 'colorloop'},
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'lastupdated': {
                 type: 'state',
                 common: {
                     name: 'Lastupdated',
                     type: 'string',
                     role: 'value.datetime',
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'localtime': {
                 type: 'state',
                 common: {
                     name: 'Localtime',
                     type: 'string',
                     role: 'value.datetime',
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'mode': {
                 type: 'state',
                 common: {
                     name: 'Mode',
                     type: 'string',
                     role: 'state',
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'scheduler': {
                 type: 'state',
                 common: {
                     name: 'Scheduler',
                     type: 'string',
                     role: 'state',
                     read: true,
                     write: true
                 },
                 native: {}
             },
     'press': {
                 type: 'state',
                 common: {
                     name: 'Press',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'hold': {
                 type: 'state',
                 common: {
                     name: 'Hold',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'release_press': {
                 type: 'state',
                 common: {
                     name: 'Release after press',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'release_hold': {
                 type: 'state',
                 common: {
                     name: 'Release after hold',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'double_press': {
                 type: 'state',
                 common: {
                     name: 'Double press',
                     type: 'boolean',
                     role: 'switch.comfort',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'triple_press': {
                 type: 'state',
                 common: {
                     name: 'Triple press',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'quadruple_press': {
                 type: 'state',
                 common: {
                     name: 'Quadruple press ',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'shake': {
                 type: 'state',
                 common: {
                     name: 'Shake',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'drop': {
                 type: 'state',
                 common: {
                     name: 'Drop',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'tilt': {
                 type: 'state',
                 common: {
                     name: 'Tilt',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'many_press': {
                 type: 'state',
                 common: {
                     name: 'Many press',
                     type: 'boolean',
                     role: 'switch',
                     def: false,
                     read: true,
                     write: false
                 },
                 native: {}
             },
     'dimspeed': {
                 type: 'state',
                 common: {
                     name: 'Steps for dimming',
                     type: 'number',
                     role: 'level.dimspeed',
                     def: 1,
                     min: 1,
                     max: 254,
                     read: false,
                     write: true
                 },
                 native: {}
             },
     'dimup': {
                 type: 'state',
                 common: {
                     name: 'Dim up',
                     type: 'boolean',
                     role: 'button.press',
                     def: false,
                     read: false,
                     write: true
                 },
                 native: {}
             },
     'dimdown': {
                 type: 'state',
                 common: {
                     name: 'Dim down',
                     type: 'boolean',
                     role: 'button.press',
                     def: false,
                     read: false,
                     write: true
                 },
                 native: {}
             },
     'action': {
                 type: 'state',
                 common: {
                     name: 'Action',
                     type: 'string',
                     role: 'state',
                     read: true,
                     write: true
                 },
                 native: {}
             },
      'buttonpressed': {
                  type: 'state',
                  common: {
                      name: 'Button pressed',
                      type: 'number',
                      role: 'state',
                      read: true,
                      write: false
                  },
                  native: {}
              }
}

module.exports = {defObj: object_definitions};
