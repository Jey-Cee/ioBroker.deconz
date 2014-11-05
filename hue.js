/**
 *
 *      ioBroker Philips Hue Bridge Adapter
 *
 *      (c) 2014 hobbyquaker
 *
 *      MIT License
 *
 */

var hue = require("node-hue-api");

var adapter = require(__dirname + '/../../lib/adapter.js')({

    name:           'hue',

    objectChange: function (id, obj) {

    },

    stateChange: function (id, state) {
        if (!state.ack) {
            adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
            var tmp = id.split('.');
            var dp = tmp.pop();
            id = tmp.slice(2).join('.');
            var ls = {};
            ls[dp] = state.val;
            api.setLightState(channelIds[id], ls, function (err, res) {
                if (!err && res) {
                    adapter.setState([id, dp].join('.'), {val: state.val, ack: true});
                }
            });
        }
    },

    unload: function (callback) {
        try {
            adapter.log.info('terminating');
            callback();
        } catch (e) {
            callback();
        }
    },

    ready: function () {
        main();
    }

});

var HueApi = hue.HueApi;
var lightState = hue.lightState;
var api;

var channelIds = {};
var pollIds = [];
var pollChannels = [];

function main() {

    adapter.subscribeStates('*');


    api = new HueApi(adapter.config.bridge, adapter.config.user);

    api.getFullState(function(err, config) {
        if (err) {
            adapter.log.error(err);
            process.exit(1);
        } else if (!config) {
            adapter.log.error('Cannot get the configuration from hue bridge');
            process.exit(1);
        }

        // Create/update lamps
        adapter.log.info('creating/updating light channels');

        var devChildren = [];
        var lights = config.lights;
        var count = 0;
        for (var id in lights) {
            count += 1;
            var light = lights[id];

            var channelName = config.config.name + '.' + light.name;
            devChildren.push(channelName);
            channelIds[channelName] = id;
            pollIds.push(id);
            pollChannels.push(channelName);

            var children = [];


            for (var state in light.state) {

                var objId = channelName + '.' + state;

                children.push(objId);

                adapter.setState(objId, {val: light.state[state], ack: true});

                var obj = {
                    type: 'state',
                    parent: channelName,
                    common: {
                        name: objId,
                        read: true,
                        write: true
                    },
                    native: {
                        id: id
                    }
                };

                switch (state) {
                    case 'on':
                        obj.common.type = 'boolean';
                        obj.common.role = 'switch';
                        break;
                    case 'bri':
                        obj.common.type = 'number';
                        obj.common.role = 'level.dimmer';
                        obj.common.min = 0;
                        obj.common.max = 255;
                        break;
                    case 'hue':
                        obj.common.type = 'number';
                        obj.common.role = 'level.color.hue';
                        obj.common.min = 0;
                        obj.common.max = 65535;
                        break;
                    case 'sat':
                        obj.common.type = 'number';
                        obj.common.role = 'level.color.saturation';
                        obj.common.min = 0;
                        obj.common.max = 255;
                        break;
                    case 'xy':
                        break;
                    case 'ct':
                        obj.common.type = 'number';
                        obj.common.role = 'level.color.temperature';
                        obj.common.min = 153;
                        obj.common.max = 500;
                        break;
                    case 'alert':
                        obj.common.type = 'string';
                        break;
                    case 'effect':
                        obj.common.type = 'string';
                        break;
                    case 'colormode':
                        obj.common.type = 'string';
                        break;
                    case 'reachable':
                        obj.common.type = 'boolean';
                        obj.common.write = false;
                        obj.common.role = 'indicator.reachable';
                        break;
                    default:
                }
                adapter.setObject(objId, obj);
            }

            adapter.setObject(channelName, {
                type: 'channel',
                parent: config.config.name,
                children: children,
                common: {
                    name: channelName,
                    role: light.type === 'Dimmable plug-in unit' || light.type === 'Dimmable Light' ? 'light.dimmer' : 'light.color'
                },
                native: {
                    id: id,
                    type: light.type,
                    name: light.name,
                    modelid: light.modelid,
                    swversion: light.swversion,
                    pointsymbol: light.pointsymbol
                }
            });

        }
        adapter.log.info('created/updated ' + count + ' light channels');

        // Create/update device
        adapter.log.info('creating/updating bridge device');
        adapter.setObject(config.config.name, {
            type: 'device',
            children: devChildren,
            common: {
                name: config.config.name
            },
            native: config.config
        });

    });

    if (adapter.config.polling && adapter.config.pollingInterval > 0) {
        setTimeout(pollSingle, adapter.config.pollingInterval * 1000);
    }

}

var c = 0;

function pollSingle() {
    if (c >= pollIds.length) {
        c = 0;s
        setTimeout(pollSingle, adapter.config.pollingInterval * 1000);
        return;
    } else {
        adapter.log.debug('polling light ' + pollIds[c]);
        api.lightStatus(pollIds[c], function(err, result) {
            if (err) {
                adapter.log.error(err);
            } if (!result) {
                adapter.log.error('Cannot get result for lightStatus' + pollIds[c]);
            } else {
                for (var state in result.state) {
                    var objId = pollChannels[c] + '.' + state;
                    adapter.setState(objId, {val: result.state[state], ack: true});
                }
            }
            c += 1;
            setTimeout(pollSingle, 50);
        });
    }
}

