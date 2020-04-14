# Homebridge-Yamaha-Zone-TV

[![NPM Downloads](https://img.shields.io/npm/dm/homebridge-yamaha-zone-tv.svg?style=flat)](https://npmjs.org/package/homebridge-yamaha-zone-tv)

Homebridge plugin for multi-zone Yamaha Receivers like the RX-V1075 that creates a HomeKit TV Icon to control the receiver.  A TV Icon will be created for each zone, and will be controllable by the iOS Control Centre Remote App.

The Yamaha AVR will display as a TV Accessory with Power, Input, Volume & Remote Control.

The plugin will detect inputs automatically by querying the receiver. Note that inputs with a custom name and all network applications will be visible by default. If other inputs are desired to be visible this needs to be changed in the Home app.

# Installation

Follow the instruction in [NPM](https://www.npmjs.com/package/homebridge) for the homebridge server installation. The plugin is published through [NPM](https://www.npmjs.com/package/homebridge-yamaha-zone-tv) and should be installed "globally" by typing:

    sudo npm install -g homebridge-yamaha-zone-tv

# Configuration

## config.json

-   min_volume - Minimum Volume
-   max_volume - Maximum Volume
-   discovery_timeout - How long to stay in discovery mode, defaults to 30
-   radio_presets - Create a switch for each radio preset, defaults to false ( true/false )
-   preset_num - Names the switch the number of the preset, defaults to false ( true/false ). Otherwise the name is the frequency. ( useful with Siri and Alexa )
-   zone - Zone name
-   zone_controllers_only_for - A list of zone names for which an accessory is to be created. If no value for this key is provided, then accessories for all available zones are created.
-   cursor_remote_control - If set to true the remote control will control the cursor for use with on screen display, else it will control the media playback ( true/false ).

## Basic config.json config

"platforms": \[{
  "platform": "yamaha-zone-tv",
  "max_volume": 10
}

## Example advanced configuration

Example config.json:

```json
{
    "bridge": {
        "name": "Homebridge",
        "username": "CC:22:3D:E3:CE:51",
        "port": 51826,
        "pin": "031-45-154"
    },
    "description": "This is an example configuration file for homebridge plugin for yamaha AVR",
    "hint": "Always paste into jsonlint.com validation page before starting your homebridge, saves a lot of frustration",

    "platforms": [
      {
        "platform": "yamaha-zone-tv",
        "discovery_timeout": 5,
        "radio_presets": true,
        "preset_num": true,
        "max_volume": 10
      }
    ],
    "accessories": [
      {}
    ]
}
```

# Other Yamaha Receiver Plugins

## [homebridge-yamaha-home](https://github.com/NorthernMan54/homebridge-yamaha-home) For multi-zone Yamaha Receivers, and uses a Fan to control each zone of the receiver.

## [homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr) For single zone Yamaha receivers, and uses the Television control for the receiver.



# Credits

-   neonightmare - Creating the original plugin
-   TommyCardello - Adding Party Mode Switch, Adding Input or Scene Switches.
-   Abko - Added automatic detection of inputs. Tested on RX-A3060
-   torandreroland - Added remote control for AVR using on screen display
