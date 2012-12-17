var glome = null;
var request = null;
var glome_is_online = true;
// all ads
var glome_ad_stack = [];
// only new ads
var glome_new_ad_stack = [];
var glome_ad_history = [];
var glome_ad_last_state = {};
var glome_ad_categories = {};
var glome_ad_categories_count = {};
var glome_id = null;
var xhr = null;
var xhr_ads = null;
var xhr_categories = null;

var page = 0;
var pages = 0;
var ad_id = 0;

var date = new Date();

// Set constants
const GLOME_AD_STATUS_UNINTERESTED = -2; // corresponds to action: 'notnow' on the server
const GLOME_AD_STATUS_LATER = -1; // not in use yet
const GLOME_AD_STATUS_PENDING = 0; // default
const GLOME_AD_STATUS_VIEWED = 1; // corresponds to action: 'getit' on the server
const GLOME_AD_STATUS_CLICKED = 2; // corresponds to action: 'click' on the server

// Initialize SQLite
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

// Update locally stored ad data
let file = FileUtils.getFile("ProfD", ["glome.sqlite"]);
let db = Services.storage.openDatabase(file); // Will also create the file if it does not exist

try
{
  glome = Components.classes["@glome.me/glome-ext;1"].createInstance().wrappedJSObject;

  dump('\n' + glome + '\n');
  if (! glome)
  {
    glome = null;
  }
}
catch (e)
{
  dump("\nGET GLOME EXCEPTION\n");
  dump(e);
}

// prefs observer
// a preferences observer intance
glome.prefs = new PreferencesManager(
  "extensions.glome.",
  function(branch, name)
  {
    log.debug('************ ' + name + ' preference changed');

    if (glome.initialized)
    {
      switch (name)
      {
        case 'enabled':
          log.debug('************ new value of ' + name + ':' + glome.prefs.enabled);
          if (glome.prefs.enabled)
          {
            if (glome.prefs.password_protection)
            {
              window.jQuery('#auth_box').attr('hidden', false);
              window.jQuery('#glome_power_switch').hide();//attr('hidden', true);
            }
            else
            {
              window.jQuery('#auth_box').attr('hidden', true);
              window.jQuery('#glome_power_switch').show();//attr('hidden', false);
              //window.jQuery(document).trigger('updateticker');
            }
          }
          else
          {
            window.jQuery('#glome-controls-icon-counter-value').hide();
          }
          break;
        case 'session_token':
          log.debug('************ new value of ' + name + ':' + glome.prefs.enabled);
          break;
        case 'session_cookie':
          log.debug('************ new value of ' + name + ':' + glome.prefs.enabled);
          break;
        case 'password_protection':
          // init the login section in the knock
          if (glome.prefs.password_protection)
          {
            window.jQuery('#glome_security_switch').attr('checked', true);
            if (glome.prefs.loggedin)
            {
              window.jQuery('#auth_box').attr('hidden', true);
              window.jQuery('#glome_power_switch').hide();//attr('hidden', false);
            }
            else
            {
              window.jQuery('#auth_box').show();//attr('hidden', false);
              window.jQuery('#glome_power_switch').hide();//attr('hidden', true);
            }
          }
          else
          {
            window.jQuery('#glome_security_switch').attr('checked', false);
            glome.prefs.loggedin = false;
            glome.prefs.save();
          }
          log.debug('************ new value of ' + name + ':' + glome.prefs.enabled);
          break;
        case 'loggedin':
          if (glome.prefs.loggedin)
          {
            window.jQuery('#glome_power_switch').show();
            window.jQuery(document).trigger('profileready');
          }
          else
          {
            window.jQuery('#auth_box').show();
            window.jQuery('#glome_power_switch').hide();
            if (glome.prefs.password_protection)
            {
              window.jQuery('#glome-controls-icon-counter-value').hide();
              window.jQuery('#glome_power_switch').hide();
            }
          }
          log.debug('************ new value of ' + name + ':' + glome.prefs.enabled);
          break;
      }
    }
    else
    {
      log.debug('************ but glome has not been initialized yet');
    }
  }
);

glome.initialized = false;

// setup preference observers
glome.prefs.register(true);

log = new glome.log();
log.level = 5;

/**
 * Init
 */
function glomeInit()
{
  log.info("glomeInit");

  if (glome)
  {
    log.debug('Glome is defined, register unload event');
    // Register event listeners
    window.addEventListener("unload", glomeUnload, false);
    // Create reference to this
    window.glome = this;
  }

  // event listener for dbready
  window.jQuery(document).on('dbready', function(event)
  {
    log.debug('db ready triggered');
    glomeGetServerCategories();
    glomeGetCategories();
    glomeInitABP();
  });

  // event listener for getting profile
  window.jQuery(document).on('profileready', function(event)
  {
    dump('triggered');
    // fetch history
    glomeGetProfile();
  });

  // event listener for getting profile
  window.jQuery(document).on('profilecreated', function(event)
  {
    // wipe off ads if something remained from a previous usage
    glomeCleanAds();
    // update categories, basically a reset
    glomeGetServerCategories();
    // fetch history, should all be defualt at this stage
    glomeGetProfile();
  });

  // event listener for updating ticker
  window.jQuery(document).on('updateticker', function(event)
  {
    glomeUpdateTicker();
  });

  glomeInitDb();

  if (   glome.prefs
      && glome.prefs.glomeid)
  {
    window.jQuery(document).trigger('profileready');
  }
  else
  {
    glomeCreateProfile();
  }

  // Set a long delay for ad retrieval. When debugging this should be minutes and
  // for production probably an hour
  window.setInterval
  (
    function()
    {
      glomeFetchAds();
    },
    glome.prefs.get('api.updateads') * 1000
  );

  // Refresh every now and then the list of categories
  window.setInterval
  (
    function()
    {
      glomeGetCategories();
    },
    glome.prefs.get('api.updatecategories') * 1000
  );

  log.info("glomeInit done");
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

    // in this version only
    if (typeof glome.prefs.schema_updated === 'undefined'
        || glome.prefs.schema_updated === false)
    {
      var q = 'DROP TABLE ' + tablename;
      db.executeSimpleSQL(q);
      log.debug('-- dropped ' + tablename);
      if (tablename == 'ads')
      {
        glome.prefs.schema_updated = true;
        glome.prefs.save();
      }
    }

    if (! db.tableExists(tablename))
    {
      try
      {
        var q = 'CREATE TABLE ' + tablename + ' (id INTEGER PRIMARY KEY)';
        //log.debug(q);
        db.executeSimpleSQL(q);
        log.debug('-- created ' + tablename);
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
        //log.debug(q);
        db.executeSimpleSQL(q);
      }
      catch (e)
      {
        log.warning('Tried to create a new column to ' + tablename + ' with query ' + q + ' but caught an exception!');
      }
    }
  }

  log.info('Database initialized, prepare to fetch data from server');

  window.jQuery(document).trigger('dbready');

  log.debug('glomeInitDb ends');
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

/**
 * Unloading
 */
function glomeUnload()
{
  //debug.info("glomeUnload");
  glome.prefs.removeListener(glomeTimedUpdater);
  glome.prefListener.unregister();
  glome.getBrowserInWindow(window).removeEventListener("select", glomeTimedUpdater, false);
}

/**
 * Switch Glome on and off
 *
 * @return boolean  Current Glome status
 */
function glomeSwitch()
{
  glomeTogglePref('enabled');
  return glome.prefs.enabled;
}

/**
 * Update Glome ticker
 */
function glomeUpdateTicker()
{
  self = this;

  log.debug('glomeUpdateTicker called');

  var label;
  var state = null;

  if (glome)
  {
    if (glome.prefs.enabled)
    {
      state = 'active';
    }
    else
    {
      state = 'disabled';
    }
  }

  window.jQuery('#main-window').attr('state', state);
  log.debug('state of main window: ' + window.jQuery('#main-window').attr('state'));

  // Stop execution here if Glome is off
  if (state == 'disabled')
  {
    return;
  }

  // local vars
  var glome_ad_stack = [];
  var glome_new_ad_stack = [];
  var glome_ad_categories_count = []

  q = 'SELECT * FROM ads WHERE expired = 0 AND expires >= :datetime';
  //log.debug(q);

  var statement = db.createStatement(q);
  var ads_table = glomeGetTable('ads');

  statement.params.datetime = glome.ISODateString();

  statement.executeAsync
  (
    {
      handleResult: function(results)
      {
        for (var row = results.getNextRow(); row; row = results.getNextRow())
        {
          var item = {};

          for (i in ads_table)
          {
            switch (i)
            {
              case 'adcategories':
                categories = JSON.parse(row.getResultByName(i));
                item.adcategories = new Array();
                for (i in categories)
                {
                  item.adcategories.push(categories[i]);
                }
                break;

              default:
                item[i] = row.getResultByName(i);
            }
          }

          var found = false;

          // Check if the item belongs to a category with subscription
          for (n in item.adcategories)
          {
            var cat_id = item.adcategories[n];

            if (! cat_id)
            {
              continue;
            }

            if (typeof glome_ad_categories_count[cat_id] == 'undefined')
            {
              glome_ad_categories_count[cat_id] = 0;
            }

            glome_ad_categories_count[cat_id]++;

            for (k in glome_ad_categories)
            {
              if (cat_id == k)
              {
                found = true;
                break;
              }
            }
          }

          // This ad wasn't in a category with a subscription
          if (! found)
          {
            continue;
          }

          // add ad to all ads
          glome_ad_stack.push(item);

          // Status check
          if (item.status == 0)
          {
            glome_new_ad_stack.push(item);
          }
        }
      },
      handleError: function(error)
      {
        log.error("Error while fetching ads from local db: " + error.message);
      },
      handleCompletion: function(reason)
      {
        if (reason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED)
        {
          log.debug('fetching ads from local db query cancelled');
        }

        self.glome_ad_stack = glome_ad_stack;
        self.glome_new_ad_stack = glome_new_ad_stack;
        self.glome_ad_categories_count = glome_ad_categories_count;

        // check event listener in ff-overlay.js
        log.debug('before triggering tickerupdated');
        window.jQuery(document).trigger('tickerupdated');
        log.debug('trigger tickerupdated from browserWindow::UpdateTicker');
      }
    }
  );
}

/**
 * Toggles the value of a boolean pref
 *
 * @return boolean New preference (which SHOULD be now reversed status)
 */
function glomeTogglePref(pref)
{
  glome.prefs[pref] = ! glome.prefs[pref];
  glome.prefs.save();
}

/**
 *  Loads a Glome specific subscription for AdBlock Plus
 */
function glomeInitABP()
{
  log.debug('AdBlockPlus [ABP] init start');
  if ("@adblockplus.org/abp/public;1" in Components.classes)
  {
    log.info('AdBlockPlus [ABP] installed');
    var abpURL = Components.classes["@adblockplus.org/abp/public;1"].getService(Components.interfaces.nsIURI);
    var AdblockPlus = Components.utils.import(abpURL.spec, null).AdblockPlus;

    // check if the ABP integration is requested in the preferences
    if (glome.prefs.get('abp.enabled'))
    {
      var filters = [];
      log.debug('ABP integration is turned on in the preferences');
      window.jQuery.get(glome.prefs.get('abp.subscription'), function(data) {
        log.info('ABP filters loaded from ' + glome.prefs.get('abp.subscription'));
        window.jQuery.each(data.split('\n'), function(index, value) {
          value = window.jQuery.trim(value);
          var c = value.charAt(0);
          switch (c) {
            case "[":
            case "!":
            case "":
              break;
            default:
              log.info('ABP filter #' + index + ': ' + value);
              filters.push(value);
          };
        });

        var res = AdblockPlus.updateExternalSubscription('glome', 'glomefilters', filters);
        log.debug("ABP subscription setting result: " + res);
      });
   }
    else
    {
      log.debug('ABP integration is turned off in Glome preferences');
    }
  }
  else
  {
    log.debug('ABP is not installed');
  }
  log.debug('ABP init done');
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
      program_id: 'INTEGER',
      element_id: 'INTEGER',
      title: 'TEXT',
      adtype: 'TEXT',
      bonus_text: 'TEXT',
      bonus_money: 'TEXT',
      bonus_percent: 'TEXT',
      content: 'TEXT',
      action: 'TEXT',
      adcategories: 'TEXT',
      description: 'TEXT',
      notice: 'TEXT',
      width: 'INTEGER',
      height: 'INTEGER',
      expires: 'TEXT',
      expired: 'INTEGER',
      created_at: 'TEXT',
      updated_at: 'TEXT',
      program: 'TEXT',
      language: 'TEXT',
      country: 'TEXT',
      currency: 'TEXT',
      logo: 'TEXT',
      status: 'INTEGER'
    }
  }

  if (typeof tables[tablename] == 'undefined')
  {
    return false;
  }

  return tables[tablename];
}

/**
 * get and updatre categories
 */
function glomeGetServerCategories()
{
  var url = glome.prefs.getUrl(glome.prefs.get('api.adcategories'));

  window.jQuery.ajax({
    url: url,
    type: 'GET',
    dataType: 'json',
    success: function(data, textStatus, jqXHR)
    {
      log.debug('-- ad categories received');

      // Add all of the categories to database
      for (let i = 0; i < data.length; i++)
      {
        // Update categories
/*
        var q = 'UPDATE categories SET name = :name WHERE id = :id';
        var statement = db.createStatement(q);
        statement.params.id = data[i].id;
        statement.params.name = data[i].name;
        statement.executeAsync();
*/
        // Insert into categories. Let SQLite to fix the issue of primary keyed rows, no need to check against them
        var q = 'REPLACE INTO categories (id, name, subscribed) VALUES (:id, :name, 1)';
        //log.debug(q);
        var statement = db.createStatement(q);
        statement.params.id = data[i].id;
        statement.params.name = data[i].name;
        statement.executeAsync();

        // @TODO: This needs a check to delete the removed categories as well
      }

      log.debug('-- updating ad categories finished');
    },
  });
}

/**
 * Set ad status to
 *
 * @param int ad_id    ID of the advertisement
 * @param int status   Status for the ad
 */
function glomeSetAdStatus(ad_id, status)
{
  //log.debug('glomeSetAdStatus starts');

  var q = 'UPDATE ads SET status = :status WHERE id = :id';
  var statement = db.createStatement(q);
  statement.params.id = ad_id;
  statement.params.status = Number(status);

  if (! statement.params.status)
  {
    statement.params.status = 0;
  }

  statement.executeAsync();

  // Update ticker
  //glomeUpdateTicker();
  //log.debug('glomeSetAdStatus ends');
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
  //log.debug(q);

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
        window.jQuery(document).trigger('updateticker');
      }
    }
  );
  log.debug('glomeCategorySubscription ends');
}

/**
 * Get ad according to its id
 *
 * @param int ad_id
 * @return mixed Object with populated values or false on failure
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

      switch (i)
      {
        case 'adcategories':
          ad[i] = JSON.parse(ad[i]);
          break;
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

/**
 * Get ads for a category
 */
function glomeGetAdsForCategory(id)
{
  // Get items for a category
  var id = Number(id);

  var q = "SELECT * FROM ads WHERE adcategories LIKE '%" + id + "%' AND expires >= :datetime AND expired = 0";
  //log.debug(q);
  var statement = db.createStatement(q);
  statement.params.datetime = glome.ISODateString();

  var ads = new Array();
  while (statement.executeStep())
  {
    var ad = {};
    var found = false;

    for (i in glomeGetTable('ads'))
    {
      if (typeof statement.row[i] == 'undefined')
      {
        ad[i] = null;
        continue;
      }

      var value = null;

      switch (i)
      {
        case 'adcategories':
          var value = JSON.parse(statement.row[i]);

          for (k = 0; k < value.length; k++)
          {
            if (value[k] == id)
            {
              found = true;
              break;
            }
          }

          var value = statement.row[i];
          break;

        default:
          var value = statement.row[i];
      }

      ad[i] = value;
    }

    //found = true;
    if (found)
    {
      ads.push(ad);
    }
  }

  return ads;
}

/**
 * Get the list of categories
 */
function glomeGetCategories()
{
  log.debug('glomeGetCategories called');

  let q = 'SELECT * FROM categories WHERE subscribed = :subscribed';
  //log.debug(q);

  var statement = db.createStatement(q);
  statement.params.subscribed = 1;

  // Reset category data
  glome_ad_categories = {}

  statement.executeAsync
  (
    {
      handleResult: function(results)
      {
        var cat = glomeGetTable('categories');

        // Old stack
        var stack = {}
        for (k in glome_ad_categories)
        {
          stack[k] = false;
        }

        for (let row = results.getNextRow(); row; row = results.getNextRow())
        {
          var id = row.getResultByName('id');
          stack[id] = true;

          glome_ad_categories[id] = {};

          for (i in cat)
          {
            glome_ad_categories[id][i] = row.getResultByName(i);
          }
        }
      },
      handleCompletion: function(reason)
      {
        //log.debug('all categories processed; call updateticker');
        window.jQuery(document).trigger('updateticker');
      }
    }
  );
}

/**
 * Clean up ads table
 */
function glomeCleanAds()
{
  q = 'DELETE FROM ads';
  log.debug(q);
  var statement = db.createStatement(q);
  statement.execute();
  statement.reset();
}

/**
 * Fetch ads from server
 */
function glomeFetchAds()
{
  self = this;

  log.debug('Fetch ads called');

  if (! glome.prefs.enabled)
  {
    if (glome_ad_stack.length > 0)
    {
      log.debug('Knock turned off, we have ads in the local db; no fetching now');
      //window.jQuery(document).trigger('statechanged');
      return null;
    }
  }

  // @TODO: Verify that it is possible to make a connection
  // Update category data
  if (xhr_ads)
  {
    xhr_ads.abort();
    xhr_ads = null;
  }

  var completed = false;

  var xhr_ads = window.jQuery.ajax({
    url: glome.prefs.getUrl(glome.prefs.get('api.ads')),
    type: 'GET',
    dataType: 'json',
    success: function(data, textStatus, jqXHR)
    {
      log.debug(data.length + ' ads received');

      for (let i = 0; i < data.length; i++)
      {
        var ad = data[i];

        // check if the ad has changed
        if (typeof self.glome_ad_stack != 'undefined' &&
            typeof self.glome_ad_stack[i] != 'undefined' &&
            self.glome_ad_stack[i].updated_at == ad.updated_at)
        {
          continue;
        }

        if ((i + 1) == data.length)
        {
          completed = true;
        }

        // Get keys
        if (typeof keys == 'undefined')
        {
          var keys = new Array();
          var keys_with_colon = new Array();

          for (key in ad)
          {
            keys.push(key);
            keys_with_colon.push(':' + key);
          }

          keys.push('status');
          keys_with_colon.push(':status');
          keys.push('language');
          keys_with_colon.push(':language');
          keys.push('country');
          keys_with_colon.push(':country');
          keys.push('currency');
          keys_with_colon.push(':currency');
        }

        // Store the ads locally
        q = 'INSERT OR REPLACE INTO ads (' + keys.toString() + ') VALUES (' + keys_with_colon.toString() + ')';
        var statement = db.createStatement(q);
        // Set status of ads using the history info that was obtained from the server
        if (typeof glome_ad_last_state[ad.id] !== 'undefined')
        {
          statement.params.status = glome_ad_last_state[ad.id]
        }
        else
        {
          statement.params.status = GLOME_AD_STATUS_PENDING;
        }

        for (key in ad)
        {
          var value = ad[key];

          // Per type rules
          switch (key)
          {
            case 'adcategories':
              var selection = new Array();

              for (k in value)
              {
                selection.push(value[k].id);
              }

              // Store as JSON string
              value = JSON.stringify(selection);
              statement.params[key] = value;
              break;
            case 'program':
              statement.params['language'] = value.language;
              statement.params['country'] = value.country;
              statement.params['currency'] = value.currency;
              break;
            default:
              statement.params[key] = value;
          }
        }

        // Check if updateable on error, since probably the primary keyed ID already exists
        statement.executeAsync
        (
          {
            rval: statement.params,

            handleCompletion: function(reason)
            {
              if (reason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED)
              {
                log.debug('CANCELLED query for inserting ads in local db');
              }
              else
              {
                if (completed)
                {
                  // update the ticker in the knock
                  log.debug('update ticker after inserting the last ad to local db');
                  window.jQuery(document).trigger('updateticker');
                  completed = false;
                }
              }
            }
          }
        );
      } // end of for loop
    }, // end fo success
    error: function(jqXHR, textStatus, errorThrown) {
      log.debug('Error getting ads via json: ' + jqXHR.status + ', ' + jqXHR.statusText);

      // maybe the session ended? start a new one
      if (jqXHR.status === 403)
      {
        log.debug('try to login again');
        glomeGetProfile();
      }
    }, // end of error
  });
}

/**
 * Focus on the about:glome page or create new if needed
 */
function glomeFocus()
{
  document.getElementById('glome-controls-window').hidePopup();

  var url = 'about:glome';
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
  var browserEnumerator = wm.getEnumerator("navigator:browser");

  // Check each browser instance for our URL
  var found = false;
  while (! found && browserEnumerator.hasMoreElements())
  {
    var browserWin = browserEnumerator.getNext();
    var tabbrowser = browserWin.gBrowser;

    // Check each tab of this browser instance
    var numTabs = tabbrowser.browsers.length;
    for (var index = 0; index < numTabs; index++)
    {
      var currentBrowser = tabbrowser.getBrowserAtIndex(index);
      if (url == currentBrowser.currentURI.spec)
      {
        // The URL is already opened. Select this tab.
        tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

        // Focus *this* browser-window
        browserWin.focus();

        found = true;
        break;
      }
    }
  }

  // Our URL isn't open. Open it now.
  if (! found)
  {
    var recentWindow = wm.getMostRecentWindow("navigator:browser");
    if (recentWindow)
    {
      // Use an existing browser window
      recentWindow.delayedOpenTab(url, null, null, null, null);
    }
    else
    {
      // No browser windows are open, so open a new one.
      window.open(url);
    }
  }
}

/**
 * Creates a new glome id if not existing
 */
function glomeCreateProfile(glomeid)
{
  log.debug('glomeid in: ' + glomeid);

  if (typeof glomeid === 'undefined')
  {
    glomeid = date.getTime();
  }

  var url = glome.prefs.getUrl(glome.prefs.get('api.users.json'));
  var data =
  {
    user:
    {
      glomeid: glomeid
    }
  }

  log.debug('Create profile: ' + glomeid);

  window.jQuery.ajax
  (
    {
      url: url,
      data: data,
      type: 'POST',
      dataType: 'json',
      success: function(data, textStatus, jqXHR)
      {
        // set an internal
        glome.prefs.glomeid = data.glomeid;
        glome.prefs.save();

        log.debug('Glome ID is now ' + glome.prefs.glomeid);

        window.jQuery(document).trigger('profilecreated');
      },
    }
  );
}

/**
 * Gets user profile info (adhistory)
 */
function glomeGetProfile(password)
{
  log.debug('Get profile of ' + glome.prefs.glomeid);

  var url = glome.prefs.getUrl(glome.prefs.get('api.users')) + '/login.json';
  var method = 'POST';
  var data =
  {
    user:
    {
      glomeid: glome.prefs.glomeid
    }
  };

  if (glome.prefs.password_protection)
  {
      if (glome.prefs.loggedin)
      {
          url = glome.prefs.getUrl(glome.prefs.get('api.users')) + '/' + glome.prefs.glomeid + '.json';
          method = 'GET';
          data = '';
      }
  }

  log.debug('  sending profile request to:' + url);

  window.jQuery.ajax({
    url: url,
    type: method,
    data: data,
    dataType: 'json',
    success: function(data, textStatus, jqXHR)
    {
      if (typeof glome.prefs.session_token === 'undefined' ||
          glome.prefs.session_token != jqXHR.getResponseHeader('X-CSRF-Token'))
      {
        log.debug('******** we have to update headers');
        log.debug('');
        log.debug('token:' + jqXHR.getResponseHeader('X-CSRF-Token') + ' => ' + glome.prefs.session_token + ' vs ' + glome.prefs.session_token);
        log.debug('cookie:' + jqXHR.getResponseHeader('Set-Cookie') + ' => ' + glome.prefs.session_cookies + ' vs ' + glome.prefs.session_cookies);
        log.debug('');
        log.debug('*********************************************');

        glome.prefs.session_token = jqXHR.getResponseHeader('X-CSRF-Token');
        glome.prefs.session_cookies = jqXHR.getResponseHeader('Set-Cookie');

        if (data.encrypted_password == '')
        {
          glome.prefs.password_protection = false;
        }
        else
        {
          glome.prefs.password_protection = true;
        }
        glome.prefs.save();
      }

      if (data.error && data.error == 'No such profile.')
      {
        log.debug('Error, call create profile');
        glomeCreateProfile(glome.prefs.glomeid);
      }
      else
      {
        window.jQuery('#glome_power_switch').attr('hidden', false);
        window.jQuery('#auth_box').attr('hidden', true);

        // store the history for later use when fetching ads completed
        glome_ad_history = data.adhistories;
        // parse ad history and determine last state of each ad
        glomeParseAdHistory(glome_ad_history);
        // update
        window.jQuery(document).trigger('updateticker');
        // safe to get ads now
        glomeFetchAds();
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      log.debug('Error getting glome profile via json: ' + jqXHR.status + ': ' + jqXHR.statusText);
      glome.prefs.loggedin = false;
      glome.prefs.save();
    },
    complete: function() {
      log.debug('Get profile completed');
    }
  });
}

/**
 * Parses ad history and updates the local DB
 * @param array with ad history objects:
 *
 */
function glomeParseAdHistory(histories)
{
  var status = GLOME_AD_STATUS_PENDING;

  window.jQuery.each(histories, function(index, history)
  {
    // map server side actions with extension side statuses
    switch (history.action)
    {
      case 'getit':
        status = GLOME_AD_STATUS_VIEWED;
        break;
      case 'notnow':
        status = GLOME_AD_STATUS_UNINTERESTED;
        break;
      case 'click':
        status = GLOME_AD_STATUS_CLICKED;
        break;
      default:
        status = GLOME_AD_STATUS_PENDING;
    }
/*
    if (status != GLOME_AD_STATUS_PENDING)
    {
      log.debug('set history: ' + history.ad_id + ' -> ' + status);
      glomeSetAdStatus(history.ad_id, status);
    }
*/
    // store last status of the ad in the hash
    glome_ad_last_state[history.ad_id] = status;
  });

  if (log.level == 5)
  {
    // testing the ads' last state hash
    window.jQuery.each(glome_ad_last_state, function(index, value) {
      log.debug('############ Last status of ' + index + ' is ' + value);
    });
  }
}

glomeInit();
glome.initialized = true;
