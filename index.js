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

var Accessory, Service, Characteristic, UUIDGen, hap;
// var inherits = require('util').inherits;
var debug = require('debug')('yamaha-zone-tv');
var util = require('./lib/util.js');
var Yamaha = require('yamaha-nodejs');
var Q = require('q');
var bonjour = require('bonjour')();
var ip = require('ip');
var sysIds = {};
var accessories = [];
var inputs = []; // used to retrieve available inputs for the detected receiver

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  hap = homebridge.hap;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  homebridge.registerPlatform("homebridge-yamaha-zone-tv", "yamaha-zone-tv", YamahaAVRPlatform, true);
};

function YamahaAVRPlatform(log, config, api) {
  this.log = log;
  this.config = config;
  this.api = api;

  this.zone = config["zone"] || "Main";
  this.minVolume = config["min_volume"] || -80.0;
  this.maxVolume = config["max_volume"] || 20.0;
  this.gapVolume = this.maxVolume - this.minVolume;
  this.discoveryTimeout = config["discovery_timeout"] || 10;

  this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
}

YamahaAVRPlatform.prototype.configureAccessory = function(accessory) {
  debug("configureAccessory", accessory);
};

YamahaAVRPlatform.prototype.didFinishLaunching = function() {
  this.log("Getting Yamaha AVR devices.");
  var that = this;

  var browser = bonjour.find({
    type: 'http'
  }, setupFromService.bind(this));

  var timer;
  var timeElapsed = 0;
  var checkCyclePeriod = 5000;

  // The callback can only be called once...so we'll have to find as many as we can
  // in a fixed time and then call them in.
  var timeoutFunction = function() {
    timeElapsed += checkCyclePeriod;
    if (timeElapsed > that.discoveryTimeout * 1000) {
      that.log("Waited " + that.discoveryTimeout + " seconds, stopping discovery.");
    } else {
      timer = setTimeout(timeoutFunction, checkCyclePeriod);
      return;
    }

    browser.stop();
    that.log("Discovery finished, found " + accessories.length + " Yamaha AVR devices.");
    that.api.publishExternalAccessories("yamaha-zone-tv", accessories);
  };
  timer = setTimeout(timeoutFunction, checkCyclePeriod);
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

        // add discovery of inputs here

        var inputsXML = sysConfig.YAMAHA_AV.System[0].Config[0].Name[0].Input[0];
        var id=0
        for (var prop in inputsXML) { // iterate through all inputs
          var input = {};
          // some of the names returned are not in sync with the names used for setting the input, so they are converted to match
          if (prop=='V_AUX') 
            input.ConfiguredName = "V-AUX";
          else // None of the inputs use an _ in setting the input, so removing _ from the input names
            input.ConfiguredName = prop.replace ("_","");
          input.ConfiguredTitle = inputsXML[prop][0];
          input.Identifier  = id;
          input.InputDeviceType = 0;
          input.InputSourceType = 0;
          inputs.push(input);
          id++;
        }
        // manually add Main Zone Sync as the receiver XML does not have any info on this
        inputs.push({
         ConfiguredName: 'Main Zone Sync',
         ConfiguredTitle : 'Main Zone Sync',
         Identifier: id,
         InputDeviceType : [ 0 ],
         InputSourceType : [ 0 ]
        });
        id++

        // iterate through the feature list of the amp to add more inputs
        var zonesXML = sysConfig.YAMAHA_AV.System[0].Config[0].Feature_Existence[0];
        for (var prop in zonesXML) {
            // Only return inputs that the receiver supports, skip Zone entries and USB since it's already in the input list
            if (!(prop.includes('one')) && !(prop.includes('USB'))&& zonesXML[prop].includes('1')) {
               var input = {};

               // Convert tuner and net radio to make them work
               if (prop=='Tuner') prop = "TUNER";
               if (prop=='NET_RADIO') prop = "NET RADIO";
               input.ConfiguredName = prop;
               input.ConfiguredTitle = prop;
               input.Identifier  = id;
               input.InputDeviceType = 0;
               input.InputSourceType = 10; // App
               inputs.push(input);
               id++;
            }
        }

        yamaha.getAvailableZones().then(
          function(zones) {
            if (zones.length > 0) {
              for (var zone in zones) {
                yamaha.getBasicInfo(zones[zone]).then(function(basicInfo) {
                  if (basicInfo.getVolume() !== -999) {
                    yamaha.getZoneConfig(basicInfo.getZone()).then(
                      function(zoneInfo) {
                        if (zoneInfo) {
                          var z = Object.keys(zoneInfo.YAMAHA_AV)[1];
                          var zoneName = zoneInfo.YAMAHA_AV[z][0].Config[0].Name[0].Zone[0];
                        } else {
                          var zoneName = "Main_Zone";
                        }
                        this.log("Adding TV Control for", zoneName);
                        var uuid = UUIDGen.generate(zoneName + "Y");
                        var zoneAccessory = new Accessory(zoneName + "Y", uuid, hap.Accessory.Categories.TELEVISION);
                        var accessory = new YamahaZone(this.log, this.config, zoneName, yamaha, sysConfig, z, zoneAccessory, name);
                        accessory.getServices();
                        accessories.push(zoneAccessory);
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

function YamahaZone(log, config, name, yamaha, sysConfig, zone, accessory, unitName) {
  this.log = log;
  this.config = config;
  this.name = name;
  this.yamaha = yamaha;
  this.sysConfig = sysConfig;
  this.zone = zone;
  this.accessory = accessory;
  this.unitName = unitName;

  this.radioPresets = config["radio_presets"] || false;
  this.presetNum = config["preset_num"] || false;
  this.minVolume = config["min_volume"] || -80.0;
  this.maxVolume = config["max_volume"] || -10.0;
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

    var informationService = this.accessory.services[0];

    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-zone-tv")
      .setCharacteristic(Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(Characteristic.FirmwareRevision, require('./package.json').version)
      .setCharacteristic(Characteristic.SerialNumber, this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]);

    // for main zone Only
    if (this.zone === "Main_Zone") {
      // Party Mode switch

      var mainSwitch = new Service.Switch(this.unitName, UUIDGen.generate(this.unitName), this.unitName);
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
      this.accessory.addService(mainSwitch);

      // Party Mode switch

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
      this.accessory.addService(partySwitch);

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
                    debug('Tuning radio to preset %s - %s', this.context.preset, this.displayName);
                    callback(null);
                  }.bind(this));
                }.bind(this));
              }.bind(presetSwitch));

            // debug("Bind", this, presetSwitch);
            this.accessory.addService(presetSwitch);
          }
        }.bind(this)).bind(this);
      }
    }

    var zoneService = new Service.Television(this.name);
    debug ("TV Zone name:", this.name);
    zoneService.setCharacteristic(Characteristic.ConfiguredName, this.name);
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

      zoneService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(inputs.find(function(input) {
        return (input.ConfiguredName === basicInfo.getCurrentInput() ? input : false);
      }).Identifier);

    });

    zoneService
      .getCharacteristic(Characteristic.ActiveIdentifier)
      .on('get', function(callback) {
        // debug("getActiveIdentifier", that.zone);
        yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
          debug("getActiveIdentifier Input", that.zone, basicInfo.getCurrentInput());
          callback(null, inputs.find(function(input) {
            return (input.ConfiguredName === basicInfo.getCurrentInput() ? input : false);
          }).Identifier);
        });
        // callback(null);
      })
      .on('set', function(newValue, callback) {
        debug("setActiveIdentifier => setNewValue: ", that.zone, newValue);
        yamaha.setInputTo(inputs.find(function(input) {
           debug("find %s === %s", input.Identifier, newValue);
          return (input.Identifier === newValue ? input : false);
        }).ConfiguredName, that.zone).then(function(a, b) {
          debug("setActiveIdentifier", that.zone, a, b);
          callback();
        });
        // callback(null);
      });

    // Spotify / Airplay controls
    zoneService
      .getCharacteristic(Characteristic.RemoteKey)
      .on('set', function(newValue, callback) {
        debug("setRemoteKey: ", that.zone, newValue);
        var option = util.mapKeyToControl(newValue);
        if (option) {
          debug("command", that.zone, newValue, option, this.pausePlay);
          yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
            if (basicInfo.getCurrentInput() === 'AirPlay' || basicInfo.getCurrentInput() === 'Spotify') {
              var input = basicInfo.getCurrentInput();
              yamaha.SendXMLToReceiver(
                '<YAMAHA_AV cmd="PUT"><' + input + '><Play_Control><Playback>' + option + '</Playback></Play_Control></' + input + '></YAMAHA_AV>'
              );
            }
            else // For non Spotify or Airplay sources perform Mute
            if (newValue==Characteristic.RemoteKey.PLAY_PAUSE)

            {
              if (basicInfo.isMuted(that.zone))
              {
                    debug("Mute Off: ", that.zone);
                    yamaha.muteOff(that.zone)
              }
              else
              {
                  debug("Mute On : ", that.zone);
                  yamaha.muteOn (that.zone)
              }
            } // end Mute functionality for non Spotiry or Airplay sources
          });
        }
        callback(null);
      });

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

    inputs.forEach(function(input) {
      // Don't add Main Zone Sync for the Main zone
      if (this.zone !== "Main_Zone"||input.ConfiguredName!="Main Zone Sync") {
        debug("Adding input", input.ConfiguredName, "for zone", this.name);
        var inputService = new Service.InputSource(input.ConfiguredName, UUIDGen.generate(this.name + input.ConfiguredName), input.ConfiguredName);

      inputService
        .setCharacteristic(Characteristic.Identifier, input.Identifier)
        .setCharacteristic(Characteristic.ConfiguredName, input.ConfiguredTitle) // Use title instead of name
        .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
        .setCharacteristic(Characteristic.InputSourceType, input.InputSourceType)
        .getCharacteristic(Characteristic.TargetVisibilityState)
        .on('set', function(newValue, callback) {
          debug("setTargetVisibilityState => setNewValue: ", that.zone, newValue);
          inputService.getCharacteristic(Characteristic.CurrentVisibilityState).updateValue(newValue);
          callback(null);
        });

        // if sourcetype = App or the Title is different than name (custom name is created) make input visible by default
        if (input.InputSourceType!=10 /* App */ && (input.ConfiguredName==input.ConfiguredTitle&&input.ConfiguredName!='Main Zone Sync'))
        {
          debug ("Making input", input.ConfiguredTitle, "invisible");
          inputService.getCharacteristic(Characteristic.CurrentVisibilityState).updateValue(1);
          inputService.getCharacteristic(Characteristic.TargetVisibilityState).updateValue(1);
        }

        zoneService.addLinkedService(inputService);
        this.accessory.addService(inputService);
        // debug(JSON.stringify(inputService, null, 2));
      }
    }.bind(this));

    var speakerService = new Service.TelevisionSpeaker(this.name);

    speakerService
      .setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
      .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);
    // .setCharacteristic(Characteristic.Volume, 50);

    speakerService.getCharacteristic(Characteristic.Volume)
      .on('get', function(callback) {
        debug("get Volume", that.zone);
        callback(null);
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

    this.accessory.addService(speakerService);
  }
};
