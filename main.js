'use strict';

const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const request = require('request');
let SSDP = require('./lib/ssdp.js');

let adapter;

let hue_factor = 182.041666667;

let ws = null;
let alive_ts = 0;
let reconnect = null;

//Sentry for error reporting
let Sentry;
let SentryIntegrations;
function initSentry(callback) {
    if (!adapter.ioPack.common || !adapter.ioPack.common.plugins || !adapter.ioPack.common.plugins.sentry) {
        return callback && callback();
    }
    const sentryConfig = adapter.ioPack.common.plugins.sentry;
    if (!sentryConfig.dsn) {
        adapter.log.warn('Invalid Sentry definition, no dsn provided. Disable error reporting');
        return callback && callback();
    }
    // Require needed tooling
    Sentry = require('@sentry/node');
    SentryIntegrations = require('@sentry/integrations');
    // By installing source map support, we get the original source
    // locations in error messages
    require('source-map-support').install();

    let sentryPathWhitelist = [];
    if (sentryConfig.pathWhitelist && Array.isArray(sentryConfig.pathWhitelist)) {
        sentryPathWhitelist = sentryConfig.pathWhitelist;
    }
    if (adapter.pack.name && !sentryPathWhitelist.includes(adapter.pack.name)) {
        sentryPathWhitelist.push(adapter.pack.name);
    }
    let sentryErrorBlacklist = [];
    if (sentryConfig.errorBlacklist && Array.isArray(sentryConfig.errorBlacklist)) {
        sentryErrorBlacklist = sentryConfig.errorBlacklist;
    }
    if (!sentryErrorBlacklist.includes('SyntaxError')) {
        sentryErrorBlacklist.push('SyntaxError');
    }

    Sentry.init({
        release: adapter.pack.name + '@' + adapter.pack.version,
        dsn: sentryConfig.dsn,
        integrations: [
            new SentryIntegrations.Dedupe()
        ]
    });
    Sentry.configureScope(scope => {
        scope.setTag('version', adapter.common.installedVersion || adapter.common.version);
        if (adapter.common.installedFrom) {
            scope.setTag('installedFrom', adapter.common.installedFrom);
        }
        else {
            scope.setTag('installedFrom', adapter.common.installedVersion || adapter.common.version);
        }
        scope.addEventProcessor(function(event, hint) {
            // Try to filter out some events
            if (event.exception && event.exception.values && event.exception.values[0]) {
                const eventData = event.exception.values[0];
                // if error type is one from blacklist we ignore this error
                if (eventData.type && sentryErrorBlacklist.includes(eventData.type)) {
                    return null;
                }
                if (eventData.stacktrace && eventData.stacktrace.frames && Array.isArray(eventData.stacktrace.frames) && eventData.stacktrace.frames.length) {
                    // if last exception frame is from an nodejs internal method we ignore this error
                    if (eventData.stacktrace.frames[eventData.stacktrace.frames.length - 1].filename && (eventData.stacktrace.frames[eventData.stacktrace.frames.length - 1].filename.startsWith('internal/') || eventData.stacktrace.frames[eventData.stacktrace.frames.length - 1].filename.startsWith('Module.'))) {
                        return null;
                    }
                    // Check if any entry is whitelisted from pathWhitelist
                    const whitelisted = eventData.stacktrace.frames.find(frame => {
                        if (frame.function && frame.function.startsWith('Module.')) {
                            return false;
                        }
                        if (frame.filename && frame.filename.startsWith('internal/')) {
                            return false;
                        }
                        if (frame.filename && !sentryPathWhitelist.find(path => path && path.length && frame.filename.includes(path))) {
                            return false;
                        }
                        return true;
                    });
                    if (!whitelisted) {
                        return null;
                    }
                }
            }

            return event;
        });


        adapter.getForeignObject('system.config', (err, obj) => {
            if (obj && obj.common && obj.common.diag) {
                adapter.getForeignObject('system.meta.uuid', (err, obj) => {
                    // create uuid
                    if (!err  && obj) {
                        Sentry.configureScope(scope => {
                            scope.setUser({
                                id: obj.native.uuid
                            });
                        });
                    }
                    callback && callback();
                });
            }
            else {
                callback && callback();
            }
        });
    });
}

class deconz extends utils.Adapter{
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'deconz',
        });
        this.on('ready', this.onReady.bind(this));
        //this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        adapter = this;

        if (adapter.supportsFeature && adapter.supportsFeature('PLUGINS')) {
            await main();
        }
        else {
            initSentry(main);
        }
    }

    async onUnload(callback) {
        if(ws !== null) ws.terminate();
        this.setState('info.connection', {val: false, ack: true});
        this.setState('Gateway_info.alive', {val: false, ack: true});

        try {
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    async onStateChange(id, state){
        let oid = id;
        let tmp = id.split('.');
        let dp = tmp.pop();
        id = tmp.slice(2).join('.');

        if (!id || !state || state.ack) {
            if (dp === 'alive') {
                if (state === null) {
                    this.setState(id, {val: false, ack: true});
                    if (ws !== null) {
                        ws.terminate();
                        this.setState('info.connection', {val: false, ack: true});
                    }
                } else if (state.val === true) {
                    if (state.lc !== alive_ts) {
                        alive_ts = state.lc;
                        if(reconnect !== null){
                            if(ws !== null){
                                ws.terminate();
                            }
                            clearTimeout(reconnect);
                        }
                        await getAutoUpdates();
                    }

                }
            }
            return;
        }

        this.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

        this.log.debug('dp: ' + dp + '; id:' + id + ' tmp: ' + tmp);

        let stateObj = await this.getObjectAsync(oid);

        if(typeof state.val === stateObj.common.type) {
            /**
             * @param {any} err
             * @param {object|null} tTime - object for state transitiontime
             */
            this.getState(this.name + '.' + this.instance + '.' + id + '.transitiontime', async (err, tTime) => {
                let parameters = {};
                let action = '';
                let stateId = '';
                let method = '';
                let transitionTime = (err === null && tTime !== null) ? (tTime.val * 10) : 'none';

                let obj = await this.getObjectAsync(this.name + '.' + this.instance + '.' + id);
                if (obj === null) return false;

                let controlId = obj !== null ? obj.native.id : '';


                switch (dp) {
                    case 'bri':
                        if (state.val > 0 && (transitionTime === 'none' || transitionTime === 0)) {
                            parameters = '{"bri": ' + JSON.stringify(state.val) + ', "on": true}';
                        } else if (state.val > 0) {
                            parameters = '{"transitiontime": ' + JSON.stringify(transitionTime) + ', "bri": ' + JSON.stringify(state.val) + ', "on": true}';
                        } else {
                            parameters = '{"bri": ' + JSON.stringify(state.val) + ', "on": false}';
                        }
                        new SetObjectAndState(tmp[3], '', tmp[2], 'level', Math.floor((100 / 255) * state.val));
                        break;
                    case 'level':
                        if (state.val > 0 && (transitionTime === 'none' || transitionTime === 0)) {
                            parameters = '{"bri": ' + Math.floor((255 / 100) * state.val) + ', "on": true}';
                        } else if (state.val > 0) {
                            parameters = '{"transitiontime": ' + JSON.stringify(transitionTime) + ', "bri": ' + Math.floor((255 / 100) * state.val) + ', "on": true}';
                        } else {
                            parameters = '{"bri": ' + Math.floor((255 / 100) * state.val) + ', "on": false}';
                        }
                        break;
                    case 'on':
                        if (transitionTime === 'none' || transitionTime === 0) {
                            parameters = '{"on": ' + JSON.stringify(state.val) + '}';
                        } else {
                            parameters = '{"transitiontime": ' + JSON.stringify(transitionTime) + ', "on": ' + JSON.stringify(state.val) + '}';
                        }
                        break;
                    case 'hue':
                        if (transitionTime === 'none' || transitionTime === 0) {
                            parameters = '{"hue": ' + Math.round(parseInt(JSON.stringify(state.val)) * hue_factor) + '}';
                        } else {
                            parameters = '{"transitiontime": ' + JSON.stringify(transitionTime) + ', "hue": ' + Math.round(parseInt(JSON.stringify(state.val)) * hue_factor) + '}';
                        }
                        break;
                    case 'sat':
                        if (transitionTime === 'none' || transitionTime === 0) {
                            parameters = '{"sat": ' + JSON.stringify(state.val) + '}';
                        } else {
                            parameters = '{"transitiontime": ' + JSON.stringify(transitionTime) + ', "sat": ' + JSON.stringify(state.val) + '}';
                        }
                        break;
                    case 'ct':
                        if (transitionTime === 'none' || transitionTime === 0) {
                            parameters = '{"ct": ' + JSON.stringify(state.val) + '}';
                        } else {
                            parameters = '{"transitiontime": ' + JSON.stringify(transitionTime) + ', "ct": ' + JSON.stringify(state.val) + '}';
                        }
                        break;
                    case 'xy':
                        if (transitionTime === 'none' || transitionTime === 0) {
                            parameters = '{"xy": [' + state.val + ']}';
                        } else {
                            parameters = '{"transitiontime": ' + JSON.stringify(transitionTime) + ', "xy": [' + state.val + ']}';
                        }
                        break;
                    case 'alert':
                        if (transitionTime === 'none' || transitionTime === 0) {
                            parameters = '{"alert": ' + JSON.stringify(state.val) + '}';
                        } else {
                            parameters = '{"transitiontime": ' + JSON.stringify(transitionTime) + ', "alert": ' + JSON.stringify(state.val) + '}';
                        }
                        break;
                    case 'effect':
                        if (state.val === 'colorloop') {
                            let speed = await this.getStateAsync(this.name + '.' + this.instance + '.' + id + '.colorspeed');
                            this.log.info(JSON.stringify(speed));
                            if (speed.val === null || speed.val === undefined) {
                                speed.val = 1;
                            }
                            parameters = '{"colorspeed": ' + speed.val + ', "effect": ' + JSON.stringify(state.val) + '}';
                        } else {
                            parameters = '{"effect": ' + JSON.stringify(state.val) + '}';
                        }
                        break;
                    case 'colormode':
                        parameters = `{ "${dp}": "${state.val}" }`;
                        break;
                    case 'dimup':
                    case 'dimdown':
                        let dimspeed = await this.getStateAsync(this.name + '.' + this.instance + '.' + id + '.dimspeed');

                        if (dimspeed === null || dimspeed === undefined || dimspeed.val === 0) {
                            dimspeed = 10;
                            this.setState(this.name + '.' + this.instance + '.' + id + '.dimspeed', 10, true);
                        }
                        let speed = dp === 'dimup' ? dimspeed.val : dimspeed.val * -1;
                        if (transitionTime !== 'none') {
                            parameters = `{ "transitiontime": ${JSON.stringify(transitionTime)} , "bri_inc": ${speed} }`;
                        } else {
                            parameters = `{ "bri_inc": ${speed} }`;
                        }
                        break;
                    case 'action':
                        if (state.val === null || state.val === undefined || state.val === 0) {
                            return;
                        }
                        parameters = `{ ${state.val} }`;
                        break;
                    case 'createscene':
                        if (obj.common.role === 'group') {
                            let controlId = obj.native.id;
                            let parameters = `{ "name": "${state.val}" }`;
                            setGroupScene(parameters, controlId, 0, '', '', 'POST');
                            getAllGroups();
                        }
                        break;
                    case 'delete':
                        method = 'DELETE';
                        await this.delObjectAsync(this.name + '.' + this.instance + '.' + id);
                        break;
                    case 'store':
                        action = 'store';
                        method = 'PUT';
                        break;
                    case 'recall':
                        action = 'recall';
                        method = 'PUT';
                        break;
                    case 'name':
                        parameters = `{ "name": "${state.val}" }`;
                        method = 'PUT';

                        this.extendObject(this.name + '.' + this.instance + '.' + id, {
                            common: {
                                name: state.val
                            }
                        });
                        break;
                    case 'offset':
                    case 'sensitivity':
                    case 'usertest':
                    case 'ledindication':
                    case 'duration':
                    case 'delay':
                    case 'locked':
                    case 'boost':
                    case 'off':
                    case 'mode':
                        parameters = `{ "${dp}": "${state.val}" }`;
                        break;
                    case 'heatsetpoint':
                    case 'temperature':
                        let val = Math.floor(state.val * 100);
                        parameters = `{ "${dp}": "${val}" }`;
                        break;
                    case 'network_open':
                        let opentime;
                        await this.getObjectAsync('Gateway_info')
                            .then(async results => {
                                opentime = results.native.networkopenduration;
                            }, reject => {
                                this.log.error(JSON.stringify(reject));
                            });
                        parameters = `{"permitjoin": ${opentime}}`;
                        await modifyConfig(parameters);
                        break;
                    default:
                        action = 'none';
                        break;
                }

                if (action !== 'none') {
                    if (typeof parameters === 'object') {
                        parameters = JSON.stringify(parameters);
                    }
                    switch (obj.common.role) {
                        case 'light':
                            await setLightState(parameters, controlId, this.name + '.' + this.instance + '.' + id + '.' + dp);
                            break;
                        case 'group':
                            if (dp !== 'createscene') {
                                await setGroupState(parameters, controlId, this.name + '.' + this.instance + '.' + id + '.' + dp);
                            }
                            break;
                        case 'sensor':
                            await setSensorParameters(parameters, controlId, this.name + '.' + this.instance + '.' + id + '.' + dp);
                            break;
                        case 'scene':
                            let parentDeviceId = id.split(".")[1];
                            //let parent = await adapter.getObjectAsync(adapter.name + '.' + adapter.instance + '.Groups.' + parentDeviceId);
                            await setGroupScene(parameters, parentDeviceId, controlId, action, stateId, method);
                            break;
                    }
                }
            });
        }
    }

    async onMessage(obj) {
        let wait = false;
        if (obj) {
            switch (obj.command) {
                case 'createAPIkey':
                    createAPIkey(obj.message.host, obj.message.credentials, (res) => {
                        if (obj.callback) this.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                    });
                    wait = true;
                    break;
                case 'deleteAPIkey':
                    await deleteAPIkey();
                    wait = true;
                    break;
                case 'getConfig':
                    await getConfig();
                    wait = true;
                    break;
                case 'openNetwork':
                    let openTime;
                    await this.getObjectAsync('Gateway_info')
                        .then(async results => {
                            openTime = results.native.networkopenduration;
                        }, reject => {
                            this.log.error(JSON.stringify(reject));
                        });
                    let parameters = `{"permitjoin": ${openTime}}`;
                    await modifyConfig(parameters);
                    wait = true;
                    break;
                case 'deleteLight':
                    await deleteLight(obj.message, (res) => {
                        if (obj.callback) this.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                    });
                    wait = true;
                    break;
                case 'deleteSensor':
                    await deleteSensor(obj.message, (res) => {
                        if (obj.callback) this.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                    });
                    wait = true;
                    break;
                case 'createGroup':
                    await createGroup(obj.message, (res) => {
                        if (obj.callback) this.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                    });
                    wait = true;
                    break;
                case 'deleteGroup':
                    await deleteGroup(obj.message, (res) => {
                        if (obj.callback) this.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
                    });
                    wait = true;
                    break;
                case 'saveConfig':
                    this.extendObject('Gateway_info', {
                        native: obj.message
                    });
                    break;
                default:
                    this.log.warn("Unknown command: " + obj.command);
                    return false;
            }
        }
        if (!wait && obj.callback) {
            this.sendTo(obj.from, obj.command, obj.message, obj.callback);
        }
        return true;
    }
}

async function main() {
    adapter.subscribeStates('*');

    heartbeat();
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            if (results.native.ipaddress === undefined) {  //only on first start
                autoDiscovery();
            } else {
                if (results.native.user === '' || results.native.user === null) {
                    adapter.log.warn('No API Key found');
                } else {
                    getConfig();
                    getAutoUpdates();
                }
            }
        }), (reject => {
        adapter.log.error(JSON.stringify(reject));
    });
}


//search for Gateway
let discovery = new SSDP.Discovery();
let found_deconz = false;
let wait;

function autoDiscovery() {
    adapter.log.info('auto discovery');

    discovery.on('message', (msg, rinfo, iface) => {
        if (msg.headers.st === 'urn:schemas-upnp-org:device:basic:1') {
            adapter.log.debug(`M-SEARCH from ${rinfo.address} for "${msg.headers.st}"`);
            if (msg.headers['gwid.phoscon.de'] !== undefined) {
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
                found_deconz = true;
                clearTimeout(wait);
                discovery.close();
            }
        }

    });


    discovery.listen('',(error) => {
        if (error) {
            sentryMsg(error);
        }
        discovery.search({st: 'ssdp:all'});
        wait = setTimeout( () => {
            adapter.log.warn('Could not found deConz by broadcast, establishing Websocket without monitoring the connection state. This is happen if you are using VLAN or installed deConz in an container.')
            getAutoUpdates();
        }, 10 * 1000)
    });


}

function heartbeat() {

    discovery.on('notify', (msg, rinfo, iface) => {
        if (msg.headers.nt === 'urn:schemas-upnp-org:device:basic:1') {
            if (msg.headers['gwid.phoscon.de']) {
                let time = parseInt(msg.headers['cache-control'].replace('max-age=', ''));
                adapter.setState('Gateway_info.alive', {val: true, ack: true, expire: time});
                //adapter.log.debug('NOTIFY ' + JSON.stringify(msg))
            }
        }
    });

    discovery.listen((error) => {
        if (error) {
            sentryMsg(error);
        }
    });
}

function createAPIkey(host, credentials, callback) {
    let auth;

    if (credentials !== null) {
        auth = Buffer.from(credentials).toString('base64');
    } else {
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
    adapter.log.debug(host + ' auth: ' + auth);
    try {
        let req = request(options, async (error, res, body) => {
            if (!error) {
                adapter.log.info('STATUS: ' + JSON.stringify(res));
                if (res.statusCode === 403) {
                    callback({error: 101, message: 'Unlock Key not pressed'});
                } else if ( await logging(res, body, 'create API key') ) {
                    let apiKey = JSON.parse(body);
                    adapter.log.info(JSON.stringify(apiKey[0]['success']['username']));
                    callback({error: 0, message: apiKey[0]['success']['username']});
                    getConfig();
                }
            } else {
                adapter.log.error('Could not connect to deConz/Phoscon. ' + error);
            }
        });
        req.write('{"devicetype": "ioBroker"}');
    } catch (err) {
        adapter.log.error(err)
    }

}

async function deleteAPIkey() {
    adapter.log.info('deleteAPIkey');
    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results !== null ? results.native.ipaddress : null;
            port = results !== null ? results.native.port : null;
            user = results !== null ? results.native.user : null;
        });
    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/config/whitelist/' + user,
        method: 'DELETE',
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8'
        }
    };

    request(options, async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            let response;
            try {
                response = JSON.parse(body);
            } catch (err) {
            }
            if (res !== undefined) {
                if (await logging(res, body, 'delete API key')) {
                    if (response[0]['success']) {

                        adapter.extendObject('Gateway_info', {
                            native: {
                                user: ''
                            }
                        });

                        adapter.log.info('API key deleted');
                    } else if (response[0]['error']) {
                        adapter.log.warn(JSON.stringify(response[0]['error']));
                    }
                } else if (res.statusCode === 403) {
                    adapter.log.warn('You do not have the permission to do this! ');
                } else if (res.statusCode === 404) {
                    adapter.log.warn('Error 404 Not Found ')
                }
            }
        }
    });
}

//Make Abo using websocket
const WebSocket = require('ws');

function autoReconnect(host, port){
    reconnect = setTimeout(() => {
        ws.terminate();
        getAutoUpdates();
    }, 60 * 1000);
}

async function getAutoUpdates() {

    let host, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            host = (results !== null || results !== undefined) ? results.native.ipaddress : null;
            port = (results !== null || results !== undefined) ? results.native.websocketport : null;
            user = (results !== null || results !== undefined) ? results.native.user : null;
        }, reject => {
            adapter.log.warn('Object Gateway_info access error: ' + JSON.stringify(reject))
        });

    if (user !== null && host !== null && port !== null) {
        ws = new WebSocket('ws://' + host + ':' + port);

        ws.on('open', () => {
            adapter.setState('info.connection', {val: true, ack: true});
            adapter.log.debug('Subscribed to updates...');
            autoReconnect();
        });

        ws.on('close', () => {
            adapter.log.debug('Websocket connection closed');
            //getAutoUpdates();
        });

        ws.on('error', async (err) => {
            adapter.log.warn('Could not connect to websocket instance of deConz/Phoscon. ' + err);
            if(ws !== null) ws.terminate();
            adapter.setState('info.connection', {val: false, ack: true});
            setTimeout(async () => {
                await getAutoUpdates();
            }, 60 * 1000)

        });


        ws.onmessage = async (msg) => {
            clearTimeout(reconnect);
            autoReconnect(host, port);
            let data = JSON.parse(msg.data);
            let id = data['id'] ? data['id'] : data['gid'];
            let type = data['r'];
            let state = data['state'];
            let config = data['config'];
            adapter.log.debug('Websocket message: ' + JSON.stringify(data));

            let thing;
            let object;
            switch (type) {
                case 'lights':
                    await getLightState(id);
                    break;
                case 'groups':
                case 'scenes':
                    await getGroupAttributes(id);
                    break;
                case 'sensors':
                    object = await getObjectByDeviceId(id, 'Sensors');
                    thing = 'Sensor';
                    if (object === undefined) {
                       await getSensor(id);
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
                                        new SetObjectAndState(id, object.value.common.name, 'Sensors', obj, state[obj]);
                                    } else if (lupdate.val !== state[obj]) {
                                        if (obj === 'buttonevent') {
                                            new SetObjectAndState(id, object.value.common.name, 'Sensors', obj, state[obj]);
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
                                            setTimeout(() => {
                                                adapter.setState(`Sensors.${id}` + '.' + 'buttonpressed', {
                                                    val: 0,
                                                    ack: true
                                                })
                                            }, 800);
                                        } else {
                                            new SetObjectAndState(id, object.value.common.name, 'Sensors', obj, state[obj]);
                                        }
                                    }

                                })
                            }
                        }
                        if (typeof config == 'object') {
                            for (let obj in config) {
                                new SetObjectAndState(id, object.value.common.name, 'Sensors', obj, config[obj]);
                            }
                        }

                    }
                    break;
            }

        }

    }
}

//START deConz config --------------------------------------------------------------------------------------------------
async function modifyConfig(parameters) {
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

    request(options, async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            let response;
            if (error) adapter.log.warn(error);
            try {
                response = JSON.parse(body);
            } catch (err) {
            }

            if (await logging(res, body, 'modify config') && response !== undefined && response !== 'undefined') {
                if (response[0]['success']) {
                    switch (JSON.stringify(response[0]['success'])) {
                        case  `{"/config/permitjoin":${ot}}`:
                            adapter.log.info(`Network is now open for ${ot} seconds to register new devices.`);
                            adapter.setState('Gateway_info.network_open', {ack: true, expire: ot});
                            break;
                    }
                } else if (response[0]['error']) {
                    adapter.log.warn(JSON.stringify(response[0]['error']));
                }
            } else if (res.statusCode === 403) {
                adapter.log.warn('You do not have the permission to do this! ' + parameters);
            } else if (res.statusCode === 400) {
                adapter.log.warn('Error 404 Not Found ' + parameters)
            }
        }
    });
}


async function getConfig() {
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

    request(options,  async (error, res, body) => {
        if (error) {
            adapter.log.error('Could not connect to deConz/Phoscon. ' + error);
        } else if ( await logging(res, body, ' get config') ) {
            let gateway = JSON.parse(body);
            adapter.log.info('deConz Version: ' + gateway['swversion'] + '; API version: ' + gateway['apiversion']);
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
                    //ipaddress: gateway['ipaddress'],
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

    request(options, async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            let list = JSON.parse(body);
            let count = Object.keys(list).length - 1;

            if (await logging(res, body, 'get all groups') && body !== '{}') {
                for (let i = 0; i <= count; i++) {
                    let keyName = Object.keys(list)[i];
                    //create object for group
                    let objectName = list[keyName]['name'];
                    let groupID = list[keyName]['id'];

                    //Changed check if is helper group, if skip it
                    let regex = new RegExp("helper[0-9]+ for group [0-9]+");
                    if (!regex.test(objectName)) {


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
                        }, () => {
                            getGroupAttributes(list[keyName]['id']);
                            getGroupScenes(`Groups.${groupID}`, list[keyName]['scenes']);
                        });

                    }
                }
            }
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

    request(options, async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            let list = JSON.parse(body);

            if (await logging(res, body, 'get group attributes ' + groupId)) {
                //create object for group with attributes
                let groupID = list['id'];
                //Changed check if helper, if skip it (cause it also dont exists)
                let regex = new RegExp("helper[0-9]+ for group [0-9]+");
                if (!regex.test(list['name'])) {
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
                        new SetObjectAndState(groupId, list['name'], 'Groups', stateName, list['action'][stateName]);
                        new SetObjectAndState(groupId, list['name'], 'Groups', 'transitiontime', null);
                    }
                    let count3 = Object.keys(list['state']).length - 1;
                    //create states for light device
                    for (let z = 0; z <= count3; z++) {
                        let stateName = Object.keys(list['state'])[z];
                        new SetObjectAndState(groupId, list['name'], 'Groups', stateName, list['state'][stateName]);
                        new SetObjectAndState(groupId, list['name'], 'Groups', 'transitiontime', null);
                    }
                    new SetObjectAndState(groupId, list['name'], 'Groups', 'level', null);
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
                getGroupScenes(`Groups.${groupID}`, list['scenes']);
            }
        }
    })
} //END getGroupAttributes

function getGroupScenes(group, sceneList) {

    //Changed check if group exists, if not skip it
    adapter.getObject(adapter.name + '.' + adapter.instance + '.' + group, (err, obj) => {
        if (obj !== undefined) {
            adapter.setObjectNotExists(`${group}.createscene`, {
                type: 'state',
                common: {
                    name: "createscene",
                    role: "state",
                    type: "string",
                    read: false,
                    write: true
                }
            });
            if (sceneList.length === 0) {
                return;
            }

            sceneList.forEach((scene) => {
                if (scene.lightcount > 0) {
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

async function setGroupState(parameters, groupId, stateId) {
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

    request(options, async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            let response;
            try {
                response = JSON.parse(body);
            } catch (err) {
            }

            if (await logging(res, body, 'set group state ' + groupId) && response !== undefined && response !== 'undefined') {
                new ackStateVal(stateId, response);
            }
        }
    });
} //END setGroupState

async function setGroupScene(parameters, groupId, sceneId, action, stateId, method) {
    let sceneString = '';
    if (sceneId > 0) {
        sceneString = '/' + sceneId;
        if (action !== '') {
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

    request(options, async (error, res, body) => {
        if(error){
            sentryMsg(error);
            sentryMsg(error);
        }else {
            let response;
            try {
                response = JSON.parse(body);
            } catch (err) {
            }

            if (await logging(res, body, 'set group scene ' + groupId) && response !== undefined && response !== 'undefined') {
                    new ackStateVal(stateId, response);
            }
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
            'Content-Length': Buffer.byteLength('{"name": "' + name + '"}')
        }
    };
    try {
        let req = request(options,  async (error, res, body) => {
            if ( await logging(res, body, 'create group ' + name) ) {
                let apiKey = JSON.parse(body);
                adapter.log.info(JSON.stringify(apiKey[0]['success']['id']));
                callback({error: 0, message: 'success'});
                await getGroupAttributes(apiKey[0]['success']['id']);
            }
        });
        req.write('{"name": "' + name + '"}');
    } catch (err) {
        adapter.log.error(err)
    }
} //END createGroup

async function deleteGroup(groupId) {

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
    };

    request(options,  async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            let response;
            try {
                response = JSON.parse(body);
            } catch (err) {
            }

            if (await logging(res, body, 'delete group ' + groupId) && response !== undefined && response !== 'undefined') {
                if (response[0]['success']) {
                    adapter.log.info('The group with id ' + groupId + ' was removed.');
                    adapter.getForeignObjects(adapter.name + '.' + adapter.instance + '*', 'device', async (err, enums) => {                    //alle Objekte des Adapters suchen
                        let count = Object.keys(enums).length - 1;                                      //Anzahl der Objekte
                        for (let i = 0; i <= count; i++) {                                              //jedes durchgehen und prüfen ob es sich um ein Objekt vom Typ group handelt
                            let keyName = Object.keys(enums)[i];
                            if (enums[keyName].common.role === 'group' && enums[keyName].native.id === groupId) {
                                adapter.log.info('Delete device Object: ' + enums[keyName].id);
                                let name = enums[keyName]._id;

                                await deleteDevice(name);
                            }
                        }
                    });
                } else if (response[0]['error']) {
                    adapter.log.warn(JSON.stringify(response[0]['error']));
                }
            }
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
    request(options,  async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            let list = JSON.parse(body);
            let count = Object.keys(list).length - 1;


            if (await logging(res, body, 'get all sensors') && body !== '{}') {
                for (let i = 0; i <= count; i++) {              //Get each Sensor
                    let keyName = Object.keys(list)[i];
                    let sensorID = keyName;
                    //create object for sensor device
                    let regex = new RegExp("CLIP-Sensor TOOGLE-");
                    if (!regex.test(list[keyName]['name'])) {
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
                            new SetObjectAndState(sensorID, list[keyName]['name'], 'Sensors', stateName, list[keyName]['state'][stateName]);
                        }


                        let count3 = Object.keys(list[keyName]['config']).length - 1;
                        //create config states for sensor device
                        for (let x = 0; x <= count3; x++) {
                            let stateName = Object.keys(list[keyName]['config'])[x];
                            new SetObjectAndState(sensorID, list[keyName]['name'], 'Sensors', stateName, list[keyName]['config'][stateName]);
                        }
                    }
                }
            }
        }
    });
} //END getAllSensors

async function getSensor(sensorId) {

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
    request(options,  async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            if (await logging(res, body, 'get sensor ' + sensorId)) {
                let list = JSON.parse(body);

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
                        mode: list['mode'],
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

                    if (stateName === 'buttonevent' && list['modelid'] === 'lumi.Sensors.switch.aq2') {
                        let LastUpdate = Number(new Date(list['state']['lastupdated']));
                        let Now = Number(new Date().getTime());
                        let dateOff = new Date();
                        let TimeOffset = dateOff.getTimezoneOffset() * 60000;

                        if ((Now - LastUpdate + TimeOffset) < 2000) {
                            new SetObjectAndState(sensorId, list['name'], 'Sensors', stateName, list['state'][stateName]);
                        } else {
                            adapter.log.info('buttonevent NOT updated for ' + list['name'] + ', too old: ' + ((Now - LastUpdate + TimeOffset) / 1000) + 'sec time difference update to now');
                        }
                    } else {
                        new SetObjectAndState(sensorId, list['name'], 'Sensors', stateName, list['state'][stateName]);
                    }


                    let count3 = Object.keys(list['config']).length - 1;
                    //create config for sensor device
                    for (let x = 0; x <= count3; x++) {
                        let stateName = Object.keys(list['config'])[x];
                        new SetObjectAndState(sensorId, list['name'], 'Sensors', stateName, list['config'][stateName]);
                    }
                }
            }
        }
    })
} //END getSensor

async function setSensorParameters(parameters, sensorId, stateId, callback) {

    let ip, port, user;
    await adapter.getObjectAsync('Gateway_info')
        .then(async results => {
            ip = results.native.ipaddress;
            port = results.native.port;
            user = results.native.user;
        });

    let options = {
        url: 'http://' + ip + ':' + port + '/api/' + user + '/sensors/' + sensorId + '/config',
        method: 'PUT',
        headers: 'Content-Type" : "application/json',
        body: parameters
    };

    request(options,  async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            let response;
            try {
                response = JSON.parse(body);
            } catch (err) {
            }

            if (await logging(res, body, 'set sensor parameters') && response !== undefined && response !== 'undefined') {
                new ackStateVal(stateId, response);
            }

            if (callback)
                callback();
        }
    });
} //END setSensorParameters

async function deleteSensor(sensorId) {

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
    };

    request(options, async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            adapter.log.debug('deleteSensor STATUS: ' + res.statusCode);
            let response;
            try {
                response = JSON.parse(body);
            } catch (err) {
            }

            if (await logging(res, body, 'delete sensor ' + sensorId) && response !== undefined && response !== 'undefined') {
                if (response[0]['success']) {
                    adapter.log.info('The sensor with id ' + sensorId + ' was removed.');
                    adapter.getForeignObjects(adapter.name + '.' + adapter.instance + '*', 'device', async (err, enums) => {                    //alle Objekte des Adapters suchen
                        let count = Object.keys(enums).length - 1;                                      //Anzahl der Objekte
                        for (let i = 0; i <= count; i++) {                                              //jedes durchgehen und prüfen ob es sich um ein Objekt vom Typ sensor handelt
                            let keyName = Object.keys(enums)[i];
                            if (enums[keyName].common.role === 'sensor' && enums[keyName].native.id === sensorId) {
                                adapter.log.info('delete device Object: ' + enums[keyName]._id);
                                let name = enums[keyName]._id;

                                await deleteDevice(name);
                            }

                        }
                    });
                } else if (response[0]['error']) {
                    adapter.log.warn(JSON.stringify(response[0]['error']));
                }
            }
        }
    });
}

//END  Sensor functions ------------------------------------------------------------------------------------------------


//START  Light functions -----------------------------------------------------------------------------------------------
async function getAllLights() {

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
    request(options, async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            let list = JSON.parse(body);
            let count = Object.keys(list).length - 1;

            if (await logging(res, body, 'get all lights') && body !== '{}') {
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
                        new SetObjectAndState(lightID, list[keyName]['name'], 'Lights', stateName, list[keyName]['state'][stateName]);
                        new SetObjectAndState(lightID, list[keyName]['name'], 'Lights', 'transitiontime', null);
                        new SetObjectAndState(lightID, list[keyName]['name'], 'Lights', 'level', null);
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
            }
        }
    })
} //END getAllLights

async function getLightState(lightId) {

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
    request(options, async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            if (await logging(res, body, 'get light state ' + lightId)) {
                let list = JSON.parse(body);
                let keyName = Object.keys(list)[0];
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
                    new SetObjectAndState(lightId, list[keyName]['name'], 'Lights', stateName, list['state'][stateName]);
                }
            }
        }
    })
} //END getLightState

async function setLightState(parameters, lightId, stateId, callback) {
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

    request(options, async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            let response;
            try {
                response = JSON.parse(body);
            } catch (err) {
            }

            if (await logging(res, body, 'set light state ' + lightId) && response !== undefined && response !== 'undefined') {
                new ackStateVal(stateId, response);
            }

            if (callback)
                callback();
        }
    });
} //END setLightState

async function deleteLight(lightId) {

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
    };

    request(options, async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            let response;
            try {
                response = JSON.parse(body);
            } catch (err) {
            }

            if (await logging(res, body, 'delete light ' + lightId) && response !== undefined && response !== 'undefined') {
                if (response[0]['success']) {
                    adapter.log.info('The light with id ' + lightId + ' was removed.')
                    adapter.getForeignObjects(adapter.name + '.' + adapter.instance + '.Lights.*', 'device', async (err, enums) => {                    //alle Objekte des Adapters suchen
                        let count = Object.keys(enums).length - 1;                                      //Anzahl der Objekte
                        for (let i = 0; i <= count; i++) {                                              //jedes durchgehen und prüfen ob es sich um ein Objekt vom Typ sensor handelt
                            let keyName = Object.keys(enums)[i];
                            if (enums[keyName].common.role === 'light' && enums[keyName].native.id === lightId) {
                                adapter.log.info('delete device Object: ' + enums[keyName]._id);
                                let name = enums[keyName]._id;

                                await deleteDevice(name);
                            }

                        }
                    });
                } else if (response[0]['error']) {
                    adapter.log.warn(JSON.stringify(response[0]['error']));
                }
            }
        }
    });
}

async function removeFromGroups(lightId) {

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

    request(options, async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            let response;
            try {
                response = JSON.parse(body);
            } catch (err) {
            }

            if (await logging(res, body, 'remove light from groups ' + lightId) && response !== undefined && response !== 'undefined') {
                if (response[0]['success']) {
                    adapter.log.info('The light with id ' + lightId + ' was removed from all groups.')
                } else if (response[0]['error']) {
                    adapter.log.warn(JSON.stringify(response[0]['error']));
                }
            }
        }
    });
}

//END  Light functions -------------------------------------------------------------------------------------------------

//START Devices functions ----------------------------------------------------------------------------------------------
async function getDevices() {

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

    request(options,async (error, res, body) => {
        if(error){
            sentryMsg(error);
        }else {
            if (await logging(res, body, 'get devices')) {
                adapter.log.debug('getDevices: ' + JSON.stringify(res) + ' ' + body);
            }
        }
    });
}

//END Devices functions ------------------------------------------------------------------------------------------------

async function logging(res, message, action) {
    //if(typeof message !== 'string'){
    //    message = JSON.stringify(message);
    //}
    if(action === undefined){
        action = '';
    }
    if( res === undefined ) {
        return;
    }
    let statusCode = res.statusCode;
    let check;
    switch (statusCode) {
        case 200:
            adapter.log.debug(`Code 200: Request succeded ${action}: ${message}`);
            check = true;
            break;
        case 201:
            adapter.log.info(`Code 201: A new resource was created ${action}: ${message}`);
            check = true;
            break;
        case 202:
            adapter.log.info(`Code 202: Request will be processed but isn\'t finished yet ${action}: ${message}`);
            check = false;
            break;
        case 304:
            adapter.log.debug(`Code 304: Not modified ${action}: ${message}`);
            check = false;
            break;
        case 400:
            let msg = `Code 400: Bad request ${action}: ${message}`;
            adapter.log.warn(msg);
            check = false;
            break;
        case 401:
            adapter.log.info(`Code 401: Unathorized ${action}: ${message}`);
            check = false;
            break;
        case 403:
            adapter.log.info(`Code 403: Forbidden ${action}: ${message}`);
            check = false;
            break;
        case 404:
            adapter.log.info(`Code 404: Ressource not found ${action}: ${message}`);
            check = false;
            break;
        case 503:
            adapter.log.info(`Code 503: Service unavailable ${action}: ${message}`);
            check = false;
            break;
    }
    return check;
}

function sentryMsg(msg) {
    if (adapter.supportsFeature && adapter.supportsFeature('PLUGINS')) {
        const sentryInstance = adapter.getPluginInstance('sentry');
        if (sentryInstance) {
            const Sentry = sentryInstance.getSentryObject();
            Sentry && Sentry.withScope(scope => {
                scope.setLevel('info');
                scope.setExtra('key', 'value');
                Sentry.captureMessage(msg, 'info'); // Level "info"
            });
        }
    }
}

function nameFilter(name) {
    let signs = [String.fromCharCode(46), String.fromCharCode(44), String.fromCharCode(92), String.fromCharCode(47), String.fromCharCode(91), String.fromCharCode(93), String.fromCharCode(123), String.fromCharCode(125), String.fromCharCode(32), String.fromCharCode(129), String.fromCharCode(154), String.fromCharCode(132), String.fromCharCode(142), String.fromCharCode(148), String.fromCharCode(153)]; //46=. 44=, 92=\ 47=/ 91=[ 93=] 123={ 125=} 32=Space 129=ü 154=Ü 132=ä 142=Ä 148=ö 153=Ö
    signs.forEach((item, index) => {
        let count = name.split(item).length - 1;

        for (let i = 0; i < count; i++) {
            name = name.replace(item, '_');
        }

        let result = name.search(/_$/);
        if (result !== -1) {
            name = name.replace(/_$/, '');
        }

    });
    return name;
}

async function deleteDevice(deviceId) {
    await adapter.getObjectListAsync( {startkey: deviceId, endkey: deviceId + '.\u9999'})
        .then(async result => {
            for(let r in result.rows){
                await adapter.delObjectAsync(result.rows[r].id)
                    .then(result => {
                        console.log(result);
                    }, reject => {
                        console.log(reject);
                    });
            }
        }, reject => {
            console.log(reject);
        })


}

/**
 * Set ACK Flag for state value
 * @param {string} stateId
 * @param {object} response
 */
function ackStateVal(stateId, response){
    try {
        if (response[0]['success']) {
            adapter.getStateAsync(stateId)
                .then(results => {
                    adapter.setStateAsync(stateId, {val: results.val, ack: true});
                });
        } else if (response[0]['error']) {
            adapter.log.warn(JSON.stringify(response[0]['error']));
        }
    } catch (error) {
        adapter.log.warn(error);
    }
}

/**
 * @return {string}
 */
function UTCtoLocal(timeString) {
    if (timeString !== 'none' && timeString !== null && timeString !== undefined) {
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

        return (new Date(local)).toISOString();
    } else {
        return timeString;
    }
}

async function buttonEvents(id, event) {
    if(event !== null && event !== undefined){
    let button = event.toString().substr(0, 1);
    let type = event.toString().substr(1, 3);
    await adapter.setObjectNotExistsAsync(`${id}.${button}`, {
        type: 'channel',
        common: {
            name: 'Button ' + button
        },
        native: {}
    });

    let common = {
        type: 'boolean',
        role: 'switch',
        read: true,
        write: false,
        def: false
    };
    let state;
    switch (type) {
        case '000':
            common.name = 'Press';
            state = 'press';
            break;
        case '001':
            common.name = 'Hold';
            state = 'hold';
            break;
        case '002':
            common.name = 'Release after press';
            state = 'release_press';
            break;
        case '003':
            common.name = 'Release after hold';
            state = 'release_hold';
            break;
        case '004':
            common.name = 'Double press';
            state = 'double_press';
            break;
        case '005':
            common.name = 'Triple press';
            state = 'triple_press';
            break;
        case '006':
            common.name = 'Quadruple press';
            state = 'quadruple_press';
            break;
        case '007':
            common.name = 'Shake';
            state = 'shake';
            break;
        case '008':
            common.name = 'Drop';
            state = 'drop';
            break;
        case '009':
            common.name = 'Tilt';
            state = 'tilt';
            break;
        case '010':
            common.name = 'Many press';
            state = 'many_press';
            break;
    }
    await adapter.setObjectNotExistsAsync(`${id}.${button}.${state}`, {
        type: 'state',
        common: common,
        native: {}
    });

    await adapter.setStateAsync(`${id}.${button}.${state}`, {
        val: true,
        ack: true
    }).then(results=>{
        setTimeout( ()=> {
            adapter.setState(`${id}.${button}.${state}`, {
                val: false,
                ack: true
            })
        }, 100);
    });

    }
}

async function getObjectByDeviceId(id, type) {
    /*
    type = Groups, Lights, Sensors
     */
    let obj = await adapter.getObjectListAsync({
        startkey: 'deconz.' + adapter.instance + '.' + type + '.',
        endkey: 'deconz.' + adapter.instance + '.' + type + '.\u9999'
    });

    let rows = obj.rows;
    let object;
    for (let o in rows) {
        if (rows[o].value.native !== undefined) {
            if (rows[o].value.native.id === id.toString()) {
                object = rows[o];
                break;
            }
        }
    }
    return object;
}

/**
 *
 * @param {string} id - of the device or group
 * @param {string} name - only for creating object
 * @param {string} type - Sensors, Lights, Groups
 * @param {string} stateName
 * @param value
 * @constructor
 */
function SetObjectAndState(id, name, type, stateName, value) {

    let objType = 'mixed';
    let objRole = 'state';
    let objStates = null;
    let objRead = true;
    let objWrite = true;
    let objMin = null;
    let objMax = null;
    let objUnit = null;
    let objDefault = null;


    switch (stateName) {
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
            objRole = 'indicator';
            objWrite = false;
            break;
        case 'any_on':
            objType = 'boolean';
            objRole = 'indicator';
            objWrite = false;
            if(value === true){
                new SetObjectAndState(id, name, type, 'on', true);
            }else if(value === false){
                new SetObjectAndState(id, name, type, 'on', false);
            }
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
        case 'configured':
            objType = 'boolean';
            objRole = 'indicator';
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
            objRole = 'level.brightness';
            objMin = 0;
            objMax = 254;
            objDefault = 254;
            break;
        case 'buttonevent':
            objType = 'number';
            objRole = 'state';
            objWrite = false;
            buttonEvents(`${type}.${id}.buttonevent`, value);
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
            objMin = 153;
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
            objRole = 'value';
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
        case 'level':
            objType = 'number';
            objRole = 'level.brightness';
            objMin = 0;
            objMax = 100;
            objDefault = 100;
            objUnit = '%';
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
        case 'sunriseoffset':
            objType = 'number';
            objRole = 'state';
            break;
        case 'sunsetoffset':
            objType = 'number';
            objRole = 'state';
            break;
        case 'temperature':
            objType = 'number';
            objRole = 'value.temperature';
            objWrite = false;
            objDefault = 0;
            objUnit = '°C';
            value = value / 100;
            break;
        case 'tholddark':
            objType = 'number';
            objRole = 'value';
            objDefault = 0;
            objWrite = false;
            break;
        case 'tholdoffset':
            objType = 'number';
            objRole = 'value';
            objDefault = 0;
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
            objUnit = 's';
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
            objStates = {hs: 'hs', xy: 'xy', ct: 'ct'};
            break;
        case 'effect':
            objType = 'string';
            objRole = 'state';
            objStates = {none: 'none', colorloop: 'colorloop'};
            let cs = new SetObjectAndState(id, name, type, 'colorspeed', null);
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
        case 'sunrise':
            objType = 'string';
            objRole = 'date.sunrise';
            objWrite = false;
            break;
        case 'sunset':
            objType = 'string';
            objRole = 'date.sunset';
            objWrite = false;
            break;
    }

    let objCommon = {
        name: name + ' ' + stateName,
        type: objType,
        role: objRole,
        read: objRead,
        write: objWrite
    };

    if (objStates !== null) {
        objCommon.states = objStates;
    }
    if (objUnit !== null) {
        objCommon.unit = objUnit;
    }
    if (objMin !== null) {
        objCommon.min = objMin;
    }
    if (objMin !== null) {
        objCommon.max = objMax;
    }
    if (objDefault !== null) {
        objCommon.def = objDefault;
    }


    adapter.setObjectNotExists(`${type}.${id}` + '.' + stateName, {
        type: 'state',
        common: objCommon,
        native: {}
    });
    if (value !== null) {
        adapter.setState(`${type}.${id}` + '.' + stateName, {
            val: value,
            ack: true
        });
    }

}


// @ts-ignore parent is a valid property on module
if (module.parent) {
    module.exports = (options) => new deconz(options);
} else {
    // or start the instance directly
    new deconz();
}
