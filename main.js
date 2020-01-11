'use strict';

const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const request = require('request');
let SSDP = require('./lib/ssdp.js');

let adapter;

let started;
let hue_factor = 182.041666667;

let ws = null;
let alive_ts = 0;

function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: 'deconz',
        stateChange: function (id, state) {
            let tmp = id.split('.');
            let dp = tmp.pop();
            id = tmp.slice(2).join('.');

    if (!id || !state || state.ack) {
        if(dp === 'alive'){

            if(state === null){
                adapter.setState(id, {val: false, ack: true});
                if(ws !== null){
                    ws.terminate();
                    adapter.setState('info.connected', {val: false, ack: true});
                }
            }else if(state.val === true){
                if(state.lc !== alive_ts){
                    alive_ts = state.lc;
                    getAutoUpdates();
                }

            }
        }
        return;
    }


    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

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
                if(state.val >0 && ttime === 'none'){
                    parameters = '{"bri": ' + JSON.stringify(state.val) + ', "on": true}';
                }else if(state.val >0){
                    parameters = '{"transitiontime": ' + JSON.stringify(ttime) + ', "bri": ' + JSON.stringify(state.val) + ', "on": true}';
                }else{
                    parameters = '{"bri": ' + JSON.stringify(state.val) + ', "on": false}';
                }
                

                if(obj.common.role == 'light'){
                    setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.bri');
                }else if(obj.common.role == 'group'){
                    setGroupState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.bri');
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
                //let hue_factor = 182.041666667;
                if(ttime === 'none'){
                    parameters = '{"hue": ' + Math.round(parseInt(JSON.stringify(state.val)) * hue_factor) + '}';
                }else{
                    parameters = '{"transitiontime": ' + JSON.stringify(ttime) + ', "hue": ' + Math.round(parseInt(JSON.stringify(state.val)) * hue_factor) + '}';
                }

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
                    let controlId = obj.native.id;
                    let parameters = '{"effect": ' + JSON.stringify(state.val) + '}';
                    if(obj.common.role == 'light') {
                        setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.effect')
                    }else if(obj.common.role == 'group'){
                        setGroupState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.effect')
                    }
                }
            });
        }else if(dp === 'colormode'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function (err, obj) {
                let controlId = obj.native.id;
                let parameters = `{ "${dp}": "${state.val}" }`;
                setLightState(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.colormode');
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
                    let parentDevicelId = id.split(".")[1];
                    adapter.getObject(adapter.name + '.' + adapter.instance + '.Groups.' + parentDevicelId, function(err, objParent) {
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
                    let parentDevicelId = id.split(".")[1];
                    adapter.getObject(adapter.name + '.' + adapter.instance + '.Groups.' + parentDevicelId, function(err, objParent) {
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
                    let parentDeviceId = id.split(".")[1];
                    adapter.getObject(adapter.name + '.' + adapter.instance + '.Groups.' + parentDeviceId, function(err, objParent) {
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
                    adapter.getObject(adapter.name + '.' + adapter.instance + '.Groups.' + parentDevicelId, function(err, objParent) {
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
        } else if(dp === 'offset' || dp === 'sensitivity' || dp === 'usertest' || dp === 'ledindication' || dp === 'duration' || dp === 'delay' || dp === 'locked' || dp === 'boost' || dp === 'off' || dp === 'on' || === 'mode') {
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function (err, obj) {
                let controlId = obj.native.id;
                let parameters = `{ "${dp}": "${state.val}" }`;
                setSensorParameters(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.' + dp)
            });
        }else if(dp === 'heatsetpoint'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                let controlId = obj.native.id;
                let val = Math.floor(state.val * 100);
                let parameters = `{ "${dp}": "${val}" }`;
                setSensorParameters(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.' + dp)
            });
        }else if(dp === 'temperature'){
            adapter.getObject(adapter.name + '.' + adapter.instance + '.' + id, function(err, obj) {
                let controlId = obj.native.id;
                let val = Math.floor(state.val * 100);
                let parameters = `{ "${dp}": "${val}" }`;
                setSensorParameters(parameters, controlId, adapter.name + '.' + adapter.instance + '.' + id + '.' + dp)
            });
        }
    })
},
//END on StateChange

// New message arrived. obj is array with current messages
        message: async function (obj) {
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
                createAPIkey(obj.message.host, obj.message.credentials, function (res) {
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
                let opentime;
                await adapter.getObject('Gateway_info')
                    .then(async results =>{
                        opentime = results.native.networkopenduration;
                    });
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
           case 'saveConfig':
               adapter.log.info('save Config');
               adapter.extendObject('Gateway_info', {
                   native: obj.message

               });
               break;
            default:
                adapter.log.warn("Unknown command: " + obj.command);
                return false;
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


async function main() {
    adapter.subscribeStates('*');
    await adapter.getObjectAsync('Gateway_info')
        .then(async results=>{
            if(results.native.ipaddress === undefined){
                autoDiscovery();
            }else{
                if(results.native.user === '' || results.native.user === null){
                    adapter.log.warn('No API Key found');
                }else {
                    getConfig();
                }
            }
        }), (reject =>{
        adapter.log.error(JSON.stringify(reject));
    });

    setTimeout(function(){
        getAutoUpdates();
    }, 10000);


}


//search for Gateway
let discovery = new SSDP.Discovery();

function autoDiscovery(){

    discovery.on( 'message', (msg, rinfo, iface) => {
        let addr = `${rinfo.address}:${rinfo.port}`;
        if(msg.headers.st === 'urn:schemas-upnp-org:device:basic:1'){
            adapter.log.debug( `M-SEARCH from ${rinfo.address} for "${msg.headers.st}"`);
            if(msg.headers['gwid.phoscon.de'] !== undefined){
                let loc = msg.headers.location.replace('/description.xml', '');
                loc = loc.replace('http://', '');
                loc = loc.split(':');

                adapter.log.debug('autodiscovery: ' + loc);

                        adapter.extendObject('Gateway_info', {
                            native: {
                                ipaddress: loc[0],
                                port: loc[1]
                            }
                        });

                        discovery.close();
                }
        }

    });



    discovery.listen((error) => {
        if(error){
            adapter.log.error(error);
        }
        //discovery.search({ st: 'urn:schemas-upnp-org:device:basic:1', mx: 1 });
        discovery.search({ st: 'ssdp:all' });
    });


}

function heartbeat(){

    discovery.on( 'notify', ( msg, rinfo, iface ) => {
        if(msg.headers.nt === 'urn:schemas-upnp-org:device:basic:1') {
            if(msg.headers['gwid.phoscon.de']){
                let time = parseInt(msg.headers['cache-control'].replace('max-age=', ''));
                adapter.setState('Gateway_info.alive', {val: true, ack: true, expire: time + 10000});
                adapter.log.debug('NOTIFY ' + JSON.stringify(msg))
            }

        }
    });

    discovery.listen((error) => {
        if(error){
            adapter.log.error(error);
        }
    });
}

function createAPIkey(host, credentials, callback){
    let newApiKey = null;
    const userDescription = 'iobroker.deconz';
    let auth;

    if(credentials !== null){
        auth = Buffer.from(credentials).toString('base64');
    }else{
        auth = 'ZGVsaWdodDpkZWxpZ2h0';
    }

    let options = {
        url: 'http://' + host + '/api',
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8',
            'Authorization': `Basic ${auth}`,
            'Content-Length': Buffer.byteLength('{"devicetype": "ioBroker"}')
        }
    };
    adapter.log.info(host + ' auth: ' + auth);
    try{
        let req = request(options, function (error, res, body){
            if(!error){
                adapter.log.info('STATUS: ' + JSON.stringify(res));
                if(res.statusCode === 403){
                    callback({error: 101, message: 'Unlock Key not pressed'});
                }else if(res.statusCode === 200){
                    let apiKey = JSON.parse(body);
                    adapter.log.info(JSON.stringify(apiKey[0]['success']['username']));
                    callback({error: 0, message: apiKey[0]['success']['username']});
                    getConfig();
                }
            }else{
                adapter.log.error('Could not connect to deConz/Phoscon. ' + error);
            }
        });
        req.write('{"devicetype": "ioBroker"}');
    }catch(err){adapter.log.error(err)}

}

async function deleteAPIkey(){
    adapter.log.info('deleteAPIkey');
    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });
    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/config/whitelist/' + user,
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

                adapter.extendObject('Gateway_info', {
                    native: {
                        user: ''
                    }
                });

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

async function getAutoUpdates() {
    heartbeat();

    let host, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            host = results.native.ipaddress;
            port = results.native.websocketport;
            user = results.native.user;
        });

    if (user) {
            ws = new WebSocket('ws://' + host + ':' + port);

            ws.on('open', () => {
                adapter.setState('info.connection', {val: true, ack: true});
            });


            ws.on('error', (err) => {
                adapter.log.warn('Could not connect to websocket instance of deConz/Phoscon. ' + err);
                adapter.setState('info.connection', {val: false, ack: true});
            });

            ws.onmessage = async function (msg) {
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
                        let object = await getObjectByDeviceId(id, 'Sensors');
                        thing = 'Sensor';
                            if (object === undefined) {
                                getSensor(id);
                            } else {
                                if (typeof state == 'object') {
                                    for (let obj in state) {

                                        if (obj === 'lastupdated') {
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
                                            if (lupdate === null) {
                                                let newStates = new setObjectAndState(id, object.value.common.name, 'Sensors', obj, state[obj]);
                                            } else if (lupdate.val !== state[obj]) {
                                                if(obj === 'buttonevent'){
                                                    let newStates = new setObjectAndState(id, object.value.common.name, 'Sensors', obj, state[obj]);
                                                    adapter.setObjectNotExists(`Sensors.${id}` + '.' + "buttonpressed", {
                                                        type: 'state',
                                                        common: {
                                                            name: 'Sensor' + id + ' ' + 'buttonpressed',
                                                            type: 'number',
                                                            role: 'state',
                                                            read: true,
                                                            write: false
                                                        },
                                                        native: {}
                                                    });
                                                    adapter.setState(`Sensors.${id}` + '.' + 'buttonpressed', {
                                                        val: state[obj],
                                                        ack: true
                                                    });
                                                    setTimeout(function () {
                                                        adapter.setState(`Sensors.${id}` + '.' + 'buttonpressed', {
                                                            val: 0,
                                                            ack: true
                                                        })
                                                    }, 800);
                                                }else{
                                                    let newStates = new setObjectAndState(id, object.value.common.name, 'Sensors', obj, state[obj]);
                                                }
                                            }

                                        })
                                    }
                                }
                                if (typeof config == 'object') {
                                    for (let obj in config) {
                                        let newStates = new setObjectAndState(id, object.value.common.name, 'Sensors', obj, config[obj]);

                                    }
                                }

                            }
                        break;
                }

            }

    }
}

//START deConz config --------------------------------------------------------------------------------------------------
async function modifyConfig(parameters){
    let ip, port, user, ot;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
            ot = results.native.networkopenduration;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/config',
        method: 'PUT',
        headers: 'Content-Type" : "application/json',
        body: parameters
    };

    request(options, function(error, res, body) {
        let response;
        try{response = JSON.parse(body);} catch(err){}


        if(res.statusCode === 200){
            if(response[0]['success']){
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

async function getConfig(){
    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/config',
        method: 'GET'
    };

    request(options, function(error, res, body){
        if(error){
                adapter.log.error('Could not connect to deConz/Phoscon. ' + error);
        }else if(res.statusCode === 200) {
                let gateway = JSON.parse(body);
                adapter.log.debug('API version: ' + gateway['apiversion']);
                adapter.extendObject('Gateway_info', {
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



                getAllLights();
                getAllSensors();
                getAllGroups();
                getDevices();

        }else{
            logging(res.statusCode, 'Get Config:');
        }
    });
} //END getConfig
//END deConz config ----------------------------------------------------------------------------------------------------


//START  Group functions -----------------------------------------------------------------------------------------------
async function getAllGroups() {
    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/groups',
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


                        adapter.setObjectNotExists(`Groups.${groupID}`, {
                            type: 'device',
                            common: {
                                name: list[keyName]['name'],
                                role: 'group'
                            },
                            native: {
                                devicemembership: list[keyName]['devicemembership'],
                                etag: list[keyName]['etag'],
                                id: list[keyName]['id'],
                                hidden: list[keyName]['hidden'],
                                type: 'group'
                            }
                        }, ()=>{
                            getGroupAttributes(list[keyName]['id']);
                            getGroupScenes(`Groups.${groupID}`, list[keyName]['scenes']);
                        });

                    }
                }
        }else{
            logging(res.statusCode, 'Get all Groups:');
        }
    });
} //END getAllGroups

async function getGroupAttributes(groupId) {
    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/groups/' + groupId,
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
                        let newStates = new setObjectAndState(groupId, list['name'], 'Groups', stateName, list['action'][stateName]);
                        let tt = new setObjectAndState(groupId, list['name'], 'Groups', 'transitiontime', null);
                    }

                    let count3 = Object.keys(list['state']).length - 1;
                    //create states for light device
                    for (let z = 0; z <= count3; z++) {
                        let stateName = Object.keys(list['state'])[z];
                        let newStates = new setObjectAndState(groupId, list['name'], 'Groups', stateName, list['state'][stateName]);
                        let tt = new setObjectAndState(groupId, list['name'], 'Groups', 'transitiontime', null);
                    }

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
                getGroupScenes(`Groups.${groupID}`, list[keyName]['scenes']);
            }

        }else{
            logging(res.statusCode, 'Get group attributes: ' + groupId);
        }
    })
} //END getGroupAttributes

function getGroupScenes(group, sceneList) {
    adapter.log.debug("getGroupScenes for " + group + ": " + JSON.stringify(sceneList));

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
                            role: 'button',
                            type: 'boolean',
                            read: false,
                            write: true
                        }
                    });
                    adapter.setObjectNotExists(`${group}.Scene_${scene.id}.store`, {
                        type: 'state',
                        common: {
                            name: "store",
                            role: 'button',
                            type: 'boolean',
                            read: false,
                            write: true
                        }
                    });
                    adapter.setObjectNotExists(`${group}.Scene_${scene.id}.delete`, {
                        type: 'state',
                        common: {
                            name: "delete",
                            role: 'button',
                            type: 'boolean',
                            read: false,
                            write: true
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
                    adapter.extendObject(`${group}.Scene_${scene.id}`, {
                        common: {
                            name: scene.name
                        }
                    });
                }
            });
        }
    });
} //END getGroupScenes

async function setGroupState(parameters, groupId, stateId){
    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/groups/' + groupId + '/action',
        method: 'PUT',
        headers: 'Content-Type : application/json',
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

async function setGroupScene(parameters, groupId, sceneId, action, stateId, method){
    let sceneString = '';
    if(sceneId > 0){
        sceneString = '/' + sceneId;
        if(action != ''){
            sceneString += '/' + action;
        }
    }

    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/groups/' + groupId + '/scenes' + sceneString,
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

async function createGroup(name, callback) {
    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/groups',
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

async function deleteGroup(groupId){

    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/groups/' + groupId,
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
                        adapter.log.info('Delete device Object: ' + enums[keyName].id);
                        let name = enums[keyName]._id;

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
async function getAllSensors() {

    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/sensors',
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
                        let newStates = new setObjectAndState(sensorID, list[keyName]['name'], 'Sensors', stateName, list[keyName]['state'][stateName]);

                    }


                    let count3 = Object.keys(list[keyName]['config']).length - 1;
                    //create config states for sensor device
                    for (let x = 0; x <= count3; x++) {
                        let stateName = Object.keys(list[keyName]['config'])[x];
                        let value = null;
                        let newStates = new setObjectAndState(sensorID, list[keyName]['name'], 'Sensors', stateName, list[keyName]['config'][stateName]);
                    }
                }
            }
            }else
            {
                logging(res.statusCode, 'Get all Sensors:');
            }

    });
} //END getAllSensors

async function getSensor(sensorId){

    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/sensors/' + sensorId,
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

                    if (stateName == 'buttonevent' && list['modelid'] == 'lumi.Sensors.switch.aq2') {
                        let LastUpdate = Number(new Date(list['state']['lastupdated']));
                        let Now = Number(new Date().getTime());
                        let dateoff = new Date();
                        let TimeOffset = dateoff.getTimezoneOffset() * 60000;

                        if ((Now - LastUpdate + TimeOffset) < 2000) {
                            let newStates = new setObjectAndState(sensorId, list['name'], 'Sensors', stateName, list['state'][stateName]);

                        } else {
                            adapter.log.info('buttonevent NOT updated for ' + list['name'] + ', too old: ' + ((Now - LastUpdate + TimeOffset)/1000) + 'sec time difference update to now');
                        }
                    } else {
                        let newStates = new setObjectAndState(sensorId, list['name'], 'Sensors', stateName, list['state'][stateName]);
                    }


                    let count3 = Object.keys(list['config']).length - 1;
                    //create config for sensor device
                    for (let x = 0; x <= count3; x++) {
                        let stateName = Object.keys(list['config'])[x];
                        let newStates = new setObjectAndState(sensorId, list['name'], 'Sensors', stateName, list['config'][stateName]);

                    }
                }
        }
    })
} //END getSensor

async function setSensorParameters(parameters, sensorId, stateId, callback){

    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    adapter.log.info('setSensorParameters: ' + parameters + ' ' + sensorId + ' ' + stateId);
    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/sensors/' + sensorId + '/config',
        method: 'PUT',
        headers: 'Content-Type" : "application/json',
        body: parameters
    };

    request(options, function(error, res, body) {
        adapter.log.debug('STATUS: ' + res.statusCode);
        let response;
        try{response = JSON.parse(body);} catch(err){}
        adapter.log.debug('options: ' + JSON.stringify(options));
        adapter.log.debug('setSensorParameters BODY: ' + JSON.stringify(response));

        if(res.statusCode === 200){
            if(response[0]['success']){
                adapter.setState(stateId, {ack: true});
            }else if(response[0]['error']){
                //adapter.setState(stateId, {ack: false});
                adapter.log.warn(JSON.stringify(response[0]['error']));
            }
        }else{
            logging(res.statusCode, 'Set sensor parameters with ID: ' + sensorId + ' parameter: ' + parameters);
        }

        if(callback)
            callback();
    });
} //END setSensorParameters

async function deleteSensor(sensorId){

    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/sensors/' + sensorId,
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
                            adapter.log.info('delete device Object: ' + enums[keyName]._id);
                            let name = enums[keyName]._id;

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
async function getAllLights(){

    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/lights',
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
                            let newStates = new setObjectAndState(lightID, list[keyName]['name'], 'Lights', stateName, list[keyName]['state'][stateName]);
                            let tt = new setObjectAndState(lightID, list[keyName]['name'], 'Lights', 'transitiontime', null);

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

async function getLightState(lightId){

    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/lights/' + lightId,
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
                        let newStates = new setObjectAndState(lightId, list[keyName]['name'], 'Lights', stateName, list['state'][stateName]);
                    }
            } else{
                logging(res.statusCode, 'Get light state with ID: ' + lightId);
            }
    })
} //END getLightState

async function setLightState(parameters, lightId, stateId, callback){
        adapter.log.info('setLightState: ' + parameters + ' ' + lightId + ' ' + stateId);

        let ip, port, user;
        await adapter.getObjectAsync('Gateway_info')
            .then(async results => {
                ip = results.native.ipaddress;
                port = results.native.port;
                user = results.native.user;
            });

        let options = {
            url: 'http://' + ip + ':' + port + '/api/' + user + '/lights/' + lightId + '/state',
            method: 'PUT',
            headers: 'Content-Type" : "application/json',
            body: parameters
        };

        request(options, function(error, res, body) {
            adapter.log.debug('STATUS: ' + res.statusCode);
            let response;
            try{response = JSON.parse(body);} catch(err){}
            adapter.log.debug('options: ' + JSON.stringify(options));
            adapter.log.debug('setLightState BODY: ' + JSON.stringify(response));

            if(res.statusCode === 200 && (response[0] !== undefined || response[0] !== 'undefined')){
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

async function deleteLight(lightId){

    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/lights/' + lightId,
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

async function removeFromGroups(lightId){

    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/lights/' + lightId + '/groups',
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
//END  Light functions -------------------------------------------------------------------------------------------------

//START Devices functions ----------------------------------------------------------------------------------------------
async function getDevices(){

    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/devices',
        method: 'GET'
    };

    request(options, function (error, res, body){
        adapter.log.debug('getDevices: ' + JSON.stringify(res) + ' ' + body);
    });
}
//END Devices functions ------------------------------------------------------------------------------------------------

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

function UTCtoLocal(timeString){
    if(timeString !== 'none' && timeString !== null && timeString !== undefined) {
        let jsT = Date.parse(timeString + 'Z');

        let d = new Date();
        let n = d.getTimezoneOffset();

        let local;

        if (Math.sign(n) === -1) {
            n = Math.abs(n);
            let offset = (n * 60) * 1000;

            local = jsT + offset;
        } else {
            let offset = (n * 60) * 1000;

            local = jsT - offset;
        }

        let lTime = (new Date(local)).toISOString();
        return lTime;
    }else{
        return timeString;
    }
}

async function getObjectByDeviceId(id, type){
    /*
    type = Groups, Lights, Sensors
     */
   let obj = await adapter.getObjectListAsync({startkey: 'deconz.' + adapter.instance + '.' + type + '.', endkey: 'deconz.' + adapter.instance + '.' + type + '.\u9999'});

        let rows = obj.rows;
        let object;
        for(let o in rows){
            if(rows[o].value.native !== undefined){
                if(rows[o].value.native.id === id.toString()){
                    object = rows[o];
                    break;
                }
            }
        }
        return object;
}

function setObjectAndState(id, name, type, stateName, value){
    /*
    type = Sensors, Lights, Groups
     */
    let objType = 'mixed';
    let objRole = 'state';
    let objStates = null;
    let objRead = true;
    let objWrite = true;
    let objMin = null;
    let objMax = null;
    let objUnit = null;
    let objDefault = null;

    switch(stateName){
        case 'orientation':
            objType = 'array';
            objWrite = false;
            break;
        case 'pending':
            objType = 'array';
            objWrite = false;
            break;
        case 'xy':
            objType = 'array';
            objRole = 'color.CIE';
            objDefault = '0.10000, 0.10000';
            break;
        case 'alarm':
            objType = 'boolean';
            objRole = 'sensor.alarm';
            objWrite = false;
            break;
        case 'all_on':
            objType = 'boolean';
            objRole = 'switch';
            break;
        case 'any_on':
            objType = 'boolean';
            objRole = 'switch';
            break;
        case 'boost':
            objType = 'boolean';
            objRole = 'switch';
            break;
        case 'carbonmonoxide':
            objType = 'boolean';
            objRole = 'sensor.alarm';
            objWrite = false;
            break;
        case 'displayflipped':
            objType = 'boolean';
            objRole = 'indicator';
            objWrite = false;
            break;
        case 'fire':
            objType = 'boolean';
            objRole = 'sensor.alarm.fire';
            objWrite = false;
            break;
        case 'flag':
            objType = 'boolean';
            objRole = 'indicator';
            objWrite = false;
            break;
        case 'ledindication':
            objType = 'boolean';
            objRole = 'indicator';
            break;
        case 'on':
        case 'off':
        case 'locked':
        case 'usertest':
        case 'toggle':
            objType = 'boolean';
            objRole = 'switch';
            break;
        case 'lowbattery':
            objType = 'boolean';
            objRole = 'indicator.lowbat';
            objWrite = false;
            break;
        case 'open':
            objType = 'boolean';
            objRole = 'sensor.open';
            objWrite = false;
            break;
        case 'presence':
            objType = 'boolean';
            objRole = 'sensor.motion';
            objWrite = false;
            break;
        case 'reachable':
            objType = 'boolean';
            objRole = 'indicator.reachable';
            objWrite = false;
            break;
        case 'vibration':
            objType = 'boolean';
            objRole = 'sensor.vibration';
            break;
        case 'water':
            objType = 'boolean';
            objRole = 'sensor.alarm.flood';
            objWrite = false;
            break;
        case 'scheduleron':
        case 'tampered':
        case 'dark':
        case 'daylight':
            objType = 'boolean';
            objRole = 'state';
            objWrite = false;
            break;
        case 'battery':
            objType = 'number';
            objRole = 'value.battery';
            objWrite = false;
            objMin = 0;
            objMax = 100;
            objUnit = '%';
            objDefault = 0;
            break;
        case 'bri':
            objType = 'number';
            objRole = 'value.brightness';
            objMin = 0;
            objMax = 254;
            objDefault = 254;
            break;
        case 'buttonevent':
            objType = 'number';
            objRole = 'state';
            objWrite = false;
            break;
        case 'colorspeed':
            objType = 'number';
            objRole = 'state';
            objMin = 1;
            objMax = 255;
            objDefault = 255;
            break;
        case 'configid':
            objType = 'number';
            objRole = 'state';
            break;
        case 'consumption':
            objType = 'number';
            objRole = 'value.power.consumption';
            objWrite = false;
            objDefault = 0;
            objUnit = 'Wh';
            break;
        case 'ct':
            objType = 'number';
            objRole = 'level.color.temperature';
            objMin =  153;
            objMax = 500;
            objDefault = 500;
            break;
        case 'current':
            objType = 'number';
            objRole = 'value.current';
            objWrite = false;
            objDefault = 0;
            objUnit = 'mA';
            break;
        case 'delay':
            objType = 'number';
            objRole = 'state';
            break;
        case 'duration':
            objType = 'number';
            objRole = 'value.power.consumption';
            objMin = 0;
            objMax = 600;
            objDefault = 600;
            objUnit = 's';
            break;
        case 'group':
            objType = 'number';
            objRole = 'state';
            break;
        case 'heatsetpoint':
            objType = 'number';
            objRole = 'level.temperature';
            objDefault = 20.00;
            objUnit = '°C';
            value = value / 100;
            break;
        case 'hue':
            objType = 'number';
            objRole = 'level.color.hue';
            objMin = 0;
            objMax = 360;
            objDefault = 360;
            objUnit = '°';
            value = Math.round(value * 100 / hue_factor) / 100;
            break;
        case 'humidity':
            objType = 'number';
            objRole = 'value.humidity';
            objWrite = false;
            objMin = 0;
            objMax = 100;
            objDefault = 0;
            objUnit = '%';
            value = value / 100;
            break;
        case 'lightlevel':
            objType = 'number';
            objRole = 'value';
            objWrite = false;
            objDefault = 0;
            break;
        case 'lux':
            objType = 'number';
            objRole = 'value.brightness';
            objDefault = 0;
            objWrite = false;
            objUnit = 'Lux';
            break;
        case 'offset':
            objType = 'number';
            objRole = 'state';
            objMin = -500;
            objMax = 500;
            objDefault = 0;
            break;
        case 'power':
            objType = 'number';
            objRole = 'value.power';
            objWrite = false;
            objDefault = 0;
            objUnit = 'W';
            break;
        case 'pressure':
            objType = 'number';
            objRole = 'value.pressure';
            objWrite = false;
            objDefault = 0;
            objUnit = 'hPa';
            break;
        case 'sat':
            objType = 'number';
            objRole = 'level.color.saturation';
            objMin = 0;
            objMax = 255;
            objDefault = 255;
            break;
        case 'sensitivity':
            objType = 'number';
            objRole = 'state';
            objDefault = 0;
            break;
        case 'sensitivitymax':
            objType = 'number';
            objRole = 'state';
            objDefault = 0;
            break;
        case 'speed':
            objType = 'number';
            objRole = 'state';
            objDefault = 0;
            break;
        case 'status':
            objType = 'number';
            objRole = 'state';
            objWrite = false;
            objDefault = 0;
            break;
        case 'temperature':
            objType = 'number';
            objRole = 'value.temperature';
            objWrite = false;
            objDefault = 0;
            objUnit = '°C';
            value = value / 100;
            break;
        case 'tiltangle':
            objType = 'number';
            objRole = 'value.tilt';
            objWrite = false;
            objDefault = 0;
            objUnit = '°';
            break;
        case 'transitiontime':
            objType = 'number';
            objRole = 'state';
            objDefault = 0;
            break;
        case 'vibrationstrength':
            objType = 'number';
            objRole = 'value';
            objWrite = false;
            objDefault = 0;
            break;
        case 'valve':
            objType = 'number';
            objRole = 'value.valve';
            objWrite = false;
            objDefault = 0;
            break;
        case 'voltage':
            objType = 'number';
            objRole = 'value.voltage';
            objWrite = false;
            objDefault = 0;
            objUnit = 'V';
            break;
        case 'alert':
            objType = 'string';
            objRole = 'state';
            objDefault = 'none';
            objStates = {none: 'none', select: 'select', lselect: 'lselect', blink: 'blink'};
            break;
        case 'colormode':
            objType = 'string';
            objRole = 'state';
            objStates = {hs: 'hs', xy: 'xy', ct : 'ct'};
            break;
        case 'effect':
            objType = 'string';
            objRole = 'state';
            objStates = {none: 'none', colorloop: 'colorloop'};
            let cs = new setObjectAndState(id, name, type, 'colorspeed', null);
            break;
        case 'lastupdated':
            objType = 'string';
            objRole = 'value.datetime';
            objWrite = false;
            value = UTCtoLocal(value);
            break;
        case 'localtime':
            objType = 'string';
            objRole = 'value.datetime';
            objWrite = false;
            break;
        case 'mode':
            objType = 'string';
            objRole = 'state';
            break;
        case 'scheduler':
            objType = 'string';
            objRole = 'state';
            break;
    }

    let objCommon = {
        name: name + ' ' + stateName,
        type: objType,
        role: objRole,
        read: objRead,
        write: objWrite
    };

    if(objStates !== null){
        objCommon.states = objStates;
    }
    if(objUnit !== null){
        objCommon.unit = objUnit;
    }
    if(objMin !== null){
        objCommon.min = objMin;
    }
    if(objMin !== null){
        objCommon.max = objMax;
    }
    if(objDefault !== null){
        objCommon.def = objDefault;
    }


    adapter.setObjectNotExists(`${type}.${id}` + '.' + stateName, {
        type: 'state',
        common: objCommon,
        native: {}
    });
    if(value !== null){
        adapter.setState(`${type}.${id}` + '.' + stateName, {
            val: value,
            ack: true
        });
    }

}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}