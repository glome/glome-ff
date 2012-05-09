var glome = null;

try {
  glome = Components.classes["@glome.me/glome-ext;1"].createInstance().wrappedJSObject;
  if (!glome.prefs.initialized || !glome.abp.prefs.initialized)
    glome = null;
} catch (e) {
  dump("GET GLOME EXCEPTION");
  dump(e);
}

var glomePrefs = glome ? glome.prefs : {enabled: false};
var glomeOldShowInToolbar = glomePrefs.showintoolbar;
var glomeHideImageManager;
var glomeAbpHideImageManager;

/**
 * List of event handers to be registered. For each event handler the element ID,
 * event and the actual event handler are listed.
 * @type Array
 */
let eventHandlers = [
  ["glome-tooltip", "popupshowing", glomeFillTooltip],
  // ["glome-status-popup", "popupshowing", glomeFillPopup],
  // ["glome-toolbar-popup", "popupshowing", glomeFillPopup],
  ["glome-command-settings", "command", function() { glome.openSettingsDialog(); }],
  // ["glome-command-sidebar", "command", glomeToggleSidebar],
  // ["glome-command-togglesitewhitelist", "command", function() { toggleFilter(siteWhitelist); }],
  // ["glome-command-togglepagewhitelist", "command", function() { toggleFilter(pageWhitelist); }],
  // ["glome-command-toggleobjtabs", "command", function() { glomeTogglePref("frameobjects"); }],
  // ["glome-command-togglecollapse", "command", function() { glomeTogglePref("fastcollapse"); }],
  // ["glome-command-toggleshowintoolbar", "command", function() { glomeTogglePref("showintoolbar"); }],
  // ["glome-command-toggleshowinstatusbar", "command", function() { glomeTogglePref("showinstatusbar"); }],
  // ["glome-command-enable", "command", function() { glomeTogglePref("enabled"); }]//,
  ["glome-status", "click", glomeClickHandler]//,
  // ["glome-toolbarbutton", "command", function(event) { if (event.eventPhase == event.AT_TARGET) glomeCommandHandler(event); }],
  // ["glome-toolbarbutton", "click", function(event) { if (event.eventPhase == event.AT_TARGET && event.button == 1) glomeTogglePref("enabled"); }],
  // ["glome-image-menuitem", "command", function() { glomeNode(backgroundData || nodeData); }],
  // ["glome-object-menuitem", "command", function() { glomeNode(nodeData); }],
  // ["glome-frame-menuitem", "command", function() { glomeNode(frameData); }]
];

function E(id)
{
  return document.getElementById(id);
}

function glomeInit() {
  glome.LOG("glomeInit");
  
  // Process preferences
  window.glomeDetachedSidebar = null;
  glomeReloadPrefs();
  
  if (glome) {
    // Register event listeners
    window.addEventListener("unload", glomeUnload, false);
    for each (let [id, event, handler] in eventHandlers) {
      let element = E(id);
      if (element)
        element.addEventListener(event, handler, false);
    }
    
    // Load jQuery. This needs window event so loading jQuery in extensions doesn't work
    // at least at the moment
    try
    {
      // Load jQuery core
      glome.LOG('load jQuery');
      var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
      loader.loadSubScript("chrome://glome/content/jQuery/jquery-1.7.2.min.js", window);
      
      glome.jQuery = window.jQuery.noConflict(true);
      glome.window = window;
      
      // Load jQuery timers
      loader.loadSubScript("chrome://glome/content/jQuery/jquery.timers.src.js", glome);
    }
    catch(e)
    {
      glome.LOG('Exception caught when loading jQuery: ' + e.message);
    }
    
    // Make sure whitelisting gets displayed after at most 2 seconds
    prefReloadTimer = glome.createTimer(glomeReloadPrefs, 2000);
    prefReloadTimer.type = prefReloadTimer.TYPE_REPEATING_SLACK;
    
    // Make sure we always configure keys but don't let them break anything
    try {
      // Configure keys
      for (var key in glomePrefs)
        if (key.match(/(.*)_key$/))
          glomeConfigureKey(RegExp.$1, glomePrefs[key]);
    } catch(e) {}
  }

  // Install context menu handler
  var contextMenu = E("contentAreaContextMenu") || E("messagePaneContext") || E("popup_content");
  if (contextMenu) {
    contextMenu.addEventListener("popupshowing", glomeCheckContext, false);
  
    // Make sure our context menu items are at the bottom
    contextMenu.appendChild(E("glome-frame-menuitem"));
    contextMenu.appendChild(E("glome-object-menuitem"));
    contextMenu.appendChild(E("glome-image-menuitem"));
  }
  
  // First run actions
  if (glome && !("doneFirstRunActions" in glomePrefs) && glome.versionComparator.compare(glomePrefs.lastVersion, "0.0") <= 0)
  {
    glome.LOG("RUN FIRST ACTIONS");
    // Don't repeat first run actions if new window is opened
    glomePrefs.doneFirstRunActions = true;
  
    // Add Glome icon to toolbar if necessary
    glome.createTimer(glomeInstallInToolbar, 0);
  
    // Show subscriptions dialog if the user doesn't have any subscriptions yet
    //glome.createTimer(glomeShowSubscriptions, 0);
  }

  // Move toolbar button to a correct location in Mozilla
  var button = E("glome-toolbarbutton");
  if (button && button.parentNode.id == "nav-bar-buttons") {
    var ptf = E("bookmarks-ptf");
    ptf.parentNode.insertBefore(button, ptf);
  }

  // Copy the menu from status bar icon to the toolbar
  var fixId = function(node) {
    if (node.nodeType != node.ELEMENT_NODE)
      return node;
  
    if ("id" in node && node.id)
      node.id = node.id.replace(/glome-status/, "glome-toolbar");
  
    for (var child = node.firstChild; child; child = child.nextSibling)
      fixId(child);
  
    return node;
  };
  var copyMenu = function(to) {
    if (!to || !to.firstChild)
      return;
  
    to = to.firstChild;
    var from = E("glome-status-popup");
    for (var node = from.firstChild; node; node = node.nextSibling)
      to.appendChild(fixId(node.cloneNode(true)));
  };
  copyMenu(E("glome-toolbarbutton"));
  copyMenu(glomeGetPaletteButton());
  
  // glome.createTimer(glomeInitImageManagerHiding, 0);
  
  // Dummy notif test
  let opts = {
      // Available display types for this particular ad. This will later on reflect on the
      // user preferences on ad display method. At the moment the first value is used.
      types: [
          'remote',
          'local'
      ],
      frameSrc: 'http://www.google.com/',
      mediaType: 'image',
      mediaSrc: 'https://www.google.com/logos/2012/Howard_Carter-2012-res.png',
      onYes: function(opts)
      {
        glome.LOG('notification - onYes clicked!');
        glome.LOG('OPEN AD MODAL');
        let modal = glome.adModals.create(1, this.opts);
        modal.show();
      }
  };
  let notif = glome.notifications.create('Audi would like to take you on a test drive, interested?', 1, opts);
  notif.show();
  
  glome.connection.open();
  glome.connection.sendTest();
  
  glome.LOG("glomeInit done");
};

function glomeUnload() {
  //glome.LOG("glomeUnload");
  glomePrefs.removeListener(glomeReloadPrefs);
  glome.getBrowserInWindow(window).removeEventListener("select", glomeReloadPrefs, false); 
  prefReloadTimer.cancel();
}

function glomeReloadPrefs() {
  //glome.LOG("glomeReloadPrefs");
  
  var label;
  var state = null;
  if (glome) {
    if (glomePrefs.enabled)
      state = "active";
    else
      state = "disabled";
  
    label = glome.getString("status_" + state + "_label");
    if (state == "active") {
      let location = getCurrentLocation();
      // if (location && glome.abp.policy.isWhitelisted(location.spec))
      //   state = "whitelisted";
    }
  }

  var tooltip = E("glome-tooltip");
  if (state && tooltip)
    tooltip.setAttribute("curstate", state);

  var updateElement = function(element) {
    if (!element)
      return;
  
    if (glome) {
      element.removeAttribute("disabled");
  
      if (element.tagName == "statusbarpanel" || element.tagName == "vbox") {
        element.hidden = !glomePrefs.showinstatusbar;
  
        var labelElement = element.getElementsByTagName("label")[0];
        labelElement.setAttribute("value", label);
      }
      else
        element.hidden = !glomePrefs.showintoolbar;
  
      if (glomeOldShowInToolbar != glomePrefs.showintoolbar)
        glomeInstallInToolbar();
      
      glomeOldShowInToolbar = glomePrefs.showintoolbar;
    }
  
    element.removeAttribute("deactivated");
    element.removeAttribute("whitelisted");
    if (state == "whitelisted")
      element.setAttribute("whitelisted", "true");
    else if (state == "disabled")
      element.setAttribute("deactivated", "true");
  };

  var status = E("glome-status");
  updateElement(status);
  if (glomePrefs.defaultstatusbaraction == 0)
    status.setAttribute("popup", status.getAttribute("context"));
  else
    status.removeAttribute("popup");

  var button = E("glome-toolbarbutton");
  updateElement(button);
  
  if (button) {
    if (button.hasAttribute("context") && glomePrefs.defaulttoolbaraction == 0) {
      button.setAttribute("popup", button.getAttribute("context"));
      button.removeAttribute("type");
    }
    else
      button.removeAttribute("popup");
  }
  
  updateElement(glomeGetPaletteButton());
  
  //glome.LOG("glomeReloadPrefs done");
};

/**
 * Retrieves the current location of the browser (might return null on failure).
 */
function getCurrentLocation() /**nsIURI*/
{
  // Regular browser
  return glome.unwrapURL(glome.getBrowserInWindow(window).contentWindow.location.href);
};

// Finds the toolbar button in the toolbar palette
function glomeGetPaletteButton() {
  //glome.LOG("glomeGetPaletteButton");
  var toolbox = E("navigator-toolbox");
  if (!toolbox || !("palette" in toolbox) || !toolbox.palette)
    return null;

  for (var child = toolbox.palette.firstChild; child; child = child.nextSibling)
    if (child.id == "glome-toolbarbutton")
      return child;

  return null;
}

// Check whether we installed the toolbar button already
function glomeInstallInToolbar() {
  //glome.LOG("glomeInstallInToolbar");
  
  if (!E("glome-toolbarbutton")) {
    var insertBeforeBtn = null;
    var toolbar = E("nav-bar");

    if (toolbar && "insertItem" in toolbar) {
      var insertBefore = (insertBeforeBtn ? E(insertBeforeBtn) : null);
      if (insertBefore && insertBefore.parentNode != toolbar)
        insertBefore = null;

      toolbar.insertItem("glome-toolbarbutton", insertBefore, null, false);

      toolbar.setAttribute("currentset", toolbar.currentSet);
      document.persist(toolbar.id, "currentset");
    }
  }
}

// Hides the unnecessary context menu items on display
function glomeCheckContext() {
  //glome.LOG("glomeCheckContext");
  
  var contextMenu = E("contentAreaContextMenu") || E("messagePaneContext") || E("popup_content");
  var target = document.popupNode;

  var nodeType = null;
  backgroundData = null;
  frameData = null;
  if (glome && target) {
    // Lookup the node in our stored data
    var data = glome.getDataForNode(target);
    var targetNode = null;
    if (data) {
      targetNode = data[0];
      data = data[1];
    }
    nodeData = data;
    if (data && !data.filter)
      nodeType = data.typeDescr;

    var wnd = (target ? target.ownerDocument.defaultView : null);
    var wndData = (wnd ? glome.getDataForWindow(wnd) : null);

    if (wnd.frameElement)
      frameData = glome.getDataForNode(wnd.frameElement, true);
    if (frameData)
      frameData = frameData[1];
    if (frameData && frameData.filter)
      frameData = null;

    if (nodeType != "IMAGE") {
      // Look for a background image
      var imageNode = target;
      while (imageNode && !backgroundData) {
        if (imageNode.nodeType == imageNode.ELEMENT_NODE) {
          var bgImage = null;
          var style = wnd.getComputedStyle(imageNode, "");
          bgImage = glomeImageStyle(style, "background-image") || glomeImageStyle(style, "list-style-image");
          if (bgImage) {
            backgroundData = wndData.getLocation(glome.abp.policy.type.BACKGROUND, bgImage);
            if (backgroundData && backgroundData.filter)
              backgroundData = null;
          }
        }

        imageNode = imageNode.parentNode;
      }
    }

    // Hide "Block Images from ..." if hideimagemanager pref is true and the image manager isn't already blocking something
    var imgManagerContext = E("context-blockimage");
    if (imgManagerContext) {
      if (typeof glomeAbpHideImageManager == "undefined")
        glomeAbpInitImageManagerHiding();
    
      // Don't use "hidden" attribute - it might be overridden by the default popupshowing handler
      imgManagerContext.style.display = (glomeAbpHideImageManager ? "none" : "");
    }
  }

  E("glome-image-menuitem").hidden = (nodeType != "IMAGE" && backgroundData == null);
  E("glome-object-menuitem").hidden = (nodeType != "OBJECT");
  E("glome-frame-menuitem").hidden = (frameData == null);
}

function glomeFillTooltip(event) {
  if (!document.tooltipNode || !document.tooltipNode.hasAttribute("tooltip"))
  {
    event.preventDefault();
    return;
  }

  glomeReloadPrefs();

  var type = (document.tooltipNode && document.tooltipNode.id == "glome-toolbarbutton" ? "toolbar" : "statusbar");
  var action = parseInt(glomePrefs["default" + type + "action"]);
  if (isNaN(action))
    action = -1;

  var actionDescr = E("glome-tooltip-action");
  actionDescr.hidden = (action < 0 || action > 3);
  if (!actionDescr.hidden)
    actionDescr.setAttribute("value", glome.getString("action" + action + "_tooltip"));

  var state = event.target.getAttribute("curstate");
  var statusDescr = E("glome-tooltip-status");
  statusDescr.setAttribute("value", glome.getString(state + "_tooltip"));

  var activeFilters = [];
  E("glome-tooltip-blocked-label").hidden = (state != "active");
  E("glome-tooltip-blocked").hidden = (state != "active");
  if (state == "active") {
    var data = glome.getDataForWindow(glome.getBrowserInWindow(window).contentWindow);
    var locations = data.getAllLocations();

    var blocked = 0;
    var filterCount = {__proto__: null};
    for (i = 0; i < locations.length; i++) {
      if (locations[i].filter && !(locations[i].filter instanceof glome.WhitelistFilter))
        blocked++;
      if (locations[i].filter) {
        if (locations[i].filter.text in filterCount)
          filterCount[locations[i].filter.text]++;
        else
          filterCount[locations[i].filter.text] = 1;
      }
    }

    var blockedStr = glome.getString("blocked_count_tooltip");
    blockedStr = blockedStr.replace(/--/, blocked).replace(/--/, locations.length);
    E("glome-tooltip-blocked").setAttribute("value", blockedStr);

    var filterSort = function(a, b) {
      return filterCount[b] - filterCount[a];
    };
    for (var filter in filterCount)
      activeFilters.push(filter);
    activeFilters = activeFilters.sort(filterSort);
  }

  E("glome-tooltip-filters-label").hidden = (activeFilters.length == 0);
  E("glome-tooltip-filters").hidden = (activeFilters.length == 0);
  if (activeFilters.length > 0) {
    var filtersContainer = E("glome-tooltip-filters");
    while (filtersContainer.firstChild)
      filtersContainer.removeChild(filtersContainer.firstChild);

    for (var i = 0; i < activeFilters.length && i < 3; i++) {
      var descr = document.createElement("description");
      descr.setAttribute("value", activeFilters[i] + " (" + filterCount[activeFilters[i]] + ")");
      filtersContainer.appendChild(descr);
    }
    if (activeFilters.length > 3) {
      var descr = document.createElement("description");
      descr.setAttribute("value", "...");
      filtersContainer.appendChild(descr);
    }
  }
}

// Fills the context menu on the status bar
// function glomeFillPopup(event) {
//   let popup = event.target;
// 
//   // Not at-target call, ignore
//   if (popup.getAttribute("id").indexOf("options") >= 0)
//     return;
// 
//   // Need to do it this way to prevent a Gecko bug from striking
//   var elements = {};
//   var list = popup.getElementsByTagName("menuitem");
//   for (var i = 0; i < list.length; i++)
//     if (list[i].id && /\-(\w+)$/.test(list[i].id))
//       elements[RegExp.$1] = list[i];
// 
//   var sidebarOpen = abpIsSidebarOpen();
//   elements.opensidebar.hidden = sidebarOpen;
//   elements.closesidebar.hidden = !sidebarOpen;
// 
//   var whitelistItemSite = elements.whitelistsite;
//   var whitelistItemPage = elements.whitelistpage;
//   whitelistItemSite.hidden = whitelistItemPage.hidden = true;
// 
//   var whitelistSeparator = whitelistItemPage.nextSibling;
//   while (whitelistSeparator.nodeType != whitelistSeparator.ELEMENT_NODE)
//     whitelistSeparator = whitelistSeparator.nextSibling;
// 
//   let location = getCurrentLocation();
//   if (location && abp.policy.isBlockableScheme(location))
//   {
//     let host = null;
//     try
//     {
//       host = location.host;
//     } catch (e) {}
// 
//     if (host)
//     {
//       let ending = "|";
//       if (location instanceof Components.interfaces.nsIURL && location.ref)
//         location.ref = "";
//       if (location instanceof Components.interfaces.nsIURL && location.query)
//       {
//         location.query = "";
//         ending = "?";
//       }
// 
//       siteWhitelist = abp.Filter.fromText("@@|" + location.prePath + "/");
//       whitelistItemSite.setAttribute("checked", isUserDefinedFilter(siteWhitelist));
//       whitelistItemSite.setAttribute("label", whitelistItemSite.getAttribute("labeltempl").replace(/--/, host));
//       whitelistItemSite.hidden = false;
// 
//       pageWhitelist = abp.Filter.fromText("@@|" + location.spec + ending);
//       whitelistItemPage.setAttribute("checked", isUserDefinedFilter(pageWhitelist));
//       whitelistItemPage.hidden = false;
//     }
//     else
//     {
//       siteWhitelist = abp.Filter.fromText("@@|" + location.spec + "|");
//       whitelistItemSite.setAttribute("checked", isUserDefinedFilter(siteWhitelist));
//       whitelistItemSite.setAttribute("label", whitelistItemSite.getAttribute("labeltempl").replace(/--/, location.spec.replace(/^mailto:/, "")));
//       whitelistItemSite.hidden = false;
//     }
//   }
//   whitelistSeparator.hidden = whitelistItemSite.hidden && whitelistItemPage.hidden;
// 
//   elements.enabled.setAttribute("checked", abpPrefs.enabled);
//   elements.frameobjects.setAttribute("checked", abpPrefs.frameobjects);
//   elements.slowcollapse.setAttribute("checked", !abpPrefs.fastcollapse);
//   elements.showintoolbar.setAttribute("checked", abpPrefs.showintoolbar);
//   elements.showinstatusbar.setAttribute("checked", abpPrefs.showinstatusbar);
// 
//   var defAction = (popup.tagName == "menupopup" || document.popupNode.id == "abp-toolbarbutton" ? abpPrefs.defaulttoolbaraction : abpPrefs.defaultstatusbaraction);
//   elements.opensidebar.setAttribute("default", defAction == 1);
//   elements.closesidebar.setAttribute("default", defAction == 1);
//   elements.settings.setAttribute("default", defAction == 2);
//   elements.enabled.setAttribute("default", defAction == 3);
// }

// Handle clicks on the Adblock statusbar panel
function glomeClickHandler(e) {
  glome.LOG("glomeClickHandler e.button: "+e.button);
  if (e.button == 0)
    glomeExecuteAction(glomePrefs.defaultstatusbaraction);
  else if (e.button == 1)
    glomeTogglePref("enabled");
}

function glomeCommandHandler(e) {
  glome.LOG("glomeCommandHandler");
  if (glomePrefs.defaulttoolbaraction == 0)
    e.target.open = true;
  else
    glomeExecuteAction(glomePrefs.defaulttoolbaraction);
}

// Executes default action for statusbar/toolbar by its number
function glomeExecuteAction(action) {
  glome.LOG("glomeExecuteAction action: "+action);
  if (action == 1) {
    //glomeToggleSidebar();
  }    
  else if (action == 2)
    glome.openSettingsDialog();
  else if (action == 3)
    glomeTogglePref("enabled");
}

// Toggles the value of a boolean pref
function glomeTogglePref(pref) {
  glomePrefs[pref] = !glomePrefs[pref];
  glomePrefs.save();
}

// Bring up the settings dialog for the node the context menu was referring to
function glomeNode(data) {
  glome.LOG("glomeNode");
  if (glome && data)
    window.openDialog("chrome://adblockplus/content/composer.xul", "_blank", "chrome,centerscreen,resizable,dialog=no,dependent", glome.getBrowserInWindow(window).contentWindow, data);
}

/* Adblock Plus related */

function glomeAbpInitImageManagerHiding() {
  if (!abp || typeof glomeAbpHideImageManager != "undefined")
    return;

  glomeAbpHideImageManager = false;
  if (abpPrefs.hideimagemanager && "@mozilla.org/permissionmanager;1" in Components.classes) {
    try {
      glomeAbpHideImageManager = true;
      var permissionManager = Components.classes["@mozilla.org/permissionmanager;1"]
                                        .getService(Components.interfaces.nsIPermissionManager);
      var enumerator = permissionManager.enumerator;
      while (glomeAbpHideImageManager && enumerator.hasMoreElements()) {
        var item = enumerator.getNext().QueryInterface(Components.interfaces.nsIPermission);
        if (item.type == "image" && item.capability == Components.interfaces.nsIPermissionManager.DENY_ACTION)
          glomeAbpHideImageManager = false;
      }
    } catch(e) {}
  }
}

glomeInit();
