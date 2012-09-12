var glome = null;
var last_updated = null;
var request = null;
var glome_is_online = true;
var glome_ad_stack = new Array();;
var glome_ad_categories = {};

var page = 0;
var pages = 0;
var ad_id = 0;

var date = new Date();

// Set the last updated to the current moment
last_updated = date.getTime();

// Initialize XMLHttpRequest class
const { XMLHttpRequest } = Components.classes['@mozilla.org/appshell/appShellService;1'].getService(Components.interfaces.nsIAppShellService).hiddenDOMWindow;

// Set constants
const GLOME_AD_STATUS_UNINTERESTED = -2;
const GLOME_AD_STATUS_LATER = -1;
const GLOME_AD_STATUS_PENDING = 0;
const GLOME_AD_STATUS_VIEWED = 1;
const GLOME_AD_STATUS_CLICKED = 2;

// Initialize SQLite
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

// Update locally stored ad data
let file = FileUtils.getFile("ProfD", ["glome.sqlite"]);
let db = Services.storage.openDatabase(file); // Will also create the file if it does not exist

try
{
  glome = Components.classes["@glome.me/glome-ext;1"].createInstance().wrappedJSObject;
  
  if (!glome.prefs.initialized || !glome.abp.prefs.initialized)
  {
    glome = null;
  }
}
catch (e)
{
  dump("GET GLOME EXCEPTION");
  dump(e);
}

var glomePrefs = glome ? glome.prefs : {enabled: false};
var glomeOldShowInToolbar = glomePrefs.showintoolbar;
var glomeHideImageManager;
var glomeAbpHideImageManager;

glome.initialized = false;

/**
 * List of event handers to be registered. For each event handler the element ID,
 * event and the actual event handler are listed.
 * @type Array
 */
var log =
{
  debug: function(input)
  {
    this.output(input, 5);
  },
  info: function(input)
  {
    this.output(input, 4);
  },
  warning: function(input)
  {
    this.output(input, 3);
  },
  error: function(input)
  {
    this.output(input, 2);
  },
  output: function(input, level)
  {
    if (!level)
    {
      level = 5;
    }
    
    var type = String(typeof input);
    if (type.match(/(object|array)/))
    {
      glomeExtract(input);
    }
    else
    {
      dump(input + '\n');
    }
  }
}

function E(id)
{
  return document.getElementById(id);
}

function glomeInit()
{
  log.info("glomeInit");
  log.debug('-- start with the database');
  glomeInitDb();
  log.debug('-- database initialized');
  
  // Process preferences
  window.glomeDetachedSidebar = null;
  
  if (glome)
  {
    log.debug('Glome is defined, register unload event');
    // Register event listeners
    window.addEventListener("unload", glomeUnload, false);
    
    // Create reference to this
    window.glome = this;
  
    // Make sure whitelisting gets displayed after at most 2 seconds
    prefReloadTimer = glome.createTimer(glomeTimedUpdater, 2000);
    prefReloadTimer.type = prefReloadTimer.TYPE_REPEATING_SLACK;
    log.debug('Preferences loaded');
    
     // Make sure we always configure keys but don't let them break anything
    try
    {
      // Configure keys
      for (var key in glomePrefs)
      {
        log.debug('Set Glome preferences for ' + key);
        if (key.match(/(.*)_key$/))
        {
          glomeConfigureKey(RegExp.$1, glomePrefs[key]);
        }
      }
    }
    catch(e)
    {
      
    }
  }

  // Install context menu handler
  var contextMenu = E("contentAreaContextMenu") || E("messagePaneContext") || E("popup_content");
  if (contextMenu)
  {
    contextMenu.addEventListener("popupshowing", glomeCheckContext, false);
  
    // Make sure our context menu items are at the bottom
    contextMenu.appendChild(E("glome-frame-menuitem"));
    contextMenu.appendChild(E("glome-object-menuitem"));
    contextMenu.appendChild(E("glome-image-menuitem"));
  }
  
  
  // First run actions
  if (glome && !("doneFirstRunActions" in glomePrefs) && glome.versionComparator.compare(glomePrefs.lastVersion, "0.0") <= 0)
  {
    debug.info("RUN FIRST ACTIONS");
    // Don't repeat first run actions if new window is opened
    glomePrefs.doneFirstRunActions = true;
  }

  // Move toolbar button to a correct location in Mozilla
  var button = E("glome-toolbarbutton");
  
  if (button && button.parentNode.id == "nav-bar-buttons")
  {
    var ptf = E("bookmarks-ptf");
    ptf.parentNode.insertBefore(button, ptf);
  }

  // Copy the menu from status bar icon to the toolbar
  var fixId = function(node)
  {
    if (node.nodeType != node.ELEMENT_NODE)
    {
      return node;
    }
  
    if ("id" in node && node.id)
    {
      node.id = node.id.replace(/glome-status/, "glome-toolbar");
    }
  
    for (var child = node.firstChild; child; child = child.nextSibling)
    {
      fixId(child);
    }
  
    return node;
  };
  var copyMenu = function(to)
  {
    if (!to || !to.firstChild)
    {
      return;
    }
  
    to = to.firstChild;
    var from = E("glome-status-popup");
    for (var node = from.firstChild; node; node = node.nextSibling)
    {
      to.appendChild(fixId(node.cloneNode(true)));
    }
  };
  copyMenu(E("glome-toolbarbutton"));
  copyMenu(glomeGetPaletteButton());
  
  // glome.createTimer(glomeInitImageManagerHiding, 0);
  
  glome.connection.open();
  glome.connection.sendTest();
  
  // Run startup stuff
  glomeGetCategories();
  glomeFetchAds();
  glomeTimedUpdater();
  
  // Set timed updater
  window.setInterval
  (
    function()
    {
      var date = new Date();
      var ts = date.getTime();
      log.debug('glomeTimedUpdater called as interval');
      
      glomeTimedUpdater();
      
      var date = new Date();
      log.debug('-- done in ' + (date.getTime() - ts) + ' ms');
    },
    10 * 1000
  );
  
  // Set a long delay for ad retrieval. When debugging this should be minutes and
  // for production probably an hour
  window.setInterval
  (
    function()
    {
      var date = new Date();
      var ts = date.getTime();
      log.debug('glomeFetchAds called as interval');
      
      glomeFetchAds();
      
      var date = new Date();
      log.debug('-- done in ' + (date.getTime() - ts) + ' ms');
    },
    60 * 1000
  );
  
  // Refresh every now and then the list of categories
  window.setInterval
  (
    function()
    {
      var date = new Date();
      var ts = date.getTime();
      log.debug('glomeGetCategories called as interval');
      
      glomeGetCategories();
      
      var date = new Date();
      log.debug('-- done in ' + (date.getTime() - ts) + ' ms');
    },
    60 * 1000
  );
  
  debug.info("glomeInit done");
};

/**
 * Glome database initialization scripts
 */
function glomeInitDb()
{
  log.info('glomeInitDb starts'); 
  // Initialize database
  var tables =
  {
    categories: glomeGetTable('categories'),
    ads: glomeGetTable('ads'),
  }
  
  // Try to create and update tables
  for (tablename in tables)
  {
    // Table fields
    var table = tables[tablename];
    
    var q = 'DROP TABLE ' + tablename;
    log.debug(q);
    //db.executeSimpleSQL(q);
    log.debug('-- dropped');
    
    if (!db.tableExists(tablename))
    {
      try
      {
        var q = 'CREATE TABLE ' + tablename + ' (id INTEGER PRIMARY KEY)';
        log.debug(q);
        db.executeSimpleSQL(q);
        log.debug('-- created');
      }
      catch (e)
      {
        log.warning('Tried to create table with query ' + q + ' but ran into trouble and caught an exception');
        return;
      }
    }
    
    // Add columns to the table
    for (i in table)
    {
      // Skip ID as it is always created with the table
      if (i == 'id')
      {
        continue;
      }
      
      try
      {
        var q = 'ALTER TABLE ' + tablename + ' ADD COLUMN ' + i + ' ' + table[i];
        log.debug(q);
        db.executeSimpleSQL(q);
      }
      catch (e)
      {
        log.warning('Tried to create a new column to ' + tablename + ' with query ' + q + ' but caught an exception!');
      }
    }
  }
  
  log.info('Database initialized, prepare to fetch data from server');
  
  // @TODO: Verify that it is possible to make a connection
  
  // Update category data
  glome.request = new XMLHttpRequest();
  glome.request.timeout = 5000;
  glome.request.onreadystatechange = function(e)
  {
    if (e.originalTarget.readyState !== 4)
    {
      return;
    }
    
    log.debug('Got the results for ad categories JSON listing');
    data = JSON.parse(e.originalTarget.response);
    log.debug(data);
    
    // Add all of the categories to database
    for (i = 0; i < data.length; i++)
    {
      // Update categories
      var q = 'UPDATE categories SET name = :name WHERE id = :id';
      log.debug(q);
      var statement = db.createStatement(q);
      statement.params.id = data[i].id;
      statement.params.name = data[i].name;
      statement.executeAsync();
      log.debug('-- executeAsync called');
      
      // Insert into categories. Let SQLite to fix the issue of primary keyed rows, no need to check against them
      var q = 'INSERT INTO categories (id, name, subscribed) VALUES (:id, :name, 1)';
      log.debug(q);
      var statement = db.createStatement(q);
      statement.params.id = data[i].id;
      statement.params.name = data[i].name;
      statement.executeAsync();
      log.debug('-- executeAsync called');
      
      // @TODO: This needs a check to delete the removed categories as well
    }
    
    log.debug('-- updating ad categories finished');
  }
  
  log.debug('Created onreadystatechange');
  
  if (glome_is_online)
  {
    var url = 'http://api.glome.me/adcategories.json';
    log.info('Opening connection now to ' + url);
    glome.request.open('GET', url, true);
    glome.request.send();
    log.info('-- opened');
  }
  else
  {
    log.info('Glome is not online, do not fetch categories');
  }
  log.info('glomeInitDb ends'); 
}

function glomeInitPage(e)
{
  glomeTimedUpdater();
  glomeABPHideElements();
  return true;
}

/**
 * Get the currently viewed domain
 * 
 * @return string
 */
function glomeGetCurrentDomain()
{
  var current_url = window.top.getBrowser().selectedBrowser.contentWindow.location.href;
  
  // Do nothing for local pages
  if (current_url.match(/(about|chrome):/))
  {
    return null;
  }
  
  // Match the current domain
  return current_url.match(/^.+:\/\/(.+?)(\/.*$|$)/)[1];
}

function glomeUnload()
{
  //debug.info("glomeUnload");
  glomePrefs.removeListener(glomeTimedUpdater);
  glome.getBrowserInWindow(window).removeEventListener("select", glomeTimedUpdater, false); 
  prefReloadTimer.cancel();
}

function glomeExtract(object, levels, indent)
{
  if (!indent)
  {
    dump('--- DUMP starts: ---\n');
    indent = String('');
  }
  
  if (!levels)
  {
    levels = 2;
  }
  
  for (i in object)
  {
    dump(indent + i + ' (' + typeof object[i] + ')');
    
    switch (typeof object[i])
    {
      case 'object':
        // Prevent infinite chains
        if (object == object[i])
        {
          break;
        }
        
        dump('\n');
        
        if (indent.length < (levels - 1) * 2)
        {
          glomeExtract(object[i], levels, indent + '  ');
        }
        
        break;
      
      case 'function':
        dump('\n');
        break;
        // Do nothing
      
      default:
        dump(': ' + object[i] + '\n');
    }
  }
  
  if (   !indent
      || indent == '')
  {
    dump('--- DUMP ends ---\n');
  }
}

/**
 * Switch Glome on and off
 * 
 * @return boolean    Current Glome status
 */
function glomeSwitch()
{
  glomeTogglePref('enabled');
  return glomePrefs.enabled;
}

/**
 * Timed updating of Glome
 */
function glomeTimedUpdater()
{
  var label;
  var state = null;
  
  if (glome)
  {
    if (glomePrefs.enabled)
    {
      state = 'active';
    }
    else
    {
      state = 'disabled';
    }
    
    var domain = glomeGetCurrentDomain();
    
    if (!domain)
    {
      E('glome-switch-domain').setAttribute('domain', 'undefined');
    }
    
    // Glome is off for the currently viewed domain
    if (glomePrefs.getDomainStatus(glomeGetCurrentDomain()) == 'on')
    {
      state = 'disabled';
    }
    
    label = glome.getString('status_' + state + '_label');
    
    if (state == 'active')
    {
      let location = getCurrentLocation();
      // if (location && glome.abp.policy.isWhitelisted(location.spec))
      //   state = "whitelisted";
    }
  }
  
  // Set state to main window
  overlay = E('main-window');
  overlay.setAttribute('state', state);
  
  // Stop execution here if Glome is off
  if (state == 'disabled')
  {
    return;
  }
  
  glomeUpdateTicker();
};

/**
 * Update Glome ticker
 */
function glomeUpdateTicker()
{
  q = 'SELECT * FROM ads WHERE status = 0';
  let statement = db.createStatement(q);
  
  statement.executeAsync
  (
    {
      handleResult: function(results)
      {
        log.debug('-- got to handle the results of glomeUpdateTicker');
        let ads_table = glomeGetTable('ads');
        glome_ad_stack = new Array();
        let date = new Date();
        let now = date.getTime();
        
        for (let row = results.getNextRow(); row; row = results.getNextRow())
        {
          let item = {};
          
          for (i in ads_table)
          {
            switch (i)
            {
              case 'adcategories':
                item[i] = JSON.parse(row.getResultByName(i));
                break;
              
              default:
                item[i] = row.getResultByName(i);
            }
          }
          
          // Skip if the item has expired
          if (item.expired)
          {
            continue;
          }
          
          //dump('id: ' + item.id + ', expired: ' + item.expired + ', expires: ' + item.expires + '\n');
          
          let date = new Date(item.expires);
          //dump('-- as timestamp: ' + date.getTime() + '\n');
          
          if (date.getTime() < now)
          {
            continue;
          }
          
          var found = false;
          
          // Check if the item belongs to a category with subscription
          for (let n = 0; n < item.adcategories; n++)
          {
            let cat_id = item.adcategories[n];
            
            for (k in glome_ad_categories)
            {
              if (cat_id == k)
              {
                found = true;
                break;
              }
            }
            
            if (found)
            {
              break;
            }
          }
          
          // This ad wasn't in a category with a subscription
          if (!found)
          {
            continue;
          }
          
          // Populate ad stack
          let id = item[id];
          glome_ad_stack.push(item);
        }
      },
      handleCompletion: function(reason)
      {
        if (!glome_ad_stack.length)
        {
          E('glome-controls-icon-counter-value').hidden = true;
        }
        else
        {
          E('glome-controls-icon-counter-value').hidden = false;
        }
        
        E('glome-controls-icon-counter-value').setAttribute('value', glome_ad_stack.length);
      }
    }
  );
}

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
  var toolbox = E("navigator-toolbox");
  if (!toolbox || !("palette" in toolbox) || !toolbox.palette)
  {
    return null;
  }

  for (var child = toolbox.palette.firstChild; child; child = child.nextSibling)
  {
    if (child.id == "glome-toolbarbutton")
    {
      return child;
    }
  }

  return null;
}

// Check whether we installed the toolbar button already
function glomeInstallInToolbar() {
  if (!E("glome-toolbarbutton"))
  {
    var insertBeforeBtn = null;
    var toolbar = E("nav-bar");

    if (toolbar && "insertItem" in toolbar)
    {
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
function glomeCheckContext()
{
  var contextMenu = E("contentAreaContextMenu") || E("messagePaneContext") || E("popup_content");
  var target = document.popupNode;

  var nodeType = null;
  backgroundData = null;
  frameData = null;
  if (glome && target)
  {
    // Lookup the node in our stored data
    var data = glome.getDataForNode(target);
    var targetNode = null;
    if (data)
    {
      targetNode = data[0];
      data = data[1];
    }
    
    nodeData = data;
    
    if (data && !data.filter)
    {
      nodeType = data.typeDescr;
    }
    

    var wnd = (target ? target.ownerDocument.defaultView : null);
    var wndData = (wnd ? glome.getDataForWindow(wnd) : null);

    if (wnd.frameElement)
    {
      frameData = glome.getDataForNode(wnd.frameElement, true);
    }
    
    if (frameData)
    {
      frameData = frameData[1];
    }
    
    if (frameData && frameData.filter)
    {
      frameData = null;
    }
    

    if (nodeType != "IMAGE")
    {
      // Look for a background image
      var imageNode = target;
      while (imageNode && !backgroundData)
      {
        if (imageNode.nodeType == imageNode.ELEMENT_NODE)
        {
          var bgImage = null;
          var style = wnd.getComputedStyle(imageNode, "");
          bgImage = glomeImageStyle(style, "background-image") || glomeImageStyle(style, "list-style-image");
          if (bgImage)
          {
            backgroundData = wndData.getLocation(glome.abp.policy.type.BACKGROUND, bgImage);
            
            if (backgroundData && backgroundData.filter)
            {
              backgroundData = null;
            }
          }
        }

        imageNode = imageNode.parentNode;
      }
    }

    // Hide "Block Images from ..." if hideimagemanager pref is true and the image manager isn't already blocking something
    var imgManagerContext = E("context-blockimage");
    if (imgManagerContext)
    {
      if (typeof glomeAbpHideImageManager == "undefined")
      {
        glomeAbpInitImageManagerHiding();
      }
      
      // Don't use "hidden" attribute - it might be overridden by the default popupshowing handler
      imgManagerContext.style.display = (glomeAbpHideImageManager ? "none" : "");
    }
  }

  E("glome-image-menuitem").hidden = (nodeType != "IMAGE" && backgroundData == null);
  E("glome-object-menuitem").hidden = (nodeType != "OBJECT");
  E("glome-frame-menuitem").hidden = (frameData == null);
}

/**
 * Fill tooltip 
 * 
 * @param Object event      
 */
function glomeFillTooltip(event)
{
  if (!document.tooltipNode || !document.tooltipNode.hasAttribute("tooltip"))
  {
    event.preventDefault();
    return;
  }

  glomeTimedUpdater();

  var type = (document.tooltipNode && document.tooltipNode.id == "glome-toolbarbutton" ? "toolbar" : "statusbar");
  var action = parseInt(glomePrefs["default" + type + "action"]);
  if (isNaN(action))
  {
    action = -1;
  }

  var actionDescr = E("glome-tooltip-action");
  actionDescr.hidden = (action < 0 || action > 3);
  if (!actionDescr.hidden)
  {
    actionDescr.setAttribute("value", glome.getString("action" + action + "_tooltip"));
  }

  var state = event.target.getAttribute("curstate");
  var statusDescr = E("glome-tooltip-status");
  statusDescr.setAttribute("value", glome.getString(state + "_tooltip"));

  var activeFilters = [];
  E("glome-tooltip-blocked-label").hidden = (state != "active");
  E("glome-tooltip-blocked").hidden = (state != "active");
  
  if (state == "active")
  {
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
function glomeClickHandler(e)
{
  if (e.button == 0)
  {
    glomeExecuteAction(glomePrefs.defaultstatusbaraction);
  }
  else if (e.button == 1)
  {
    glomeTogglePref("enabled");
  }
}

function glomeCommandHandler(e)
{
  if (glomePrefs.defaulttoolbaraction == 0)
  {
    e.target.open = true;
  }
  else
  {
    glomeExecuteAction(glomePrefs.defaulttoolbaraction);
  }
}

// Executes default action for statusbar/toolbar by its number
function glomeExecuteAction(action) {
  if (action == 1)
  {
    //glomeToggleSidebar();
  }    
  else if (action == 2)
  {
    glome.openSettingsDialog();
  }
  else if (action == 3)
  {
    glomeTogglePref("enabled");
  }
}

/**
 * Toggles the value of a boolean pref
 * 
 * @return boolean New preference (which SHOULD be now reversed status)
 */
function glomeTogglePref(pref)
{
  glomePrefs[pref] = !glomePrefs[pref];
  glomePrefs.save();
  
  // Return the new status
  return glomePrefs[pref];
}

// Bring up the settings dialog for the node the context menu was referring to
function glomeNode(data)
{
  if (glome && data)
  {
    window.openDialog("chrome://adblockplus/content/composer.xul", "_blank", "chrome,centerscreen,resizable,dialog=no,dependent", glome.getBrowserInWindow(window).contentWindow, data);
  }
}

function glomeABPHideElements()
{
  if ("@adblockplus.org/abp/public;1" in Components.classes)
  {
    var abpURL = Components.classes["@adblockplus.org/abp/public;1"].getService(Components.interfaces.nsIURI);
    var AdblockPlus = Components.utils.import(abpURL.spec, null).AdblockPlus;
    log.debug('ABP subscription count: ' + AdblockPlus.subscriptionCount);
  }
  else
  {
    // *ad-container*
    var filter = new glome.abp.BlockingFilter('ad-container');
    filter.elemhideRegExp = '.*ad-container*.';
    //glomeExtract(filter);
    
    var selected_tab = window.gBrowser.getBrowserForTab(window.gBrowser.selectedTab);
    //glomeExtract(selected_tab.contentDocument, 1);
    //glomeExtract(glome.abp);
    
    var filters =
    [
      filter
    ];
    
    glome.abp.addPatterns(filter);
    
    glome.abp.elemhide.add(filter);
    glome.abp.elemhide.apply();
    glome.abp.policy.processNode(window, selected_tab.contentDocument);
    
  }
}

/**
 * Adblock Plus related
 * 
 * @TODO: write what this does. Or find it out first...
 */
function glomeAbpInitImageManagerHiding()
{
  if (!abp || typeof glomeAbpHideImageManager != "undefined")
  {
    return;
  }

  glomeAbpHideImageManager = false;
  
  if (abpPrefs.hideimagemanager && "@mozilla.org/permissionmanager;1" in Components.classes)
  {
    try
    {
      glomeAbpHideImageManager = true;
      var permissionManager = Components.classes["@mozilla.org/permissionmanager;1"]
                                        .getService(Components.interfaces.nsIPermissionManager);
      var enumerator = permissionManager.enumerator;
      while (glomeAbpHideImageManager && enumerator.hasMoreElements())
      {
        var item = enumerator.getNext().QueryInterface(Components.interfaces.nsIPermission);
        if (item.type == "image" && item.capability == Components.interfaces.nsIPermissionManager.DENY_ACTION)
        {
          glomeAbpHideImageManager = false;
        }
      }
    } catch(e) {}
  }
}

/**
 * Get table specifications
 *
 * @param String tablename   Table name
 * @return Object            Column name as key and its properties as value
 */
function glomeGetTable(tablename)
{
  var tables =
  {
    categories: {
      id: 'INTEGER',
      name: 'TEXT',
      subscribed: 'INTEGER',
      extras: 'TEXT',
    },
    ads:
    {
      id: 'INTEGER',
      program: 'INTEGER',
      element: 'INTEGER',
      language: 'TEXT',
      title: 'TEXT',
      adtype: 'TEXT',
      content: 'TEXT',
      action: 'TEXT',
      expires: 'TEXT',
      adcategories: 'TEXT',
      description: 'TEXT',
      notice: 'TEXT',
      width: 'INTEGER',
      height: 'INTEGER',
      expired: 'INTEGER',
      expires: 'TEXT',
      created_at: 'TEXT',
      updated_at: 'TEXT',
      status: 'INTEGER', // View status. 
    }
  }
  
  if (typeof tables[tablename] == 'undefined')
  {
    return false;
  }
  
  return tables[tablename];
}

/**
 * Set ad status to
 * 
 * @param int ad_id    ID of the advertisement
 * @param int status   Status for the ad
 */
function glomeSetAdStatus(ad_id, status)
{
  log.debug('glomeSetAdStatus starts'); 
  
  var q = 'UPDATE ads SET status = :status WHERE id = :id';
  var statement = db.createStatement(q);
  statement.params.id = ad_id;
  statement.params.status = Number(status);
  
  if (!statement.params.status)
  {
    statement.params.status = 0;
  }
  
  statement.executeAsync();
  
  // Update ticker
  glomeUpdateTicker();
  log.debug('glomeSetAdStatus ends');
}

/**
 * Update ad category subscription status
 * 
 * @param int id          ID of the category
 * @param boolean status  New status
 */
function glomeCategorySubscription(id, status)
{
  log.debug('glomeCategorySubscription starts'); 
  var q = 'UPDATE categories SET subscribed = :status WHERE id = :id';
  log.debug(q);
  var statement = db.createStatement(q);
  statement.params.id = id;
  statement.params.status = (status) ? 1 : 0;
  
  // Execute and update ticker
  statement.executeAsync
  (
    {
      handleCompletion: function(reason)
      {
        log.debug('-- got to complete the query of glomeCategorySubscriptionlog.debug');
        glomeGetCategories();
        glomeUpdateTicker();
      }
    }
  );
  log.debug('glomeCategorySubscription ends');
}

/**
 * Get ad according to its id
 * 
 * @param int ad_id
 * @return mixed      Object with populated values or false on failure
 */
function glomeGetAd(ad_id)
{
  // Check if the ad has already been loaded?
  log.debug('glomeGetAd starts');
  
  for (let i = 0; i < glome_ad_stack.length; i++)
  {
    if (glome_ad_stack[i].id == ad_id)
    {
      log.debug('-- got from ad_stack');
      return glome_ad_stack[i];
    }
  }
  
  var q = 'SELECT * FROM ads WHERE id = :id';
  var statement = db.createStatement(q);
  statement.params.id = ad_id;
  
  var ad = {};
  
  while (statement.executeStep())
  {
    for (i in glomeGetTable('ads'))
    {
      if (typeof statement.row[i] == 'undefined')
      {
        ad[i] = null;
      }
      else
      {
        ad[i] = statement.row[i];
      }
    }
  }
  
  log.debug('glomeGetAd ends'); 
  if (typeof ad.id == 'undefined')
  {
    return false;
  }
  
  return ad;
}

function glomeGetCategories()
{
  let q = 'SELECT id, name FROM categories WHERE subscribed = :subscribed';
  log.debug(q);
  
  var statement = db.createStatement(q);
  statement.params.subscribed = 1;
  
  statement.executeAsync
  (
    {
      handleResult: function(results)
      {
        log.debug('-- got to the results of query in glomeGetCategories');
        
        // Old stack
        var stack = {}
        for (k in glome_ad_categories)
        {
          stack[k] = false;
        }
        
        for (let row = results.getNextRow(); row; row = results.getNextRow())
        {
          let id = row.getResultByName('id');
          stack[id] = true;
          
          glome_ad_categories[id] =
          {
            id: row.getResultByName('id'),
            name: row.getResultByName('name'),
          }
        }
        
        // Delete the unsubscribed
        for (k in stack)
        {
          if (stack[k])
          {
            continue;
          }
          
          delete glome_ad_categories[k];
        }
      },
      handleCompletion: function()
      {
        // Get a fresh list of ads
        glomeUpdateTicker();
      }
    }
  );      
}

function glomeFetchAds()
{
  // Abort the previous request if it is still pending
  if (typeof glome.request != 'undefined')
  {
    glome.request.abort();
  }

  // Get the ads from Glome API
  glome.request = new XMLHttpRequest();
  glome.request.timeout = 5000;
  glome.request.onreadystatechange = function(e)
  {
    if (e.originalTarget.readyState < 4)
    {
      return;
    }
    
    data = JSON.parse(e.originalTarget.response);
    
    for (let i = 0; i < data.length; i++)
    {
      // Get keys
      if (typeof keys == 'undefined')
      {
        var keys = new Array();
        var keys_with_colon = new Array();
        
        for (key in data[i])
        {
          keys.push(key);
          keys_with_colon.push(':' + key);
        }
        
        keys.push('status');
        keys_with_colon.push(':status');
      }
      
      // Store the ads locally
      q = 'INSERT INTO ads (' + keys.toString() + ') VALUES(' + keys_with_colon.toString() + ')';
      let statement = db.createStatement(q);
      
      for (key in data[i])
      {
        // Per key rules
        switch (key)
        {
          case 'adcategories':
            selection = new Array();
            
            for (k in data[i][key])
            {
              selection.push(data[i][key][k].id);
            }
            
            // Store as JSON
            statement.params[key] = JSON.stringify(selection);
            break;
          
          default:
            statement.params[key] = data[i][key];
        }
      }
      
      // Set status to zero for new ads
      statement.params.status = 0;
      
      // Check if updateable on error, since probably the primary keyed ID already exists
      statement.executeAsync
      (
        {
          rval: statement.params,
          handleError: function(error)
          {
            q = 'UPDATE ads SET ';
            
            var first = true;
            
            for (key in this.rval)
            {
              if (key == 'id')
              {
                continue;
              }
              
              if (first)
              {
                first = false;
              }
              else
              {
                q += ', ';
              }
              
              q += key + ' = :' + key;
            }
            
            q += ' WHERE id = ' + this.rval.id;
            
            
            let statement = db.createStatement(q);
            statement.params = this.rval;
            
            statement.executeAsync();
          }
        }
      );
    }
  }
    
  if (glome_is_online)
  {
    glome.request.open('GET', 'http://api.glome.me/ads.json', true);
    glome.request.send();
  }
}

glomeInit();
glome.initialized = true;

