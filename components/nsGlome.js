const GLOME_VERSION = "0.0.1";//"{{VERSION}}";
const GLOME_PACKAGE = "/extension.glome.me"; 
const GLOME_EXTENSION_ID = "glome@glome.me";
const GLOME_CONTRACTID = "@glome.me/glome-ext;1";
const GLOME_CID = Components.ID("{7B55BE07-94CB-4B4C-8118-D65069F5E509}");
const GLOME_PROT_CONTRACTID = "@mozilla.org/network/protocol;1?name=glome";
const GLOME_PROT_CID = Components.ID("{EB516FD2-7389-4D02-A03D-2227EFDA79D9}");

// ABP Specific
const ABP_PROT_CONTRACTID = "@mozilla.org/network/protocol;1?name=abp";
const ABP_PROT_CID = Components.ID("{DB15FD20-63FD-492A-BD2F-6B3E43A690EF}");

const Cc = Components.classes;
const Ci = Components.interfaces;
const loader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
  .getService(Ci.mozIJSSubScriptLoader);

// const locales = [
//   "{{LOCALE}}",
//   null
// ];
const locales = [];

/*
 * Module object
 */
const module = {
  registerSelf: function(compMgr, fileSpec, location, type)
  {
    compMgr = compMgr.QueryInterface(Ci.nsIComponentRegistrar);
    compMgr.registerFactoryLocation(GLOME_CID, 
                    "Glome content policy",
                    GLOME_CONTRACTID,
                    fileSpec, location, type);
    compMgr.registerFactoryLocation(GLOME_PROT_CID,
                    "Glome protocol handler",
                    GLOME_PROT_CONTRACTID,
                    fileSpec, location, type);
    compMgr.registerFactoryLocation(ABP_PROT_CID,
                    "ABP protocol handler",
                    ABP_PROT_CONTRACTID,
                    fileSpec, location, type);

    // Need to delete category before removing, nsIContentPolicies in Gecko 1.9 listens to
    // category changes
    // var catman = Cc["@mozilla.org/categorymanager;1"]
    //                        .getService(Ci.nsICategoryManager);
    // catman.deleteCategoryEntry("content-policy", GLOME_CONTRACTID, true);
    // catman.addCategoryEntry("content-policy", GLOME_CONTRACTID,
    //           GLOME_CONTRACTID, true, true);
  },

  unregisterSelf: function(compMgr, fileSpec, location)
  {
    compMgr = compMgr.QueryInterface(Ci.nsIComponentRegistrar);
    
    compMgr.unregisterFactoryLocation(GLOME_CID, fileSpec);
    compMgr.unregisterFactoryLocation(GLOME_PROT_CID, fileSpec);
    compMgr.unregisterFactoryLocation(ABP_PROT_CID, fileSpec);
    // var catman = Cc["@mozilla.org/categorymanager;1"]
    //                        .getService(Ci.nsICategoryManager);
    //catman.deleteCategoryEntry("content-policy", GLOME_CONTRACTID, true);
  },

  getClassObject: function(compMgr, cid, iid)
  {
    if (!cid.equals(GLOME_CID) && !cid.equals(GLOME_PROT_CID))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    
    if (!iid.equals(Ci.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    
    return factory;
  },

  canUnload: function(compMgr)
  {
    return true;
  }
};

function NSGetModule(comMgr, fileSpec)
{  
  return module;
};

/*
 * Factory object
 */
var initialized = false;
const factory = {
  // nsIFactory interface implementation
  createInstance: function(outer, iid)
  {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    if (!initialized)
      init();

    return glome.QueryInterface(iid);
  },

  // nsISupports interface implementation
  QueryInterface: function(iid)
  {
    if (iid.equals(Ci.nsISupports) ||
        iid.equals(Ci.nsIFactory))
      return this;

    if (!iid.equals(Ci.nsIClassInfo))
      dump("Glome: factory.QI to an unknown interface: " + iid + "\n");

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

function NSGetFactory(aCID)  
{  
  return factory;  
}

/*
 * Constants / Globals
 */

const Node = Ci.nsIDOMNode;
const Element = Ci.nsIDOMElement;
const Window = Ci.nsIDOMWindow;
const ImageLoadingContent = Ci.nsIImageLoadingContent;

var windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                               .getService(Ci.nsIWindowMediator);
var windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"]
                             .getService(Ci.nsIWindowWatcher);


/*
 * Content policy class definition
 */

const glome = {
  //
  // Glome logger implementation
  //
  
  LOG: function()
  {
    var message = 'GLOME: ' + Array.prototype.slice.call(arguments).join(' :: ');
    if(!message.match(/\n$/))
      message += '\n';
    
    Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService)
    .logStringMessage(message);
    
    dump(message);
  },
  formatStackTrace: function(exception)
  {
    var trace = '';
    if (exception.stack) {
      var calls = exception.stack.split('\n');
      for each(let call in calls) {
        if (call.length > 0) {
          call = call.replace(/\\n/g, '\n');

          if (call.length > 200)
            call = call.substr(0, 200) + '[...]\n';

          trace += call.replace(/^/mg, '\t') + '\n';
        }
      }
    } else {
      return exception;
    }
    return trace;
  },
  
  //
  // nsISupports interface implementation
  //

  QueryInterface: function(iid)
  {
    if (iid.equals(Ci.nsIContentPolicy))
      return policy;

    if (iid.equals(Ci.nsIProtocolHandler))
      return protocol;

    if (iid.equals(Ci.nsISupports))
      return this;

    if (!iid.equals(Ci.nsIClassInfo) &&
        !iid.equals(Ci.nsISecurityCheckedComponent) &&
        !iid.equals(Ci.nsIDOMWindow))
      dump("Glome: glome.QI to an unknown interface: " + iid + "\n");

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /**
   * Returns installed Glome version
   */
  getInstalledVersion: function() /**String*/
  {
    return GLOME_VERSION;
  },

  /**
   * Opens preferences dialog or focused already open dialog.
   * @param {String} location  (optional) filter suggestion
   * @param {Filter} filter    (optional) filter to be selected
   */
  openSettingsDialog: function(location, filter)
  {
    var dlg = windowMediator.getMostRecentWindow("glome:settings");
    var func = function() {
      if (typeof location == "string")
        dlg.setLocation(location);
      if (filter instanceof Filter)
        dlg.selectFilter(filter);
    }
    
    if (dlg) {
      func();
    
      try {
        dlg.focus();
      } catch (e) {
        // There must be some modal dialog open
        dlg = windowMediator.getMostRecentWindow("glome:subscription") || windowMediator.getMostRecentWindow("glome:about");
        if (dlg)
          dlg.focus();
      }
    }
    else
    {
      dlg = windowWatcher.openWindow(null, "chrome://glome/content/settings.xul", "_blank", "chrome,centerscreen,resizable,dialog=no", null);
      dlg.addEventListener("post-load", func, false);
    }
  },

  /**
   * Opens a URL in the browser window. If browser window isn't passed as parameter,
   * this function attempts to find a browser window.
   */
  loadInBrowser: function(/**String*/ url, /**Window*/ currentWindow)
  {
    currentWindow = currentWindow ||
                    windowMediator.getMostRecentWindow("navigator:browser");
    function tryWindowMethod(method, parameters) {
      let obj = currentWindow;
      if (currentWindow && /^browser\.(.*)/.test(method)) {
        method = RegExp.$1;
        obj = glome.getBrowserInWindow(currentWindow);
      }

      if (!obj)
        return false;

      try {
        obj[method].apply(obj, parameters);
      } catch(e) {
        return false;
      }

      try {
        currentWindow.focus();
      } catch(e) {}
      
      return true;
    }

    if (tryWindowMethod("delayedOpenTab", [url]))
      return;
    if (tryWindowMethod("browser.addTab", [url, null, null, true]))
      return;
    if (tryWindowMethod("openUILinkIn", [url, "tab"]))
      return;
    if (tryWindowMethod("loadURI", [url]))
      return;

    var protocolService = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
                                    .getService(Ci.nsIExternalProtocolService);
    protocolService.loadURI(makeURL(url), null);
  },

  /**
   * Retrieves the browser/tabbrowser element for the specified window (might return null).
   */
  getBrowserInWindow: function(/**Window*/ window)  /**Element*/
  {
    if ("getBrowser" in window)
      return window.getBrowser();
    else if ("messageContent" in window)
      return window.messageContent;
    else
      return window.document.getElementById("frame_main_pane") || window.document.getElementById("browser_content");
  },
  
  abp: {} 
};
glome.wrappedJSObject = glome;

/*
 * Core Routines
 */
// Initialization and registration
function init()
{
  initialized = true;
  glome.LOG("init() called");

  glome.versionComparator = Cc["@mozilla.org/xpcom/version-comparator;1"]
    .createInstance(Ci.nsIVersionComparator);
  
  // Common
  loader.loadSubScript('chrome://glome/content/utils.js');  
  
  // Glome related
  loader.loadSubScript('chrome://glome/content/prefs.js');
  loader.loadSubScript('chrome://glome/content/connection.js');
  loader.loadSubScript('chrome://glome/content/notifications.js');
  loader.loadSubScript('chrome://glome/content/adModals.js');
  
  // Adblock related
  loader.loadSubScript('chrome://glome/content/ab/interface.js');
  loader.loadSubScript('chrome://glome/content/ab/filterClasses.js');
  loader.loadSubScript('chrome://glome/content/ab/subscriptionClasses.js');
  loader.loadSubScript('chrome://glome/content/ab/filterStorage.js');
  loader.loadSubScript('chrome://glome/content/ab/matcher.js');
  loader.loadSubScript('chrome://glome/content/ab/elemhide.js');
  loader.loadSubScript('chrome://glome/content/ab/filterListener.js');
  loader.loadSubScript('chrome://glome/content/ab/protocol.js');
  loader.loadSubScript('chrome://glome/content/ab/policy.js');
  loader.loadSubScript('chrome://glome/content/ab/data.js');
  loader.loadSubScript('chrome://glome/content/ab/prefs.js');
  loader.loadSubScript('chrome://glome/content/ab/synchronizer.js');
  loader.loadSubScript('chrome://glome/content/ab/flasher.js');
  
  glome.LOG("init() done");
};

function fixPackageLocale(package_name)
{
  try
  {
    var locale = "en-US";
    try
    {
      var branch = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefBranch);
      try
      {
        var complex = branch.getComplexValue("general.useragent.locale", Components.interfaces.nsIPrefLocalizedString);
        locale = complex.data;
      }
      catch (e)
      {
        locale = branch.getCharPref("general.useragent.locale");
      }
    } catch (e) {}

    var select = null;
    for (var i = 0; i < locales.length; i++)
    {
      if (!locales[i])
        continue;

      if (locales[i] == locale)
      {
        select = locales[i];
        break;
      }

      if (locales[i].substr(0, 2) == locale.substr(0, 2))
        select = locales[i];
    }
    if (!select)
      select = locales[0];

    var registry = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
                             .getService(Components.interfaces.nsIChromeRegistrySea);
    registry.selectLocaleForPackage(select, package_name, true);
  } catch(e) {}
}
