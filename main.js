'use strict';

const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const axios = require('axios').default;
const preObj = require('iobroker-adapter-helpers').states;
const defObj = require('./lib/object_definition').defObj;

let SSDP = require('./lib/ssdp.js');

let adapter;

const hue_factor = 182.041666667;

let ws = null;
/** @type {number} */
let alive_ts = 0;
/** @type {boolean} */
let ready = false;
/** @type {boolean} */
let objChangeByAdapter = false;

let startTime, collectActive = true;

let timeoutScan, timeoutReady, timeoutWait, timeoutReconnect = null, timeoutAutoUpdates, timeoutButton, timeoutButtonpressed;


class deconz extends utils.Adapter {
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        // @ts-ignore
        super({
            ...options,
            name: 'deconz'
        });
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        adapter = this;
        await main();
    }

    async onUnload(callback) {
        if (ws !== null) ws.terminate();
        this.setState('info.connection', {val: false, ack: true});
        this.setState('gateway_info.alive', {val: false, ack: true});

        clearTimeout(timeoutScan);
        clearTimeout(timeoutReady);
        clearTimeout(timeoutWait);
        clearTimeout(timeoutReconnect);
        clearTimeout(timeoutAutoUpdates);
        clearTimeout(timeoutButton);
        clearTimeout(timeoutButtonpressed);

        try {
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    async onObjectChange(id, obj) {
        if (obj && obj.type && obj.type === 'device' && ready === true && objChangeByAdapter === false) {
            switch (obj.common.role) {
                case 'group':
                    await setGroupAttributes(`{"name": "${obj.common.name}"}`, obj.native.id);
                    break;
                case 'light':
                    await setLightAttributes(`{"name": "${obj.common.name}"}`, obj.native.id)
                    break;
                case 'sensor':
                    for (let i in obj.native.id) {
                            await updateSensor(`{"name": "${obj.common.name}"}`, obj.native.id[i]);
                    }
                    break;
            }
        } else if (objChangeByAdapter) {
            objChangeByAdapter = false;
        }

    }

    /**
     * @param {string} id
     * @param {any} state
     * @returns {Promise<void>}
     */
    async onStateChange(id, state) {
        const originalId = id;
        let tmp = id.split('.');
        const dp = tmp.pop();       //last part of id, object/state its self
        if(tmp[tmp.length - 1] === 'manage'){
            id = tmp.slice(tmp.length - 3, tmp.length - 1).join('.');
        } else {
            id = tmp.slice(2).join('.');
        }



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
                        if (timeoutReconnect !== null) {
                            if (ws !== null) {
                                ws.terminate();
                            }
                            clearTimeout(timeoutReconnect);
                        }
                        await getAutoUpdates();
                    }

                }
            }
            return;
        }

        let stateObj = await this.getObjectAsync(originalId);

        if ((stateObj !== null && stateObj !== undefined) && typeof state.val === stateObj.common.type) {
            /**
             * @param {any} err
             * @param {object|null} tTime - object for state transitiontime
             */
            this.getState(this.name + '.' + this.instance + '.' + id + '.transitiontime', async (err, tTime) => {
                let parameters = {}
                /** @type {number|string} */
                let transitionTime = (err === null && tTime !== null) ? (tTime.val * 10) : 'none';

                let parentObject = await this.getObjectAsync(this.name + '.' + this.instance + '.' + id);
                if (parentObject === null) return false;

                switch (dp) {
                    case 'bri':
                        if (state.val > 0 && (transitionTime === 'none' || transitionTime === 0)) {
                            parameters = '{"bri": ' + JSON.stringify(state.val) + ', "on": true}';
                        } else if (state.val > 0) {
                            parameters = '{"transitiontime": ' + JSON.stringify(transitionTime) + ', "bri": ' + JSON.stringify(state.val) + ', "on": true}';
                        } else {
                            parameters = '{"bri": ' + JSON.stringify(state.val) + ', "on": false}';
                        }
                        await SetObjectAndState(tmp[3], tmp[2], 'level', Math.floor((100 / 255) * state.val));
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
                    case 'colorspeed':
                        let effect = await this.getStateAsync(this.name + '.' + this.instance + '.' + id + '.effect');
                        if (effect && effect.val === 'colorloop') {
                            parameters = '{"colorloopspeed": ' + state.val + ', "effect": "colorloop"}';
                        }
                        break;
                    case 'effect':
                        if (state.val === 'colorloop') {
                            let speed = await this.getStateAsync(this.name + '.' + this.instance + '.' + id + '.colorspeed');
                            if (speed.val === null || speed.val === undefined) {
                                speed.val = 1;
                            }
                            parameters = '{"colorloopspeed": ' + speed.val + ', "effect": ' + JSON.stringify(state.val) + '}';
                        } else {
                            parameters = '{"effect": ' + JSON.stringify(state.val) + '}';
                        }
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
                        if (parentObject.common.role === 'group') {
                            let controlId = parentObject.native.id;
                            await createScene(state.val, controlId);
                            await getGroupAttributes(controlId);
                        }
                        break;
                    case 'delete':
                        if(parentObject.common.role === 'scene'){
                            await deleteScene(tmp[5], tmp[3]);
                        } else if (parentObject.common.role === 'group') {
                            await deleteGroup(tmp[3]);
                        } else if (parentObject.common.role === 'light') {
                            await deleteLight(tmp[3]);
                        } else if (parentObject.common.role === 'sensor') {
                            let sensor = await adapter.getObjectAsync(`sensors.${parentObject._id}`);
                            for (const sensorKey in sensor) {
                                await deleteSensor(sensor[sensorKey]);
                            }
                        }
                        await deleteDevice(`${parentObject._id}`);
                        break;
                    case 'store':
                        await storeScene(tmp[5], tmp[3]);
                        break;
                    case 'recall':
                        await recallScene(tmp[5], tmp[3]);
                        break;
                    case 'offset':
                    case 'sensitivity':
                    case 'sensitivitymax':
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
                        if (state.val) {
                            let opentime;
                            const results = await this.getObjectAsync('gateway_info')
                            if (results) {
                                opentime = results.native.networkopenduration;
                            }
                            parameters = `{"permitjoin": ${opentime}}`;
                            await modifyConfig(parameters);
                        }
                        break;
                    case 'backup':
                        await backup();
                        break;
                    case 'update_deconz':
                        await updateSoftware();
                        break;
                    case 'update_firmware':
                        await updateFirmware();
                        break;
                    case 'scan':
                        await touchlinkScan();
                        break;
                    case 'identify':
                        await touchlinkIdentify(state.val);
                        break;
                    case 'reset':
                        await touchlinkReset(state.val);
                        break;
                    case 'creategroup':
                        await createGroup(state.val)
                        break;
                    case 'addtogroup': {
                        let groupObject = await adapter.getObjectAsync(`groups.${state.val}`);
                        if (groupObject !== null){
                            let lights = groupObject.native.lights;
                            lights.push(parentObject.native.id);
                            await setGroupAttributes({"lights": lights}, state.val);
                            groupObject.native.lights = lights;
                            await adapter.setObjectAsync(`groups.${state.val}`, groupObject)
                                .then (result => {
                                    objChangeByAdapter = true;
                                }). catch (reject => {
                                    adapter.log.error(reject);
                                });
                        }
                        break;
                    }
                    case 'removefromgroup': {
                        let groupObject = await adapter.getObjectAsync(`groups.${state.val}`);
                        let lights = groupObject.native.lights;
                        const index = lights.indexOf(parentObject.native.id);
                        if (index > -1) {
                            lights.splice(index, 1);
                            await setGroupAttributes({"lights": lights}, state.val);
                            groupObject.native.lights = lights;
                            await adapter.setObjectAsync(`groups.${state.val}`, groupObject)
                                .then (result => {
                                    objChangeByAdapter = true;
                            }). catch (reject => {
                                adapter.log.error(reject);
                            });
                        }
                        break;
                    }
                    case 'removegroups':
                        await removeFromGroups((tmp[3]));
                        break;
                    case 'removescenes':
                        await removeFromScenes(tmp[3]);
                        break;
                }

                if (typeof parameters === 'object') {
                    parameters = JSON.stringify(parameters);
                }

                let controlId = (parentObject !== null || parentObject !== undefined) ? parentObject.native.id : '';

                if (tmp[3] !== 'removefromgroup' && tmp[3] !== 'addtogroup' && tmp[3] !== 'delete' && tmp[3] !== 'removegroups' && tmp[3] !== 'removescenes'){
                    switch (parentObject.common.role) {
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
                    await createAPIkey(obj.message.host, obj.message.credentials, (res) => {
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
                    const results = await this.getObjectAsync('gateway_info')
                    if (results) {
                        openTime = results.native.networkopenduration;
                    }
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
                    adapter.log.info('delete sensor');
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
                    await this.extendObjectAsync('gateway_info', {
                        native: obj.message
                    });
                    await getConfig();
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
    adapter.log.info('Please wait while adapter is starting');

    //TODO: subscribe only objects with the attribute write true
    adapter.subscribeStates('*');
    adapter.subscribeObjects('lights.*');
    adapter.subscribeObjects('groups.*');
    adapter.subscribeObjects('sensors.*');

    startTime = Date.now();
    await getLatestVersion();
    await sendDeviceInformation();

    heartbeat();
    const results = await adapter.getObjectAsync('gateway_info');
    if (results) {
        if (results.native.ipaddress === undefined) {  //only on first start
            autoDiscovery();
        } else {
            if (results.native.port === '' || results.native.port === null) {
                await adapter.extendObjectAsync('gateway_info', {
                    native: {
                        port: 80
                    }
                })
            }
            if (results.native.user === '' || results.native.user === null) {
                adapter.log.warn('No API Key found');
            } else {
                await getConfig();
                await getAutoUpdates();
            }
        }
    }
    timeoutReady = setTimeout(() => {
        ready = true;
        adapter.log.info('Adapter is ready');
    }, 60 * 1000)

}

//search for Gateway
let discovery = new SSDP.Discovery();
let found_deconz = false;

function autoDiscovery() {
    //TODO: Call autodiscovery from config page only, use discovery adapter
    adapter.log.info('auto discovery');

    discovery.on('message', (msg, rinfo) => {
        if (msg.headers.st === 'urn:schemas-upnp-org:device:basic:1') {
            adapter.log.debug(`M-SEARCH from ${rinfo.address} for "${msg.headers.st}"`);
            if (msg.headers['gwid.phoscon.de'] !== undefined) {
                let loc = msg.headers.location.replace('/description.xml', '');
                loc = loc.replace('http://', '');
                loc = loc.split(':');

                adapter.log.debug('autodiscovery: ' + loc);

                adapter.extendObject('gateway_info', {
                    native: {
                        ipaddress: loc[0],
                        port: loc[1]
                    }
                });
                found_deconz = true;
                clearTimeout(timeoutWait);
                discovery.close();
            }
        }

    });


    discovery.listen('', (error) => {
        if (error) {
            sentryMsg(error);
        }
        discovery.search({st: 'ssdp:all'});
        timeoutWait = setTimeout(() => {
            adapter.log.warn('Could not found deConz by broadcast, establishing Websocket without monitoring the connection state. This is happen if you are using VLAN or installed deConz in an container.')
            getAutoUpdates();
        }, 10 * 1000)
    });


}

function heartbeat() {

    discovery.on('notify', (msg) => {
        if (msg.headers.nt === 'urn:schemas-upnp-org:device:basic:1') {
            if (msg.headers['gwid.phoscon.de']) {
                let time = parseInt(msg.headers['cache-control'].replace('max-age=', ''));
                adapter.setState('gateway_info.alive', {val: true, ack: true, expire: time});
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

//START Make Abo using websocket ---------------------------------------------------------------------------------------
const WebSocket = require('ws');

function autoReconnect() {
    clearTimeout(timeoutReconnect);
    timeoutReconnect = setTimeout(() => {
        ws.terminate();
        getAutoUpdates();
    }, 60 * 1000);
}

async function getAutoUpdates() {

    let host, port, user;
    const results = await adapter.getObjectAsync('gateway_info');

    if (results) {
        host = (results !== null && results.native.ipaddress !== undefined) ? results.native.ipaddress : null;
        port = (results !== null && results.native.websocketport !== undefined) ? results.native.websocketport : null;
        user = (results !== null && results.native.user !== undefined) ? results.native.user : null;
    }

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
            if (ws !== null) ws.terminate();
            adapter.setState('info.connection', {val: false, ack: true});
            timeoutAutoUpdates = setTimeout(async () => {
                await getAutoUpdates();
            }, 60 * 1000)

        });


        ws.onmessage = async (msg) => {
            autoReconnect();
            await handleWSmessage(msg);
        }

    }
}
//END Make Abo using websocket -----------------------------------------------------------------------------------------

//START deConz config --------------------------------------------------------------------------------------------------
async function createAPIkey(host, credentials, callback) {
    let auth;
    if (credentials.username === '') {
        credentials.username = 'delight';
    }

   if (credentials !== null) {
        auth = Buffer.from( `${credentials.username}:${credentials.password}`).toString('base64');
    } else {
        auth = 'ZGVsaWdodDpkZWxpZ2h0';
    }

    let options = {
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8',
            'Authorization': `Basic ${auth}`,
            'Content-Length': Buffer.byteLength('{"devicetype": "ioBroker"}')
        }
    };
    adapter.log.debug(host + ' auth: ' + auth);

    await axios.post(`http://${host}/api`, {  "devicetype": "iobroker" }, options)
        .then(async result => {
            let res = result.status;
            let body = result.data;
            adapter.log.info('STATUS: ' + JSON.stringify(res));
            if (res === 403) {

            } else if (await logging(res, body, 'create API key')) {
                let apiKey = body;
                adapter.log.info(JSON.stringify(apiKey[0]['success']['username']));
                callback({error: 0, message: apiKey[0]['success']['username']});
                await getConfig();
            }
        }).catch(async error => {
            callback({error: 101, message: 'Password invalid'});
            adapter.log.info(error);
            sentryMsg(error);
        });


}

async function deleteAPIkey() {
    adapter.log.info('deleteAPIkey');
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.delete(`http://${ip}:${port}/api/${user}/config/whitelist/${user}`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                let response = body;
                if (res !== undefined) {
                    if (await logging(res, body, 'delete API key')) {
                        if (response[0]['success']) {

                            adapter.extendObject('gateway_info', {
                                native: {
                                    user: ''
                                }
                            });

                            adapter.log.info('API key deleted');
                        } else if (response[0]['error']) {
                            adapter.log.warn(JSON.stringify(response[0]['error']));
                        }
                    } else if (res === 403) {
                        adapter.log.warn('You do not have the permission to do this! ');
                    } else if (res === 404) {
                        adapter.log.warn('Error 404 Not Found ')
                    }
                }
            }).catch(async error => {
                sentryMsg(error);
            });

    }
}

async function modifyConfig(parameters) {
    let ip, port, user, ot;
    const results = await adapter.getObjectAsync('gateway_info');
    if (results) {
        ip = results.native.ipaddress;
        port = results.native.port;
        user = results.native.user;
        ot = results.native.networkopenduration;


        await axios.put(`http://${ip}:${port}/api/${user}/config`, parameters)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                let response = body;
                if (await logging(res, body, 'modify config') && response !== undefined && response !== 'undefined') {
                    if (response[0]['success']) {
                        switch (JSON.stringify(response[0]['success'])) {
                            case  `{"/config/permitjoin":${ot}}`:
                                adapter.log.info(`Network is now open for ${ot} seconds to register new devices.`);
                                adapter.setState(`${adapter.namespace}.gateway_info.network_open`, {ack: true, expire: ot});
                                break;
                        }
                    } else if (response[0]['error']) {
                        adapter.log.warn(JSON.stringify(response[0]['error']));
                    }
                } else if (res === 403) {
                    adapter.log.warn('You do not have the permission to do this! ' + parameters);
                } else if (res === 400) {
                    adapter.log.warn('Error 404 Not Found ' + parameters)
                }

            }).catch(async error => {
                adapter.log.error('Modify configuration: ' + error);
                sentryMsg(error);
            });

    }
}

async function getConfig() {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.get(`http://${ip}:${port}/api/${user}/config`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                if (await logging(res, JSON.stringify(body), ' get config')) {
                    let gateway = body;
                    adapter.log.info('deConz Version: ' + gateway['swversion'] + '; API version: ' + gateway['apiversion']);
                    await adapter.extendObjectAsync('gateway_info', {
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
                    }).catch ( error => {
                        adapter.log.error(error);
                    });

                    await getAllLights();
                    await getAllSensors();
                    await getAllGroups();
                    //getDevices();
                }
            }).catch(async error => {
                adapter.log.error('Could not connect to deConz/Phoscon. ' + error);
                sentryMsg(error);
            });

    }
} //END getConfig

async function backup() {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.post(`http://${ip}:${port}/api/${user}/config/export`)
            .then(async result => {
                await logging(result.status, result.data, 'backup');
            }).catch(async error => {
                adapter.log.error('Could not create backup: ' + error);
                sentryMsg(error);
            });

    }
}

async function updateSoftware() {
    const {ip, port, user} = await getGatewayParam();

    const gw = await adapter.getObjectAsync('gateway_info');
    const version = gw.native.swversion.split('.').map(el => {
        let n = Number(el);
        return n === 0 ? n : n || el;
    }).toString();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.put(`http://${ip}:${port}/api/${user}/config/update`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                await logging(res, body, 'update deConz');
                let returned = body[0].success['/config/update'].split('.').map(el => {
                    let n = Number(el);
                    return n === 0 ? n : n || el;
                }).toString();
                if(returned !== version){
                    adapter.log.info('deConz update done. New version: ' + returned + ' ' + version);
                } else {
                    adapter.log.info('No new deConz Version available');
                }
            }).catch(async error => {
                adapter.log.error('Could not update deConz: ' + error);
                sentryMsg(error);
            });

    }
}

async function updateFirmware() {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.post(`http://${ip}:${port}/api/${user}/config/updatefirmware`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                if (res === 503) {
                    adapter.log.info('No firmware update available');
                } else if (res === 200){
                    let returned = body[0].success['/config/updatefirmware'];
                    adapter.log.info('Firmware update done. New version: ' + returned);
                } else {
                    await logging(res, body, 'update firmware');
                }
            }).catch(async error => {
                adapter.log.error('Could not update firmware: ' + error);
                sentryMsg(error);
            });

    }
}
//END deConz config ----------------------------------------------------------------------------------------------------

//START Touchlink
async function touchlinkScan() {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.post(`http://${ip}:${port}/api/${user}/touchlink/scan`)
            .then(async () => {
                await adapter.setStateAsync('gateway_info.touchlink.scan', {ack: true});
                timeoutWait = setTimeout( async () => {
                    await getTouchlinkScanResult();
                }, 15 * 1000);
            }).catch(async error => {
                adapter.log.error('Could not start touchlink scan: ' + error);
                sentryMsg(error);
            });
    }
}

async function getTouchlinkScanResult() {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {
        await axios.get(`http://${ip}:${port}/api/${user}/touchlink/scan`)
            .then(async result => {
                let body = JSON.stringify(result.data);
                await adapter.setStateAsync('gateway_info.touchlink.scan_result', {val: body, ack: true});
            }).catch(async error => {
                adapter.log.error('Could not connect get scan results. ' + error);
                sentryMsg(error);
            });
    }
}

async function touchlinkIdentify(id) {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.post(`http://${ip}:${port}/api/${user}/touchlink/${id}/identify`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                await logging(res, body, 'touchlink identify ' + id)
            }).catch(async error => {
                adapter.log.error('Could not start touchlink identify ' + id + ': ' + error);
                sentryMsg(error);
            });
    }
}

async function touchlinkReset(id) {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.post(`http://${ip}:${port}/api/${user}/touchlink/${id}/reset`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                await logging(res, body, 'touchlink  reset ' + id)
            }).catch(async error => {
                adapter.log.error('Could not start touchlink reset ' +id + ': ' + error);
                sentryMsg(error);
            });
    }
}
//END Touchlink

//START  Group functions -----------------------------------------------------------------------------------------------
async function getAllGroups() {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.get(`http://${ip}:${port}/api/${user}/groups`)
            .then(async result => {
                let res = result.status;
                let body = result.data;

                let list = body;
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


                            await adapter.extendObjectAsync(`groups.${groupID}`, {
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
                            }).then ( () => {
                                objChangeByAdapter = true;
                                getGroupAttributes(list[keyName]['id']);
                                getAllScenes(`${groupID}`, list[keyName]['scenes']);
                            });
                        }
                    }
                }

            }).catch(async error => {
                sentryMsg(error);
            });

    }
} //END getAllGroups

async function getGroupAttributes(groupId) {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.get(`http://${ip}:${port}/api/${user}/groups/${groupId}`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                let list = body;

                if (await logging(res, body, 'get group attributes ' + groupId)) {
                    //create object for group with attributes
                    let groupID = list['id'];
                    //Changed check if helper, if skip it (cause it also dont exists)
                    let regex = new RegExp("helper[0-9]+ for group [0-9]+");
                    if (!regex.test(list['name'])) {
                        await adapter.extendObjectAsync(`groups.${groupId}`, {
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
                        }).then ( () => {
                            objChangeByAdapter = true;
                        }).catch( (error) => {
                            adapter.log.error('extendObject: ' + error);
                        });


                        await adapter.setObjectNotExistsAsync(`groups.${groupID}.info`, {
                            type: 'channel',
                            common: {
                                name: 'Information'
                            }
                        }).then ( () => {
                            objChangeByAdapter = true;
                        });
                        await adapter.setObjectNotExistsAsync(`groups.${groupID}.manage`, {
                            type: 'channel',
                            common: {
                                name: 'Manage group'
                            }
                        }).then ( () => {
                            objChangeByAdapter = true;
                        });

                        if(list['action']) {
                            let count2 = Object.keys(list['action']).length - 1;
                            //create states for light device
                            for (let z = 0; z <= count2; z++) {
                                let stateName = Object.keys(list['action'])[z];
                                await SetObjectAndState(groupId, 'groups', stateName, list['action'][stateName]);
                                await SetObjectAndState(groupId, 'groups', 'transitiontime', null);
                            }
                        }

                        if(list['state']){
                            let count3 = Object.keys(list['state']).length - 1;
                            //create states for light device
                            for (let z = 0; z <= count3; z++) {
                                let stateName = Object.keys(list['state'])[z];
                                await SetObjectAndState(groupId, 'groups', stateName, list['state'][stateName]);
                                await SetObjectAndState(groupId, 'groups', 'transitiontime', null);
                            }
                        }

                        await SetObjectAndState(groupId,'groups', 'level', null, null);
                        let manage = ['delete', 'createscene'];

                        for (const manageKey in manage) {
                            await SetObjectAndState(groupId, 'groups', manage[manageKey], null, 'manage');
                        }
                        let staticObjs = ['dimspeed', 'dimup', 'dimdown', 'action'];

                        for (const staticObjsKey in staticObjs) {
                            await SetObjectAndState(groupId, 'groups', staticObjs[staticObjsKey], null,)
                        }
                    }
                    await getAllScenes(`${groupID}`, list['scenes']);
                }

            }).catch(async error => {
                sentryMsg(error);
            });

    }
} //END getGroupAttributes

async function setGroupAttributes(parameters, groupId) {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.put(`http://${ip}:${port}/api/${user}/groups/${groupId}`, parameters)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                await logging(res, body, 'set group attribute ' + groupId);
            }).catch(async error => {
                sentryMsg(error);
            });

    }
} //END setGroupAttributes

async function setGroupState(parameters, groupId, stateId) {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.put(`http://${ip}:${port}/api/${user}/groups/${groupId}/action`, parameters)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                let response = body;
                if (await logging(res, body, 'set group state ' + groupId) && response !== undefined && response !== 'undefined') {
                    await AckStateVal(stateId, response);
                }
            }).catch(async error => {
                sentryMsg(error);
            });

    }
} //END setGroupState

async function createGroup(name, callback) {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.post(`http://${ip}:${port}/api/${user}/groups`, {'name': name})
            .then(async result => {
                let res = result.status;
                let body = result.data;
                if (await logging(res, body, 'create group ' + name)) {
                    let apiKey = body;
                    adapter.log.info(JSON.stringify('New group with id ' + apiKey[0]['success']['id'] + ' created.'));
                    await getGroupAttributes(apiKey[0]['success']['id']);
                    callback({error: 0, message: 'success'});
                }
            }).catch(async error => {
                sentryMsg(error);
            });
    }
} //END createGroup


async function deleteGroup(groupId) {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.delete(`http://${ip}:${port}/api/${user}/groups/${groupId}`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                let response = body;
                if (await logging(res, body, 'delete group ' + groupId) && response !== undefined && response !== 'undefined') {
                    if (response[0]['success']) {
                        adapter.log.info('The group with id ' + groupId + ' was removed.');
                        adapter.getForeignObjects(adapter.name + '.' + adapter.instance + '*', 'device', async (err, enums) => {                    //alle Objekte des Adapters suchen
                            let count = Object.keys(enums).length - 1;                                      //Anzahl der Objekte
                            for (let i = 0; i <= count; i++) {                                              //jedes durchgehen und prüfen ob es sich um ein Objekt vom Typ group handelt
                                let keyName = Object.keys(enums)[i];
                                if (enums[keyName].common.role === 'group' && enums[keyName].native.id === groupId) {
                                    adapter.log.info('Delete group Objects: ' + enums[keyName]._id);
                                    let name = enums[keyName]._id;

                                    await deleteDevice(name);
                                }
                            }
                        });
                    } else if (response[0]['error']) {
                        adapter.log.warn(JSON.stringify(response[0]['error']));
                    }
                }
            }).catch(async error => {
                sentryMsg(error);
            });
    }
}

//END  Group functions -------------------------------------------------------------------------------------------------

//START Scenes functions -----------------------------------------------------------------------------------------------
async function getAllScenes(group, sceneList) {
    //Changed check if group exists, if not skip it
    await adapter.getObjectAsync(adapter.name + '.' + adapter.instance + '.groups.' + group, async (err, obj) => {
        if (obj !== undefined) {

            if (sceneList !== undefined && sceneList.length === 0) {
                return;
            }

            await adapter.setObjectNotExistsAsync(`groups.${group}.scenes`, {
                type: 'channel',
                common: {
                    name: 'Scenes'
                }
            }).then ( () => {
                objChangeByAdapter = true;
            });

            const arrStates = ['recall', 'store', 'delete', 'lightcount', 'transitiontime'];
            for (const sceneListKey in sceneList) {
                await getSceneAttributes(group, sceneList[sceneListKey].id)
            }

        }
    });
} //END getAllScenes

async function getSceneAttributes(groupId, sceneId) {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.get(`http://${ip}:${port}/api/${user}/groups/${groupId}/scenes/${sceneId}`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                let response = body;
                await adapter.setObjectNotExistsAsync(`groups.${groupId}.scenes.${sceneId}`, {
                    type: 'channel',
                    common: {
                        name: response.name,
                        role: 'scene'
                    },
                    native: {}
                });

                const arrStates = ['recall', 'store', 'delete', 'lightcount', 'transitiontime'];
                for (const arrStatesKey in arrStates) {
                    let value = null;
                    switch (arrStates[arrStatesKey]){
                        case 'lightcount':
                            value = response.lightcount;
                            break;
                        case 'transitiontime':
                            value = response.transitiontime;
                            break;
                    }
                    await SetObjectAndState(`${groupId}`, 'scenes', arrStates[arrStatesKey], value, null, sceneId)
                }
            }).catch(async error => {
                await logging(error.response.status, error.response.status, 'get scene ' + sceneId)
                sentryMsg(error);
            });
    }
} //END getAllScenes

async function createScene(sceneName, groupId) {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.post(`http://${ip}:${port}/api/${user}/groups/${groupId}/scenes`, {'name': sceneName})
            .then(async result => {
                let res = result.status;
                let body = result.data;
                let response = body;
                if (await logging(res, body, 'create scene ' + groupId) && response !== undefined && response !== 'undefined') {
                    await AckStateVal(`${adapter.namespace}.${adapter.instance}.groups.${groupId}.createscene`, response);
                }
            }).catch(async error => {
                await logging(error.response.status, error.response.status, 'create scene ' + groupId)
                sentryMsg(error);
            });
    }
} //END createScene

async function recallScene(sceneId, groupId) {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.put(`http://${ip}:${port}/api/${user}/groups/${groupId}/scenes/${sceneId}/recall`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                let response = body;
                if (await logging(res, body, 'recall scene ' + groupId) && response !== undefined && response !== 'undefined') {
                    await AckStateVal(`groups.${groupId}.scenes.${sceneId}.recall`, response);
                }
            }).catch(async error => {
                await logging(error.response.status, error.response.status, 'recall scene ' + groupId)
                sentryMsg(error);
            });
    }
} //END recallScene

async function storeScene(sceneId, groupId) {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.put(`http://${ip}:${port}/api/${user}/groups/${groupId}/scenes/${sceneId}/store`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                let response = body;
                if (await logging(res, body, 'store scene ' + groupId) && response !== undefined && response !== 'undefined') {
                    await AckStateVal(`groups.${groupId}.scenes.${sceneId}.store`, response);
                }
            }).catch(async error => {
                await logging(error.response.status, error.response.status, 'store scene ' + groupId)
                sentryMsg(error);
            });
    }
} //END storeScene

async function deleteScene(sceneId, groupId) {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.delete(`http://${ip}:${port}/api/${user}/groups/${groupId}/scenes/${sceneId}`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                await logging(res, body, 'delete scene ' + groupId);
            }).catch(async error => {
                await logging(error.response.status, error.response.status, 'delete scene ' + groupId)
                sentryMsg(error);
            });
    }
} //END deleteScene
//END Scenes functions -------------------------------------------------------------------------------------------------

//START  Sensor functions ----------------------------------------------------------------------------------------------
async function getAllSensors() {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.get(`http://${ip}:${port}/api/${user}/sensors`)
            .then(async result => {
                let res = result.status;
                let body = result.data;

                let list = body;
                let count = Object.keys(list).length - 1;


                if (await logging(res, body, 'get all sensors') && body !== '{}') {
                    for (let i = 0; i <= count; i++) {              //Get each Sensor
                        let keyName = Object.keys(list)[i];
                        let mac = list[keyName]['uniqueid'];

                        if (!mac) {
                            return false;
                        }

                        if(checkVirtualDevices(mac) !== true){
                            mac = mac.match(/..:..:..:..:..:..:..:../g);
                            if (mac !== null) mac = mac.toString();
                        }

                        let sensorID = mac.replace(/:/g, '');

                        //create object for sensor device
                        let regex = new RegExp("CLIP-Sensor TOOGLE-");
                        if (!regex.test(list[keyName]['name'])) {
                            let exists = await adapter.getObjectAsync('sensors.' + sensorID);
                            if (exists === null) {
                                await adapter.setObjectNotExistsAsync(`sensors.${sensorID}`, {
                                    type: 'device',
                                    common: {
                                        name: list[keyName]['name'],
                                        role: 'sensor'
                                    },
                                    native: {
                                        ep: list[keyName]['ep'],
                                        etag: list[keyName]['etag'],
                                        id: keyName,
                                        group: (list[keyName]['config'] !== undefined) ? list[keyName]['config']['group'] : '',
                                        manufacturername: list[keyName]['manufacturername'],
                                        modelid: list[keyName]['modelid'],
                                        swversion: list[keyName]['swversion'],
                                        type: list[keyName]['type'],
                                        uniqueid: list[keyName]['uniqueid']
                                    }
                                });
                                await adapter.setObjectNotExistsAsync(`sensors.${sensorID}.info`, {
                                    type: 'channel',
                                    common: {
                                        name: 'Information'
                                    }
                                }).then ( () => {
                                    objChangeByAdapter = true;
                                });
                            } else {
                                let ids = exists.native.id;
                                if (typeof ids === 'string' && ids !== keyName) {
                                    ids = [ids, keyName];
                                } else {
                                    let check = true;
                                    for (let i in ids) {
                                        if (ids.hasOwnProperty(i)){
                                            if (ids[i] === keyName) {
                                                check = false;
                                            }
                                        }
                                    }
                                    if (Array.isArray(ids) && check === true) ids.push(keyName);
                                }

                                await adapter.extendObjectAsync(`sensors.${sensorID}`, {
                                    native: {
                                        id: ids
                                    }
                                })
                            }

                            let count2 = Object.keys(list[keyName]['state']).length - 1;
                            //create states for sensor device
                            for (let z = 0; z <= count2; z++) {
                                let stateName = Object.keys(list[keyName]['state'])[z];
                                await SetObjectAndState(sensorID, 'sensors', stateName, list[keyName]['state'][stateName]);
                            }


                            let count3 = Object.keys(list[keyName]['config']).length - 1;
                            //create config states for sensor device
                            for (let x = 0; x <= count3; x++) {
                                let stateName = Object.keys(list[keyName]['config'])[x];
                                await SetObjectAndState(sensorID, 'sensors', stateName, list[keyName]['config'][stateName]);
                            }
                        }
                    }
                }
            }).catch(async error => {
                await logging(error.status, error.data, 'get all sensors')
                sentryMsg(error);
            });

    }
} //END getAllSensors

async function getSensor(Id) {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.get(`http://${ip}:${port}/api/${user}/sensors/${Id}`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                if (await logging(res, body, 'get sensor ' + Id)) {
                    let list = body;
                    let mac = list['uniqueid'];

                    if (!mac){
                        return false;
                    }

                    if(checkVirtualDevices(mac) !== true){
                        mac = mac.match(/..:..:..:..:..:..:..:../g).toString();
                    }
                    let sensorId = mac.replace(/:/g, '');

                    let exists = await adapter.getObjectAsync('sensors.' + sensorId);
                    if (exists === null) {
                        //create object for sensor
                        await adapter.setObjectNotExistsAsync(`sensors.${sensorId}`, {
                            type: 'device',
                            common: {
                                name: list['name'],
                                role: 'sensor'
                            },
                            native: {
                                ep: list['ep'],
                                etag: list['etag'],
                                id: Id,
                                group: list['config']['group'],
                                manufacturername: list['manufacturername'],
                                mode: list['mode'],
                                modelid: list['modelid'],
                                swversion: list['swversion'],
                                type: list['type'],
                                uniqueid: list['uniqueid']
                            }
                        });
                        await adapter.setObjectNotExistsAsync(`sensors.${sensorId}.info`, {
                            type: 'channel',
                            common: {
                                name: 'Information'
                            }
                        }).then ( () => {
                            objChangeByAdapter = true;
                        });
                    } else {
                        let ids = exists.native.id;
                        if (typeof ids === 'string' && ids !== Id) {
                            ids = [ids, Id];
                        } else {
                            let check = true;
                            for (let i in ids) {
                                if (ids.hasOwnProperty(i)){
                                    if (ids[i] === Id) {
                                        check = false;
                                    }
                                }

                            }
                            if (Array.isArray(ids) && check === true) ids.push(Id);
                        }

                        await adapter.extendObjectAsync(`sensors.${sensorId}`, {
                            native: {
                                id: ids
                            }
                        })
                    }
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
                                await SetObjectAndState(sensorId, 'sensors', stateName, list['state'][stateName]);
                            } else {
                                adapter.log.info('buttonevent NOT updated for ' + list['name'] + ', too old: ' + ((Now - LastUpdate + TimeOffset) / 1000) + 'sec time difference update to now');
                            }
                        } else {
                            await SetObjectAndState(sensorId, 'sensors', stateName, list['state'][stateName]);
                        }


                        let count3 = Object.keys(list['config']).length - 1;
                        //create config for sensor device
                        for (let x = 0; x <= count3; x++) {
                            let stateName = Object.keys(list['config'])[x];
                            await SetObjectAndState(sensorId, 'sensors', stateName, list['config'][stateName]);
                        }
                    }
                }
            }).catch(async error => {
                sentryMsg(error);
            });

    }
} //END getSensor

async function updateSensor(parameters, sensorId) {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.put(`http://${ip}:${port}/api/${user}/sensors/${sensorId}`, parameters)
            .then( async result => {
                    await logging(result.status, result.data, 'set sensor parameters');
            }).catch( async error => {
                sentryMsg(error);
            });
    }
} //END updateSensor

async function setSensorParameters(parameters, sensorId, stateId) {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {
        console.log(typeof sensorId);
        if (typeof sensorId === 'object'){
            for (const id in sensorId){
                await axios.put(`http://${ip}:${port}/api/${user}/sensors/${sensorId[id]}/config`, parameters)
                    .then( async result => {
                        await logging(result.status, result.data, 'set sensor parameters');
                        await AckStateVal(stateId, result);
                    }).catch( async error => {
                        adapter.log.error(error)
                        sentryMsg(error);
                    });
            }
        } else {
            await axios.put(`http://${ip}:${port}/api/${user}/sensors/${sensorId}/config`, parameters)
                .then( async result => {
                    await logging(result.status, result.data, 'set sensor parameters');
                    await AckStateVal(stateId, result);
                }).catch( async error => {
                    adapter.log.error(error)
                    sentryMsg(error);
                });
        }


    }
} //END setSensorParameters

async function deleteSensor(sensorId) {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.delete(`http://${ip}:${port}/api/${user}/sensors/${sensorId}`)
            .then( async result => {
                if (await logging(result.status, result.data, 'delete sensor ' + sensorId)) {
                    let response = result.data;
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
            }).catch( async error => {
                sentryMsg(error);
            });

    }
}

//END  Sensor functions ------------------------------------------------------------------------------------------------


//START  Light functions -----------------------------------------------------------------------------------------------
async function getAllLights() {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.get(`http://${ip}:${port}/api/${user}/lights`)
            .then(async result => {

                let list = result.data;
                let count = Object.keys(list).length - 1;

                if (await logging(result.status, result.data, 'get all lights') && result.data !== '{}') {
                    for (let i = 0; i <= count; i++) {
                        let keyName = Object.keys(list)[i];
                        //let lightID = Object.keys(list)[i];
                        let mac = list[keyName]['uniqueid'];
                        if (!mac) {
                            break;
                        }
                        mac = mac.match(/..:..:..:..:..:..:..:../g).toString();
                        let lightID = mac.replace(/:/g, '');

                        //create object for light device
                        await adapter.setObjectNotExistsAsync(`lights.${lightID}`, {
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
                        }).then ( () => {
                            objChangeByAdapter = true;
                        });

                        await adapter.setObjectNotExistsAsync(`lights.${lightID}.info`, {
                            type: 'channel',
                            common: {
                                name: 'Information'
                            }
                        }).then ( () => {
                            objChangeByAdapter = true;
                        });
                        await adapter.setObjectNotExistsAsync(`lights.${lightID}.manage`, {
                            type: 'channel',
                            common: {
                                name: 'Manage light'
                            }
                        }).then ( () => {
                            objChangeByAdapter = true;
                        });

                        if (list[keyName]['state']) {
                            let count2 = Object.keys(list[keyName]['state']).length - 1;
                            //create states for light device
                            for (let z = 0; z <= count2; z++) {
                                let stateName = Object.keys(list[keyName]['state'])[z];
                                await SetObjectAndState(lightID, 'lights', stateName, list[keyName]['state'][stateName]);
                                await SetObjectAndState(lightID, 'lights', 'transitiontime', null);
                                await SetObjectAndState(lightID, 'lights', 'level', null);

                                let manage = ['delete', 'removegroups', 'removescenes', 'addtogroup', 'removefromgroup'];

                                for (const manageKey in manage) {
                                    await SetObjectAndState(lightID, 'lights', manage[manageKey], null, 'manage');
                                }

                                let staticObjs = ['dimspeed', 'dimup', 'dimdown', 'action'];

                                for (const staticObjsKey in staticObjs) {
                                    await SetObjectAndState(lightID, 'lights', staticObjs[staticObjsKey], null,)
                                }
                            }
                        }
                    }
                }

            }).catch(async error => {
                await logging(error.status, error.data, 'get all lights')
                sentryMsg(error);
            });
    }
} //END getAllLights

async function getLightState(Id) {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.get(`http://${ip}:${port}/api/${user}/light/${Id}`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                if (await logging(res, body, 'get light state ' + Id)) {
                    let list = body;
                    let keyName = Object.keys(list)[0];

                    let mac = list['uniqueid'];
                    mac = mac.match(/..:..:..:..:..:..:..:../g).toString();
                    let lightId = mac.replace(/:/g, '');
                    //create object for light device
                    await adapter.setObjectAsync(`lights.${lightId}`, {
                        type: 'device',
                        common: {
                            name: list['name'],
                            role: 'light'
                        },
                        native: {
                            etag: list['etag'],
                            hascolor: list['hascolor'],
                            id: Id,
                            manufacturername: list['manufacturername'],
                            modelid: list['modelid'],
                            swversion: list['swversion'],
                            type: list['type'],
                            uniqueid: list['uniqueid']
                        }
                    }).then ( () => {
                        objChangeByAdapter = true;
                    });
                    await adapter.setObjectNotExistsAsync(`lights.${lightId}.info`, {
                        type: 'channel',
                        common: {
                            name: 'Information'
                        }
                    }).then ( () => {
                        objChangeByAdapter = true;
                    });
                    await adapter.setObjectNotExistsAsync(`lights.${lightId}.manage`, {
                        type: 'channel',
                        common: {
                            name: 'Manage light'
                        }
                    }).then ( () => {
                        objChangeByAdapter = true;
                    });
                    let count2 = Object.keys(list['state']).length - 1;
                    //create states for light device
                    for (let z = 0; z <= count2; z++) {
                        let stateName = Object.keys(list['state'])[z];
                        await SetObjectAndState(lightId, 'lights', stateName, list['state'][stateName]);
                    }
                    let manage = ['delete', 'removegroups', 'removescenes', 'addtogroup', 'removefromgroup'];

                    for (const manageKey in manage) {
                        await SetObjectAndState(lightId, 'lights', manage[manageKey], null, 'manage');
                    }

                    let staticObjs = ['dimspeed', 'dimup', 'dimdown', 'action'];

                    for (const staticObjsKey in staticObjs) {
                        await SetObjectAndState(lightId, 'lights', staticObjs[staticObjsKey], null,)
                    }
                }

            }).catch(async error => {
                sentryMsg(error);
            });


    }
} //END getLightState

async function setLightState(parameters, lightId, stateId) {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.put(`http://${ip}:${port}/api/${user}/lights/${lightId}/state`, parameters)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                let response = body;
                if (await logging(res, body, 'set light state ' + lightId) && response !== undefined && response !== 'undefined') {
                    await AckStateVal(stateId, response);
                }
            }).catch(async error => {
                sentryMsg(error);
            });
    }
} //END setLightState

async function setLightAttributes(parameters, lightId) {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.put(`http://${ip}:${port}/api/${user}/lights/${lightId}`, parameters)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                await logging(res, body, 'set light state ' + lightId);
            }).catch(async error => {
                sentryMsg(error);
            });

    }
} //END setLightAttributes

async function deleteLight(lightId) {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.delete(`http://${ip}:${port}/api/${user}/lights/${lightId}`)
            .then(async result => {
                let res = result.status
                let body = result.data;
                let response = body;
                if (await logging(res, body, 'delete light ' + lightId) && response !== undefined && response !== 'undefined') {
                    if (response[0]['success']) {
                        adapter.log.info('The light with id ' + lightId + ' was removed.')
                        adapter.getForeignObjects(adapter.name + '.' + adapter.instance + '.lights.*', 'device', async (err, enums) => {                    //alle Objekte des Adapters suchen
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
            }).catch(async error => {
                sentryMsg(error);
            });

    }
}

async function removeFromGroups(lightId) {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.put(`http://${ip}:${port}/api/${user}/lights/${lightId}/groups`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                let response = body;
                if (await logging(res, body, 'remove light from groups ' + lightId) && response !== undefined && response !== 'undefined') {
                    if (response[0]['success']) {
                        adapter.log.info('The light with id ' + lightId + ' was removed from all groups.')
                    } else if (response[0]['error']) {
                        adapter.log.warn(JSON.stringify(response[0]['error']));
                    }
                }
            }).catch(async error => {
                adapter.log.error(error);
                sentryMsg(error);
            });

    }
}

async function removeFromScenes(lightId) {

    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.put(`http://${ip}:${port}/api/${user}/lights/${lightId}/scenes`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                let response = body;
                if (await logging(res, body, 'remove light from scenes ' + lightId) && response !== undefined && response !== 'undefined') {
                    if (response[0]['success']) {
                        adapter.log.info('The light with id ' + lightId + ' was removed from all scenes.')
                    } else if (response[0]['error']) {
                        adapter.log.warn(JSON.stringify(response[0]['error']));
                    }
                }
            }).catch(async error => {
                adapter.log.error(error);
                sentryMsg(error);
            });

    }
}
//END  Light functions -------------------------------------------------------------------------------------------------

//START Devices functions ----------------------------------------------------------------------------------------------
async function getDevices() {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {

        await axios.get(`http://${ip}:${port}/api/${user}/devices`)
            .then(async result => {
                let res = result.status;
                let body = result.data;
                if (await logging(res, body, 'get devices')) {
                    adapter.log.debug('getDevices: ' + JSON.stringify(res) + ' ' + body);
                }
            }).catch(async error => {
                sentryMsg(error);
            });

    }
}

//END Devices functions ------------------------------------------------------------------------------------------------

async function logging(res, message, action) {
    if(typeof message !== 'string'){
        message = JSON.stringify(message);
    }
    if (action === undefined) {
        action = '';
    } else if (typeof action !== 'string') {
        action = JSON.stringify(action);
    }
    if (res === undefined) {
        return;
    }
    let statusCode = res;
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

function checkVirtualDevices(mac){
    const regexFSM = new RegExp('fsm');
    const regexVPIR = new RegExp('vpir');
    const resFSM = regexFSM.test(mac);
    const resVPIR = regexVPIR.test(mac);
    return !(resFSM !== true && resVPIR !== true);
}

async function getGatewayParam() {
    const results = await adapter.getObjectAsync('gateway_info');
    if (results) {
        return {
            ip: results.native.ipaddress ? results.native.ipaddress : 'none',
            port: results.native.port ? results.native.port : 'none',
            user: results.native.user ? results.native.user : 'none'
        };
    }
}

//Read latest release on Github of deConz
async function getLatestVersion() {
    const url = 'https://api.github.com/repos/dresden-elektronik/deconz-rest-plugin/releases/latest';

    const release =  await axios.get(url);
    let tagName = release.data.tag_name;
    tagName = tagName.replace('V', '');
    tagName = tagName.replace('_stable', '');
    const arrVersion = tagName.split('_');
    const version = `${ parseInt(arrVersion[0]) }.${ parseInt(arrVersion[1]) }.${ parseInt(arrVersion[2]) }`

    await adapter.extendObjectAsync('gateway_info', {
        native: {
            latestVersion: version
        }
    })
}


async function deleteDevice(deviceId) {
    await adapter.getObjectListAsync({startkey: deviceId, endkey: deviceId + '.\u9999'})
        .then(async result => {
            for (let r in result.rows) {
                await adapter.delObjectAsync(result.rows[r].id)
                    .then(result => {
                        //console.log(result);
                    }, reject => {
                        adapter.log.error(reject);
                    });
            }
        }, reject => {
            adapter.log.error(reject);
        })


}

/**
 * Set ACK Flag for state value
 * @param {string} stateId
 * @param {object} response
 */
async function AckStateVal(stateId, response) {
    if (response[0]['success']) {
        await adapter.setStateAsync(stateId, {ack: true});
    } else if (response[0]['error']) {
        adapter.log.warn(JSON.stringify(response[0]['error']));
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
    if(!ready){
        return;
    }
    if (event !== null && event !== undefined) {
        let button = event.toString().substr(0, 1);
        let type = event.toString().substr(1, 3);
        await adapter.setObjectNotExistsAsync(`sensors.${id}.buttons`, {
            type: 'channel',
            common: {
                name: 'Buttons'
            },
            native: {}
        }).then ( () => {
            objChangeByAdapter = true;
        });
        await adapter.setObjectNotExistsAsync(`sensors.${id}.buttons.${button}`, {
            type: 'channel',
            common: {
                name: 'Button ' + button
            },
            native: {}
        }).then ( () => {
            objChangeByAdapter = true;
        });

        let state;
        switch (type) {
            case '000':
                state = 'press';
                break;
            case '001':
                state = 'hold';
                break;
            case '002':
                state = 'release_press';
                break;
            case '003':
                state = 'release_hold';
                break;
            case '004':
                state = 'double_press';
                break;
            case '005':
                state = 'triple_press';
                break;
            case '006':
                state = 'quadruple_press';
                break;
            case '007':
                state = 'shake';
                break;
            case '008':
                state = 'drop';
                break;
            case '009':
                state = 'tilt';
                break;
            case '010':
                state = 'many_press';
                break;
        }
        await SetObjectAndState(`${id}.buttons.${button}`, 'sensors', state, true, null);

        timeoutButton = setTimeout(() => {
            adapter.setState(`sensors.${id}.buttons.${button}.${state}`, {
                val: false,
                ack: true
            })
        }, 150);

    }
}

/**
 *
 * @param {number} id
 * @param {string} type - first letter has to be upper case. Possible: groups, lights, sensors
 */
async function getObjectByDeviceId(id, type) {

    let obj = await adapter.getObjectListAsync({
        startkey: 'deconz.' + adapter.instance + '.' + type + '.',
        endkey: 'deconz.' + adapter.instance + '.' + type + '.\u9999'
    });

    let rows = obj.rows;
    let object;
    for (let o in rows) {
        if (rows[o].value.native !== undefined && typeof rows[o].value.native.id === 'string') {
            if (rows[o].value.native.id === id.toString()) {
                object = rows[o];
                break;
            }
        } else if (rows[o].value.native !== undefined) {
            for (let i in rows[o].value.native.id) {
                    if (rows[o].value.native.id[i] === id.toString()) {
                        object = rows[o];
                        break;
                    }
            }
        }
    }

    return object;
}

/**
 *
 * @param {string} id - of the device or group
 * @param {string} type - sensors, lights, groups, scenes
 * @param {string} stateName
 * @param value
 * @param {string} channel - channel for the state, null if not used
 * @param {number} sceneId - id for the scene
 */
async function SetObjectAndState(id, type, stateName, value = null, channel  = null, sceneId = null) {

    switch (stateName) {
        case 'all_on':
            channel = 'info'
            break;
        case 'any_on':
            if (value === true) {
                await SetObjectAndState(id, type, 'on', true);
            } else if (value === false) {
                await SetObjectAndState(id, type, 'on', false);
            }
            channel = 'info';
            break;
        case 'bri':
            await SetObjectAndState(id, type, 'level', Math.floor((100 / 254) * value));
            break;
        case 'buttonevent':
            await buttonEvents(`${id}`, value);
            break;
        case 'heatsetpoint':
            value = value / 100;
            break;
        case 'hue':
            value = Math.round(value * 100 / hue_factor) / 100;
            break;
        case 'humidity':
            value = value / 100;
            break;
        case 'temperature':
            value = value / 100;
            break;
        case 'effect':
            await SetObjectAndState(id, type, 'colorspeed', null);
            break;
        case 'lastupdated':
            value = UTCtoLocal(value);
            channel = 'info'
            break;
        case 'scene':
            channel = 'info'
            break;
        case 'reachable':
            channel = 'info';
            break;
        case 'battery':
            channel = 'info';
            break;
        case 'configured':
            channel = 'info';
            break;
        case 'colormode':
            channel = 'info';
            break;
    }

    let obj;

    if ( defObj[stateName] ) {
        obj = defObj[stateName];
    } else if ( preObj[stateName] ) {
        obj = preObj[stateName];
    } else {
        obj = {
            type: 'state',
            common: {
                name: stateName,
                type: 'mixed',
                role: 'state',
                read: true,
                write: true
            },
            native: {}
        }
    }
    let stateId;

    if(type !== 'scenes'){
        stateId = channel ? `${type}.${id}.${channel}.${stateName}` : `${type}.${id}.${stateName}`;
    } else {
        stateId = `groups.${id}.scenes.${sceneId}.${stateName}`
    }


   await adapter.setObjectNotExistsAsync(stateId, obj)
        .then ( () => {
            objChangeByAdapter = true;
        });
    if (value !== null) {
        await adapter.setStateAsync(stateId, {
            val: value,
            ack: true
        });
    }
}

async function handleWSmessage(msg) {
    let data = JSON.parse(msg.data);
    let id = data['id'] ? data['id'] : data['gid'];
    let event = data['e'];
    let type = data['r'];
    let state = data['state'];
    let attr = data['attr'];
    let config = data['config'];
    adapter.log.debug('Websocket message: ' + JSON.stringify(data));
    if (collectActive === true){
        CollectWSmessages(data);
    }


    let object;
    switch (type) {
        case 'lights': {
            switch (event) {
                case 'changed': {
                    if (typeof state == 'object') {
                        if (Object.keys(state).length > 0) {
                            object = await getObjectByDeviceId(id, 'lights');
                            if (object){
                                for (let stateName in state) {
                                    let oid = object.id.replace(/^(\w*\.){3}/g, '');
                                    await SetObjectAndState(oid, 'lights', stateName, state[stateName]);
                                }
                            }
                        } else {
                            adapter.log.debug("Event has no state-Changes");
                            // no state objects
                        }
                    } else if (typeof attr == 'object') {
                        //adapter.log.debug("Event has attr-Tag");
                        // in this case the new "attr"-attribute of the new event (lastseen) can be checked
                    } else {
                        await getLightState(id);
                    }
                    break;
                }
                case 'added':{
                    await getLightState(id);
                    break;
                }
                case 'deleted':{
                    object = await getObjectByDeviceId(id, 'lights');
                    let oid = object.id.replace(/^(\w*\.){3}/g, '');
                    await deleteDevice(oid);
                    break;
                }
            }

            break;
        }
        case 'groups':{
            switch (event){
                case 'changed': {
                    await getGroupAttributes(id);
                    break;
                }
                case 'added': {
                    await getGroupAttributes(id);
                    break;
                }
                case 'deleted': {
                    object = await getObjectByDeviceId(id, 'groups');
                    let oid = object.id.replace(/^(\w*\.){3}/g, '');
                    await deleteDevice(oid);
                    break;
                }
            }
            break;
        }
        case 'scenes': {
            if (data.e !== 'scene-called'){

            } else {
                await getSceneAttributes(id, data.scid);
            }
            break;
        }
        case 'sensors': {
            switch (event){
                case 'changed': {
                    let sensorData = data;
                    object = await getObjectByDeviceId(id, 'sensors');
                    if (object === undefined) {
                        await getSensor(id);
                    } else if (sensorData.e === 'changed' && sensorData.name) {
                        if (object && object.value.common.name !== sensorData.name) {
                            await adapter.extendObjectAsync(object.id, {
                                common: {
                                    name: sensorData.name
                                }
                            })
                        }

                    } else {
                        id = object.id.replace(/^(\w*\.){3}/g, '');
                        if (typeof state == 'object') {
                            for (let obj in state) {

                                if (obj === 'lastupdated') {
                                    await SetObjectAndState(id, 'sensors', 'lastupdated');
                                }

                                adapter.getState(`${object.id}.info.lastupdated`, async (err, lupdate) => {
                                    if (lupdate === null) {
                                        await SetObjectAndState(id, 'sensors', obj, state[obj]);
                                    } else if (lupdate.val !== state[obj]) {
                                        if (obj === 'buttonevent') {
                                            await SetObjectAndState(id, 'sensors', obj, state[obj]);
                                            await SetObjectAndState(id, 'sensors', 'buttonpressed');

                                            await adapter.setStateAsync(`${object.id}.buttonpressed`, {
                                                val: state[obj],
                                                ack: true
                                            });
                                            timeoutButtonpressed = setTimeout(() => {
                                                adapter.setState(`${object.id}.buttonpressed`, {
                                                    val: 0,
                                                    ack: true
                                                })
                                            }, 800);
                                        } else {
                                            await SetObjectAndState(id, 'sensors', obj, state[obj]);
                                        }
                                    }

                                })
                            }
                        }
                        if (typeof config == 'object') {
                            for (let obj in config) {
                                await SetObjectAndState(id, 'sensors', obj, config[obj]);
                            }
                        }
                    }
                    break;
                }
                case 'added': {
                    await getSensor(id);
                    break;
                }
                case 'deleted':{
                    object = await getObjectByDeviceId(id, 'sensors');
                    let oid = object.id.replace(/^(\w*\.){3}/g, '');
                    await deleteDevice(oid);
                    break;
                }
            }

            break;
        }
    }

}

//START Send device information to developer
async function sendDeviceInformation() {
    const {ip, port, user} = await getGatewayParam();

    if (ip !== 'none' && port !== 'none' && user !== 'none') {
        const gw = await adapter.getObjectAsync('gateway_info');


        const lights =  await axios.get(`http://${ip}:${port}/api/${user}/lights`);
        const sensors =  await axios.get(`http://${ip}:${port}/api/${user}/sensors`);
        const db = await axios.get('https://deconz.all-smart.net/devices');

        for (let device in lights.data){
            let exists = false;

            for (let dev in db.data) {
                if (lights.data[device].modelid === db.data[dev].ModelID && db.data[dev].deConzVersion === gw.native.swversion && lights.data[device].swversion === db.data[dev].swversion && lights.data[device].type === db.data[dev].Type){
                    exists = true;
                }
            }

            if (exists === true){
                continue;
            }
            let message = { UniqueID: lights.data[device].uniqueid, ModelID: lights.data[device].modelid, Manufacturer: lights.data[device].manufacturername, swversion: lights.data[device].swversion, deConzVersion: gw.native.swversion, Type: lights.data[device].type, Raw: lights.data[device] };
            try {
                const res = await axios.post('https://deconz.all-smart.net/devices', message);
            } catch (error) {
                console.log(error);
            }
        }

        for (let device in sensors.data){
            let exists = false;
            try {
                const db = await axios.get('https://deconz.all-smart.net/devices');
                for (let dev in db.data) {
                    if (sensors.data[device].modelid === db.data[dev].ModelID && db.data[dev].deConzVersion === gw.native.swversion && sensors.data[device].swversion === db.data[dev].swversion && sensors.data[device].type === db.data[dev].Type){
                        exists = true;
                    }
                }
            } catch (error) {
                console.log(error);
            }
            if (exists === true){
                continue;
            }
            let message = { UniqueID: sensors.data[device].uniqueid, ModelID: sensors.data[device].modelid, Manufacturer: sensors.data[device].manufacturername, swversion: sensors.data[device].swversion, deConzVersion: gw.native.swversion, Type: sensors.data[device].type, Raw: sensors.data[device] };
            try {
                const res = await axios.post('https://deconz.all-smart.net/devices', message);
            } catch (error) {
                console.log(error);
            }
        }

    }
}

async function CollectWSmessages(message) {
    let dataToSend = {};

    if ((Date.now() - startTime) >= 5400000){
        collectActive = false;
    }

    if(message.r !== 'groups') {
        const {ip, port, user} = await getGatewayParam();

        if (ip !== 'none' && port !== 'none' && user !== 'none') {
            const gw = await adapter.getObjectAsync('gateway_info');
            try {
                let device = await axios.get(`http://${ip}:${port}/api/${user}/${message.r}/${message.id}`);

                dataToSend.UniqueID = device.data.uniqueid;
                dataToSend.ModelID = device.data.modelid;
                dataToSend.Type = device.data.type;
                dataToSend.Event = message.e;
                dataToSend.Messages_type = message.t;
                dataToSend.Resource = message.r;
                dataToSend.Raw = message;
                dataToSend.deConzVersion = gw.native.swversion;

                const res = await axios.post('https://deconz.all-smart.net/messages', dataToSend);
            } catch (error){
                console.log(error);
            }

        }
    }

}
//END Send device information to developer

// @ts-ignore parent is a valid property on module
if (module.parent) {
    module.exports = (options) => new deconz(options);
} else {
    // or start the instance directly
    new deconz();
}

