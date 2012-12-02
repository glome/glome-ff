const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function AboutGlome() {}

AboutGlome.prototype = {
  classDescription: "about:glome",
  contractID: "@mozilla.org/network/protocol/about;1?what=glome",
  classID: Components.ID("{f9d69ff0-ffed-11e1-a21f-0800200c9a66}"),
//Note: classID here should be exactly the same as CID in chrome.manifest
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

  getURIFlags: function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },

  newChannel: function(aURI) {
    let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    let channel = ios.newChannel("chrome://glome/content/aboutGlome.xul",
                                 null, null);
  channel.originalURI = aURI;
    return channel;
  }
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutGlome]);