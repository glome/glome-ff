"use strict";

var gGlomeDashboardView = {
  node: null,
  enabled: true,
  // Set to true after the view is first shown. If initialization completes
  // after this then it must also load the discover homepage
  loaded: false,
  _browser: null,
  _loading: null,
  _error: null,
  homepageURL: null,
  _loadListeners: [],

  initialize: function() {
    console.log('gGlomeDashboardView::initialize');
    
    this.node = document.getElementById("glome-view");
    
    this._container = document.getElementById("glome-dashboard-container");
    
    // this._loading = document.getElementById("glome-loading");
    // this._browser = document.getElementById("glome-browser");
    
    var url = Cc["@mozilla.org/toolkit/URLFormatterService;1"]
                .getService(Ci.nsIURLFormatter)
                .formatURLPref('http://glome.me');
    // console.log('url',url);
    var self = this;

    function setURL(aURL) {
      console.log('setURL',aURL);
      try {
        self.homepageURL = Services.io.newURI(aURL, null, null);
      } catch (e) {
        self.showError();
        notifyInitialized();
        return;
      }

      self._browser.homePage = self.homepageURL.spec;
      self._browser.addProgressListener(self, Ci.nsIWebProgress.NOTIFY_ALL |
                                              Ci.nsIWebProgress.NOTIFY_STATE_ALL);

      if (self.loaded)
        self._loadURL(self.homepageURL.spec, false, notifyInitialized);
      else
        notifyInitialized();
    }
    
    //setURL(url);
    //setURL('http://glome.me');
  },

  show: function(aParam, aRequest, aState, aIsRefresh) {
    glome.LOG('Show dashboard');
    return;
    console.log('gGlomeDashboardView::show',aState);
    gViewController.updateCommands();
    
    // If we're being told to load a specific URL then just do that
    if (aState && "url" in aState) {
      console.log('gGlomeDashboardView - loaded');
      this.loaded = true;
      this._loadURL(aState.url);
    }

    // If the view has loaded before and still at the homepage (if refreshing),
    // and the error page is not visible then there is nothing else to do
    // if (this.loaded && this.node.selectedPanel != this._error &&
    //     (!aIsRefresh || (this._browser.currentURI &&
    //      this._browser.currentURI.spec == this._browser.homePage))) {
    //   gViewController.notifyViewChanged();
    //   console.log('gGlomeDashboardView - gViewController.notifyViewChanged');
    //   return;
    // }

    this.loaded = true;

    // No homepage means initialization isn't complete, the browser will get
    // loaded once initialization is complete
    if (!this.homepageURL) {
      console.log('gGlomeDashboardView - !this.homepageURL');
      this._loadListeners.push(gViewController.notifyViewChanged.bind(gViewController));
      return;
    }

    this._loadURL(this.homepageURL.spec, aIsRefresh,
                  gViewController.notifyViewChanged.bind(gViewController));
  },
  
  canRefresh: function() {
    glome.log('canRefresh');
    if (this._browser.currentURI &&
        this._browser.currentURI.spec == this._browser.homePage)
      return false;
    return true;
  },

  refresh: function(aParam, aRequest, aState) {
    console.log('gGlomeDashboardView::refresh');
    this.show(aParam, aRequest, aState, true);
  },

  hide: function() { },

  showError: function() {
    console.log('gGlomeDashboardView::showError',this._error);
    //this.node.selectedPanel = this._error;
  },

  _loadURL: function(aURL, aKeepHistory, aCallback) {
    console.log('gGlomeDashboardView::_loadURL',aURL);
    if (this._browser.currentURI.spec == aURL) {
      if (aCallback)
        aCallback();
      return;
    }

    if (aCallback)
      this._loadListeners.push(aCallback);

    var flags = 0;

    this._browser.loadURIWithFlags(aURL, flags);
  },

  onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags) {
    console.log('gGlomeDashboardView::onLocationChange',aLocation.spec);
    // Ignore the about:blank load
    if (aLocation.spec == "about:blank")
      return;

    gViewController.updateCommands();
    
    // If the hostname is the same as the new location's host and either the
    // default scheme is insecure or the new location is secure then continue
    // with the load
    // if (aLocation.host == this.homepageURL.host &&
    //     (!this.homepageURL.schemeIs("https") || aLocation.schemeIs("https")))
    //   return;

    // Canceling the request will send an error to onStateChange which will show
    // the error page
    //aRequest.cancel(Components.results.NS_BINDING_ABORTED);
  },

  onSecurityChange: function(aWebProgress, aRequest, aState) {
    glome.log('onSecurityChange');
    return;
    // Don't care about security if the page is not https
    if (!this.homepageURL.schemeIs("https"))
      return;

    // If the request was secure then it is ok
    // if (aState & Ci.nsIWebProgressListener.STATE_IS_SECURE)
    //   return;

    // Canceling the request will send an error to onStateChange which will show
    // the error page
    aRequest.cancel(Components.results.NS_BINDING_ABORTED);
  },

  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    glome.log('onStateChange');
    // Only care about the network events
    if (!(aStateFlags & (Ci.nsIWebProgressListener.STATE_IS_NETWORK)))
      return;
    
    // If this is the start of network activity then show the loading page
    if (aStateFlags & (Ci.nsIWebProgressListener.STATE_START))
      this.node.selectedPanel = this._loading;
    
    // Ignore anything except stop events
    if (!(aStateFlags & (Ci.nsIWebProgressListener.STATE_STOP)))
      return;
    
    // Consider the successful load of about:blank as still loading
    if (aRequest instanceof Ci.nsIChannel && aRequest.URI.spec == "about:blank")
      return;
    
    // If there was an error loading the page or the new hostname is not the
    // same as the default hostname or the default scheme is secure and the new
    // scheme is insecure then show the error page
    const NS_ERROR_PARSED_DATA_CACHED = 0x805D0021;
    if (!(Components.isSuccessCode(aStatus) || aStatus == NS_ERROR_PARSED_DATA_CACHED) ||
        (aRequest && aRequest instanceof Ci.nsIHttpChannel && !aRequest.requestSucceeded)) {
      this.showError();
    } else {
      // Got a successful load, make sure the browser is visible
      this.node.selectedPanel = this._browser;
      gViewController.updateCommands();
    }
    
    var listeners = this._loadListeners;
    this._loadListeners = [];
    
    listeners.forEach(function(aListener) {
      aListener();
    });
  },

  onProgressChange: function() { },
  onStatusChange: function() { },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener,
                                         Ci.nsISupportsWeakReference]),

  getSelectedAddon: function() null
};


var GlomeDashboard = {
  onLoad: function(event) {
    // initialization code
    LOG('GLOME - initialize dashboard');

    if (event.target instanceof XMLStylesheetProcessingInstruction) {
      console.log('XMLStylesheetProcessingInstruction');
      return;
    }
    document.removeEventListener("load", GlomeDashboard.onLoad, true);

    this.initialized = true;

    this.node = document.getElementById("categories");
    LOG('categories node');
    LOG(this.node);
    
    this.viewPort = document.getElementById("view-port");
    
    //this.bindToCategory();
    gViewController.viewObjects["glome"] = gGlomeDashboardView;
    //gViewController.viewObjects["glome"].initialize();
    // console.log('gViewController.viewObjects',gViewController.viewObjects);
  },
  
  bindToCategory: function(event) {
    LOG('bindToCategory');
    var self = this;
    
    this.node.addEventListener("select", function() {
      console.log('select',self.node.selectedItem.value);
      var view = gViewController.parseViewId(self.node.selectedItem.value);
      console.log('gViewController.parseViewId',view);
      if (!view.type || !(view.type in gViewController.viewObjects))
        console.log("Invalid view: " + view.type);
        
      console.log('gViewController.currentViewId',gViewController.currentViewId);
      console.log('gViewController.currentViewObj',gViewController.currentViewObj);
    }, false);

    this.node.addEventListener("click", function(aEvent) {
      var selectedItem = self.node.selectedItem;
      console.log('click',self.node.selectedItem.value);
      console.log('aEvent.target.localName',aEvent.target.localName);
      console.log('selectedItem.value',selectedItem.value);
    }, false);
  }
};


function initialize(event) {
  LOG('GLOME - initialize extensions');
  // XXXbz this listener gets _all_ load events for all nodes in the
  // document... but relies on not being called "too early".
  // if (event.target instanceof XMLStylesheetProcessingInstruction) {
  //   return;
  // }
  //document.removeEventListener("load", initialize, true);
  
  // LOG('document');
  // LOG(document);
  dump(document);
  var node = document.getElementById("categories");
  LOG('categories node');
  LOG(node);
}

//document.addEventListener("load", initialize, false);
window.addEventListener("load", function (event) { GlomeDashboard.onLoad(event); }, true);

function LOG(text)
{    
  if (typeof console != undefined)
  {
    console.log(text + ' (' + typeof text + ')');
  }
  else
  {
    Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService).logStringMessage(text);
  }
}
