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

var hue = require('node-hue-api');
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils
var huehelper = require('./lib/HueHelper');

var adapter = utils.adapter('hue');

adapter.on('stateChange', function (id, state) {
    if (!id || !state || state.ack) {
        return;
    }

    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
    var tmp = id.split('.');
    var dp = tmp.pop();
    id = tmp.slice(2).join('.');
    var ls = {};
    //if .on changed instead change .bri to 254 or 0
    var bri = 0;
    if (dp == 'on') {
        bri = state.val ? 254 : 0;
        adapter.setState([id, 'bri'].join('.'), {val: bri, ack: false});
        return;
    }
    //if .level changed instead change .bri to level.val*254
    if (dp == 'level') {
        bri = Math.max(Math.min(Math.round(state.val * 2.54), 254), 0);
        adapter.setState([id, 'bri'].join('.'), {val: bri, ack: false});
        return;
    }
    //get lamp states
    adapter.getStates(id + '.*', function (err, idStates) {
        if (err) {
            adapter.log.error(err);
            return;
        }
        //gather states that need to be changed
        ls = {};
        var alls = {};
        var lampOn = false;
        for (var idState in idStates) {
            if (!idStates.hasOwnProperty(idState)) {
                continue;
            }
            var idtmp = idState.split('.');
            var iddp = idtmp.pop();
            switch (iddp) {
                case 'bri':
                    alls[iddp] = idStates[idState].val;
                    ls[iddp] = idStates[idState].val;
                    if (idStates[idState].ack && idStates[idState].val > 0) lampOn = true;
                    break;
                case 'alert':
                    alls[iddp] = idStates[idState].val;
                    if (dp == 'alert') ls[iddp] = idStates[idState].val;
                    break;
                case 'effect':
                    alls[iddp] = idStates[idState].val;
                    if (dp == 'effect') ls[iddp] = idStates[idState].val;
                    break;
                case 'r':
                case 'g':
                case 'b':
                    alls[iddp] = idStates[idState].val;
                    if (dp == 'r' || dp == 'g' || dp == 'b') {
                        ls[iddp] = idStates[idState].val;
                    }
                    break;
                case 'ct':
                    alls[iddp] = idStates[idState].val;
                    if (dp == 'ct') {
                        ls[iddp] = idStates[idState].val;
                    }
                    break;
                case 'hue':
                case 'sat':
                    alls[iddp] = idStates[idState].val;
                    if (dp == 'hue' || dp == 'sat') {
                        ls[iddp] = idStates[idState].val;
                    }
                    break;
                case 'xy':
                    alls[iddp] = idStates[idState].val;
                    if (dp == 'xy') {
                        ls[iddp] = idStates[idState].val;
                    }
                    break;
                case 'command':
                    if (dp == 'command') {
                        try {
                            var commands = JSON.parse(state.val);
                            for (var command in commands) {
                                if (!commands.hasOwnProperty(command)) {
                                    continue;
                                }
                                if (command == 'on') {
                                    //convert on to bri
                                    if (commands[command] && !commands.hasOwnProperty('bri')) {
                                        ls.bri = 254;
                                    } else {
                                        ls.bri = 0;
                                    }
                                } else {
                                    ls[command] = commands[command];
                                }
                            }
                        } catch (e) {
                            adapter.log.error(e);
                            return;
                        }
                    }
                    alls[iddp] = idStates[idState].val;
                    break;
                default:
                    alls[iddp] = idStates[idState].val;
                    break;
            }
        }

        //get lightState
        adapter.getObject(id, function (err, obj) {
            if (err) {
                adapter.log.error(err);
                return;
            }

            //apply rgb to xy with modelId
            if ('r' in ls || 'g' in ls || 'b' in ls) {
                if (!('r' in ls)) {
                    ls.r = 0;
                }
                if (!('g' in ls)) {
                    ls.g = 0;
                }
                if (!('b' in ls)) {
                    ls.b = 0;
                }
                var xyb = huehelper.RgbToXYB(ls.r / 255, ls.g / 255, ls.b / 255, (obj.native.hasOwnProperty('modelid') ? obj.native.modelid.trim() : 'default'));
                ls.bri = xyb.b;
                ls.xy = xyb.x + ',' + xyb.y;
            }


            //create lightState from ls
            //and check values
            var lightState = hue.lightState.create();
            var finalLS = {};
            if (ls.bri > 0) {
                lightState = lightState.on().bri(Math.min(254, ls.bri));
                finalLS.bri = Math.min(254, ls.bri);
                finalLS.on = true;
            } else {
                lightState = lightState.off();
                finalLS.bri = 0;
                finalLS.on = false;
            }
            if ('xy' in ls) {
                var xy = ls.xy.split(',');
                xy = {'x': xy[0], 'y': xy[1]};
                xy = huehelper.GamutXYforModel(xy.x, xy.y, (obj.native.hasOwnProperty('modelid') ? obj.native.modelid.trim() : 'default'));
                finalLS.xy = xy.x + ',' + xy.y;
                lightState = lightState.xy(xy.x, xy.y);
                if (!lampOn && (!('bri' in ls) || ls.bri === 0)) {
                    lightState = lightState.on();
                    lightState = lightState.bri(254);
                    finalLS.bri = 254;
                    finalLS.on = true;
                }
                var rgb = huehelper.XYBtoRGB(xy.x, xy.y, (finalLS.bri / 254));
                finalLS.r = Math.round(rgb.Red * 254);
                finalLS.g = Math.round(rgb.Green * 254);
                finalLS.b = Math.round(rgb.Blue * 254);
            }
            if ('ct' in ls) {
                finalLS.ct = Math.max(153, Math.min(500, ls.ct));
                lightState = lightState.ct(finalLS.ct);
                if (!lampOn && (!('bri' in ls) || ls.bri === 0)) {
                    lightState = lightState.on();
                    lightState = lightState.bri(254);
                    finalLS.bri = 254;
                    finalLS.on = true;
                }
            }
            if ('hue' in ls) {
                finalLS.hue = Math.max(0, Math.min(65535, ls.hue));
                lightState = lightState.hue(finalLS.hue);
                if (!lampOn && (!('bri' in ls) || ls.bri === 0)) {
                    lightState = lightState.on();
                    lightState = lightState.bri(254);
                    finalLS.bri = 254;
                    finalLS.on = true;
                }
            }
            if ('sat' in ls) {
                finalLS.sat = Math.max(0, Math.min(254, ls.sat));
                lightState = lightState.sat(finalLS.sat);
                if (!lampOn && (!('bri' in ls) || ls.bri === 0)) {
                    lightState = lightState.on();
                    lightState = lightState.bri(254);
                    finalLS.bri = 254;
                    finalLS.on = true;
                }
            }
            if ('alert' in ls) {
                if (['select', 'lselect'].indexOf(ls.alert) == -1) {
                    finalLS.alert = 'none';
                } else {
                    finalLS.alert = ls.alert;
                }
                lightState = lightState.alert(finalLS.alert);
            }
            if ('effect' in ls) {
                if (['colorloop'].indexOf(ls.effect) == -1) {
                    finalLS.effect = 'none';
                } else {
                    finalLS.effect = ls.effect;
                }
                lightState = lightState.effect(finalLS.effect);
                if (!lampOn && (finalLS.effect != 'none' && !('bri' in ls) || ls.bri === 0)) {
                    lightState = lightState.on();
                    lightState = lightState.bri(254);
                    finalLS.bri = 254;
                    finalLS.on = true;
                }
            }

            //only available in command state
            if ('transitiontime' in ls) {
                var transitiontime = parseInt(ls.transitiontime);
                if (!isNaN(transitiontime)) {
                    finalLS.transitiontime = transitiontime;
                    lightState = lightState.transitiontime(transitiontime);
                }
            }
            if ('sat_inc' in ls && !('sat' in finalLS) && 'sat' in alls) {
                finalLS.sat = (((ls.sat_inc + alls.sat) % 255) + 255) % 255;
                if (!lampOn && (!('bri' in ls) || ls.bri === 0)) {
                    lightState = lightState.on();
                    lightState = lightState.bri(254);
                    finalLS.bri = 254;
                    finalLS.on = true;
                }
                lightState = lightState.sat(finalLS.sat);
            }
            if ('hue_inc' in ls && !('hue' in finalLS) && 'hue' in alls) {
                finalLS.hue = (((ls.hue_inc + alls.hue) % 65536) + 65536) % 65536;
                if (!lampOn && (!('bri' in ls) || ls.bri === 0)) {
                    lightState = lightState.on();
                    lightState = lightState.bri(254);
                    finalLS.bri = 254;
                    finalLS.on = true;
                }
                lightState = lightState.hue(finalLS.hue);
            }
            if ('ct_inc' in ls && !('ct' in finalLS) && 'ct' in alls) {
                finalLS.ct = (((((alls.ct - 153) + ls.ct_inc) % 348) + 348) % 348) + 153;
                if (!lampOn && (!('bri' in ls) || ls.bri === 0)) {
                    lightState = lightState.on();
                    lightState = lightState.bri(254);
                    finalLS.bri = 254;
                    finalLS.on = true;
                }
                lightState = lightState.ct(finalLS.ct);
            }
            if ('bri_inc' in ls) {
                finalLS.bri = (((alls.bri + ls.bri_inc) % 255) + 255) % 255;
                if (finalLS.bri === 0) {
                    if (lampOn) {
                        lightState = lightState.on(false);
                        finalLS.on = false;
                    } else {
                        adapter.setState([id, 'bri'].join('.'), {val: 0, ack: false});
                        return;
                    }
                } else {
                    finalLS.on = true;
                    lightState = lightState.on();
                }
                lightState = lightState.bri(finalLS.bri);
            }

            //change colormode
            if ('xy' in finalLS) {
                finalLS.colormode = 'xy';
            } else if ('ct' in finalLS) {
                finalLS.colormode = 'ct';
            } else if ('hue' in finalLS || 'sat' in finalLS) {
                finalLS.colormode = 'hs';
            }

            //set level to final bri / 2.54
            if ('bri' in finalLS) {
                finalLS.level = Math.max(Math.min(Math.round(finalLS.bri / 2.54), 100), 0);
            }

            //log final changes / states
            adapter.log.info('final lightState: ' + JSON.stringify(finalLS));

            if (obj.common.role == 'LightGroup' || obj.common.role == 'Room') {
                api.setGroupLightState(groupIds[id], lightState, function (err, res) {
                    if (err || !res) {
                        adapter.log.error('error: ' + err);
                    }
                });
            } else {
                api.setLightState(channelIds[id], lightState, function (err, res) {
                    if (err || !res) {
                        adapter.log.error('error: ' + err);
                        return;
                    }
                    //write back known states
                    for (var finalState in finalLS) {
                        if (!finalLS.hasOwnProperty(finalState)) {
                            continue;
                        }
                        if (finalState in alls) {
                            adapter.setState([id, finalState].join('.'), {val: finalLS[finalState], ack: true});
                        }
                    }
                });
            }
        });

    });
});

// New message arrived. obj is array with current messages
adapter.on('message', function (obj) {
    var wait = false;
    if (obj) {
        switch (obj.command) {
            case 'browse':
                browse(obj.message, function (res) {
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                });
                wait = true;
                break;
            case 'createUser':
                createUser(obj.message, function (res) {
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                });
                wait = true;
                break;
            default:
                adapter.log.warn("Unknown command: " + obj.command);
                break;
        }
    }
    if (!wait && obj.callback) {
        adapter.sendTo(obj.from, obj.command, obj.message, obj.callback);
    }
    return true;
});

adapter.on('unload', function (callback) {
    try {
        adapter.log.info('terminating');
    } catch (e) {
        adapter.log.error(e);
    } finally {
        callback();
    }
});

adapter.on('ready', function () {
    main();
});

function browse(timeout, callback) {
    timeout = parseInt(timeout);
    if (isNaN(timeout)) timeout = 5000;
    hue.upnpSearch(timeout).then(callback).done();
}

function createUser(ip, callback) {
    var newUserName = null;
    var userDescription = "ioBroker.hue";
    try {
        var api = new HueApi();
        api.registerUser(ip, newUserName, userDescription)
            .then(function (newUser) {
                adapter.log.info('created new User: ' + newUser);
                callback({error: 0, message: newUser});
            })
            .fail(function (err) {
                callback({error: err.type, message: err.message});
            })
            .done();
    } catch (e) {
        adapter.log.error(e);
        callback({error: 1, message: JSON.stringify(e)});
    }
}

var HueApi = hue.HueApi;
var api;

var channelIds = {};
var pollIds = [];
var pollChannels = [];
var groupIds = {};

function main() {
    adapter.subscribeStates('*');

    api = new HueApi(adapter.config.bridge, adapter.config.user);

    api.getFullState(function (err, config) {
        if (err) {
            adapter.log.warn('could not connect to ip');
            setTimeout(main, 5000);
            return;
        } else if (!config) {
            adapter.log.warn('Cannot get the configuration from hue bridge');
            setTimeout(main, 5000);
            return;
        }

        var channelNames = [];

        // Create/update lamps
        adapter.log.info('creating/updating light channels');

        var lights = config.lights;
        var count = 0;
        for (var lid in lights) {
            if (!lights.hasOwnProperty(lid)) {
                continue;
            }
            count += 1;
            var light = lights[lid];

            var channelName = config.config.name + '.' + light.name;
            if (channelNames.indexOf(channelName) !== -1) {
                adapter.log.warn('channel "' + channelName + '" already exists, skipping lamp');
                continue;
            } else {
                channelNames.push(channelName);
            }
            channelIds[channelName.replace(/\s/g, '_')] = lid;
            pollIds.push(lid);
            pollChannels.push(channelName.replace(/\s/g, '_'));

            if (light.type !== 'Dimmable plug-in unit' && light.type !== 'Dimmable light') {
                light.state.r = 0;
                light.state.g = 0;
                light.state.b = 0;
            }

            light.state.command = '{}';
            light.state.level = 0;

            for (var state in light.state) {
                if (!light.state.hasOwnProperty(state)) {
                    continue;
                }
                var objId = channelName + '.' + state;

                adapter.setState(objId.replace(/\s/g, '_'), {val: light.state[state], ack: true});

                var lobj = {
                    type: 'state',
                    common: {
                        name: objId.replace(/\s/g, '_'),
                        read: true,
                        write: true
                    },
                    native: {
                        id: lid
                    }
                };

                switch (state) {
                    case 'on':
                        lobj.common.type = 'boolean';
                        lobj.common.role = 'switch';
                        break;
                    case 'bri':
                        lobj.common.type = 'number';
                        lobj.common.role = 'level.dimmer';
                        lobj.common.min = 0;
                        lobj.common.max = 254;
                        break;
                    case 'level':
                        lobj.common.type = 'number';
                        lobj.common.role = 'level.dimmer';
                        lobj.common.min = 0;
                        lobj.common.max = 100;
                        break;
                    case 'hue':
                        lobj.common.type = 'number';
                        lobj.common.role = 'level.color.hue';
                        lobj.common.min = 0;
                        lobj.common.max = 65535;
                        break;
                    case 'sat':
                        lobj.common.type = 'number';
                        lobj.common.role = 'level.color.saturation';
                        lobj.common.min = 0;
                        lobj.common.max = 254;
                        break;
                    case 'xy':
                        lobj.common.type = 'string';
                        lobj.common.role = 'level.color.xy';
                        break;
                    case 'ct':
                        lobj.common.type = 'number';
                        lobj.common.role = 'level.color.temperature';
                        lobj.common.min = 153;
                        lobj.common.max = 500;
                        break;
                    case 'alert':
                        lobj.common.type = 'string';
                        lobj.common.role = 'switch';
                        break;
                    case 'effect':
                        lobj.common.type = 'string';
                        lobj.common.role = 'switch';
                        break;
                    case 'colormode':
                        lobj.common.type = 'string';
                        lobj.common.role = 'indicator.colormode';
                        lobj.common.write = false;
                        break;
                    case 'reachable':
                        lobj.common.type = 'boolean';
                        lobj.common.write = false;
                        lobj.common.role = 'indicator.reachable';
                        break;
                    case 'r':
                        lobj.common.type = 'number';
                        lobj.common.role = 'level.color.r';
                        lobj.common.min = 0;
                        lobj.common.max = 255;
                        break;
                    case 'g':
                        lobj.common.type = 'number';
                        lobj.common.role = 'level.color.g';
                        lobj.common.min = 0;
                        lobj.common.max = 255;
                        break;
                    case 'b':
                        lobj.common.type = 'number';
                        lobj.common.role = 'level.color.b';
                        lobj.common.min = 0;
                        lobj.common.max = 255;
                        break;
                    case 'command':
                        lobj.common.type = 'string';
                        lobj.common.role = 'command';
                        break;
                    default:
                        adapter.log.info('skip: ' + state);
                        break;
                }
                adapter.setObject(objId.replace(/\s/g, '_'), lobj);
            }

            adapter.setObject(channelName.replace(/\s/g, '_'), {
                type: 'channel',
                common: {
                    name: channelName.replace(/\s/g, '_'),
                    role: light.type === 'Dimmable plug-in unit' || light.type === 'Dimmable light' ? 'light.dimmer' : 'light.color'
                },
                native: {
                    id: lid,
                    type: light.type,
                    name: light.name,
                    modelid: light.modelid,
                    swversion: light.swversion,
                    pointsymbol: light.pointsymbol
                }
            });

        }
        adapter.log.info('created/updated ' + count + ' light channels');


        // Create/update groups
        adapter.log.info('creating/updating light groups');

        var groups = config.groups;
		groups[0] = {
            name: "All",   //"Lightset 0"
            type: "LightGroup",
            id: 0,
            action: {
                alert: "select",
                bri: 0,
                colormode: "",
                ct: 0,
                effect: "none",
                hue: 0,
                on: false,
                sat: 0,
                xy: '0,0'
            }
        }
        count = 0;
        for (var gid in groups) {
            if (!groups.hasOwnProperty(gid)) {
                continue;
            }
            count += 1;
            var group = groups[gid];

            var groupName = config.config.name + '.' + group.name;
            if (channelNames.indexOf(groupName) !== -1) {
                adapter.log.warn('channel "' + groupName + '" already exists, skipping group');
                continue;
            } else {
                channelNames.push(groupName);
            }
            groupIds[groupName.replace(/\s/g, '_')] = gid;

            group.action.r = 0;
            group.action.g = 0;
            group.action.b = 0;
            group.action.command = '{}';
            group.action.level = 0;

            for (var action in group.action) {
                if (!group.action.hasOwnProperty(action)) {
                    continue;
                }

                var gobjId = groupName + '.' + action;

                adapter.setState(gobjId.replace(/\s/g, '_'), {val: group.action[action], ack: true});

                var gobj = {
                    type: 'state',
                    common: {
                        name: gobjId.replace(/\s/g, '_'),
                        read: true,
                        write: true
                    },
                    native: {
                        id: gid
                    }
                };

                switch (action) {
                    case 'on':
                        gobj.common.type = 'boolean';
                        gobj.common.role = 'switch';
                        break;
                    case 'bri':
                        gobj.common.type = 'number';
                        gobj.common.role = 'level.dimmer';
                        gobj.common.min = 0;
                        gobj.common.max = 254;
                        break;
                    case 'level':
                        gobj.common.type = 'number';
                        gobj.common.role = 'level.dimmer';
                        gobj.common.min = 0;
                        gobj.common.max = 100;
                        break;
                    case 'hue':
                        gobj.common.type = 'number';
                        gobj.common.role = 'level.color.hue';
                        gobj.common.min = 0;
                        gobj.common.max = 65535;
                        break;
                    case 'sat':
                        gobj.common.type = 'number';
                        gobj.common.role = 'level.color.saturation';
                        gobj.common.min = 0;
                        gobj.common.max = 254;
                        break;
                    case 'xy':
                        gobj.common.type = 'string';
                        gobj.common.role = 'level.color.xy';
                        break;
                    case 'ct':
                        gobj.common.type = 'number';
                        gobj.common.role = 'level.color.temperature';
                        gobj.common.min = 153;
                        gobj.common.max = 500;
                        break;
                    case 'alert':
                        gobj.common.type = 'string';
                        gobj.common.role = 'switch';
                        break;
                    case 'effect':
                        gobj.common.type = 'string';
                        gobj.common.role = 'switch';
                        break;
                    case 'colormode':
                        gobj.common.type = 'string';
                        gobj.common.role = 'indicator.colormode';
                        gobj.common.write = false;
                        break;
                    case 'r':
                        gobj.common.type = 'number';
                        gobj.common.role = 'level.color.r';
                        gobj.common.min = 0;
                        gobj.common.max = 255;
                        break;
                    case 'g':
                        gobj.common.type = 'number';
                        gobj.common.role = 'level.color.g';
                        gobj.common.min = 0;
                        gobj.common.max = 255;
                        break;
                    case 'b':
                        gobj.common.type = 'number';
                        gobj.common.role = 'level.color.b';
                        gobj.common.min = 0;
                        gobj.common.max = 255;
                        break;
                    case 'command':
                        gobj.common.type = 'string';
                        gobj.common.role = 'command';
                        break;
                    default:
                        adapter.log.info('skip: ' + action);
                        continue;
                        break;
                }
                adapter.setObject(gobjId.replace(/\s/g, '_'), gobj);
            }

            adapter.setObject(groupName.replace(/\s/g, '_'), {
                type: 'channel',
                common: {
                    name: groupName.replace(/\s/g, '_'),
                    role: group.type
                },
                native: {
                    id: gid,
                    type: group.type,
                    name: group.name,
                    lights: group.lights
                }
            });
        }
        adapter.log.info('created/updated ' + count + ' light groups');


        // Create/update device
        adapter.log.info('creating/updating bridge device');
        adapter.setObject(config.config.name.replace(/\s/g, '_'), {
            type: 'device',
            common: {
                name: config.config.name.replace(/\s/g, '_')
            },
            native: config.config
        });

    });

    if (adapter.config.polling && adapter.config.pollingInterval > 0) {
        setTimeout(pollSingle, 5 * 1000, 0);
    }
}

function pollSingle(count) {
    if (count >= pollIds.length) {
        count = 0;
        setTimeout(pollSingle, adapter.config.pollingInterval * 1000, count);
    } else {
        adapter.log.debug('polling light ' + pollChannels[count]);
        api.lightStatus(pollIds[count], function (err, result) {
            if (err) {
                adapter.log.error(err);
            }
            if (!result) {
                adapter.log.error('Cannot get result for lightStatus' + pollIds[count]);
            } else {
                var states = {};
                for (var stateA in result.state) {
                    if (!result.state.hasOwnProperty(stateA)) {
                        continue;
                    }
                    states[stateA] = result.state[stateA];
                }
                if (states.reachable === false) {
                    states.bri = 0;
                    states.on = false;
                }
                if (states.on === false) {
                    states.bri = 0;
                }
                if (states.xy !== undefined) {
                    var xy = states.xy.toString().split(',');
                    states.xy = states.xy.toString();
                    var rgb = huehelper.XYBtoRGB(xy[0], xy[1], (states.bri / 254));
                    //adapter.log.info("xy"+states.xy+" split:"+JSON.stringify(xy)+" rgb:"+JSON.stringify(rgb));
                    states.r = Math.round(rgb.Red * 254);
                    states.g = Math.round(rgb.Green * 254);
                    states.b = Math.round(rgb.Blue * 254);
                }
                states.level = Math.max(Math.min(Math.round(states.bri / 2.54), 100), 0);
                for (var stateB in states) {
                    if (!states.hasOwnProperty(stateB)) {
                        continue;
                    }
                    var objId = pollChannels[count] + '.' + stateB;
                    adapter.setState(objId, {val: states[stateB], ack: true});
                }
            }
            count++;
            setTimeout(pollSingle, 50, count);
        });
    }
}
