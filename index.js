/*

Configuration Sample:
"platforms": [
{
    "platform": "yamaha-zone-tv",
    "discovery_timeout": 5,
    "radio_presets": true,
    "preset_num": true,
    "max_volume": 10
}

*/

"use strict";

var Accessory, Service, Characteristic, UUIDGen, hap, CachedConfigFile, cachedConfig;
// var inherits = require('util').inherits;
var debug = require('debug')('yamaha-zone-tv');
var util = require('./lib/util.js');
var Yamaha = require('yamaha-nodejs');
var fs = require('fs');
var path = require('path');
var Q = require('q');
var bonjour = require('bonjour')();
var ip = require('ip');
var sysIds = {};
var tvAccessories = [];
var cachedAccessories = [];
var controlAccessory;

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  hap = homebridge.hap;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  CachedConfigFile = path.join(homebridge.user.cachedAccessoryPath(), 'homebridge-yamaha-zone-tv.json')
  homebridge.registerPlatform("homebridge-yamaha-zone-tv", "yamaha-zone-tv", YamahaAVRPlatform, true);
};

function YamahaAVRPlatform(log, config, api) {
  this.log = log;
  this.config = config;
  this.api = api;

  this.zone = config["zone"] || "Main";
  this.minVolume = config["min_volume"] || -80.0;
  this.maxVolume = config["max_volume"] || 20.0;
  this.disablePartySwitch = config["disable_party_switch"] || false;
  this.disableMainPowerSwitch = config["disable_main_power_switch"] || false;
  this.radioPresets = config["radio_presets"] || false;
  this.gapVolume = this.maxVolume - this.minVolume;
  this.discoveryTimeout = config["discovery_timeout"] || 10;
  this.zoneControllersOnlyFor = config["zone_controllers_only_for"] || null;
  
  try {
    cachedConfig = JSON.parse(fs.readFileSync(CachedConfigFile));
  } catch (err) {
      debug('Cached names file does not exist');
      cachedConfig = {
        custom: {
          disablePartySwitch: undefined,
          disableMainPowerSwitch: undefined,
          radioPresets: undefined,
        },
        units: {}
      };  
  }

  this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
}

YamahaAVRPlatform.prototype.configureAccessory = function(accessory) {
  debug("configuredAccessory", accessory);
  
  var foundDuplicateIndex = cachedAccessories.findIndex(cachedAccessory => cachedAccessory.UUID === accessory.UUID)
  var foundDuplicate = cachedAccessories.find(cachedAccessory => cachedAccessory.UUID === accessory.UUID)
  if (foundDuplicate) {
    this.api.unregisterPlatformAccessories("homebridge-yamaha-zone-tv", "yamaha-zone-tv", [foundDuplicate]);
    cachedAccessories.splice(foundDuplicateIndex, 1)
  }
  cachedAccessories.push(accessory)

};

YamahaAVRPlatform.prototype.didFinishLaunching = function() {
  debug('didFinishLaunching')
  this.log("Getting Yamaha AVR devices.");
  var that = this;


  var browser = bonjour.find({
    type: 'http'
  }, setupFromService.bind(this));

  setTimeout(function() {
    that.log("Waited " + that.discoveryTimeout + " seconds, stopping discovery.");
  
    browser.stop();
    that.log("Discovery finished, found " + tvAccessories.length + " Yamaha AVR devices.");
    that.api.publishExternalAccessories("homebridge-yamaha-zone-tv", tvAccessories);
  
    debug('PLATFORM - cachedAccessories', cachedAccessories)

    if ( cachedConfig.custom.radioPresets === undefined
      || cachedConfig.custom.radioPresets !== that.radioPresets 
      || cachedConfig.custom.disablePartySwitch !== that.disablePartySwitch 
      || cachedConfig.custom.disableMainPowerSwitch !== that.disableMainPowerSwitch){

        cachedConfig.custom["radioPresets"] = that.radioPresets;
        cachedConfig.custom["disablePartySwitch"] = that.disablePartySwitch;
        cachedConfig.custom["disableMainPowerSwitch"] = that.disableMainPowerSwitch;
  
        fs.writeFile(CachedConfigFile, JSON.stringify(cachedConfig), (err) => {
          if (err)
              debug('Error occured could not write cachedConfig file %s', err);
        });
  
        debug('UNREGISTERING - cachedAccessories')
        that.api.unregisterPlatformAccessories("homebridge-yamaha-zone-tv", "yamaha-zone-tv", cachedAccessories);
        cachedAccessories = [];
    }

    if (controlAccessory && !cachedAccessories.find(accessory => accessory.UUID === controlAccessory.UUID)) {
      cachedAccessories.push(controlAccessory)
      that.api.registerPlatformAccessories("homebridge-yamaha-zone-tv", "yamaha-zone-tv", [controlAccessory]);
    }


    // remove old devices from cache
    if (!controlAccessory || (controlAccessory && cachedAccessories.find(accessory => accessory.UUID !== controlAccessory.UUID))) {
      that.api.unregisterPlatformAccessories("homebridge-yamaha-zone-tv", "yamaha-zone-tv", cachedAccessories.filter(accessory => accessory.UUID !== (controlAccessory ? controlAccessory.UUID : 'everything')));
    }

  }, this.discoveryTimeout * 1000)
};

function setupFromService(service) {
  // Looking for name, host and port
  this.log("Possible Yamaha device discovered", service.name, service.addresses);
  if (service.addresses) {
    for (let address of service.addresses) {
      if (ip.isV4Format(address)) {
        service.host = address;
        break;
      }
    }
  }

  var name = service.name;
  if (service.port !== 80) return; // yamaha-nodejs assumes this, so finding one on another port wouldn't do any good anyway.
  var yamaha = new Yamaha(service.host);

  yamaha.getSystemConfig().then(
    function(sysConfig) {
      // debug(JSON.stringify(sysConfig, null, 2));
      if (sysConfig && sysConfig.YAMAHA_AV) {
        var sysModel = sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0];
        var sysId = sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0];
        if (sysIds[sysId]) {
          this.log("WARN: Got multiple systems with ID " + sysId + "! Omitting duplicate!");
          return;
        }
        sysIds[sysId] = true;
        this.log("Found Yamaha " + sysModel + " - " + sysId + ", \"" + name + "\"");

        if (!cachedConfig.units[sysId])
          cachedConfig.units[sysId] = {
            zones: {},
            inputsNames: {}
          }

        // add discovery of inputs here
        var inputs = []; // used to retrieve available inputs for the detected receiver
        var inputsXML = sysConfig.YAMAHA_AV.System[0].Config[0].Name[0].Input[0];
        
        // manually add Main Zone Sync as the receiver XML does not have any info on this
        inputsXML['Main Zone Sync'] = ['Main Zone Sync']

        for (var prop in inputsXML) { // iterate through all inputs          

          var inputName =util.syncName(prop)

          var input = util.getInputConfig(inputName)

          if (cachedConfig.units[sysId].inputsNames[inputName]) {
            input.ConfiguredName = cachedConfig.units[sysId].inputsNames[inputName];
            debug('Found cached input name for')
          } else {
            input.ConfiguredName = inputsXML[prop][0]
          }
          
          if (util.isUnique(inputs, input.ConfiguredName)) {
            debug(input.ConfiguredName, "is unique");
            inputs.push(input);
          } else 
            debug(input.ConfiguredName, "already exists");

        }
        
        // iterate through the feature list of the amp to add more inputs
        var zonesXML = sysConfig.YAMAHA_AV.System[0].Config[0].Feature_Existence[0];
        for (var prop in zonesXML) {
          // Only return inputs that the receiver supports, skip Zone entries and USB since it's already in the input list
          if (!(prop.includes('one')) && !(prop.includes('USB')) && zonesXML[prop].includes('1')) {

            var inputName =util.syncName(prop)

            var input = util.getInputConfig(inputName)
  
            if (cachedConfig.units[sysId].inputsNames[inputName]) {
              input.ConfiguredName = cachedConfig.units[sysId].inputsNames[inputName];
              debug('Found cached input name for')
            } else {
              input.ConfiguredName = inputName
            }
            
            if (util.isUnique(inputs, input.ConfiguredName)) {
              debug(input.ConfiguredName, "is unique");
              inputs.push(input);
            } else 
              debug(input.ConfiguredName, "already exists");
          }
        }

        yamaha.getAvailableZones().then(
          function(zones) {
            if (zones.length > 0) {

              if (!this.disableMainPowerSwitch || !this.disablePartySwitch || this.radioPresets)
                controlAccessory = new Accessory(name + "C", UUIDGen.generate(sysId));
              else
                controlAccessory = null // if there is no need to create an extra switch

              for (var zone in zones) {
                yamaha.getBasicInfo(zones[zone]).then(function(basicInfo) {
                  if (basicInfo.getVolume() !== -999) {
                    yamaha.getZoneConfig(basicInfo.getZone()).then(
                      function(zoneInfo) {
                        if (zoneInfo) {
                          var zoneId = Object.keys(zoneInfo.YAMAHA_AV)[1];
                          var zoneName = zoneInfo.YAMAHA_AV[zoneId][0].Config[0].Name[0].Zone[0];
                        } else {
                          var zoneId = "Main_Zone";
                          var zoneName = "Main_Zone";
                        }
                        
                        if (this.zoneControllersOnlyFor == null || this.zoneControllersOnlyFor.includes(zoneName)) {
                          this.log("Adding TV Control for", zoneId);
                          var uuid = UUIDGen.generate(zoneId + "Z" + sysId);

                          if (cachedConfig.units[sysId].zones[zoneId])
                            zoneName = cachedConfig.units[sysId].zones[zoneId].name
                          else
                            cachedConfig.units[sysId].zones[zoneId] = { name: zoneName, hiddenInputs: {} }
                          
                          if (!cachedAccessories.find(accessory => accessory.UUID === uuid)) {
                            var zoneAccessory = new Accessory(zoneName, uuid, hap.Accessory.Categories.AUDIO_RECEIVER);
                            var accessory = new YamahaZone(this.log, this.config, zoneName, yamaha, sysConfig, zoneId, zoneAccessory, name, inputs, controlAccessory);
                            accessory.getServices();
                            tvAccessories.push(zoneAccessory);
                          }

                          fs.writeFile(CachedConfigFile, JSON.stringify(cachedConfig), (err) => {
                            if (err)
                                debug('Error occured could not write cachedConfig file %s', err);
                          });

                        }
                      }.bind(this)
                    );
                  }
                }.bind(this));
              }
            }
          }.bind(this)
        );
      }
    }.bind(this),
    function(error) {
      this.log("DEBUG: Failed getSystemConfig from " + name + ", probably just not a Yamaha AVR.");
    }.bind(this)
  );
}

function YamahaZone(log, config, name, yamaha, sysConfig, zoneId, accessory, unitName, inputs, controlAccessory) {
  this.log = log;
  this.config = config;
  this.name = name;
  this.yamaha = yamaha;
  this.sysConfig = sysConfig;
  this.sysId = sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]
  this.zone = zoneId;
  this.accessory = accessory;
  this.unitName = unitName;
  this.inputs = inputs;
  this.controlAccessory = controlAccessory;
  this.disablePartySwitch = config["disable_party_switch"] || false;
  this.disableMainPowerSwitch = config["disable_main_power_switch"] || false;
  this.radioPresets = config["radio_presets"] || false;
  this.presetNum = config["preset_num"] || false;
  this.minVolume = config["min_volume"] || -80.0;
  this.maxVolume = config["max_volume"] || -10.0;
  this.cursorRemoteControl = config["cursor_remote_control"] || false;
  this.gapVolume = this.maxVolume - this.minVolume;
}

YamahaZone.prototype = {

  setPlaying: function(playing) {
    var that = this;
    var yamaha = this.yamaha;

    if (playing) {
      return yamaha.powerOn(that.zone).then(function() {
        yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
          if (basicInfo.getCurrentInput() === 'AirPlay' || basicInfo.getCurrentInput() === 'Spotify') {
            var input = basicInfo.getCurrentInput();
            return yamaha.SendXMLToReceiver(
              '<YAMAHA_AV cmd="PUT"><' + input + '><Play_Control><Playback>Play</Playback></Play_Control></' + input + '></YAMAHA_AV>'
            );
          } else {
            return Q();
          }
        });
      });
    } else {
      return yamaha.powerOff(that.zone);
    }
  },

  getServices: function() {
    var that = this;
    var yamaha = this.yamaha;

    var informationService = this.accessory.getService(Service.AccessoryInformation);

    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-zone-tv")
      .setCharacteristic(Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(Characteristic.FirmwareRevision, require('./package.json').version)
      .setCharacteristic(Characteristic.SerialNumber, this.sysId + '_' + this.zone);

    // for main zone Only
    if (this.zone === "Main_Zone") {

      if (this.controlAccessory) {
        this.controlAccessory.getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Name, this.unitName)
        .setCharacteristic(Characteristic.Manufacturer, "yamaha-zone-tv")
        .setCharacteristic(Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
        .setCharacteristic(Characteristic.FirmwareRevision, require('./package.json').version)
        .setCharacteristic(Characteristic.SerialNumber, this.sysId);
      
        if (!this.disableMainPowerSwitch) {
          var mainSwitch = new Service.Switch("Main Power", UUIDGen.generate(this.sysId + 'Main Power'), this.sysId + 'Main Power');
          mainSwitch
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback, context) {
              yamaha.isOn().then(
                function(result) {
                  debug("Main Power", result);
                  callback(null, result);
                },
                function(error) {
                  callback(error, false);
                }
              );
            })
            .on('set', function(powerOn, callback) {
              this.setPlaying(powerOn).then(function() {
                callback(null, powerOn);
              }, function(error) {
                callback(error, !powerOn); // TODO: Actually determine and send real new status.
              });
            }.bind(this));
          mainSwitch.isPrimaryService = true;
          this.controlAccessory.addService(mainSwitch);
        }
        // Party Mode switch
        if (!this.disablePartySwitch) {

          var partySwitch = new Service.Switch("Party", UUIDGen.generate("Party"), "Party");
          partySwitch
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
              this.yamaha.isPartyModeEnabled().then(function(result) {
                debug("getPartySwitch", that.zone, result);
                callback(null, result);
              });
            }.bind(this))
            .on('set', function(on, callback) {
              debug("setPartySwitch", that.zone, on);
              if (on) {
                const that = this;
                this.yamaha.powerOn().then(function() {
                  that.yamaha.partyModeOn().then(function() {
                    callback(null, true);
                  });
                });
              } else {
                this.yamaha.partyModeOff().then(function() {
                  callback(null, false);
                });
              }
            }.bind(this));
          this.controlAccessory.addService(partySwitch);
        }

        // Radio Preset buttons

        if (this.radioPresets) {
          yamaha.getTunerPresetList().then(function(presets) {
            for (var preset in presets) {
              this.log("Adding preset %s - %s", preset, presets[preset].value, this.presetNum);
              if (!this.presetNum) {
                // preset by frequency
                var presetSwitch = new Service.Switch(presets[preset].value, UUIDGen.generate(presets[preset].value), presets[preset].value);
              } else {
                // preset by button
                var presetSwitch = new Service.Switch("Preset " + preset, UUIDGen.generate(preset), preset);
              }
              presetSwitch.context = {};

              presetSwitch.context.preset = preset;
              presetSwitch
                .getCharacteristic(Characteristic.On)
                .on('get', function(callback, context) {
                  // debug("getPreset", this);
                  yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
                    // debug('YamahaSwitch Is On', basicInfo.isOn()); // True
                    // debug('YamahaSwitch Input', basicInfo.getCurrentInput()); // Tuner

                    if (basicInfo.isOn() && basicInfo.getCurrentInput() === 'TUNER') {
                      yamaha.getTunerInfo().then(function(result) {
                        // console.log( 'TunerInfo', JSON.stringify(result,null, 0));
                        debug(result.Play_Info[0].Feature_Availability[0]); // Ready
                        debug(result.Play_Info[0].Search_Mode[0]); // Preset
                        debug(result.Play_Info[0].Preset[0].Preset_Sel[0]); // #
                        if (result.Play_Info[0].Feature_Availability[0] === 'Ready' &&
                          result.Play_Info[0].Search_Mode[0] === 'Preset' &&
                          result.Play_Info[0].Preset[0].Preset_Sel[0] === this.context.preset) {
                          callback(null, true);
                        } else {
                          callback(null, false);
                        }
                      }.bind(this));
                    } else {
                      // Off
                      callback(null, false);
                    }
                  }.bind(this), function(error) {
                    callback(error);
                  });
                }.bind(presetSwitch))
                .on('set', function(powerOn, callback) {
                  // debug("setPreset", this);
                  yamaha.setMainInputTo("TUNER").then(function() {
                    return yamaha.selectTunerPreset(this.context.preset).then(function() {
                      debug('Tuning radio to preset %s - %s', this.context.preset);
                      callback(null);
                    }.bind(this));
                  }.bind(this));
                }.bind(presetSwitch));

              // debug("Bind", this, presetSwitch);
              this.controlAccessory.addService(presetSwitch);
            }
          }.bind(this)).bind(this);
        }
      }
    }

    var zoneService = new Service.Television(this.name);
    debug("TV Zone name:", this.name);
    
    zoneService.getCharacteristic(Characteristic.ConfiguredName)
      .on('set', (name, callback) => {
        debug('Setting new ConfiguredName for %s', this.zone )
        cachedConfig.units[this.sysId].zones[this.zone].name = name
        fs.writeFile(CachedConfigFile, JSON.stringify(cachedConfig), (err) => {
          if (err)
              debug('Error occured could not write cachedConfig file %s', err);
        });
        callback()
      }).updateValue(this.name)

    zoneService.getCharacteristic(Characteristic.Active)
      .on('get', function(callback, context) {
        yamaha.isOn(that.zone).then(
          function(result) {
            debug("getActive", that.zone, result);
            callback(null, result);
          },
          function(error) {
            debug("getActive - error", that.zone, error);
            callback(error, false);
          }
        );
      })
      .on('set', function(powerOn, callback) {
        debug("setActive", that.zone, powerOn);
        this.setPlaying(powerOn).then(function() {
          callback(null, powerOn);
        }, function(error) {
          callback(error, !powerOn); // TODO: Actually determine and send real new status.
        });
      }.bind(this));

    // Populate ActiveIdentifier with current input selection

    yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
      debug('YamahaSwitch Is On', that.zone, basicInfo.isOn()); // True
      debug('YamahaSwitch Input', that.zone, basicInfo.getCurrentInput());

      // Set identifier for active input

      zoneService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(that.inputs.find(function(input) {
        return (input.NameIdentifier === basicInfo.getCurrentInput() ? input : false);
      }).Identifier);
    });

    zoneService
      .getCharacteristic(Characteristic.ActiveIdentifier)
      .on('get', function(callback) {
        // debug("getActiveIdentifier", that.zone);
        yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
          debug("getActiveIdentifier Input", that.zone, basicInfo.getCurrentInput());
          callback(null, that.inputs.find(function(input) {
            return (input.NameIdentifier === basicInfo.getCurrentInput() ? input : false);
          }).Identifier);
        });
        // callback(null);
      })
      .on('set', function(newValue, callback) {
        debug("setActiveIdentifier => setNewValue: ", that.zone, newValue);
        yamaha.setInputTo(that.inputs.find(function(input) {
          debug("find %s === %s", input.Identifier, newValue);
          return (input.Identifier === newValue ? input : false);
        }).ConfiguredName, that.zone).then(function(a, b) {
          debug("setActiveIdentifier", that.zone, a, b);
          callback();
        });
        // callback(null);
      });

    zoneService
      .getCharacteristic(Characteristic.RemoteKey)
      .on('set', function(newValue, callback) {
        debug("setRemoteKey: ", that.zone, newValue);
        if (this.cursorRemoteControl) {
          switch (newValue) {
            case Characteristic.RemoteKey.ARROW_UP:
              yamaha.remoteCursor("Up");
              break;
            case Characteristic.RemoteKey.ARROW_DOWN:
              yamaha.remoteCursor("Down");
              break;
            case Characteristic.RemoteKey.ARROW_RIGHT:
              yamaha.remoteCursor("Right");
              break;
            case Characteristic.RemoteKey.ARROW_LEFT:
              yamaha.remoteCursor("Left");
              break;
            case Characteristic.RemoteKey.SELECT:
              yamaha.remoteCursor("Sel");
              break;
            case Characteristic.RemoteKey.BACK:
              yamaha.remoteCursor("Return");
              break;
            case Characteristic.RemoteKey.INFORMATION:
              yamaha.remoteMenu("On Screen");
              break;
            case Characteristic.RemoteKey.PLAY_PAUSE:
              yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
                basicInfo.isMuted(that.zone) ? yamaha.muteOff(that.zone) : yamaha.muteOn(that.zone);
              });
              break;
            default:
          }
        } else {
          var option = util.mapKeyToControl(newValue);
          if (option) {
            debug("command", that.zone, newValue, option, this.pausePlay);
            yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
              if (basicInfo.getCurrentInput() === 'AirPlay' || basicInfo.getCurrentInput() === 'Spotify') {
                var input = basicInfo.getCurrentInput();
                yamaha.SendXMLToReceiver(
                  '<YAMAHA_AV cmd="PUT"><' + input + '><Play_Control><Playback>' + option + '</Playback></Play_Control></' + input + '></YAMAHA_AV>'
                );
              } else { // For non Spotify or Airplay sources perform Mute
                if (newValue === Characteristic.RemoteKey.PLAY_PAUSE) {
                  if (basicInfo.isMuted(that.zone)) {
                    debug("Mute Off: ", that.zone);
                    yamaha.muteOff(that.zone);
                  } else {
                    debug("Mute On : ", that.zone);
                    yamaha.muteOn(that.zone);
                  }
                } // end Mute functionality for non Spotify or Airplay sources
              }
            });
          }
        }
        callback(null);
      }.bind(this));

    zoneService
      .getCharacteristic(Characteristic.CurrentMediaState)
      .on('get', function(callback) {
        debug("getCurrentMediaState", that.zone);
        callback(null);
      })
      .on('set', function(newValue, callback) {
        debug("setCurrentMediaState => setNewValue: " + newValue);
        callback(null);
      });

    zoneService
      .getCharacteristic(Characteristic.TargetMediaState)
      .on('get', function(callback) {
        debug("getTargetMediaState", that.zone);
        callback(null);
      })
      .on('set', function(newValue, callback) {
        debug("setTargetMediaState => setNewValue: ", that.zone, newValue);
        callback(null);
      });

    zoneService
      .getCharacteristic(Characteristic.PictureMode)
      .on('set', function(newValue, callback) {
        debug("setPictureMode => setNewValue: ", that.zone, newValue);
        callback(null);
      });

    zoneService
      .getCharacteristic(Characteristic.PowerModeSelection)
      .on('set', function(newValue, callback) {
        debug("setPowerModeSelection => setNewValue: ", that.zone, newValue);
        callback(null);
      });

    this.accessory.addService(zoneService);

    that.inputs.forEach(function(input) {
      // Don't add Main Zone Sync for the Main zone
      if (this.zone !== "Main_Zone" || input.NameIdentifier !== "Main Zone Sync") {
        // debug("Adding input", input.ConfiguredName, "for zone", this.name);
        var inputService = new Service.InputSource(input.ConfiguredName, UUIDGen.generate(this.zone + input.NameIdentifier), this.zone + input.NameIdentifier);

        inputService.getCharacteristic(Characteristic.ConfiguredName)
          .on('set', (name, callback) => {
            debug('Setting new ConfiguredName for Input %s - %s', input.NameIdentifier, name )
            cachedConfig.units[this.sysId].inputsNames[input.NameIdentifier] = name

            fs.writeFile(CachedConfigFile, JSON.stringify(cachedConfig), (err) => {
              if (err)
                  debug('Error occured could not write cachedConfig file %s', err);
            });

            // update each zone with the new configured input name
            tvAccessories.forEach(tvAccessory => {
              if (tvAccessory.UUID !== this.accessory.UUID) {
                tvAccessory.getService(input.ConfiguredName)
                  .getCharacteristic(Characteristic.ConfiguredName)
                  .updateValue(name)
              }
            })

            callback()
          }).updateValue(input.ConfiguredName)


        inputService
          .setCharacteristic(Characteristic.Identifier, input.Identifier)
          .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
          .setCharacteristic(Characteristic.InputSourceType, input.InputSourceType)
          .setCharacteristic(Characteristic.InputDeviceType, input.InputDeviceType)
          .getCharacteristic(Characteristic.TargetVisibilityState)
            .on('set', (newValue, callback) => {
              debug("setTargetVisibilityState => setNewValue: ", that.zone, newValue);
              inputService.getCharacteristic(Characteristic.CurrentVisibilityState).updateValue(newValue);
              cachedConfig.units[this.sysId].zones[this.zone].hiddenInputs[input.NameIdentifier] = newValue
              fs.writeFile(CachedConfigFile, JSON.stringify(cachedConfig), (err) => {
                if (err)
                    debug('Error occured could not write cachedConfig file %s', err);
              });


              callback(null);
            });

        // check if VisibilityState is in cache
        var isHidden = cachedConfig.units[this.sysId].zones[this.zone].hiddenInputs[input.NameIdentifier]
        // if not in cache and sourcetype = App or the Title is different than name (custom name is created) make input visible by default
        if (isHidden === undefined && input.InputSourceType !== 10 /* App */ && input.ConfiguredName === input.NameIdentifier && input.ConfiguredName !== 'Main Zone Sync') {
          debug("Making input", input.NameIdentifier, "invisible");
          inputService.getCharacteristic(Characteristic.CurrentVisibilityState).updateValue(1);
          inputService.getCharacteristic(Characteristic.TargetVisibilityState).updateValue(1);
        } else if (isHidden !== undefined) {
          debug('Found input ', input.NameIdentifier, 'VisibilityState in cache - ', (isHidden ? 'hidden' : 'visible'))
          inputService.getCharacteristic(Characteristic.CurrentVisibilityState).updateValue(isHidden);
          inputService.getCharacteristic(Characteristic.TargetVisibilityState).updateValue(isHidden);
        }

        zoneService.addLinkedService(inputService);
        this.accessory.addService(inputService);
        // debug(JSON.stringify(inputService, null, 2));
      }
    }.bind(this));

    var speakerService = new Service.TelevisionSpeaker(this.name);

    speakerService
      .setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
      .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.RELATIVE_WITH_CURRENT);
    // .setCharacteristic(Characteristic.Volume, 50);


    speakerService.getCharacteristic(Characteristic.Volume)
      .on('get', function(callback) {
        debug("get Volume", that.zone);
        yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
          var v = basicInfo.getVolume() / 10.0;
          var p = 100 * ((v - that.minVolume) / that.gapVolume);
          p = p < 0 ? 0 : p > 100 ? 100 : Math.round(p);
          debug("Got volume percent of " + p + "%", that.zone);
          callback(p);
        });
      })
      .on('set', function(newValue, callback) {
        debug("set Volume => setNewValue: ", that.zone, newValue);
        callback(null);
      });

    yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
      var v = basicInfo.getVolume() / 10.0;
      var p = 100 * ((v - that.minVolume) / that.gapVolume);
      p = p < 0 ? 0 : p > 100 ? 100 : Math.round(p);
      debug("Got volume percent of " + p + "%", that.zone);
      speakerService.getCharacteristic(Characteristic.Volume).updateValue(p);
    });

    speakerService.getCharacteristic(Characteristic.VolumeSelector)
      .on('set', function(newValue, callback) {
        var volume = speakerService.getCharacteristic(Characteristic.Volume).value;
        // debug(volume, speakerService.getCharacteristic(Characteristic.Volume));
        volume = volume + (newValue ? -1 : +1);
        speakerService.getCharacteristic(Characteristic.Volume).updateValue(volume);
        var v = ((volume / 100) * that.gapVolume) + that.minVolume;
        v = Math.round(v) * 10.0;
        debug("Setting volume to ", that.zone, v / 10);
        yamaha.setVolumeTo(v, that.zone).then(function(status) {
          debug("Status", that.zone, status);
        });
        debug("set VolumeSelector => setNewValue: ", that.zone, newValue, volume);
        callback(null);
      });
      // .on('set', function(decrement, callback) {
      //   if (decrement) {
      //     debug("Decrementing Volume by 1 for ", that.zone);
      //     yamaha.volumeDown(1, that.zone).then(function(status) {
      //       debug("Status", that.zone, status);
      //     });

      //   } else {
      //     debug("Incrementing Volume by 1 for ", that.zone);
      //     yamaha.volumeUp(1, that.zone).then(function(status) {
      //       debug("Status", that.zone, status);
      //     });
      //   }
      //   callback(null);
      // });

    this.accessory.addService(speakerService);
  }
};
