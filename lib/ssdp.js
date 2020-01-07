/*
Thanks to Jonas Hermsmeier who has written the original code, which can be found here: https://github.com/jhermsmeier/node-net-ssdp
 */

var SSDP = module.exports

SSDP.IPv6_LINK = 'FF02::C'
SSDP.IPv6_SITE = 'FF05::C'
SSDP.IPv6_ORGANIZATION = 'FF08::C'
SSDP.IPv6_GLOBAL = 'FF0E::C'
SSDP.IPv6 = SSDP.IPv6_SITE

SSDP.IPv4_SITE = '239.255.255.250'
SSDP.IPv4 = SSDP.IPv4_SITE

SSDP.PORT = 1900
SSDP.TTL = 255
SSDP.MULTICAST_TTL = 10

SSDP.PACKET_TYPE = 'MAN'
SSDP.SERVICE_TYPE = 'ST'
SSDP.WAIT_TIME = 'MX' // -> seconds to delay response
SSDP.LOCATION = 'LOCATION'
SSDP.NOTIFICATION_TYPE = 'NT'
SSDP.NOTIFICATION_SUB_TYPE = 'NTS'
SSDP.UNIQUE_SERVICE_NAME = 'USN'

SSDP.DEFAULT_MX = 1

SSDP.NOTIFY_STATUS = {
  ALIVE: 'ssdp:alive',
}

SSDP.METHODS = [
  'NOTIFY',
  'M-SEARCH',
]

SSDP.Discovery = require( './discovery' )

SSDP.Service = class Service {
  constructor( options ) {

    options = options || {}

    this.type = options.type || ''
    this.usn = options.usn || ''
    this.uuid = options.uuid || ''
    this.location = {
      ipv4: options.ipv4 || '',
      ipv6: options.ipv6 || '',
    }

    this.maxAge = parseInt( options.maxAge, 10 ) || 1800

  }
}

SSDP.parseResponse = function( buffer ) {

  var eod = buffer.indexOf( '\r\n\r\n' )
  var header = buffer.toString( 'utf8', 0, eod )
    .split( /\r\n/g )

  var status = header.shift()

  var message = {
    protocol: '',
    version: '',
    statusCode: '',
    statusMessage: '',
    headers: Object.create( null )
  }

  eod = status.indexOf( '/' )

  message.protocol = status.slice( 0, eod ).toLowerCase()
  message.version = status.slice( eod + 1, eod = status.indexOf( ' ', eod + 1 ) )
  message.statusCode = parseInt( status.slice( eod + 1, eod = status.indexOf( ' ', eod + 1 ) ), 10 )
  message.statusMessage = status.slice( eod + 1 )

  for( var i = 0; i < header.length; i++ ) {
    eod = header[i].indexOf( ':' )
    let k = header[i].slice( 0, eod ).toLowerCase()
    let v = header[i].slice( eod + 1 ).trim()
    message.headers[k] = message.headers[k] != null ?
      message.headers[k] + ', ' + v : v
  }

  return message

}

SSDP.parseRequest = function( buffer ) {

  var eod = buffer.indexOf( '\r\n\r\n' )
  var header = buffer.toString( 'utf8', 0, eod )
    .split( /\r\n/g )

  var [ method, path, protocol ] = header.length ?
    header.shift().split( /\s/g ) : []

  var message = {
    protocol: protocol ? protocol.split( '/' ).shift().toLowerCase() : '',
    version: protocol ? protocol.split( '/' ).pop() : '',
    method,
    path,
    headers: Object.create( null ),
  }

  for( var i = 0; i < header.length; i++ ) {
    eod = header[i].indexOf( ':' )
    let k = header[i].slice( 0, eod ).toLowerCase()
    let v = header[i].slice( eod + 1 ).trim()
    message.headers[k] = message.headers[k] != null ?
      message.headers[k] + ', ' + v : v
  }

  return message

}
