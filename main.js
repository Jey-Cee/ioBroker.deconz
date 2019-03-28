'use strict';

const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const request = require('request');

let adapter;




let hue_factor = 182.041666667;

function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: 'deconz',
        stateChange: function (id, state) {
    if (!id || !state || state.ack) {
        return;
    }

    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
    let tmp = id.split('.');
    let dp = tmp.pop();
    id = tmp.slice(2).join('.');
    adapter.log.debug('dp: ' + dp + '; id:' + id);

    adapter.getState(adapter.name + '.' + adapter.instance + '.' + id + '.transitiontime', function (err, ttime){
        if(err){
            ttime = 'none';
        }else if(ttime === null) {
            ttime = 'none';
        }else{
                ttime = ttime.val;
            }

        if(dp === 'bri'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                let controlId = obj.native.id;
                let parameters;
                if(ttime === 'none'){
                    parameters = '{"bri": ' + JSON.stringify(state.val) + '}';
                }else{
                    parameters = '{"transitiontime": ' + JSON.stringify(ttime) + ', "bri": ' + JSON.stringify(state.val) + '}';
                }
                
                if(state.val > 0){
                    if(obj.common.role == 'light'){
                        setLightState('{"on": true }', controlId, adapter.name + '.' + adapter.instance + '.' + id + '.on', function() {
                            setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.bri');
                        });
                    }else if(obj.common.role == 'group'){
                        setGroupState('{"on": true }', controlId, adapter.name + '.' + adapter.instance + '.' + id + '.on', function() {
                            setGroupState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.bri');
                        });
                    }
                } else {
                    if(obj.common.role == 'light'){
                        setLightState('{"on": false }', controlId, adapter.name + '.' + adapter.instance + '.' + id + '.on');
                    } else if(obj.common.role == 'group'){
                        setGroupState('{"on": false }', controlId, adapter.name + '.' + adapter.instance + '.' + id + '.on')
                    }
                }
            });
        }else if(dp === 'on'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                let controlId = obj.native.id;
                let parameters;
                if(ttime === 'none'){
                    parameters = '{"on": ' + JSON.stringify(state.val) + '}';
                }else{
                    parameters = '{"transitiontime": ' + JSON.stringify(ttime) + ', "on": ' + JSON.stringify(state.val) + '}';
                }
                //adapter.log.info('type: ' + obj.common.role);
                if(obj.common.role == 'light') {
                    setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.on')
                }else if(obj.common.role == 'group'){
                    setGroupState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.on')
                }
            });
        }else if(dp === 'hue'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                let controlId = obj.native.id;
                let parameters;
                let hue_factor = 182.041666667;
                if(ttime === 'none'){
                    parameters = '{"hue": ' + Math.round(parseInt(JSON.stringify(state.val)) * hue_factor) + '}';
                }else{
                    parameters = '{"transitiontime": ' + JSON.stringify(ttime) + ', "hue": ' + Math.round(parseInt(JSON.stringify(state.val)) * hue_factor) + '}';
                }
                //parameters = '{"hue": ' + parseInt(JSON.stringify(state.val)) * hue_factor + '}';
                if(obj.common.role == 'light') {
                    setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.hue')
                }else if(obj.common.role == 'group'){
                    setGroupState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.hue')
                }
            });
        }else if(dp === 'sat'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                let controlId = obj.native.id;
                let parameters;
                if(ttime === 'none'){
                    parameters = '{"sat": ' + JSON.stringify(state.val) + '}';
                }else{
                    parameters = '{"transitiontime": ' + JSON.stringify(ttime) + ', "sat": ' + JSON.stringify(state.val) + '}';
                }
                if(obj.common.role == 'light') {
                    setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.sat')
                }else if(obj.common.role == 'group'){
                    setGroupState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.sat')
                }
            });
        }else if(dp === 'ct'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                let controlId = obj.native.id;
                let parameters;
                if(ttime === 'none'){
                    parameters = '{"ct": ' + JSON.stringify(state.val) + '}';
                }else{
                    parameters = '{"transitiontime": ' + JSON.stringify(ttime) + ', "ct": ' + JSON.stringify(state.val) + '}';
                }
                if(obj.common.role == 'light') {
                    setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.ct')
                }else if(obj.common.role == 'group'){
                    setGroupState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.ct')
                }
            });
        }else if(dp === 'xy'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                let controlId = obj.native.id;
                let parameters;
                if(ttime === 'none'){
                    parameters = '{"xy": [' + state.val + ']}';
                }else{
                    parameters = '{"transitiontime": ' + JSON.stringify(ttime) + ', "xy": [' + state.val + ']}';
                }
                if(obj.common.role == 'light') {
                    setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.xy')
                }else if(obj.common.role == 'group'){
                    setGroupState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.xy')
                }
            });
        }else if(dp === 'alert'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                let controlId = obj.native.id;
                let parameters;
                if(ttime === 'none'){
                    parameters = '{"alert": ' + JSON.stringify(state.val) + '}';
                }else{
                    parameters = '{"transitiontime": ' + JSON.stringify(ttime) + ', "alert": ' + JSON.stringify(state.val) + '}';
                }
                setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.alert')
            });
        }else if(dp === 'effect'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                let parameters;
                if(state.val === 'colorloop'){
                    //adapter.log.info(id + ' Effect: colorloop');
                    adapter.getState(adapter.name + '.' + adapter.instance + '.' + id + '.colorloopspeed', function(error, colorloopspeed){
                            let controlId = obj.native.id;
                            let speed;
                            try{speed = colorloopspeed.val;} catch(err){}
                            if (speed === null || speed === undefined) {
                                speed = 1;
                            }
                            parameters = '{"colorloopspeed": ' + JSON.stringify(speed) + ', "effect": ' + JSON.stringify(state.val) + '}';
                            //adapter.log.info('parameters: ' + parameters);
                            if (obj.common.role == 'light') {
                                setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.effect')
                            } else if (obj.common.role == 'group') {
                                setGroupState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.effect')
                            }
                        })
                }else {
                    //adapter.log.info('ID: ' + id + 'Effect: none');
                    let controlId = obj.native.id;
                    let parameters = '{"effect": ' + JSON.stringify(state.val) + '}';
                    if(obj.common.role == 'light') {
                        setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.effect')
                    }else if(obj.common.role == 'group'){
                        setGroupState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.effect')
                    }
                }
            });
        }else if(dp === 'dimup' || dp === 'dimdown'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                adapter.getState(adapter.name + '.' + adapter.instance + '.' + id + '.dimspeed', function(error, dimspeed){
                    if (dimspeed === null || dimspeed === undefined || dimspeed == 0) 
                    {
                        dimspeed = 10;
                        adapter.setState(adapter.name + '.' + adapter.instance + '.' + id + '.dimspeed', 10, true);
                    }
                    let speed = dp === 'dimup' ? dimspeed.val : dimspeed.val * -1;
                    let controlId = obj.native.id;
                    let parameters = `{ "bri_inc": ${speed} }`;
                    switch(obj.common.role){
                        case 'group':
                            setGroupState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.bri');
                            break;
                        case 'light':
                            setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.bri');
                            break;
                    }
                });
            });
        }else if(dp === 'dimspeed'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                adapter.setState(adapter.name + '.' + adapter.instance + '.' + id + '.dimspeed', {ack: true});
            });
        }else if(dp === 'action'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                let action = state.val;
                if (action === null || action === undefined || action == 0) 
                {
                    return;
                }
                let controlId = obj.native.id;
                let parameters = `{ ${action} }`;
                switch(obj.common.role){
                    case 'group':
                        setGroupState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.action');
                        break;
                    case 'light':
                        setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.action');
                        break;
                }
            });
        }else if(dp === 'createscene'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                if(obj.common.role == 'group'){
                    let controlId = obj.native.id;
                    let parameters = `{ "name": "${state.ts}" }`;
                    setGroupScene(parameters, controlId, 0, '', '', 'POST');
                    getAllGroups();
                }
            });
        }else if(dp === 'delete'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                if(obj.common.role == 'scene'){
                    let parentDevicelId = id.split(".")[0];
                    adapter.getObject(adapter.name + '.' + adapter.instance + '.' + parentDevicelId, function(err, objParent) {
                        let parentId = objParent.native.id;
                        let controlId = obj.native.id;
                        let parameters = '';
                        setGroupScene(parameters, parentId, controlId, '', '', 'DELETE');
                    });
                    adapter.delObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {});
                }
            });
        }else if(dp === 'store'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                if(obj.common.role == 'scene'){
                    let parentDevicelId = id.split(".")[0];
                    adapter.getObject(adapter.name + '.' + adapter.instance + '.' + parentDevicelId, function(err, objParent) {
                        let parentId = objParent.native.id;
                        let controlId = obj.native.id;
                        let parameters = '';
                        setGroupScene(parameters, parentId, controlId, 'store', '', 'PUT');
                    });
                }
            });
        }else if(dp === 'recall'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                if(obj.common.role == 'scene'){
                    let parentDevicelId = id.split(".")[0];
                    adapter.getObject(adapter.name + '.' + adapter.instance + '.' + parentDevicelId, function(err, objParent) {
                        let parentId = objParent.native.id;
                        let controlId = obj.native.id;
                        let parameters = '';
                        setGroupScene(parameters, parentId, controlId, 'recall', '', 'PUT');
                    });
                }
            });
        }else if(dp === 'name'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                if(obj.common.role == 'scene'){
                    let parentDevicelId = id.split(".")[0];
                    adapter.getObject(adapter.name + '.' + adapter.instance + '.' + parentDevicelId, function(err, objParent) {
                        let parentId = objParent.native.id;
                        let controlId = obj.native.id;
                        let parameters = `{ "name": "${state.val}" }`;
                        setGroupScene(parameters, parentId, controlId, '', '', 'PUT');
                        adapter.extendObject(adapter.name + '.' + adapter.instance + '.' + id, {
                            common: {
                                name: state.val
                            }
                        });
                    });
                }
            });
        }
    })
},
//END on StateChange

// New message arrived. obj is array with current messages
        message: function (obj) {
    let wait = false;
    if (obj) {
        switch (obj.command) {
            case 'browse':
                browse(obj.message, function (res) {
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                });
                wait = true;
                break;
            case 'createAPIkey':
                createAPIkey(obj.message, function (res) {
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                });
                wait = true;
                break;
            case 'deleteAPIkey':
                deleteAPIkey();
                wait = true;
                break;
            case 'getConfig':
                getConfig();
                wait = true;
                break;
            case 'openNetwork':
                let opentime = adapter.config.permit;
                let parameters = `{"permitjoin": ${opentime}}`;
                modifyConfig(parameters);
                wait = true;
                break;
            case 'deleteLight':
                deleteLight(obj.message, function (res) {
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                });
                wait = true;
                break;
            case 'deleteSensor':
                deleteSensor(obj.message, function (res) {
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                });
                wait = true;
                break;
            case 'createGroup':
                createGroup(obj.message, function (res) {
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                });
                wait = true;
                break;
            case 'deleteGroup':
                deleteGroup(obj.message, function (res) {
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
},

        ready: main,

    });
    adapter = new utils.Adapter(options);

    return adapter;
}


function main() {
    adapter.subscribeStates('*');
    if (!adapter.config.port) {
        adapter.config.port = 80;
    } else {
        adapter.config.port = parseInt(adapter.config.port, 10);
    }
    if(adapter.config.user === '' || adapter.config.user === null){
        adapter.log.warn('No API Key found');
    }else {
        getConfig();
    }
    setTimeout(function(){
        getAutoUpdates();
    }, 10000);
}

function createAPIkey(host, callback){
    let newApiKey = null;
    const userDescription = 'iobroker.deconz';
    let options = {
        url: 'http://' + host + '/api',
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8',
            'Authorization': 'Basic ZGVsaWdodDpkZWxpZ2h0',
            'Content-Length': Buffer.byteLength('{"devicetype": "ioBroker"}')
        }
    };
    adapter.log.info(host);
    try{
        let req = request(options, function (error, res, body){
            adapter.log.info('STATUS: ' + res.statusCode);
            if(res.statusCode === 403){
                callback({error: 101, message: 'Unlock Key not pressed'});
            }else if(res.statusCode === 200){
                let apiKey = JSON.parse(body);
                adapter.log.info(JSON.stringify(apiKey[0]['success']['username']));
                callback({error: 0, message: apiKey[0]['success']['username']});
                getConfig();
            }
        });
        req.write('{"devicetype": "ioBroker"}');
    }catch(err){adapter.log.error(err)}

}

function deleteAPIkey(){
    adapter.log.info('deleteAPIkey');
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/config/whitelist/' + adapter.config.user,
        method: 'DELETE',
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8'
        }
    };

    request(options, function(error, res, body) {
        let response;
        try{response = JSON.parse(body);} catch(err){}
        if(res.statusCode === 200){
            if(response[0]['success']){
                adapter.log.info('API key deleted');
            }else if(response[0]['error']){
                adapter.log.warn(JSON.stringify(response[0]['error']));
            }
        }else if(res.statusCode === 403){
            adapter.log.warn('You do not have the permission to do this! ');
        }else if(res.statusCode === 404){
            adapter.log.warn('Error 404 Not Found ')
        }
    });
}


//Make Abo using websocket
const WebSocket = require('ws');

function getAutoUpdates(){
    let host = adapter.config.bridge;
    let port = adapter.config.websocketport;

    if(adapter.config.user) {
        let ws = new WebSocket('ws://' + host + ':' + port);


        ws.onmessage = function (msg) {
            let value;
            let data = JSON.parse(msg.data);
            let id = data['id'];
            let type = data['r'];
            let state = data['state'];
            let config = data['config'];
            adapter.log.debug('Websocket message: ' + JSON.stringify(data));

                    let thing;
                    switch (type) {
                        case 'lights':
                            getLightState(id);
                            break;
                        case 'groups':
                            getGroupAttributes(id);
                            break;
                        case 'sensors':
                            thing = 'Sensor';
                            adapter.getObject(`Sensors.${id}`, (err, obj) => {
                                if(err){
                                    getSensor(id);
                                }else{
                                    if(typeof state == 'object'){
                                        for(let obj in state){

                                            if(obj === 'lastupdated'){
                                                adapter.setObjectNotExists(`Sensors.${id}` + '.lastupdated', {
                                                    type: 'state',
                                                    common: {
                                                        name: 'lastupdated',
                                                        type: 'string',
                                                        role: 'state',
                                                        read: true,
                                                        write: false
                                                    },
                                                    native: {}
                                                });
                                            }

                                            adapter.getState(`${adapter.name}.${adapter.instance}.Sensors.${id}.lastupdated`, (err, lupdate) => {
                                                if(lupdate === null){
                                                    switch (obj) {
                                                        case 'lightlevel':
                                                        case 'daylight':
                                                        case 'lux':
                                                        case 'buttonevent':
                                                        case 'status':
                                                        case 'power':
                                                        case 'voltage':
                                                        case 'current':
                                                        case 'consumption':
                                                        case 'pressure':
                                                        case 'presence':
                                                        case 'dark':
                                                        case 'open':
                                                        case 'flag':
                                                        case 'water':
                                                        case 'tampered':
                                                        case 'fire':
                                                        case 'lowbattery':
                                                        case 'group':
                                                            adapter.setState(`Sensors.${id}` + '.' + obj, {val: state[obj], ack: true});
                                                            break;
                                                        case 'lastupdated':
                                                            adapter.setObjectNotExists(`Sensors.${id}` + '.' + obj, {
                                                                type: 'state',
                                                                common: {
                                                                    name: 'Sensor' + id + ' ' + obj,
                                                                    type: 'number',
                                                                    role: 'state',
                                                                    read: true,
                                                                    write: false
                                                                },
                                                                native: {}
                                                            });
                                                            adapter.setState(`Sensors.${id}` + '.' + obj, {val: state[obj], ack: true});
                                                            break;
                                                        case 'temperature':
                                                        case 'humidity':
                                                            value = state[obj]/100;
                                                            adapter.setState(`Sensors.${id}` + '.' + obj, {val: value, ack: true});
                                                            break;
                                                    }
                                                }else if(lupdate.val !== state[obj]){
                                                    switch (obj) {
                                                        case 'lightlevel':
                                                        case 'daylight':
                                                        case 'lux':
                                                        case 'buttonevent':
                                                        case 'status':
                                                        case 'power':
                                                        case 'voltage':
                                                        case 'current':
                                                        case 'consumption':
                                                        case 'pressure':
                                                        case 'presence':
                                                        case 'dark':
                                                        case 'open':
                                                        case 'flag':
                                                        case 'water':
                                                        case 'tampered':
                                                        case 'fire':
                                                        case 'lowbattery':
                                                        case 'lastupdated':
                                                        case 'group':
                                                            adapter.setState(`Sensors.${id}` + '.' + obj, {val: state[obj], ack: true});
                                                            break;
                                                        case 'temperature':
                                                        case 'humidity':
                                                            value = state[obj]/100;
                                                            adapter.setState(`Sensors.${id}` + '.' + obj, {val: value, ack: true});
                                                            break;
                                                    }
                                                }

                                            })
                                        }
                                    }
                                    if(typeof config == 'object'){
                                        for(let obj in config){
                                            switch (obj) {
                                                case 'on':
                                                case 'ledindication':
                                                case 'usertest':
                                                case 'battery':
                                                case 'reachable':
                                                case 'alert':
                                                case 'duration':
                                                case 'pending':
                                                case 'sensitivity':
                                                case 'sensitivitymax':
                                                case 'tholddark':
                                                case 'tholdoffset':
                                                case 'offset':
                                                    adapter.setState(`Sensors.${id}` + '.' + obj, {val: config[obj], ack: true});
                                                    break;
                                                case 'temperature':
                                                    value = config[obj]/100;
                                                    adapter.setState(`Sensors.${id}` + '.' + obj, {val: value, ack: true});
                                                    break;
                                                case 'group':
                                                    break;
                                            }

                                        }
                                    }

                                }
                            });
                            break;
                    }

            }
        }
    }


//START deConz config --------------------------------------------------------------------------------------------------
function modifyConfig(parameters){
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/config',
        method: 'PUT',
        headers: 'Content-Type" : "application/json',
        body: parameters
    };

    request(options, function(error, res, body) {
        let response;
        try{response = JSON.parse(body);} catch(err){}


        if(res.statusCode === 200){
            if(response[0]['success']){
                let ot = adapter.config.permit;
                switch (JSON.stringify(response[0]['success'])) {
                    case  `{"/config/permitjoin":${ot}}`:
                        adapter.log.info(`Network is now open for ${ot} seconds to register new devices.`);
                        break;
                }
            }else if(response[0]['error']){
                //adapter.setState(stateId, {ack: false});
                adapter.log.warn(JSON.stringify(response[0]['error']));
            }
        }else if(res.statusCode === 403){
            adapter.log.warn('You do not have the permission to do this! ' +  parameters);
        }else if(res.statusCode === 400){
            adapter.log.warn('Error 404 Not Found ' + parameters)
        }
    });
}

function getConfig(){
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/config',
        method: 'GET'
    };

    request(options, function(error, res, body){
        let gateway = JSON.parse(body);
        let response;
        try{response = JSON.parse(body);} catch(err){}
        adapter.log.debug('API version: ' + gateway['apiversion']);
        //adapter.log.info(JSON.stringify(gateway));

        if(res.statusCode === 200) {

                adapter.setObject('Gateway_info', {
                    type: 'device',
                    common: {
                        name: gateway['name'],
                        role: 'gateway'
                    },
                    native: {
                        apiversion: gateway['apiversion'],
                        bridgeid: gateway['bridgeid'],
                        datastoreversion: gateway['datastoreversion'],
                        devicename: gateway['devicename'],
                        dhcp: gateway['dhcp'],
                        factorynew: gateway['factorynew'],
                        gateway: gateway['gateway'],
                        ipaddress: gateway['ipaddress'],
                        linkbutton: gateway['linkbutton'],
                        mac: gateway['mac'],
                        modelid: gateway['modelid'],
                        netmask: gateway['netmask'],
                        networkopenduration: gateway['networkopenduration'],
                        panid: gateway['panid'],
                        portalconnection: gateway['portalconnection'],
                        portalservices: gateway['portalservices'],
                        proxyaddress: gateway['proxyaddress'],
                        proxyport: gateway['proxyport'],
                        replacesbridgeid: gateway['replacesbridgeid'],
                        starterkitid: gateway['starterkitid'],
                        swversion: gateway['swversion'],
                        timeformat: gateway['timeformat'],
                        timezone: gateway['timezone'],
                        uuid: gateway['uuid'],
                        websocketnotifyall: gateway['websocketnotifyall'],
                        websocketport: gateway['websocketport'],
                        zigbeechannel: gateway['zigbeechannel']
                    }
                });
                adapter.config.websocketport = gateway['websocketport'];
                let updateInfos;
                if(adapter.config.sw_version !== gateway['swversion'] || adapter.config.api_version !== gateway['apiversion']){
                    adapter.extendForeignObject('system.adapter.' + adapter.name + '.' + adapter.instance, {
                        native: {
                            sw_version: gateway['swversion'],
                            api_version: gateway['apiversion']
                        }
                    });
                }

                getAllLights();
                getAllSensors();
                getAllGroups();

        }else{
            logging(res.statusCode, 'Get Config:');
        }
    });
} //END getConfig
//END deConz config ----------------------------------------------------------------------------------------------------


//START  Group functions -----------------------------------------------------------------------------------------------
function getAllGroups() {
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/groups',
        method: 'GET'
    };
    request(options, function (error, res, body) {
        let list = JSON.parse(body);
        let response;
        try{response = JSON.parse(body);} catch(err){}
        let count = Object.keys(list).length - 1;
        adapter.log.debug('getAllGroups: ' + JSON.stringify(response));

        if(res.statusCode === 200 && body != '{}'){
                for (let i = 0; i <= count; i++) {
                    let keyName = Object.keys(list)[i];
                    //create object for group
                    let objectName = list[keyName]['name'];
                    let groupID = list[keyName]['id'];

                    //Changed check if is helper group, if skip it
                    let regex = new RegExp("helper[0-9]+ for group [0-9]+");
                    if(!regex.test(objectName)) {
                        adapter.getObject(`Groups.${groupID}`, (err, obj) =>{
                            adapter.log.info(`Groups.${groupID}`);
                            adapter.log.info(obj);
                            adapter.log.info(JSON.stringify(obj));
                        });
                        adapter.setObjectNotExists(`Groups.${groupID}`, {
                            type: 'device',
                            common: {
                                name: list[keyName],
                                role: 'group'
                            },
                            native: {
                                devicemembership: list[keyName]['devicemembership'],
                                etag: list[keyName]['etag'],
                                id: list[keyName]['id'],
                                hidden: list[keyName]['hidden'],
                                type: 'group'
                            }
                        });
                        getGroupAttributes(list[keyName]['id']);
                        getGroupScenes(`Groups.${groupID}`, list[keyName]['scenes']);
                    }
                }
        }else{
            logging(res.statusCode, 'Get all Groups:');
        }
    });
} //END getAllGroups

function getGroupScenes(group, sceneList) {
    adapter.log.debug("SzenenID (JSON): " + JSON.stringify(sceneList));

    //Changed check if group exists, if not skip it
    adapter.getObject(adapter.name + '.' + adapter.instance + '.' + group, function(err, obj) {
        if(obj != undefined){
            adapter.setObjectNotExists(`${group}.createscene`, {
                type: 'state',
                    common: {
                        name: "createscene",
                        role: 'button'
                    }
                });
            if(sceneList.length == 0)
            {
                return;
            }

            sceneList.forEach(function(scene) {
                if(scene.lightcount > 0) {
                    adapter.setObjectNotExists(`${group}.Scene_${scene.id}`, {
                        type: 'device',
                            common: {
                                name: scene.name,
                                role: 'scene'
                            },
                            native: {
                                type: 'scene',
                                id: scene.id
                            }
                        });

                    adapter.setObjectNotExists(`${group}.Scene_${scene.id}.recall`, {
                        type: 'state',
                            common: {
                                name: "recall",
                                role: 'button'
                            }
                        });
                        adapter.setObjectNotExists(`${group}.Scene_${scene.id}.store`, {
                        type: 'state',
                            common: {
                                name: "store",
                                role: 'button'
                            }
                        });
                    adapter.setObjectNotExists(`${group}.Scene_${scene.id}.delete`, {
                        type: 'state',
                            common: {
                                name: "delete",
                                role: 'button'
                            }
                        });
                    adapter.setObjectNotExists(`${group}.Scene_${scene.id}.lightcount`, {
                        type: 'state',
                            common: {
                                name: "lightcount",
                                role: 'state',
                                type: 'number',
                                read: true,
                                write: false
                            }
                        });
                    adapter.setState(`${group}.Scene_${scene.id}.lightcount`, scene.lightcount, true);
                    adapter.setObjectNotExists(`${group}.Scene_${scene.id}.transitiontime`, {
                        type: 'state',
                            common: {
                                name: "transitiontime",
                                role: 'argument',
                                type: 'number',
                                read: true,
                                write: false
                            }
                        });
                    adapter.setState(`${group}.Scene_${scene.id}.transitiontime`, scene.transitiontime, true);
                    adapter.setObjectNotExists(`${group}.Scene_${scene.id}.name`, {
                        type: 'state',
                            common: {
                                name: "name",
                                role: 'state',
                                type: 'string',
                                read: true,
                                write: true
                            }
                        });
                    adapter.setState(`${group}.Scene_${scene.id}.name`, scene.name, true);
                    adapter.extendObject(group, {
                        common: {
                            name: scene.name
                        }
                    });
                    }
            });
        }
    });
} //END getGroupScenes

function getGroupAttributes(groupId) {
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/groups/' + groupId,
        method: 'GET'
    };
    request(options, function (error, res, body) {
        let list = JSON.parse(body);
        let response;
        try{response = JSON.parse(body);} catch(err){}
        let count = Object.keys(list).length - 1;

        adapter.log.debug('getGroupAttributes: ' + JSON.stringify(response));

        if(res.statusCode === 200){
            for (let i = 0; i <= count; i++) {
                let keyName = Object.keys(list)[i];
                //create object for group with attributes
                let groupID = list[keyName]['id'];

                //Changed check if helper, if skip it (cause it also dont exists)
                let regex = new RegExp("helper[0-9]+ for group [0-9]+");
                if(!regex.test(list['name'])) {

                    adapter.setObjectNotExists(`Groups.${groupId}`, {
                        type: 'device',
                        common: {
                            name: list['name'],
                            role: 'group'
                        },
                        native: {
                            devicemembership: list['devicemembership'],
                            etag: list['etag'],
                            hidden: list['hidden'],
                            id: groupId,
                            lights: list['lights'],
                            lightsequence: list['lightsequence'],
                            multideviceids: list['multideviceids']
                        }
                    });
                    let count2 = Object.keys(list['action']).length - 1;
                    //create states for light device
                    for (let z = 0; z <= count2; z++) {
                        let stateName = Object.keys(list['action'])[z];
                        switch (stateName) {
                            case 'on':
                                adapter.setObjectNotExists(`Groups.${groupId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' +stateName,
                                        type: 'boolean',
                                        role: 'switch',
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Groups.${groupId}` + '.' + stateName, {val: list['action'][stateName], ack: true});
                                break;
                            case 'bri':
                                adapter.setObjectNotExists(`Groups.${groupId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' +stateName,
                                        type: 'number',
                                        role: 'level.dimmer',
                                        min: 0,
                                        max: 255,
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Groups.${groupId}` + '.' + stateName, {val: list['action'][stateName], ack: true});
                                break;
                            case 'hue':
                                adapter.setObjectNotExists(`Groups.${groupId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' +stateName,
                                        type: 'number',
                                        role: 'level.color.hue',
                                        min: 0,
                                        max: 360,
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Groups.${groupId}` + '.' + stateName, {val: Math.round(list['action'][stateName] * 100 / hue_factor) / 100, ack: true});
                                break;
                            case 'sat':
                                adapter.setObjectNotExists(`Groups.${groupId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' +stateName,
                                        type: 'number',
                                        role: 'level.color.saturation',
                                        min: 0,
                                        max: 255,
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Groups.${groupId}` + '.' + stateName, {val: list['action'][stateName], ack: true});
                                break;
                            case 'ct':
                                adapter.setObjectNotExists(`Groups.${groupId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' +stateName,
                                        type: 'number',
                                        role: 'color.temp',
                                        min: 153,
                                        max: 500,
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Groups.${groupId}` + '.' + stateName, {val: list['action'][stateName], ack: true});
                                break;
                            case 'xy':
                                adapter.setObjectNotExists(`Groups.${groupId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' +stateName,
                                        type: 'string',
                                        role: 'color.CIE',
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Groups.${groupId}` + '.' + stateName, {val: list['action'][stateName], ack: true});
                                break;
                            case 'effect':
                                adapter.setObjectNotExists(`Groups.${groupId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' +stateName,
                                        type: 'string',
                                        role: 'action',
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setObjectNotExists(`Groups.${groupId}` + '.colorloopspeed', {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + 'colorloopspeed',
                                        type: 'number',
                                        role: 'argument',
                                        min: 1,
                                        max: 255,
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Groups.${groupId}` + '.' + stateName, {val: list['action'][stateName], ack: true});
                                break;
                        }
                    }
                    adapter.setObjectNotExists(`Groups.${groupId}` + '.transitiontime', {
                        type: 'state',
                        common: {
                            name: list['name'] + ' ' + 'transitiontime',
                            type: 'number',
                            role: 'argument',
                            read: true,
                            write: true
                        },
                        native: {}
                    });
                    adapter.setObjectNotExists(`Groups.${groupId}.dimspeed`, {
                        type: 'state',
                        common: {
                            name: list['name'] + ' ' + 'dimspeed',
                            type: 'number',
                            role: 'level.dimspeed',
                            min: 0,
                            max: 254,
                            read: false,
                            write: true
                        },
                        native: {}
                    });
                    adapter.setObjectNotExists(`Groups.${groupId}.dimup`, {
                        type: 'state',
                            common: {
                                name: list['name'] + ' ' + 'dimup',
                                role: 'button'
                            }
                    });
                    adapter.setObjectNotExists(`Groups.${groupId}.dimdown`, {
                        type: 'state',
                            common: {
                                name: list['name'] + ' ' + 'dimdown',
                                role: 'button'
                            }
                    });
                    adapter.setObjectNotExists(`Groups.${groupId}.action`, {
                        type: 'state',
                            common: {
                                name: list['name'] + ' ' + 'action',
                                role: 'argument',
                                type: 'string',
                                read: false,
                                write: true    
                            }
                    });
                }
            }
        }else{
            logging(res.statusCode, 'Get group attributes: ' + groupId);
        }
    })
} //END getGroupAttributes

function setGroupState(parameters, groupId, stateId){
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/groups/' + groupId + '/action',
        method: 'PUT',
        headers: 'Content-Type" : "application/json',
        body: parameters
    };

    request(options, function(error, res, body) {
        adapter.log.debug('setGroupState STATUS: ' + res.statusCode);
        let response;
        try{response = JSON.parse(body);} catch(err){}
        adapter.log.debug('setGroupState BODY: ' + JSON.stringify(response));

        if(res.statusCode === 200){
            if(response[0]['success']){
                adapter.setState(stateId, {ack: true});
            }else if(response[0]['error']){
                //adapter.setState(stateId, {ack: false});
                adapter.log.warn(JSON.stringify(response[0]['error']));
            }
        }else{
            logging(res.statusCode, 'Set group state with ID: ' + groupId + ' parameter: ' + parameters);
        }
    });
} //END setGroupState

function setGroupScene(parameters, groupId, sceneId, action, stateId, method){
    let sceneString = '';
    if(sceneId > 0){
        sceneString = '/' + sceneId;
        if(action != ''){
            sceneString += '/' + action;
        }
    }
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/groups/' + groupId + '/scenes' + sceneString,
        method: method,
        headers: 'Content-Type" : "application/json',
        body: parameters
    };

    request(options, function(error, res, body) {
        adapter.log.debug('setGroupState STATUS: ' + res.statusCode);
        let response;
        try{response = JSON.parse(body);} catch(err){}
        adapter.log.debug('setGroupState BODY: ' + JSON.stringify(response));

        if(res.statusCode === 200){
            if(response[0]['success']){
                adapter.setState(stateId, {ack: true});
            }else if(response[0]['error']){
                //adapter.setState(stateId, {ack: false});
                adapter.log.warn(JSON.stringify(response[0]['error']));
            }
        }else{
            logging(res.statusCode, 'Set group state with ID: ' + groupId + ' parameter: ' + parameters);
        }
    });
} //END setGroupScene

function createGroup(name, callback) {
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/groups',
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8',
            'Content-Length': Buffer.byteLength('{"name": "'+ name + '"}')
        }
    };
    try{
        let req = request(options, function (error, res, body){
            adapter.log.info('STATUS: ' + res.statusCode);
            if(res.statusCode === 200){
                let apiKey = JSON.parse(body);
                adapter.log.info(JSON.stringify(apiKey[0]['success']['id']));
                callback({error: 0, message: 'success'});
                getGroupAttributes(apiKey[0]['success']['id']);
            }
        });
        req.write('{"name": "' + name + '"}');
    }catch(err){adapter.log.error(err)}
} //END createGroup

function deleteGroup(groupId){
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/groups/' + groupId,
        method: 'DELETE',
        headers: 'Content-Type" : "application/json'
        //body: parameters
    };

    adapter.log.info('Group id: ' + groupId);

    request(options, function(error, res, body) {
        adapter.log.debug('deleteGroup STATUS: ' + res.statusCode);
        let response;
        try{response = JSON.parse(body);} catch(err){}
        adapter.log.debug('deleteGroup BODY: ' + JSON.stringify(response));


        if(res.statusCode === 200){
            if(response[0]['success']){
            adapter.log.info('The group with id ' + groupId + ' was removed.');
            adapter.getForeignObjects(adapter.name + '.' + adapter.instance + '*', 'device', function (err, enums) {                    //alle Objekte des Adapters suchen
                let count = Object.keys(enums).length - 1;                                      //Anzahl der Objekte
                for (let i = 0; i <= count; i++) {                                              //jedes durchgehen und prüfen ob es sich um ein Objekt vom Typ sensor handelt
                    let keyName = Object.keys(enums)[i];
                    if (enums[keyName].common.role == 'group' && enums[keyName].native.id == groupId) {
                        adapter.log.info('Delete device Object: ' + enums[keyName].common.name);
                        let name = enums[keyName].common.name;

                        adapter.deleteDevice(name, function(err){
                            adapter.log.info(err);
                        });
                    }

                }
            });
            }else if(response[0]['error']){
                //adapter.setState(stateId, {ack: false});
                adapter.log.warn(JSON.stringify(response[0]['error']));
            }
        }else{
            logging(res.statusCode, 'Delete group with ID: ' + groupId);
        }
    });
}


//END  Group functions -------------------------------------------------------------------------------------------------


//START  Sensor functions ----------------------------------------------------------------------------------------------
function getAllSensors() {

    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/sensors',
        method: 'GET'
    };
    request(options, function (error, res, body) {
        let list = JSON.parse(body);
        let response;
        try{response = JSON.parse(body);} catch(err){}
        let count = Object.keys(list).length - 1;

        adapter.log.debug('getAllSensors: ' + body);

        if (res.statusCode === 200 && body != '{}') {
            for (let i = 0; i <= count; i++) {              //Get each Sensor
                let keyName = Object.keys(list)[i];
                let sensorID = keyName;
                //create object for sensor device
                const patt = new RegExp(/\d$/g);
                /*let match = patt.test(sensorName);
                if(match === true && list[keyName]['ep'] > 1){
                    sensorName = sensorName + '_' + keyName;
                }*/

                let regex = new RegExp("CLIP-Sensor TOOGLE-");
                if(!regex.test(list[keyName]['name'])) {
                    adapter.setObjectNotExists(`Sensors.${sensorID}`, {
                        type: 'device',
                        common: {
                            name: list[keyName]['name'],
                            role: 'sensor'
                        },
                        native: {
                            ep: list[keyName]['ep'],
                            etag: list[keyName]['etag'],
                            id: keyName,
                            group: list[keyName]['config']['group'],
                            manufacturername: list[keyName]['manufacturername'],
                            modelid: list[keyName]['modelid'],
                            swversion: list[keyName]['swversion'],
                            type: list[keyName]['type'],
                            uniqueid: list[keyName]['uniqueid']
                        }
                    });

                    let count2 = Object.keys(list[keyName]['state']).length - 1;
                    //create states for sensor device
                    for (let z = 0; z <= count2; z++) {
                        let stateName = Object.keys(list[keyName]['state'])[z];
                        switch (stateName) {
                            case 'lightlevel':
                            case 'daylight':
                            case 'lux':
                            case 'buttonevent':
                            case 'status':
                            case 'power':
                            case 'voltage':
                            case 'current':
                            case 'consumption':
                            case 'pressure':
                            case 'group':
                                adapter.setObjectNotExists(`Sensors.${sensorID}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'state',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorID}` + '.' + stateName, {
                                    val: list[keyName]['state'][stateName],
                                    ack: true
                                });
                                break;
                            case 'temperature':
                            case 'humidity':
                                adapter.setObjectNotExists(`Sensors.${sensorID}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'state',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                let value = list[keyName]['state'][stateName] / 100;
                                adapter.setState(`Sensors.${sensorID}` + '.' + stateName, {val: value, ack: true});
                                break;
                            case 'presence':
                            case 'dark':
                            case 'open':
                            case 'flag':
                            case 'water':
                            case 'tampered':
                            case 'fire':
                            adapter.setObjectNotExists(`Sensors.${sensorID}` + '.' + stateName, {
                                type: 'state',
                                common: {
                                    name: list[keyName]['name'] + ' ' + stateName,
                                    type: 'boolean',
                                    role: 'state',
                                    read: true,
                                    write: false
                                },
                                native: {}
                            });
                            adapter.setState(`Sensors.${sensorID}` + '.' + stateName, {
                                val: list[keyName]['state'][stateName],
                                ack: true
                            });
                            break;
                            case 'lowbattery':
                                adapter.setObjectNotExists(`Sensors.${sensorID}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + stateName,
                                        type: 'boolean',
                                        role: 'indicator.battery',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorID}` + '.' + stateName, {
                                    val: list[keyName]['state'][stateName],
                                    ack: true
                                });
                                break;
                        }
                    }


                    let count3 = Object.keys(list[keyName]['config']).length - 1;
                    //create config states for sensor device
                    for (let x = 0; x <= count3; x++) {
                        let stateName = Object.keys(list[keyName]['config'])[x];
                        switch (stateName) {
                            case 'on':
                            case 'ledindication':
                            case 'usertest':
                                adapter.setObjectNotExists(`Sensors.${sensorID}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + stateName,
                                        type: 'boolean',
                                        role: 'state',
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorID}` + '.' + stateName, {
                                    val: list[keyName]['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'alert':
                                adapter.setObjectNotExists(`Sensors.${sensorID}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + stateName,
                                        type: 'string',
                                        role: 'state',
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorID}` + '.' + stateName, {
                                    val: list[keyName]['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'battery':
                                adapter.setObjectNotExists(`Sensors.${sensorID}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'indicator.battery',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorID}` + '.' + stateName, {
                                    val: list[keyName]['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'duration':
                                adapter.setObjectNotExists(`Sensors.${sensorID}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'indicator.duration',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorID}` + '.' + stateName, {
                                    val: list[keyName]['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'reachable':
                                adapter.setObjectNotExists(`Sensors.${sensorID}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + stateName,
                                        type: 'boolean',
                                        role: 'indicator.reachable',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorID}` + '.' + stateName, {
                                    val: list[keyName]['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'pending':
                                adapter.setObjectNotExists(`Sensors.${sensorID}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + stateName,
                                        type: 'mixed',
                                        role: 'info',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorID}` + '.' + stateName, {
                                    val: list[keyName]['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'sensitivity':
                            case 'sensitivitymax':
                            case 'tholddark':
                            case 'tholdoffset':
                            case 'offset':
                                adapter.setObjectNotExists(`Sensors.${sensorID}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'state',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorID}` + '.' + stateName, {
                                    val: list[keyName]['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'temperature':
                                adapter.setObjectNotExists(`Sensors.${sensorID}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'state',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                let value = list[keyName]['config'][stateName] / 100;
                                adapter.setState(`Sensors.${sensorID}` + '.' + stateName, {val: value, ack: true});
                                break;
                        }
                    }
                }
            }
            }else
            {
                logging(res.statusCode, 'Get all Sensors:');
            }

    });
} //END getAllSensors

function getSensor(sensorId){
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/sensors/' + sensorId,
        method: 'GET'
    };
    request(options, function (error, res, body) {
        let response;
        try {
            response = JSON.parse(body);
        } catch (err) {
        }

        adapter.log.debug('getSensor: ' + JSON.stringify(body));

        if (res.statusCode === 200) {
                let list = JSON.parse(body);
                let keyName = Object.keys(list)[0];
                let sensorName = nameFilter(list['name']);
                /*const patt = new RegExp(/\d$/g);
                let match = patt.test(sensorName);
                if(match === true && list['ep'] > 1){
                    sensorName = sensorName + '_' + sensorId;
                }*/

                //create object for sensor
                adapter.setObjectNotExists(`Sensors.${sensorId}`, {
                    type: 'device',
                    common: {
                        name: list['name'],
                        role: 'sensor'
                    },
                    native: {
                        ep: list['ep'],
                        etag: list['etag'],
                        id: sensorId,
                        group: list['config']['group'],
                        manufacturername: list['manufacturername'],
                        mode:   list['mode'],
                        modelid: list['modelid'],
                        swversion: list['swversion'],
                        type: list['type'],
                        uniqueid: list['uniqueid']
                    }
                });
                let count2 = Object.keys(list['state']).length - 1;
                //create states for sensor device
                for (let z = 0; z <= count2; z++) {
                    let stateName = Object.keys(list['state'])[z];
                    switch (stateName) {
                        case 'lightlevel':
                        case 'daylight':
                        case 'lux':
                        case 'buttonevent':
                        case 'status':
                        case 'power':
                        case 'voltage':
                        case 'current':
                        case 'consumption':
                        case 'pressure':
                        case 'group':
                            adapter.setObjectNotExists(`Sensors.${sensorId}` + '.' + stateName, {
                                type: 'state',
                                common: {
                                    name: list['name'] + ' ' + stateName,
                                    type: 'number',
                                    role: 'state',
                                    read: true,
                                    write: false
                                },
                                native: {}
                            });
                            if (stateName == 'buttonevent' && list['modelid'] == 'lumi.Sensors.switch.aq2') {
                                let LastUpdate = Number(new Date(list['state']['lastupdated']));
                                let Now = Number(new Date().getTime());
                                let dateoff = new Date();
                                let TimeOffset = dateoff.getTimezoneOffset() * 60000;

                                if ((Now - LastUpdate + TimeOffset) < 2000) {
                                    adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {val: list['state'][stateName], ack: true});
                                    //adapter.log.debug('buttonevent updated, time diff: ' + ((Now - LastUpdate + TimeOffset)/1000) + 'sec update to now');
                                } else {
                                    adapter.log.info('buttonevent NOT updated for ' + list['name'] + ', too old: ' + ((Now - LastUpdate + TimeOffset)/1000) + 'sec time difference update to now');
                                };
                            } else {
                                adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {val: list['state'][stateName], ack: true});
                            }
                            break;
                        case 'temperature':
                        case 'humidity':
                            adapter.setObjectNotExists(`Sensors.${sensorId}` + '.' + stateName, {
                                type: 'state',
                                common: {
                                    name: list['name'] + ' ' + stateName,
                                    type: 'number',
                                    role: 'state',
                                    read: true,
                                    write: false
                                },
                                native: {}
                            });
                            let value = list['state'][stateName]/100;
                            adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {val: value, ack: true});
                            break;
                        case 'presence':
                        case 'dark':
                        case 'open':
                        case 'flag':
                        case 'water':
                        case 'tampered':
                        case 'fire':
                            adapter.setObjectNotExists(`Sensors.${sensorId}` + '.' + stateName, {
                                type: 'state',
                                common: {
                                    name: list['name'] + ' ' + stateName,
                                    type: 'boolean',
                                    role: 'state',
                                    read: true,
                                    write: false
                                },
                                native: {}
                            });
                            adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {val: list['state'][stateName], ack: true});
                        break;
                        case 'lowbattery':
                            adapter.setObjectNotExists(`Sensors.${sensorId}` + '.' + stateName, {
                                type: 'state',
                                common: {
                                    name: list['name'] + ' ' + stateName,
                                    type: 'boolean',
                                    role: 'indicator.battery',
                                    read: true,
                                    write: false
                                },
                                native: {}
                            });
                            adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {val: list['state'][stateName], ack: true});
                            break;
                }

                    let count3 = Object.keys(list['config']).length - 1;
                    //create config for sensor device
                    for (let x = 0; x <= count3; x++) {
                        let stateName = Object.keys(list['config'])[x];
                        switch (stateName) {
                            case 'on':
                            case 'ledindication':
                            case 'usertest':
                                adapter.setObjectNotExists(`Sensors.${sensorId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'boolean',
                                        role: 'state',
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {
                                    val: list['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'battery':
                                adapter.setObjectNotExists(`Sensors.${sensorId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'indicator.battery',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {
                                    val: list['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'reachable':
                                adapter.setObjectNotExists(`Sensors.${sensorId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'boolean',
                                        role: 'indicator.reachable',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {
                                    val: list['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'alert':
                                adapter.setObjectNotExists(`Sensors.${sensorId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'boolean',
                                        role: 'indicator.reachable',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {
                                    val: list['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'duration':
                                adapter.setObjectNotExists(`Sensors.${sensorId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'indicator.duration',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {
                                    val: list['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'pending':
                                adapter.setObjectNotExists(`Sensors.${sensorId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'mixed',
                                        role: 'info',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {
                                    val: list['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'sensitivity':
                            case 'sensitivitymax':
                            case 'tholddark':
                            case 'tholdoffset':
                            case 'offset':
                                adapter.setObjectNotExists(`Sensors.${sensorId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'state',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {
                                    val: list['config'][stateName],
                                    ack: true
                                });
                                break;
                            case 'temperature':
                                adapter.setObjectNotExists(`Sensors.${sensorId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'state',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                let value = list['config'][stateName]/100;
                                adapter.setState(`Sensors.${sensorId}` + '.' + stateName, {val: value, ack: true});
                                break;
                        }
                    }
                }


        }
    })
} //END getSensor

function deleteSensor(sensorId){
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/sensors/' + sensorId,
        method: 'DELETE',
        headers: 'Content-Type" : "application/json',
        //body: parameters
    };

    request(options, function(error, res, body) {
        adapter.log.debug('deleteSensor STATUS: ' + res.statusCode);
        let response;
        try{response = JSON.parse(body);} catch(err){}
        adapter.log.debug('deleteSensor BODY: ' + JSON.stringify(response));

        if(res.statusCode === 200){
            if(response[0]['success']){
                adapter.log.info('The sensor with id ' + sensorId + ' was removed.');
                adapter.getForeignObjects(adapter.name + '.' + adapter.instance + '*', 'device', function (err, enums) {                    //alle Objekte des Adapters suchen
                    let count = Object.keys(enums).length - 1;                                      //Anzahl der Objekte
                    for (let i = 0; i <= count; i++) {                                              //jedes durchgehen und prüfen ob es sich um ein Objekt vom Typ sensor handelt
                        let keyName = Object.keys(enums)[i];
                        if (enums[keyName].common.role == 'sensor' && enums[keyName].native.id == sensorId) {
                            adapter.log.info('delete device Object: ' + enums[keyName].common.name);
                            let name = enums[keyName].id;

                            adapter.deleteDevice(name, function(err){
                                adapter.log.info(err);
                            });
                        }

                    }
                });
            }else if(response[0]['error']){
                //adapter.setState(stateId, {ack: false});
                adapter.log.warn(JSON.stringify(response[0]['error']));
            }
        }else{
            logging(res.statusCode, 'Delete sensor with ID: ' + sensorId);
        }
    });
}

//END  Sensor functions ------------------------------------------------------------------------------------------------


//START  Light functions -----------------------------------------------------------------------------------------------
function getAllLights(){
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/lights',
        method: 'GET'
    };
        request(options, function (error, res, body) {
            let list = JSON.parse(body);
            let response;
            try{response = JSON.parse(body);} catch(err){}
            let count = Object.keys(list).length - 1;

            adapter.log.debug('getAllLights: ' + body);

            if (res.statusCode === 200 && body != '{}') {
                    for (let i = 0; i <= count; i++) {
                        let keyName = Object.keys(list)[i];
                        let lightID = Object.keys(list)[i];

                        //create object for light device
                        adapter.setObjectNotExists(`Lights.${lightID}`, {
                            type: 'device',
                            common: {
                                name: list[keyName]['name'],
                                role: 'light'
                            },
                            native: {
                                etag: list[keyName]['etag'],
                                hascolor: list[keyName]['hascolor'],
                                id: Object.keys(list)[i],
                                manufacturername: list[keyName]['manufacturername'],
                                modelid: list[keyName]['modelid'],
                                swversion: list[keyName]['swversion'],
                                type: list[keyName]['type'],
                                uniqueid: list[keyName]['uniqueid']
                            }
                        });
                        let count2 = Object.keys(list[keyName]['state']).length - 1;
                        //create states for light device
                        for (let z = 0; z <= count2; z++) {
                            let stateName = Object.keys(list[keyName]['state'])[z];
                            switch (stateName) {
                                case 'on':
                                    adapter.setObjectNotExists(`Lights.${lightID}` + '.' + stateName, {
                                        type: 'state',
                                        common: {
                                            name: list[keyName]['name'] + ' ' + stateName,
                                            type: 'boolean',
                                            role: 'switch',
                                            read: true,
                                            write: true
                                        },
                                        native: {}
                                    });
                                    break;
                                case 'bri':
                                    adapter.setObjectNotExists(`Lights.${lightID}` + '.' + stateName, {
                                        type: 'state',
                                        common: {
                                            name: list[keyName]['name'] + ' ' + stateName,
                                            type: 'number',
                                            role: 'level.dimmer',
                                            min: 0,
                                            max: 255,
                                            read: true,
                                            write: true
                                        },
                                        native: {}
                                    });
                                    break;
                                case 'hue':
                                    adapter.setObjectNotExists(`Lights.${lightID}` + '.' + stateName, {
                                        type: 'state',
                                        common: {
                                            name: list[keyName]['name'] + ' ' + stateName,
                                            type: 'number',
                                            role: 'level.color.hue',
                                            min: 0,
                                            max: 360,
                                            read: true,
                                            write: true
                                        },
                                        native: {}
                                    });
                                    break;
                                case 'sat':
                                    adapter.setObjectNotExists(`Lights.${lightID}` + '.' + stateName, {
                                        type: 'state',
                                        common: {
                                            name: list[keyName]['name'] + ' ' + stateName,
                                            type: 'number',
                                            role: 'level.color.saturation',
                                            min: 0,
                                            max: 255,
                                            read: true,
                                            write: true
                                        },
                                        native: {}
                                    });
                                    break;
                                case 'ct':
                                    adapter.setObjectNotExists(`Lights.${lightID}` + '.' + stateName, {
                                        type: 'state',
                                        common: {
                                            name: list[keyName]['name'] + ' ' + stateName,
                                            type: 'number',
                                            role: 'color.temp',
                                            min: 153,
                                            max: 500,
                                            read: true,
                                            write: true
                                        },
                                        native: {}
                                    });
                                    break;
                                case 'xy':
                                    adapter.setObjectNotExists(`Lights.${lightID}` + '.' + stateName, {
                                        type: 'state',
                                        common: {
                                            name: list[keyName]['name'] + ' ' + stateName,
                                            type: 'string',
                                            role: 'color.CIE',
                                            read: true,
                                            write: true
                                        },
                                        native: {}
                                    });
                                    break;
                                case 'alert':
                                    adapter.setObjectNotExists(`Lights.${lightID}` + '.' + stateName, {
                                        type: 'state',
                                        common: {
                                            name: list[keyName]['name'] + ' ' + stateName,
                                            type: 'string',
                                            role: 'action',
                                            read: true,
                                            write: true
                                        },
                                        native: {}
                                    });
                                    break;
                                case 'effect':
                                    adapter.setObjectNotExists(`Lights.${lightID}` + '.' + stateName, {
                                        type: 'state',
                                        common: {
                                            name: list[keyName]['name'] + ' ' + stateName,
                                            type: 'string',
                                            role: 'action',
                                            read: true,
                                            write: true
                                        },
                                        native: {}
                                    });
                                    adapter.setObjectNotExists(`Lights.${lightID}` + '.colorloopspeed', {
                                        type: 'state',
                                        common: {
                                            name: list[keyName]['name'] + ' ' + 'colorloopspeed',
                                            type: 'number',
                                            role: 'argument',
                                            min: 1,
                                            max: 255,
                                            read: true,
                                            write: true
                                        },
                                        native: {}
                                    });
                                    break;
                                case 'reachable':
                                    adapter.setObjectNotExists(`Lights.${lightID}` + '.' + stateName, {
                                        type: 'state',
                                        common: {
                                            name: list[keyName]['name'] + ' ' + stateName,
                                            type: 'boolean',
                                            role: 'indicator.reachable',
                                            read: true,
                                            write: false
                                        },
                                        native: {}
                                    });
                                    break;
                            }
                            adapter.setObjectNotExists(`Lights.${lightID}` + '.transitiontime', {
                                type: 'state',
                                common: {
                                    name: list[keyName]['name'] + ' ' + 'transitiontime',
                                    type: 'number',
                                    role: 'argument',
                                    read: true,
                                    write: true
                                },
                                native: {}
                            });
                            adapter.setObjectNotExists(`Lights.${lightID}.dimspeed`, {
                                type: 'state',
                                common: {
                                    name: list[keyName]['name'] + ' ' + 'dimspeed',
                                    type: 'number',
                                    role: 'level.dimspeed',
                                    min: 0,
                                    max: 254,
                                    read: false,
                                    write: true
                                },
                                native: {}
                            });
                            adapter.setObjectNotExists(`Lights.${lightID}.dimup`, {
                                type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + 'dimup',
                                        role: 'button'
                                    }
                            });
                            adapter.setObjectNotExists(`Lights.${lightID}.dimdown`, {
                                type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + 'dimdown',
                                        role: 'button'
                                    }
                            });            
                            adapter.setObjectNotExists(`Lights.${lightID}.action`, {
                                type: 'state',
                                    common: {
                                        name: list[keyName]['name'] + ' ' + 'action',
                                        role: 'argument',
                                        type: 'string',
                                        read: false,
                                        write: true    
                                    }
                            });
                        }
                    }
            }else{
                logging(res.statusCode, 'Get all lights:');
            }
        })
} //END getAllLights

function getLightState(lightId){
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/lights/' + lightId,
        method: 'GET'
    };
    request(options, function (error, res, body) {
        let response;
        try {
            response = JSON.parse(body);
        } catch (err) {
        }
        adapter.log.debug('getLightState: ' + body);

            if (res.statusCode === 200) {
                let list = JSON.parse(body);
                let keyName = Object.keys(list)[0];
                let lightName = nameFilter(list['name']);
                //create object for light device
                    adapter.setObject(`Lights.${lightId}`, {
                        type: 'device',
                        common: {
                            name: list['name'],
                            role: 'light'
                        },
                        native: {
                            etag: list['etag'],
                            hascolor: list['hascolor'],
                            id: lightId,
                            manufacturername: list['manufacturername'],
                            modelid: list['modelid'],
                            swversion: list['swversion'],
                            type: list['type'],
                            uniqueid: list['uniqueid']
                        }
                    });
                    let count2 = Object.keys(list['state']).length - 1;
                    //create states for light device
                    for (let z = 0; z <= count2; z++) {
                        let stateName = Object.keys(list['state'])[z];
                        switch (stateName) {
                            case 'on':
                                adapter.setObjectNotExists(`Lights.${lightId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'boolean',
                                        role: 'switch',
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Lights.${lightId}` + '.' + stateName, {val: list['state'][stateName], ack: true});
                                break;
                            case 'bri':
                                adapter.setObjectNotExists(`Lights.${lightId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'level.dimmer',
                                        min: 0,
                                        max: 255,
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Lights.${lightId}` + '.' + stateName, {val: list['state'][stateName], ack: true});
                                break;
                            case 'hue':
                                adapter.setObjectNotExists(`Lights.${lightId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'level.color.hue',
                                        min: 0,
                                        max: 360,
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Lights.${lightId}` + '.' + stateName, {val: Math.round(list['state'][stateName] * 100 / hue_factor) / 100, ack: true});
                                break;
                            case 'sat':
                                adapter.setObjectNotExists(`Lights.${lightId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'level.color.saturation',
                                        min: 0,
                                        max: 255,
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Lights.${lightId}` + '.' + stateName, {val: list['state'][stateName], ack: true});
                                break;
                            case 'ct':
                                adapter.setObjectNotExists(`Lights.${lightId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'color.temp',
                                        min: 153,
                                        max: 500,
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Lights.${lightId}` + '.' + stateName, {val: list['state'][stateName], ack: true});
                                break;
                            case 'xy':
                                adapter.setObjectNotExists(`Lights.${lightId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'string',
                                        role: 'color.CIE',
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Lights.${lightId}` + '.' + stateName, {val: list['state'][stateName], ack: true});
                                break;
                            case 'alert':
                                adapter.setObjectNotExists(`Lights.${lightId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'string',
                                        role: 'action',
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Lights.${lightId}` + '.' + stateName, {val: list['state'][stateName], ack: true});
                                break;
                            case 'effect':
                                adapter.setObjectNotExists(`Lights.${lightId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'string',
                                        role: 'action',
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setObjectNotExists(`Lights.${lightId}` + '.colorloopspeed', {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + 'colorloopspeed',
                                        type: 'number',
                                        role: 'argument',
                                        min: 1,
                                        max: 255,
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                adapter.setState(`Lights.${lightId}` + '.' + stateName, {val: list['state'][stateName], ack: true});
                                break;
                            case 'transitiontime':
                                adapter.setObjectNotExists(`Lights.${lightId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'number',
                                        role: 'argument',
                                        read: true,
                                        write: true
                                    },
                                    native: {}
                                });
                                break;
                            case 'reachable':
                                adapter.setObjectNotExists(`Lights.${lightId}` + '.' + stateName, {
                                    type: 'state',
                                    common: {
                                        name: list['name'] + ' ' + stateName,
                                        type: 'boolean',
                                        role: 'indicator.reachable',
                                        read: true,
                                        write: false
                                    },
                                    native: {}
                                });
                                adapter.setState(`Lights.${lightId}` + '.' + stateName, {val: list['state'][stateName], ack: true});
                                break;
                        }

                    }
            } else{
                logging(res.statusCode, 'Get light state with ID: ' + lightId);
            }
    })
} //END getLightState

function setLightState(parameters, lightId, stateId, callback){
        adapter.log.info('setLightState: ' + parameters + ' ' + lightId + ' ' + stateId);
        let options = {
            url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/lights/' + lightId + '/state',
            method: 'PUT',
            headers: 'Content-Type" : "application/json',
            body: parameters
        };

        request(options, function(error, res, body) {
            adapter.log.debug('STATUS: ' + res.statusCode);
            let response;
            try{response = JSON.parse(body);} catch(err){}
            adapter.log.info('options: ' + JSON.stringify(options));
            adapter.log.debug('setLightState BODY: ' + JSON.stringify(response));

            if(res.statusCode === 200){
                if(response[0]['success']){
                    adapter.setState(stateId, {ack: true});
                }else if(response[0]['error']){
                    //adapter.setState(stateId, {ack: false});
                    adapter.log.warn(JSON.stringify(response[0]['error']));
                }
            }else{
                logging(res.statusCode, 'Set light state with ID: ' + lightId + ' parameter: ' + parameters);
            }

            if(callback)
                callback();
        });
} //END setLightState

function deleteLight(lightId){
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/lights/' + lightId,
        method: 'DELETE',
        headers: 'Content-Type" : "application/json',
        //body: parameters
    };

    request(options, function(error, res, body) {
        adapter.log.debug('deleteLight STATUS: ' + res.statusCode);
        let response;
        try{response = JSON.parse(body);} catch(err){}
        adapter.log.debug('deleteLight BODY: ' + JSON.stringify(response));

        if(res.statusCode === 200){
            if(response[0]['success']){
                adapter.log.info('The light with id ' + lightId + ' was removed.')
            }else if(response[0]['error']){
                //adapter.setState(stateId, {ack: false});
                adapter.log.warn(JSON.stringify(response[0]['error']));
            }
        }else{
            logging(res.statusCode, 'Delete light with ID: ' + lightId);
        }
    });
}

function removeFromGroups(lightId){
    let options = {
        url: 'http://' + adapter.config.bridge + ':' + adapter.config.port + '/api/' + adapter.config.user + '/lights/' + lightId + '/groups',
        method: 'DELETE',
        headers: 'Content-Type" : "application/json'
    };

    request(options, function(error, res, body) {
        adapter.log.debug('removeFromGroups STATUS: ' + res.statusCode);
        let response;
        try{response = JSON.parse(body);} catch(err){}
        adapter.log.debug('removeFromGroups BODY: ' + JSON.stringify(response));

        if(res.statusCode === 200){
            if(response[0]['success']){
                adapter.log.info('The light with id ' + lightId + ' was removed from all groups.')
            }else if(response[0]['error']){
                //adapter.setState(stateId, {ack: false});
                adapter.log.warn(JSON.stringify(response[0]['error']));
            }
        }else{
            logging(res.statusCode, 'Remove light with ID from Groups: ' + lightId);
        }
    });
}
//END  Light functions -----------------------------------------------------------------------------------------------


function logging(statusCode, message){
    switch (statusCode){
        case 304:
            adapter.log.debug(message + ' Code 304: Not modified');
            break;
        case 400:
            adapter.log.warn(message + ' Code 400: Bad request');
            break;
        case 401:
            adapter.log.info(message + ' Code 401: Unathorized');
            break;
        case 403:
            adapter.log.info(message + ' Code 403: Forbidden');
            break;
        case 404:
            adapter.log.info(message + ' Code 404: Ressource not found');
            break;
        case 503:
            adapter.log.info(message + ' Code 503: Service unavailable');
            break;
    }
}

function nameFilter(name){
    let signs = [String.fromCharCode(46), String.fromCharCode(44), String.fromCharCode(92), String.fromCharCode(47), String.fromCharCode(91), String.fromCharCode(93), String.fromCharCode(123), String.fromCharCode(125), String.fromCharCode(32), String.fromCharCode(129), String.fromCharCode(154), String.fromCharCode(132), String.fromCharCode(142), String.fromCharCode(148), String.fromCharCode(153)]; //46=. 44=, 92=\ 47=/ 91=[ 93=] 123={ 125=} 32=Space 129=ü 154=Ü 132=ä 142=Ä 148=ö 153=Ö

    signs.forEach(function(item, index){
        let count = name.split(item).length - 1;

        for(let i = 0; i < count; i++) {
            name = name.replace(item, '_');
        }

        let result = name.search (/_$/);
        if(result != -1){
            name = name.replace(/_$/, '');
        }



    });
    return name;
}


// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}


