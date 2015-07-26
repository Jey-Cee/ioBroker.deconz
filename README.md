![Logo](admin/hue.jpeg)
# ioBroker Philips Hue Bridge Adapter

Connects Philips Hue LED Bulbs, Friends of Hue LED Lamps and Stripes and other SmartLink capable Devices (LivingWhites,
some LivingColors) via Philips Hue Bridges to ioBroker

## Install

## Changelog
### 0.3.1
* (Pmant) fix another bug with spaces
* (Pmant) fix hue/sat bug
* (Pmant) fix effect bug

### 0.3.0
* (Pmant) fix rgb states only for color lights
* (Pmant) change set known state changes immediately
* (Pmant) change on/off sets brightness to 254/0
* (Pmant) change changing any color (hs,ct,xy) while light is off sets brightness to max
* (Pmant) fix set brightness to zero if light is off
* (Pmant) change set bri to zero if lamp is not reachable
* (Pmant) fix bridges and lamps with spaces in name

### 0.2.1
* (Pmant) add rgb states (write only)
* (Pmant) fix parent/children warnings
* (Pmant) add switch light off if brightness is zero

### 0.1.4
* (bluefox) fix some null objects

### 0.1.3
* (hobbyquaker) config UI
* (hobbyquaker) added children

### 0.1.2
* (hobbyquaker) fixes

### 0.1.1

* (hobbyquaker) fixed min/max attributes
* (hobbyquaker) added common.oper.read/write attributes

### 0.1.0

* (hobbyquaker) first release

## Roadmap/Todo

* Automatic bridge discovery
* Automatic user setup via bridge link button

## License

Apache 2.0

Copyright (c) 2014 hobbyquaker



