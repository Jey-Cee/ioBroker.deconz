var adapter = require('../../modules/adapter.js')({

    //
    name:           'hue',
    version:        '0.0.1',

    // Wird aufgerufen wenn sich ein Objekt - das via adapter.subscribeObjects aboniert wurde - ändert.
    objectChange: function (id, obj) {

    },
    // Wird aufgerufen wenn sich ein Status - der via adapter.subscribeStates aboniert wurde - ändert.
    stateChange: function (id, state) {
        adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));
    },

    // Wird aufgerufen bevor der Adapter beendet wird - callback muss unbedingt aufgerufen werden!
    unload: function (callback) {
        try {
            adapter.log.info('example terminating');
            callback();
        } catch (e) {
            callback();
        }
    },

    // Wird aufgerufen wenn der Adapter mit den Datenbanken verbunden ist und seine Konfiguration erhalten hat.
    // Hier einsteigen!
    ready: function () {
        main();
    }

});

function main() {

    adapter.subscribeStates('*');

    adapter.setState('testVariable', true);

    setTimeout(function () {
        adapter.setState('testVariable', false);
    }, adapter.config.testTimeout * 1000);

}

