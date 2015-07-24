/**
 *
 *      ioBroker Philips Hue Bridge Adapter
 *
 *      (c) 2014-2015 hobbyquaker
 *
 *      MIT License
 *
 */
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

var hue   = require('node-hue-api');
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils

var adapter = utils.adapter('hue');

adapter.on('stateChange', function (id, state) {
    if (id && state && !state.ack) {
        adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
        var tmp = id.split('.');
        var dp  = tmp.pop();
        id      = tmp.slice(2).join('.');
        var ls = {};
        ls[dp] = state.val;
        if(dp == 'r' || dp == 'g' || dp == 'b') {
            var rgb = {};
            adapter.getState([id, 'r'].join('.'), function (err, astate){
                rgb['r'] = Math.round(astate.val);
            });
            adapter.getState([id, 'g'].join('.'), function (err, astate) {
                rgb['g'] = Math.round(astate.val);
            });
            adapter.getState([id, 'b'].join('.'), function (err, astate) {
                rgb['b'] = Math.round(astate.val);
                var brightness = Math.min(254,Math.max(rgb.r,rgb.g,rgb.b));
                var huestate = hue.lightState.create().on().rgb(rgb.r,rgb.g,rgb.b).bri(brightness);
                api.setLightState(channelIds[id], huestate, function (err, res) {
                    if (!err && res) {
                        adapter.setState([id, dp].join('.'), {val: Math.round(state.val), ack: true});
                        if (brightness == 0) {
                            var huestate = hue.lightState.create().off();
                            api.setLightState(channelIds[id], huestate, function (err, res) {
                                if (!err && res) {
                                    adapter.setState([id, 'on'].join('.'), {val: false, ack: true});
                                }
                            });
                        }else {
                            adapter.setState([id, 'on'].join('.'), {val: true, ack: true});
                        }
                        adapter.setState([id, 'bri'].join('.'), {val: brightness, ack: true});
                    }
                });
            });
        }else{
            if (dp == 'ct') {
                ls['on'] = true;
            }
            if (dp == 'bri' && state.val > 0) {
                ls['on'] = true;
            }else if (dp == 'bri' && state.val == 0){
                ls['on'] = false;
            }
            api.setLightState(channelIds[id], ls, function (err, res) {
                if (!err && res) {
                    adapter.setState([id, dp].join('.'), {val: state.val, ack: true});
                    if (dp == 'bri') {
                        adapter.setState([id, 'on'].join('.'), {val: ls.on, ack: true});
                    }else if (dp == 'on' && state.val == true) {
                        adapter.getState([id, 'bri'].join('.'), function (err, astate) {
                            if (astate.val < 5) {
                                adapter.setState([id, 'bri'].join('.'), {val: 5, ack: true});
                            }
                        });
                    }
                }
            });
        }
    }
});

adapter.on('message', function (obj) {
    if (obj) processMessage(obj);
    processMessages();
});

adapter.on('unload', function (callback) {
    try {
        adapter.log.info('terminating');
        callback();
    } catch (e) {
        callback();
    }
});

adapter.on('ready', function () {
    main();
});

var HueApi     = hue.HueApi;
var lightState = hue.lightState;
var api;

var channelIds = {};
var pollIds = [];
var pollChannels = [];

function processMessage(obj) {
    if (!obj || !obj.command) return;

    switch (obj.command) {
        case 'browse': {
                browse(function (res) {
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, res, obj.callback);
                });
            }
            break;

        case 'stopInstance': {
            //unloadHMM();
        }
    }
}

function processMessages() {
    adapter.getMessage(function (err, obj) {
        if (obj) {
            processMessage(obj.command, obj.message);
            processMessages();
        }
    });
}

function browse(callback) {
    var res = [];
    setTimeout(function () {
        if (callback) callback(res);
    }, 3000);

    api.nupnpSearch(function(err, result) {
        if (!err && result) res.push(result);
    });
}

function main() {
    adapter.subscribeStates('*');

    api = new HueApi(adapter.config.bridge, adapter.config.user);

    api.getFullState(function (err, config) {
        if (err) {
            adapter.log.error(JSON.stringify(err));
            process.exit(1);
        } else if (!config) {
            adapter.log.error('Cannot get the configuration from hue bridge');
            process.exit(1);
        }

        // Create/update lamps
        adapter.log.info('creating/updating light channels');

        var lights = config.lights;
        var count = 0;
        for (var id in lights) {
            count += 1;
            var light = lights[id];

            var channelName = config.config.name + '.' + light.name;
            channelIds[channelName] = id;
            pollIds.push(id);
            pollChannels.push(channelName);

            light.state.r = 0;
            light.state.g = 0;
            light.state.b = 0;

            for (var state in light.state) {

                var objId = channelName + '.' + state;

                adapter.setState(objId, {val: light.state[state], ack: true});

                var obj = {
                    type: 'state',
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
                        obj.common.max = 254;
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
                        obj.common.max = 254;
                        break;
                    case 'xy':
                        obj.common.type = 'string';
                        obj.common.role = 'level.color.xy';
                        break;
                    case 'ct':
                        obj.common.type = 'number';
                        obj.common.role = 'level.color.temperature';
                        obj.common.min = 153;
                        obj.common.max = 500;
                        break;
                    case 'alert':
                        obj.common.type = 'string';
                        obj.common.role = 'switch';
                        break;
                    case 'effect':
                        obj.common.type = 'string';
                        obj.common.role = 'switch';
                        break;
                    case 'colormode':
                        obj.common.type = 'string';
                        obj.common.role = 'indicator.colormode';
                        obj.common.write = false;
                        break;
                    case 'reachable':
                        obj.common.type = 'boolean';
                        obj.common.write = false;
                        obj.common.role = 'indicator.reachable';
                        break;
                    case 'r':
                        obj.common.type = 'number';
                        obj.common.role = 'level.color.r';
                        obj.common.min = 0;
                        obj.common.max = 255;
                        break;
                    case 'g':
                        obj.common.type = 'number';
                        obj.common.role = 'level.color.g';
                        obj.common.min = 0;
                        obj.common.max = 255;
                        break;
                    case 'b':
                        obj.common.type = 'number';
                        obj.common.role = 'level.color.b';
                        obj.common.min = 0;
                        obj.common.max = 255;
                        break;
                    default:
                        adapter.log.info('skip: ' + state);
                        break;
                }
                adapter.setObject(objId, obj);
            }

            adapter.setObject(channelName, {
                type: 'channel',
                common: {
                    name: channelName,
                    role: light.type === 'Dimmable plug-in unit' || light.type === 'Dimmable light' ? 'light.dimmer' : 'light.color'
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
        c = 0;
        setTimeout(pollSingle, adapter.config.pollingInterval * 1000);
        return;
    } else {
        adapter.log.debug('polling light ' + pollIds[c]);
        api.lightStatus(pollIds[c], function (err, result) {
            if (err) {
                adapter.log.error(err);
            } if (!result) {
                adapter.log.error('Cannot get result for lightStatus' + pollIds[c]);
            } else {
                var states = {};
                for (var state in result.state) {
                    states[state] = result.state[state];
                }
                if (states.reachable == false) {
                    states.bri = 0;
                    states.on = false;
                }
                for (var state in states) {
                    var objId = pollChannels[c] + '.' + state;
                    adapter.setState(objId, {val: states[state], ack: true});
                }
            }
            c += 1;
            setTimeout(pollSingle, 50);
        });
    }
}
