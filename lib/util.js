// Constants

/*
Characteristic.InputSourceType.OTHER = 0;
Characteristic.InputSourceType.HOME_SCREEN = 1;
Characteristic.InputSourceType.TUNER = 2;
Characteristic.InputSourceType.HDMI = 3;
Characteristic.InputSourceType.COMPOSITE_VIDEO = 4;
Characteristic.InputSourceType.S_VIDEO = 5;
Characteristic.InputSourceType.COMPONENT_VIDEO = 6;
Characteristic.InputSourceType.DVI = 7;
Characteristic.InputSourceType.AIRPLAY = 8;
Characteristic.InputSourceType.USB = 9;
Characteristic.InputSourceType.APPLICATION = 10;
*/

/*
// The value property of InputDeviceType must be one of the following:
Characteristic.InputDeviceType.OTHER = 0;
Characteristic.InputDeviceType.TV = 1;
Characteristic.InputDeviceType.RECORDING = 2;
Characteristic.InputDeviceType.TUNER = 3;
Characteristic.InputDeviceType.PLAYBACK = 4;
Characteristic.InputDeviceType.AUDIO_SYSTEM = 5;
*/

// I copied this out of the WebUI for my Receiver
var id = 40


const inputsConfigs = module.exports = {
  Inputs: [{
      NameIdentifier: "TUNER",
      Identifier: 0,
      InputDeviceType: 3,
      InputSourceType: 2
    },
    {
      NameIdentifier: "MULTI CH",
      Identifier: 1,
      InputDeviceType: 5,
      InputSourceType: 0
    },
    {
      NameIdentifier: "PHONO",
      Identifier: 2,
      InputDeviceType: 5,
      InputSourceType: 0
    },
    {
      NameIdentifier: "HDMI1",
      Identifier: 3,
      InputDeviceType: 1,
      InputSourceType: 3
    },
    {
      NameIdentifier: "HDMI2",
      Identifier: 4,
      InputDeviceType: 1,
      InputSourceType: 3
    },
    {
      NameIdentifier: "HDMI3",
      Identifier: 5,
      InputDeviceType: 1,
      InputSourceType: 3
    },
    {
      NameIdentifier: "HDMI4",
      Identifier: 6,
      InputDeviceType: 1,
      InputSourceType: 3
    },
    {
      NameIdentifier: "HDMI5",
      Identifier: 7,
      InputDeviceType: 1,
      InputSourceType: 3
    },
    {
      NameIdentifier: "HDMI6",
      Identifier: 8,
      InputDeviceType: 1,
      InputSourceType: 3
    },
    {
      NameIdentifier: "HDMI7",
      Identifier: 9,
      InputDeviceType: 1,
      InputSourceType: 3
    },
    {
      NameIdentifier: "AV1",
      Identifier: 10,
      InputDeviceType: 0,
      InputSourceType: 0
    },
    {
      NameIdentifier: "AV2",
      Identifier: 11,
      InputDeviceType: 0,
      InputSourceType: 0
    },
    {
      NameIdentifier: "AV3",
      Identifier: 12,
      InputDeviceType: 0,
      InputSourceType: 0
    },
    {
      NameIdentifier: "AV4",
      Identifier: 13,
      InputDeviceType: 0,
      InputSourceType: 0
    },
    {
      NameIdentifier: "AV5",
      Identifier: 14,
      InputDeviceType: 0,
      InputSourceType: 0
    },
    {
      NameIdentifier: "AV6",
      Identifier: 15,
      InputDeviceType: 0,
      InputSourceType: 0
    },
    {
      NameIdentifier: "AV7",
      Identifier: 16,
      InputDeviceType: 5,
      InputSourceType: 0
    },
    {
      NameIdentifier: "V-AUX",
      Identifier: 17,
      InputDeviceType: 5,
      InputSourceType: 4
    },
    {
      NameIdentifier: "AUDIO1",
      Identifier: 18,
      InputDeviceType: 5,
      InputSourceType: 0
    },
    {
      NameIdentifier: "AUDIO2",
      Identifier: 19,
      InputDeviceType: 5,
      InputSourceType: 0
    },
    {
      NameIdentifier: "AUDIO3",
      Identifier: 20,
      InputDeviceType: 5,
      InputSourceType: 0
    },
    {
      NameIdentifier: "AUDIO4",
      Identifier: 21,
      InputDeviceType: 5,
      InputSourceType: 0
    },
    {
      NameIdentifier: "USB/NET",
      Identifier: 22,
      InputDeviceType: 5,
      InputSourceType: 9
    },
    {
      NameIdentifier: "Rhapsody",
      Identifier: 23,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      NameIdentifier: "Napster",
      Identifier: 24,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      NameIdentifier: "SiriusXM",
      Identifier: 25,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      NameIdentifier: "Pandora",
      Identifier: 26,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      NameIdentifier: "Spotify",
      Identifier: 27,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      NameIdentifier: "AirPlay",
      Identifier: 28,
      InputDeviceType: 5,
      InputSourceType: 8
    },
    {
      NameIdentifier: "SERVER",
      Identifier: 29,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      NameIdentifier: "NET RADIO",
      Identifier: 30,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      NameIdentifier: "USB",
      Identifier: 31,
      InputDeviceType: 5,
      InputSourceType: 9
    },
    {
      NameIdentifier: "iPod (USB)",
      Identifier: 32,
      InputDeviceType: 5,
      InputSourceType: 9
    },
    {
      NameIdentifier: "Main Zone Sync",
      Identifier: 33,
      InputDeviceType: 5,
      InputSourceType: 10
    }
  ],
  mapKeyToControl: mapKeyToControl,
  getInputConfig: getInputConfig,
  syncName: syncName,
  isUnique: isUnique
};

var Characteristic = {};
Characteristic.RemoteKey = {};

// Copied from HomeKitType-Television

Characteristic.RemoteKey.REWIND = 0;
Characteristic.RemoteKey.FAST_FORWARD = 1;
Characteristic.RemoteKey.NEXT_TRACK = 2;
Characteristic.RemoteKey.PREVIOUS_TRACK = 3;
Characteristic.RemoteKey.ARROW_UP = 4;
Characteristic.RemoteKey.ARROW_DOWN = 5;
Characteristic.RemoteKey.ARROW_LEFT = 6;
Characteristic.RemoteKey.ARROW_RIGHT = 7;
Characteristic.RemoteKey.SELECT = 8;
Characteristic.RemoteKey.BACK = 9;
Characteristic.RemoteKey.EXIT = 10;
Characteristic.RemoteKey.PLAY_PAUSE = 11;
Characteristic.RemoteKey.INFORMATION = 15;

function mapKeyToControl(key) {
  var code;
  switch (key) {
    case Characteristic.RemoteKey.ARROW_RIGHT:
      code = "Skip Fwd";
      break;
    case Characteristic.RemoteKey.ARROW_LEFT:
      code = "Skip Rev";
      break;
    case Characteristic.RemoteKey.PLAY_PAUSE:
      code = "Pause";
      break;
    case Characteristic.RemoteKey.SELECT:
      code = "Play";
      break;
    case Characteristic.RemoteKey.BACK:
      code = "Stop";
      break;
  }
  return (code);
}

function getInputConfig(name){
  var foundInput = inputsConfigs.Inputs.find(input => input.NameIdentifier === name)
  if (foundInput)
    return foundInput
  else {
    id ++
    return {
      NameIdentifier: name,
      Identifier: id,
      InputDeviceType: 0,
      InputSourceType: 0
    }

  }
}

function syncName(name) {
  if (name === 'NET_RADIO') 
    return "NET RADIO"
  
  if (name === 'V_AUX')
    return "V-AUX";

  if (name === 'Tuner') 
    return "TUNER";
    
  return name.replace("_", "");
  
}

function isUnique(inputs, inputName) {
  return !inputs.find(input => inputName === input.ConfiguredName)
}