![Logo](admin/deconz.png)

ioBroker deConz dresden-elektronik Adapter
==============

![Number of Installations](http://iobroker.live/badges/deconz-installed.svg) ![Number of Installations](http://iobroker.live/badges/deconz-stable.svg) [![NPM version](http://img.shields.io/npm/v/iobroker.deconz.svg)](https://www.npmjs.com/package/iobroker.deconz)  [![Downloads](https://img.shields.io/npm/dm/iobroker.deconz.svg)](https://www.npmjs.com/package/iobroker.deconz) 

[![NPM](https://nodei.co/npm/iobroker.deconz.png?downloads=true)](https://nodei.co/npm/iobroker.deconz/)

## Notice
No Support for Beta Versions of deConz

Required js-controller version >2.x.x, Required node.js >= 10.x.x

## English

Connects to deConz software developed by dresden-elektronik. This software aims to be a universal ZigBee Gateway solution, using hardware from dresden-elektronik the ConBee USB stick and RaspBee a modul for the Raspberry Pi.


You must first link to deConz.
1.  a) Enter ip address for deConz 
    b) Enter port number, standard is 80.
2. After IP address and port is entered and saved hit "Create API Key" Button. Now you can enter the credentials for deConz or go to Phoscon APP and register ioBroker as third party APP.


#### Send more than one command at the same time
For this purpose there is a object called "action".

Examples:

`"on": true, "xy": [0.6586,0.3138]`

`"on": true, "transitiontime": 5, "hue": 65500`

## Links
[deConz](https://www.dresden-elektronik.de/funktechnik/products/software/pc/deconz/)  
[REST plugin](https://github.com/dresden-elektronik/deconz-rest-plugin)  
[Gateways (Hardware)](https://www.dresden-elektronik.de/funktechnik/solutions/wireless-light-control/gateways/)  

## [Sponsors](https://github.com/iobroker-community-adapters/ioBroker.deconz/blob/master/SPONSORS.MD)

## Changelog

### 2.0.1
* Bugfixes

### 2.0.0
* changed id naming from id to mac (uniqueid)
* possibility to rename devices

Full changelog history can be found in CHANGELOG.md

## License
Apache-2.0

Copyright (c) 2017-2020 Jey Cee jey-cee@live.com



