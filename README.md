![Logo](admin/mysensors.png)
# ioBroker.mysensors

![Number of Installations](http://iobroker.live/badges/mysensors-installed.svg) ![Number of Installations](http://iobroker.live/badges/mysensors-stable.svg) [![NPM version](http://img.shields.io/npm/v/iobroker.mysensors.svg)](https://www.npmjs.com/package/iobroker.mysensors)
[![Downloads](https://img.shields.io/npm/dm/iobroker.mysensors.svg)](https://www.npmjs.com/package/iobroker.mysensors)
[![Tests](https://travis-ci.org/ioBroker/ioBroker.mysensors.svg?branch=master)](https://travis-ci.org/ioBroker/ioBroker.mysensors)

[![NPM](https://nodei.co/npm/iobroker.mysensors.png?downloads=true)](https://nodei.co/npm/iobroker.mysensors/)

This adapter communicates with [mysensors](http://www.mysensors.org) serial or ethernet gateway (TCP or UDP).
If ethernet gateway selected in this case ioBroker is server, that expects connections.

## TCP Client
This option works only together with TCP&lt;=&gt;Serial bridge, like [esp-link](https://github.com/jeelabs/esp-link).

## Pre requires
To use serial port on Windows it is VS required to build the binary.
To use serial port on linux it is build-essential and python2.7 required. To install them just write:

```
sudo apt-get update
sudo apt-get install build-essential
sudo apt-get install python2.7
```

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

## Changelog
### 3.0.0 (2022-03-21)
* (bluefox) Updated serialport package

### 2.0.3 (2021-11-10)
* (sergeyksv) Added the support of deep sleep

### 2.0.1 (2020-06-01)
* (jangatzke) compare integer values

### 2.0.0 (2019-05-15)
* (Apollon77) Support for nodejs 12 added, nodejs 4 is no longer supported!

### 1.2.2 (2018-09-17)
* (Haba1234) Added new objects (library 2.3.x)
* (Haba1234) Added support for sleeping nodes

### 1.2.1 (2018-01-23)
* (Haba1234) Update for Admin v3

### 1.2.0 (2018-01-23)
* (Apollon77) Upgrade Serialport Library

### 1.1.0 (2017-12-17)
* (bluefox) TCP client added

### 1.0.10 (2017-10-24)
* (jangatzke) Fixed wrong data type for scene controller, enabled ack flag on set command

### 1.0.8 (2017-04-18)
* (Qube2org) adjust log level for I_LOG_MESSAGE

### 1.0.7 (2017-04-10)
* (bluefox) fix I_TIME request

### 1.0.6 (2016-12-17)
* (bluefox) show extended list of serial ports

### 1.0.5 (2016-12-15)
* (Apollon77) update serialport library for node 6.x compatibility

### 1.0.4 (2016-07-01)
* (bluefox) add comment in configuration
* (bluefox) fix inclusion mode control

### 1.0.2 (2016-07-06)
* (soef) fix id usage

### 1.0.1 (2016-07-01)
* (soef) necessary version of sensor module increased

### 1.0.0 (2016-06-28)
* (soef) some value corrections and enlargement

### 0.2.6 (2016-06-16)
* (bluefox) do not switch off inclusion mode by stop

### 0.2.5 (2016-06-14)
* (bluefox) remove debug outputs

### 0.2.4 (2016-06-10)
* (bluefox) try/catch parse of messages

### 0.2.3 (2016-04-13)
* fix boolean values

### 0.2.2 (2016-04-10)
* (bluefox) implement inclusion mode

### 0.2.1 (2016-03-21)
* (bluefox) translates
* (bluefox) connection timeout for serial connection

### 0.2.0 (2016-03-21)
* (bluefox) wait till serial port is opened
* (bluefox) configurable baud rate

### 0.1.10 (2016-03-21)
* (bluefox) set role of dimmer as level.dimmer

### 0.1.9 (2016-03-15)
* (bluefox) fix typo

### 0.1.8 (2016-03-02)
* (bluefox) fix connection indicator for serial

### 0.1.7 (2016-03-02)
* (bluefox) do not send any data on disconnect

### 0.1.6 (2016-03-02)
* (bluefox) set UDP as default settings

### 0.1.5 (2016-03-02)
* (bluefox) change tree

The MIT License (MIT)

Copyright (c) 2016-2022, Bluefox <dogafox@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
