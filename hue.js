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
    if (!id || !state || state.ack) {
        return;
    }

    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
    var tmp = id.split('.');
    var dp  = tmp.pop();
    id      = tmp.slice(2).join('.');
    var ls = {};
    //if .on changed instead change .bri to 254 or 0
    if (dp == 'on') {
        var bri = state.val ? 254 : 0;
        adapter.setState([id, 'bri'].join('.'), {val: bri, ack: false});
        return;
    }
    //get lamp states
    adapter.getStates(id + '.*', function (err, idStates){
        if (err) {
            adapter.log.error(err);
            return;
        }
        //gather states that need to be changed
        var ls = {};
        var alls = {};
        var lampOn = false;
        for (var idState in idStates) {
            var idtmp = idState.split('.');
            var iddp  = idtmp.pop();
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
                    if (dp == 'r' || dp == 'g' || dp == 'b'){
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
                    alls[iddp] = idStates[idState].val;
                case 'sat':
                    alls[iddp] = idStates[idState].val;
                    if (dp == 'hue' || dp == 'sat'){
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
                        try{
                            var commands = JSON.parse(state.val);
                            for (var command in commands) {
                                if (command == 'on') {
                                    //convert on to bri
                                    if (commands[command] && !commands.hasOwnProperty('bri')) {
                                        ls['bri'] = 254;
                                    }else {
                                        ls['bri'] = 0;
                                    }
                                }else {
                                    ls[command] = commands[command];
                                }
                            }
                        } catch (e) {
                            adapter.log.error(e);
                            return;
                        }
                    }
                default:
                    alls[iddp] = idStates[idState].val;
                    break;
            }
        }
        //apply rgb to xy
        if ('r' in ls || 'g' in ls || 'b' in ls) {
            if (! ('r' in ls)){
                ls.r = 0;
            }
            if (! ('g' in ls)){
                ls.g = 0;
            }
            if (! ('b' in ls)){
                ls.b = 0;
            }
            var xyb = calculateXYB({'r': ls.r/255, 'g': ls.g/255, 'b': ls.b/255});
            ls.bri = Math.max(ls.r,ls.g,ls.b);
            ls.xy = xyb.x + ',' + xyb.y;
        }


        //create lightState from ls
        //and check values
        var lightState = hue.lightState.create();
        var finalLS = {};
        if (ls.bri > 0) {
            lightState = lightState.on().bri(Math.min(254,ls.bri));
            finalLS['bri'] = Math.min(254,ls.bri);
            finalLS['on'] = true;
        }else {
            lightState = lightState.off();
            finalLS['bri'] = 0;
            finalLS['on'] = false;
        }
        if ('xy' in ls) {
            var xy = ls.xy.split(',');
            xy = {'x': xy[0], 'y': xy[1]};
            if (!checkPointInLampsReach(xy,colorPointsForModel(''))) {
                var colorPoints = colorPointsForModel('');
                //It seems the colour is out of reach
                //let's find the closest colour we can produce with our lamp and send this XY value out.

                //Find the closest point on each line in the triangle.
                var pAB = getClosestPointToPoints(colorPoints.r,colorPoints.g,xy);
                var pAC = getClosestPointToPoints(colorPoints.b,colorPoints.r,xy);
                var pBC = getClosestPointToPoints(colorPoints.g,colorPoints.b,xy);

                //Get the distances per point and see which point is closer to our Point.
                var dAB = getDistanceBetweenTwoPoints(xy,pAB);
                var dAC = getDistanceBetweenTwoPoints(xy,pAC);
                var dBC = getDistanceBetweenTwoPoints(xy,pBC);

                var lowest = dAB;
                var closestPoint = pAB;

                if (dAC < lowest) {
                    lowest = dAC;
                    closestPoint = pAC;
                }
                if (dBC < lowest) {
                    lowest = dBC;
                    closestPoint = pBC;
                }

                //Change the xy value to a value which is within the reach of the lamp.
                xy.x = closestPoint.x;
                xy.y = closestPoint.y;
            }
            finalLS['xy'] = xy.x + ',' + xy.y;
            lightState = lightState.xy(xy.x,xy.y);
            if (!lampOn && (!('bri' in ls) || ls.bri == 0)) {
                lightState = lightState.on();
                lightState = lightState.bri(254);
                finalLS['bri'] = 254;
                finalLS['on'] = true;
            }
        }
        if ('ct' in ls) {
            finalLS['ct'] = Math.max(153,Math.min(500,ls.ct));
            lightState = lightState.ct(finalLS.ct);
            if (!lampOn && (!('bri' in ls) || ls.bri == 0)) {
                lightState = lightState.on();
                lightState = lightState.bri(254);
                finalLS['bri'] = 254;
                finalLS['on'] = true;
            }
        }
        if ('hue' in ls) {
            finalLS['hue'] = Math.max(0,Math.min(65535,ls.hue))
            lightState = lightState.hue(finalLS.hue);
            if (!lampOn && (!('bri' in ls) || ls.bri == 0)) {
                lightState = lightState.on();
                lightState = lightState.bri(254);
                finalLS['bri'] = 254;
                finalLS['on'] = true;
            }
        }
        if ('sat' in ls) {
            finalLS['sat'] = Math.max(0,Math.min(254,ls.sat));
            lightState = lightState.sat(finalLS.sat);
            if (!lampOn && (!('bri' in ls) || ls.bri == 0)) {
                lightState = lightState.on();
                lightState = lightState.bri(254);
                finalLS['bri'] = 254;
                finalLS['on'] = true;
            }
        }
        if ('alert' in ls) {
            if (['select','lselect'].indexOf(ls.alert) == -1) finalLS['alert'] = 'none';
            else finalLS['alert'] = ls.alert;
            lightState = lightState.alert(finalLS.alert);
        }
        if ('effect' in ls) {
            if (['colorloop'].indexOf(ls.effect) == -1) finalLS['effect'] = 'none';
            else finalLS['effect'] = ls.effect;
            lightState = lightState.effect(finalLS.effect);
            if (!lampOn && (finalLS['effect'] != 'none' && !('bri' in ls) || ls.bri == 0)) {
                lightState = lightState.on();
                lightState = lightState.bri(254);
                finalLS['bri'] = 254;
                finalLS['on'] = true;
            }
        }

        //only available in command state
        if ('transitiontime' in ls){
            var transitiontime = parseInt(ls['transitiontime']);
            if (!isNaN(transitiontime)){
                finalLS['transitiontime'] = transitiontime;
                lightState = lightState.transitiontime(transitiontime);
            }
        }
        if ('sat_inc' in ls && !('sat' in finalLS) && 'sat' in alls){
            finalLS['sat'] = (((ls['sat_inc']+alls['sat']) % 255) + 255) % 255;
            if (!lampOn && (!('bri' in ls) || ls.bri == 0)) {
                lightState = lightState.on();
                lightState = lightState.bri(254);
                finalLS['bri'] = 254;
                finalLS['on'] = true;
            }
            lightState = lightState.sat(finalLS['sat']);
        }
        if ('hue_inc' in ls && !('hue' in finalLS) && 'hue' in alls){
            finalLS['hue'] = (((ls['hue_inc']+alls['hue']) % 65536) + 65536) % 65536;
            if (!lampOn && (!('bri' in ls) || ls.bri == 0)) {
                lightState = lightState.on();
                lightState = lightState.bri(254);
                finalLS['bri'] = 254;
                finalLS['on'] = true;
            }
            lightState = lightState.hue(finalLS['hue']);
        }
        if ('ct_inc' in ls && !('ct' in finalLS) && 'ct' in alls){
            finalLS['ct'] =  (((((alls['ct']-153)+ls['ct_inc']) % 348) + 348) % 348) + 153;
            if (!lampOn && (!('bri' in ls) || ls.bri == 0)) {
                lightState = lightState.on();
                lightState = lightState.bri(254);
                finalLS['bri'] = 254;
                finalLS['on'] = true;
            }
            lightState = lightState.ct(finalLS['ct']);
        }
        if('bri_inc' in ls && !commands.hasOwnProperty('bri')) {
            finalLS['bri'] = (((alls['bri'] + ls['bri_inc']) % 255) + 255) % 255;
            if (finalLS['bri'] == 0) {
                if (lampOn){
                    lightState = lightState.on(false);
                    finalLS['on'] = false;
                } else {
                    adapter.setState([id, 'bri'].join('.'), {val: 0, ack: false});
                    return;
                }
            }else{
                finalLS['on'] = true;
                lightState = lightState.on();
            }
            lightState = lightState.bri(finalLS['bri']);
        }

        //change colormode
        if ('xy' in finalLS) {
            finalLS['colormode'] = 'xy';
        } else if ('ct' in finalLS) {
            finalLS['colormode'] = 'ct';
        } else if ('hue' in finalLS || 'sat' in finalLS) {
            finalLS['colormode'] = 'hs';
        }

        //log final changes / states
        adapter.log.info('final lightState: ' + JSON.stringify(finalLS));


        //set lightState
        adapter.getObject(id, function (err, obj) {
            if (err) {
                adapter.log.error(err);
                return;
            }

            if (obj.common.role == 'LightGroup') {
                api.setGroupLightState(groupIds[id], lightState, function (err, res) {
                    if (err || !res) {
                        adapter.log.error('error: ' + err);
                        return;
                    }
                });
            }else {
                api.setLightState(channelIds[id], lightState, function (err, res) {
                    if (err || !res) {
                        adapter.log.error('error: ' + err);
                        return;
                    }
                    //write back known states
                    for (var finalState in finalLS) {
                        if (finalState in alls){
                            adapter.log.info('writing state "' + [id, finalState].join('.') + '" : ' + finalLS[finalState]);
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
                browse(obj.message,function(res) {
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                });
                wait = true;
                break;
            case 'createUser':
                createUser(obj.message,function(res) {
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, res, obj.callback);
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

function createUser(ip,callback) {
    callback(ip);
}

var HueApi     = hue.HueApi;
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
            adapter.log.error(JSON.stringify(err));
            process.exit(1);
        } else if (!config) {
            adapter.log.error('Cannot get the configuration from hue bridge');
            process.exit(1);
        }

        var channelNames = [];

        // Create/update lamps
        adapter.log.info('creating/updating light channels');

        var lights = config.lights;
        var count = 0;
        for (var id in lights) {
            count += 1;
            var light = lights[id];

            var channelName = config.config.name + '.' + light.name;
            if (channelNames.indexOf(channelName) !== -1) {
                adapter.log.warn('channel "' + channelName + '" already exists, skipping lamp');
                continue;
            }else {
                channelNames.push(channelName);
            }
            channelIds[channelName.replace(/\s/g,'_')] = id;
            pollIds.push(id);
            pollChannels.push(channelName.replace(/\s/g,'_'));

            if (light.type !== 'Dimmable plug-in unit' && light.type !== 'Dimmable light') {
                light.state.r = 0;
                light.state.g = 0;
                light.state.b = 0;
            }

            light.state.command = '{}';

            for (var state in light.state) {

                var objId = channelName + '.' + state;

                adapter.setState(objId.replace(/\s/g,'_'), {val: light.state[state], ack: true});

                var obj = {
                    type: 'state',
                    common: {
                        name: objId.replace(/\s/g,'_'),
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
                    case 'command':
                        obj.common.type = 'string';
                        obj.common.role = 'command';
                        break;
                    default:
                        adapter.log.info('skip: ' + state);
                        break;
                }
                adapter.setObject(objId.replace(/\s/g,'_'), obj);
            }

            adapter.setObject(channelName.replace(/\s/g,'_'), {
                type: 'channel',
                common: {
                    name: channelName.replace(/\s/g,'_'),
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


        // Create/update groups
        adapter.log.info('creating/updating light groups');

        var groups = config.groups;
        var count = 0;
        for (var id in groups) {
            count += 1;
            var group = groups[id];

            var groupName = config.config.name + '.' + group.name;
            if (channelNames.indexOf(groupName) !== -1) {
                adapter.log.warn('channel "' + groupName + '" already exists, skipping group');
                continue;
            }else {
                channelNames.push(groupName);
            }
            groupIds[groupName.replace(/\s/g,'_')] = id;

            group.action.r = 0;
            group.action.g = 0;
            group.action.b = 0;
            group.action.command = '{}';

            for (var action in group.action) {

                var objId = groupName + '.' + action;

                adapter.setState(objId.replace(/\s/g,'_'), {val: group.action[action], ack: true});

                var obj = {
                    type: 'state',
                    common: {
                        name: objId.replace(/\s/g,'_'),
                        read: true,
                        write: true
                    },
                    native: {
                        id: id
                    }
                };

                switch (action) {
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
                    case 'command':
                        obj.common.type = 'string';
                        obj.common.role = 'command';
                        break;
                    default:
                        adapter.log.info('skip: ' + action);
                        break;
                }
                adapter.setObject(objId.replace(/\s/g,'_'), obj);
            }

            adapter.setObject(groupName.replace(/\s/g,'_'), {
                type: 'channel',
                common: {
                    name: groupName.replace(/\s/g,'_'),
                    role: group.type
                },
                native: {
                    id: id,
                    type: group.type,
                    name: group.name,
                    lights: group.lights
                }
            });
        }
        adapter.log.info('created/updated ' + count + ' light groups');


        // Create/update device
        adapter.log.info('creating/updating bridge device');
        adapter.setObject(config.config.name.replace(/\s/g,'_'), {
            type: 'device',
            common: {
                name: config.config.name.replace(/\s/g,'_')
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
        return;
    } else {
        adapter.log.debug('polling light ' + pollChannels[count]);
        api.lightStatus(pollIds[count], function (err, result) {
            if (err) {
                adapter.log.error(err);
            } if (!result) {
                adapter.log.error('Cannot get result for lightStatus' + pollIds[count]);
            } else {
                var states = {};
                for (var state in result.state) {
                    states[state] = result.state[state];
                }
                if (states.reachable == false) {
                    states.bri = 0;
                    states.on = false;
                }
                if (states.on == false) {
                    states.bri = 0;
                }
                for (var state in states) {
                    var objId = pollChannels[count] + '.' + state;
                    adapter.setState(objId, {val: states[state], ack: true});
                }
            }
            count++;
            setTimeout(pollSingle, 50, count);
        });
    }
}



//rgb conversion functions
function colorPointsForModel(model)  {
    return {
        'r': {'x': 0.674, 'y': 0.322},
        'g': {'x': 0.408, 'y': 0.517},
        'b': {'x': 0.168, 'y': 0.041}
    }
}

function calculateXYB(rgb) {
    var red = rgb.r;
    var green = rgb.g;
    var blue = rgb.b;

    // Apply gamma correction
    var r = (red   > 0.04045) ? Math.pow((red   + 0.055) / (1.0 + 0.055), 2.4) : (red   / 12.92);
    var g = (green > 0.04045) ? Math.pow((green + 0.055) / (1.0 + 0.055), 2.4) : (green / 12.92);
    var b = (blue  > 0.04045) ? Math.pow((blue  + 0.055) / (1.0 + 0.055), 2.4) : (blue  / 12.92);

    // Wide gamut conversion D65
    var X = r * 0.664511 + g * 0.154324 + b * 0.162028;
    var Y = r * 0.283881 + g * 0.668433 + b * 0.047685;
    var Z = r * 0.000088 + g * 0.072310 + b * 0.986039;

    var cx = X / (X + Y + Z);
    var cy = Y / (X + Y + Z);

    if (isNaN(cx)) {
        cx = 0.0;
    }

    if (isNaN(cy)) {
        cy = 0.0;
    }

    var xyPoint = {'x': cx, 'y': cy};
    var colorPoints = colorPointsForModel('');
    var inReachOfLamps = checkPointInLampsReach(xyPoint, colorPoints);

    if (inReachOfLamps) {
        return {'x': cx, 'y': cy, 'b': Y};    //Math.max(rgb.r,rgb.g,rgb.b)
    }

    //It seems the colour is out of reach
    //let's find the closest colour we can produce with our lamp and send this XY value out.

    //Find the closest point on each line in the triangle.
    var pAB = getClosestPointToPoints(colorPoints.r,colorPoints.g,xyPoint);
    var pAC = getClosestPointToPoints(colorPoints.b,colorPoints.r,xyPoint);
    var pBC = getClosestPointToPoints(colorPoints.g,colorPoints.b,xyPoint);

    //Get the distances per point and see which point is closer to our Point.
    var dAB = getDistanceBetweenTwoPoints(xyPoint,pAB);
    var dAC = getDistanceBetweenTwoPoints(xyPoint,pAC);
    var dBC = getDistanceBetweenTwoPoints(xyPoint,pBC);

    var lowest = dAB;
    var closestPoint = pAB;

    if (dAC < lowest) {
        lowest = dAC;
        closestPoint = pAC;
    }
    if (dBC < lowest) {
        lowest = dBC;
        closestPoint = pBC;
    }

    //Change the xy value to a value which is within the reach of the lamp.
    cx = closestPoint.x;
    cy = closestPoint.y;

    return {'x': cx, 'y': cy, 'b': Y};
}

function colorFromXYB(xyb) {
    var xy = {'x': xyb.x, 'y': xyb.y};
    var colorPoints = colorPointsForModel('');
    var inReachOfLamps = checkPointInLampsReach(xy,colorPoints);

    if (!inReachOfLamps) {
        //It seems the colour is out of reach
        //let's find the closest colour we can produce with our lamp and send this XY value out.

        //Find the closest point on each line in the triangle.
        var pAB = getClosestPointToPoints(colorPoints.r,colorPoints.g,xy);
        var pAC = getClosestPointToPoints(colorPoints.b,colorPoints.r,xy);
        var pBC = getClosestPointToPoints(colorPoints.g,colorPoints.b,xy);

        //Get the distances per point and see which point is closer to our Point.
        var dAB = getDistanceBetweenTwoPoints(xy,pAB);
        var dAC = getDistanceBetweenTwoPoints(xy,pAC);
        var dBC = getDistanceBetweenTwoPoints(xy,pBC);

        var lowest = dAB;
        var closestPoint = pAB;

        if (dAC < lowest) {
            lowest = dAC;
            closestPoint = pAC;
        }
        if (dBC < lowest) {
            lowest = dBC;
            closestPoint = pBC;
        }

        //Change the xy value to a value which is within the reach of the lamp.
        xy.x = closestPoint.x;
        xy.y = closestPoint.y;
    }
    var x = xy.x;
    var y = xy.y;
    var z = 1.0 - x - y;

    var Y = xyb.b;
    var X = (Y / y) * x;
    var Z = (Y / y) * z;

    // sRGB D65 conversion
    var r =  X * 1.656492 - Y * 0.354851 - Z * 0.255038;
    var g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
    var b =  X * 0.051713 - Y * 0.121364 + Z * 1.011530;

    if (r > b && r > g && r > 1.0) {
        // red is too big
        g = g / r;
        b = b / r;
        r = 1.0;
    }
    else if (g > b && g > r && g > 1.0) {
        // green is too big
        r = r / g;
        b = b / g;
        g = 1.0;
    }
    else if (b > r && b > g && b > 1.0) {
        // blue is too big
        r = r / b;
        g = g / b;
        b = 1.0;
    }

    // Apply gamma correction
    r = r <= 0.0031308 ? 12.92 * r : (1.0 + 0.055) * Math.pow(r, (1.0 / 2.4)) - 0.055;
    g = g <= 0.0031308 ? 12.92 * g : (1.0 + 0.055) * Math.pow(g, (1.0 / 2.4)) - 0.055;
    b = b <= 0.0031308 ? 12.92 * b : (1.0 + 0.055) * Math.pow(b, (1.0 / 2.4)) - 0.055;

    if (r > b && r > g) {
        // red is biggest
        if (r > 1.0) {
            g = g / r;
            b = b / r;
            r = 1.0;
        }
    }
    else if (g > b && g > r) {
        // green is biggest
        if (g > 1.0) {
            r = r / g;
            b = b / g;
            g = 1.0;
        }
    }
    else if (b > r && b > g) {
        // blue is biggest
        if (b > 1.0) {
            r = r / b;
            g = g / b;
            b = 1.0;
        }
    }

    if (r<0) {
        r = 0.0;
    }
    if (g<0) {
        g = 0.0;
    }
    if (b<0) {
        b = 0.0;
    }

    return {'r': r, 'g': g, 'b': b};
}

function checkPointInLampsReach(xyP, cP) {
    var v1 = {'x': cP.g.x - cP.r.x, 'y': cP.g.y - cP.r.y};
    var v2 = {'x': cP.b.x - cP.r.x, 'y': cP.b.y - cP.r.y};
    var q =  {'x': xyP.x - cP.r.x, 'y': xyP.y - cP.r.y};
    var s = crossProduct(q,v2) / crossProduct(v1,v2);
    var t = crossProduct(v1,q) / crossProduct(v1,v2);
    if ( (s >= 0.0) && (t >= 0.0) && (s+t <= 1.0) ) {
        return true;
    }
    return false;
}

function crossProduct(p1,p2) {
    return (p1.x*p2.y - p1.y*p2.x);
}

function getClosestPointToPoints(a,b,p){
    var AP = {'x': p.x-a.x, 'y': p.y-a.y};
    var AB = {'x': b.x-a.x, 'y': b.y-a.y};
    var ab2 = AB.x*AB.x + AB.y*AB.y;
    var ap_ab = AP.x*AB.x + AP.y*AB.y;
    var t = ap_ab / ab2;
    if (t < 0.0) {
        t = 0.0;
    }
    else if (t > 1.0) {
        t = 1.0;
    }

    return {'x': a.x - AB.x*t, 'y': a.y + AB.y * t};
}

function getDistanceBetweenTwoPoints(one,two) {
    var dx = one.x - two.x;
    var dy = one.y - two.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    return dist;
}

