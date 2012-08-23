/*
 * Manages Glome preferences.
 * This file is included from nsGlome.js.
 */

const prefRoot = "extensions.glome.";

var gObjtabClass = ""
for (let i = 0; i < 20; i++)
  gObjtabClass += String.fromCharCode("a".charCodeAt(0) + Math.random() * 26);

var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefService);

var ScriptableInputStream = Components.Constructor("@mozilla.org/scriptableinputstream;1", "nsIScriptableInputStream", "init");

var prefs =
{
  lastVersion: null,
  initialized: false,
  disableObserver: false,
  privateBrowsing: false,
  branch: prefService.getBranch(prefRoot),
  prefList: [],
  listeners: [],
  
  /**
   * Disable Glome for the requested domain
   * 
   * @param string domain    Domain name
   */
  disableForDomain: function(domain)
  {
    domains = this.getDomains();
    
    // Add domain if it isn't already on the list
    if (domains.indexOf(domain) == -1)
    {
      domains.push(domain);
      this.sitesDisabled = domains.toString().replace(/^,/, '');
      this.save();
    }
    
    return true;
  },
  
  /**
   * Enable Glome for the requested domain
   * 
   * @param string domain    Domain name
   */
  enableForDomain: function(domain)
  {
    var tmp = new Array();
    domains = this.getDomains();
    //domains.push(domain);
    
    for (var i = 0; i < domains.length; i++)
    {
      // Remove the current domain from the list
      if (domains[i].toLowerCase() == domain.toLowerCase())
      {
        continue;
      }
      
      // Do a bit of housekeeping and clean duplicates or non-domain names already
      if (   tmp.indexOf(domains[i]) >= 0
          || !domains[i]
          || !domains[i].toLowerCase().match(/^[a-z0-9\-_\.]+$/))
      {
        continue;
      }
      
      tmp.push(domains[i].toLowerCase());
    }
    
    this.sitesDisabled = tmp.toString();
    this.save();
    
    return true;
  },
  
  /**
   * Get the status of the current domain
   * 
   * @param string domain
   * @return string        'on' if the domain is disabled, 'off' if it is not
   */
  getDomainStatus: function(domain)
  {
    if (!domain)
    {
      return 'undefined';
    }
    
    if (this.getDomains().indexOf(domain) == -1)
    {
      return 'off';
    }
    else
    {
      return 'on';
    }
  },
  
  /**
   * Get a full list of disabled domains
   * 
   * @param string domain
   * @return boolean        True if the domain is disabled, false if it is not
   */
  getDomains: function()
  {
    return this.sitesDisabled.split(',');
  },

  addObservers: function()
  {
    // Observe preferences changes
    try
    {
      var branchInternal = this.branch.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
      branchInternal.addObserver("", this, true);
    }
    catch (e)
    {
      dump("Glome: exception registering pref observer: " + e + "\n");
    }

    var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);

    // Observe profile changes
    try
    {
      observerService.addObserver(this, "profile-before-change", true);
      observerService.addObserver(this, "profile-after-change", true);
    }
    catch (e)
    {
      dump("Glome: exception registering profile observer: " + e + "\n");
    }

    // Add Private Browsing observer
    if ("@mozilla.org/privatebrowsing;1" in Components.classes)
    {
      try
      {
        this.privateBrowsing = Components.classes["@mozilla.org/privatebrowsing;1"]
          .getService(Components.interfaces.nsIPrivateBrowsingService)
          .privateBrowsingEnabled;
        
        observerService.addObserver(this, "private-browsing", true);
      }
      catch(e)
      {
        dump("Glome: exception initializing private browsing observer: " + e + "\n");
      }
    }

    this.observe(null, "profile-after-change", null);
  },

  init: function()
  {
    // Try to fix selected locale in Mozilla/SeaMonkey
    strings = stringService.createBundle("chrome://glome/locale/global.properties");
    fixPackageLocale("glome");
    strings = stringService.createBundle("chrome://glome/locale/global.properties");

    // Initialize prefs list
    var defaultBranch = prefService.getDefaultBranch(prefRoot);
    var defaultPrefs = defaultBranch.getChildList("", {});
    var types = {};
    types[defaultBranch.PREF_INT] = "Int";
    types[defaultBranch.PREF_BOOL] = "Bool";

    this.prefList = [];
    for each (var name in defaultPrefs)
    {
      var type = defaultBranch.getPrefType(name);
      var typeName = (type in types ? types[type] : "Char");

      try
      {
        var pref = [name, typeName, defaultBranch["get" + typeName + "Pref"](name)];
        this.prefList.push(pref);
        this.prefList[" " + name] = pref;
      }
      catch(e)
      {}
    }

    // Initial prefs loading
    this.reload();

    // Update lastVersion pref if necessary
    this.lastVersion = this.currentVersion;
    if (this.currentVersion != glome.getInstalledVersion())
    {
      this.currentVersion = glome.getInstalledVersion();
      this.save();
    }
    
    //filterStorage.loadFromDisk();
    //policy.init();
  },

  // Loads a pref and stores it as a property of the object
  loadPref: function(pref)
  {
    try
    {
      this[pref[0]] = this.branch["get" + pref[1] + "Pref"](pref[0]);
    }
    catch (e)
    {
      // Use default value
      this[pref[0]] = pref[2];
    }
  },

  // Saves a property of the object into the corresponding pref
  savePref: function(pref)
  {
    try
    {
      this.branch["set" + pref[1] + "Pref"](pref[0], this[pref[0]]);
    }
    catch (e)
    {}
  },

  // Reloads the preferences
  reload: function() {
    // Load data from prefs.js
    for each (var pref in this.prefList)
      this.loadPref(pref);

    //elemhide.apply();

    // Fire pref listeners
    for each (var listener in this.listeners)
      listener(this);
  },

  // Saves the changes back into the prefs
  save: function() {    
    this.disableObserver = true;
  
    for each (var pref in this.prefList)
      this.savePref(pref);

    this.disableObserver = false;

    // Make sure to save the prefs on disk (and if we don't - at least reload the prefs)
    try
    {
      prefService.savePrefFile(null);
    }
    catch(e)
    {}
    
    this.reload();
  },

  addListener: function(handler)
  {
    this.listeners.push(handler);
  },

  removeListener: function(handler)
  {
    for (var i = 0; i < this.listeners.length; i++)
    {
      if (this.listeners[i] == handler)
      {
        this.listeners.splice(i--, 1);
      }
    }
  },

  // nsIObserver implementation
  observe: function(subject, topic, prefName)
  {
    if (topic == "profile-after-change")
    {
      this.init();
      this.initialized = true;
    }
    else if (this.initialized && topic == "profile-before-change")
    {
      //filterStorage.saveToDisk();
      this.initialized = false;
    }
    else if (topic == "private-browsing")
    {
      if (prefName == "enter")
      {
        this.privateBrowsing = true;
      }
      else if (prefName == "exit")
      {
        this.privateBrowsing = false;
      }
    }
    else if (this.initialized && !this.disableObserver)
    {
      this.reload();
    }
  },

  // nsISupports implementation
  QueryInterface: function(iid)
  {
    if (!iid.equals(Components.interfaces.nsISupports) &&
        !iid.equals(Components.interfaces.nsISupportsWeakReference) &&
        !iid.equals(Components.interfaces.nsIObserver))
    {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }

    return this;
  }
};

prefs.addObservers();
glome.prefs = prefs;
