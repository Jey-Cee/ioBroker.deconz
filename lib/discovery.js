/*
Thanks to Jonas Hermsmeier who has written the original code, which can be found here: https://github.com/jhermsmeier/node-net-ssdp
 */

var os = require( 'os' )
var dgram = require( 'dgram' )
var net = require( 'net' )
var Emitter = require( 'events' )
var SSDP = require( './ssdp' )

class Discovery extends Emitter {

  /**
   * [constructor description]
   * @param {Object} options
   * @param {Number} [options.discoverInterval]
   * @param {Number} [options.notifyInterval]
   * @param {Number} [options.multicastTTL]
   * @returns {Discovery}
   */
  constructor( options ) {

    super()

    options = Object.assign( {}, options )

    this.reuseAddr = options.reuseAddr !== false

    this.interfaces = new Map()
    this.services = []

  }

  _createSockets( interfaces ) {

    interfaces = interfaces || os.networkInterfaces()

    Object.keys( interfaces ).forEach(( name ) => {
      interfaces[ name ].forEach(( info ) => {

        // Skip internal interfaces
        if( info.internal ) { return }

        var iface = new Interface( name, info )

        iface.socket = dgram.createSocket({
          type: iface.family === 'IPv6' ? 'udp6' : 'udp4',
          ipv6Only: iface.family === 'IPv6',
          reuseAddr: this.reuseAddr,
        })

        this.interfaces.set( iface.address, iface )

      })
    })

  }

  _handleMessage( msg, rinfo, iface ) {

    var message = null

    if( msg.indexOf( 'HTTP' ) === 0 ) {
      message = SSDP.parseResponse( msg )
      //console.log(message);
      this.emit( 'message', message, rinfo, iface )
    } else {
      message = SSDP.parseRequest( msg )
      if( message.method === 'M-SEARCH' ) {
        this.emit( 'search', message, rinfo, iface )
        // TODO/FIXME: Determine if the search came from ourselves
        this._handleSearch( message, rinfo, iface )
      } else if( message.method === 'NOTIFY' ) {
        this.emit( 'notify', message, rinfo, iface )
      }
    }

  }

  _handleSearch( msg, rinfo, iface ) {

    var services = /^ssdp:all$/i.test( msg.headers.st ) ?
      this.services.slice() :
      this.services.filter(( service ) => {
        return service.type === msg.headers.st
      })

    // Calculate a random timeout up to MX until transmitting response
    var mx = parseInt( msg.headers.mx, 10 ) || SSDP.DEFAULT_MX
    var delay = mx * Math.random() * 1000

    setTimeout(() => {
      var date = new Date().toGMTString()
      services.forEach(( service ) => {
        this.respond({
          'date': date,
          'cache-control': `max-age=${service.maxAge}`,
          // 'ext': '',
          'location': iface.family === 'IPv6' ? service.location.ipv6 : service.location.ipv4,
          'st': service.type,
          'usn': service.usn,
        }, rinfo, iface )
      })
    }, delay )

  }

  respond( options, rinfo, iface ) {

    var message = `HTTP/1.1 200 OK\r\n`

    Object.keys( options ).forEach(( field ) => {
      message += `${ field.toUpperCase() }: ${ options[field] }\r\n`
    })

    message += '\r\n'

    var buffer = Buffer.from( message )
    var length = buffer.length
    var offset = 0

    iface.socket.send( buffer, offset, length, rinfo.port, rinfo.address )

  }

  search( options, callback ) {

    var headers = Object.assign({
      'host': '',
      'man': '"ssdp:discover"',
      'mx': '1',
      'st': 'ssdp:all'
    }, options )

    for( var [ address, iface ] of this.interfaces ) {

      let message = `M-SEARCH * HTTP/1.1\r\n`
      let host = iface.family === 'IPv6' ? SSDP.IPv6 : SSDP.IPv4

      headers.host = iface.family === 'IPv6' ?
        `[${host}]:${SSDP.PORT}` : `${host}:${SSDP.PORT}`

      for( var field in headers ) {
        message += field.toUpperCase() + ': ' + headers[field] + '\r\n'
      }

      message += '\r\n'

      var buffer = Buffer.from( message )
      var length = buffer.length
      var offset = 0

      iface.socket.send( buffer, offset, length, SSDP.PORT, host )

    }

    if( typeof callback === 'function' ) {
      setTimeout(() => {
        callback.call( this, null, [] )
      }, 5000 )
    }

  }

  announce( options, callback ) {
    if( typeof callback === 'function' ) {
      process.nextTick(() => {
        callback.call( this, new Error( 'Not implemented' ) )
      })
    }
  }

  publish( service, callback ) {
    this.services.push( service )
    this.announce( service, callback )
  }

  listen( interfaces, callback ) {

    if( typeof interfaces === 'function' ) {
      callback = interfaces
      interfaces = null
    }

    this._createSockets( interfaces )

    var interfaceCount = this.interfaces.size
    var socketsBound = 0

    this.interfaces.forEach(( iface, address ) => {

      var socket = iface.socket

      socket.on( 'error', ( error ) => { this.emit( 'warning', error, socket ) })
      socket.on( 'message', ( msg, rinfo ) => { this._handleMessage( msg, rinfo, iface ) })
      socket.on( 'listening', () => { this.emit( 'listening', socket ) })

      var address = iface.family === 'IPv6' ?
        SSDP.IPv6 : SSDP.IPv4

      socket.bind( SSDP.PORT, () => {

        var addr = socket.address()

        try {
          socket.setMulticastTTL( SSDP.MULTICAST_TTL )
          socket.setMulticastLoopback( true )
          socket.setBroadcast( true )
          if( iface.family === 'IPv6' ) {
            socket.addMembership( SSDP.IPv6, iface.address )
          } else {
            socket.addMembership( SSDP.IPv4, iface.address )
          }
        } catch( error ) {
          this.emit( 'warning', error, iface )
          this.interfaces.delete( iface.address )
          iface.socket.removeAllListeners()
          iface.socket.close()
          iface.socket = null
        }

        if( ( socketsBound += 1 ) === interfaceCount ) {
          var error = !this.interfaces.size ?
            new Error( 'No interfaces bound' ) : null
          callback.call( this, error )
        }

      })

    })

  }

  close() {
    this.interfaces.forEach(( iface, address ) => {
      if( iface.socket ) {
        iface.socket.close(() => {
          iface.socket.removeAllListeners()
          iface.socket = null
        })
      }
    })
  }

}

class Interface {
  constructor( name, options ) {
    this.name = name || ''
    this.address = options.address || ''
    this.netmask = options.netmask || ''
    this.family = options.family || ''
    this.mac = options.mac || ''
    this.internal = options.internal || false
    this.cidr = options.cidr || ''
    this.scopeid = options.scopeid || 0
    this.socket = null
  }
}

Discovery.Interface = Interface

module.exports = Discovery
