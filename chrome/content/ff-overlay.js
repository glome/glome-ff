/* !glomeOverlay class */

/**
 * Glome Overlay
 */
var glomeOverlay =
{
  /**
   * Current domain
   *
   * @var String
   */
  domain: null,

  /**
   * Glome state
   *
   * @var boolean
   */
  state: true,

  /**
   * Currently displayed ad ID
   *
   * @var int
   */
  currentAd: null,

  /**
   * Switch to determine if knocking view should display an ad or a category
   *
   * @var String
   */
  knockType: 'ad',

  /**
   * Knocking index
   *
   * @var int
   */
  knockIndex: 0,

  /**
   * Currently selected category ID
   *
   * @var int
   */
  category: 0,

  /**
   * Resize Glome related canvases according to the resizing of the main window
   *
   * @param Object e    onresize event
   */
  Resize: function(e)
  {
    b_width = jQuery('#browser').width();
    b_height = jQuery('#browser').height();

    if (   jQuery('#glome-panel').attr('width') == b_width
        && jQuery('#glome-panel').attr('height') == b_height)
    {
      return;
    }

    jQuery('#glome-panel')
      .attr
      (
        {
          width: b_width,
          height: b_height
        }
      );
  },

  /**
   * Change Glome state from the toolbar icon
   */
  ChangeState: function()
  {
    glome.log.debug('Change state initiated');

    glome.glomeTogglePref('enabled');

    // Set the checkbox status
    if (! glome.prefs.enabled)
    {
      glomeOverlay.HideStack();
      content.document.glomeblock = null;
    }
    else
    {
      jQuery(document).trigger('updateticker');
    }

    jQuery(document).trigger('statechanged');
    glome.log.debug('Change state finished');
  },

  /**
   * Change the panel state according to Glome status
   *
   * 'working' if Glome is up and running everywhere
   * 'on' if Glome is off and the current domain is not disabled
   * 'off' if Glome is off and the current domain is explicitly disabled
   *
   * @return string
   */
  GetPanelState: function()
  {
    // If Glome is on, return null
    if (glome.prefs.enabled)
    {
      return 'working';
    }
  },

  /**
   * Change the advertisement visible on knocker
   *
   * @param int dt    Delta for ad display related to current
   */
  ChangeKnockingItem: function(dt)
  {
    var items = new Array();

    glome.log.debug('glomeOverlay.ChangeKnockingItem, type: ' + glomeOverlay.knockType);

    if (! dt)
    {
      var dt = 0;
    }

    if (glomeOverlay.knockType == 'ad')
    {
      items = glome.glome_new_ad_stack;
    }
    else
    {
      for (i in glome.glome_ad_categories)
      {
        if (! glome.glome_ad_categories_count[i])
        {
          continue;
        }

        items.push(glome.glome_ad_categories[i]);
      }
    }

    var item_count = items.length;

    jQuery('#glome-ad-display').attr('mode', glomeOverlay.knockType);

    glome.log.debug('pwd: ' + glome.prefs.password_protection + ', loggedin: ' + glome.prefs.loggedin);

    if (glome.prefs.password_protection && ! glome.prefs.loggedin)
    {
        jQuery('#glome-ad-display').hide();
        jQuery('#glome-off').show();
        jQuery('#auth_box').attr('hidden', false);
        jQuery('#glome_power_switch').hide();
    }
    else
    {
      if (! glome.prefs.enabled)
      {
        jQuery('#glome-ad-display').hide();
        jQuery('#glome-off').show();
      }
      else
      {
        jQuery('#glome-ad-display').show();
        jQuery('#glome-off').hide();
      }

      jQuery('#auth_box').attr('hidden', true);
      jQuery('#glome_power_switch').show();

      if (item_count)
      {
        jQuery('#glome-controls-wrapper').find('.active').removeAttr('hidden');

        if (item_count == 1)
        {
          jQuery('#glome-ad-pager').parent().attr('hidden', 'true');
        }
        else
        {
          jQuery('#glome-ad-pager').parent().removeAttr('hidden');
        }
      }
      else
      {
        jQuery('#glome-controls-wrapper').find('.active').attr('hidden', true);
      }

      if (! glomeOverlay.knockIndex)
      {
        glomeOverlay.knockIndex = 0;
      }

      glomeOverlay.knockIndex += dt;

      if (glomeOverlay.knockIndex < 0)
      {
        glomeOverlay.knockIndex = item_count - 1;
      }

      if (glomeOverlay.knockIndex >= item_count)
      {
        glomeOverlay.knockIndex = 0;
      }

      index = glomeOverlay.knockIndex;

      // Display ad
      var selected = items[index];
      var current = index + 1;
      jQuery('#glome-ad-pager-page').attr('value', current + '/' + item_count);

      if (glomeOverlay.knockType == 'ad')
      {
        this.currentAd = selected.id;
        jQuery('#glome-ad-pager').attr('data-ad', selected.id);
        jQuery('#glome-ad-pager').attr('data-category', JSON.stringify(selected.adcategories));
        jQuery('#glome-ad-description-title').text(selected.title);
      }
      else
      {
        var text = jQuery('#glome-controls-wrapper').find('.active').find('.label.category').attr('value');
        var category = selected.id;

        glomeOverlay.category = category;

        text = text.replace(/\-s/, glome.glome_ad_categories_count[category]);
        text = text.replace(/\-c/, selected.name);

        jQuery('#glome-ad-pager').attr('data-ad', '');
        jQuery('#glome-ad-pager').attr('data-category', selected.id);
        jQuery('#glome-ad-description-title').text(selected.name);
        jQuery('#glome-ad-description-value').text(text);
      }
    }

    glome.log.debug('-- finished');
  },

  /**
   * Process the popup right before showing it
   */
  WidgetShow: function()
  {
    // Check from counter how many items there are and display content accordingly
    if (glome.glome_new_ad_stack.length == 0)
    {
      glomeOverlay.knockType = 'category';
    }
    else
    {
      glomeOverlay.knockType = 'ad';
    }

    glomeOverlay.ChangeKnockingItem();

    jQuery(document).trigger('statechanged');
  },

  /**
   * Hide the popup
   */
  WidgetHide: function()
  {
    document.getElementById('glome-controls-window').hidePopup();
  },

  /**
   * Shows the overlayed panel for ads, categories and such
   */
  PanelShow: function(mode)
  {
    document.getElementById('glome-controls-window').hidePopup();

    var stack = jQuery('#glome-panel');
    stack.get(0).openPopup(document.getElementById('browser'), null, 0, 0);

    if (mode)
    {
      stack.attr('view', mode);
    }

    window.gBrowser.selectedTab.setAttribute('glomepanel', jQuery('#glome-panel').attr('view'));

    glomeOverlay.Resize();
  },

  /**
   * Hides the overlayed panel for ads, categories and such
   */
  PanelHide: function()
  {
    document.getElementById('glome-panel').hidePopup();
    window.gBrowser.selectedTab.removeAttribute('glomepanel');
  },

  SetCategoryTitle: function(title)
  {
    var title_set = jQuery('#glome-panel label.category-title');

    title_set
      .unbind('click')
      .bind('click', function()
      {
        if (! glomeOverlay.category)
        {
          return;
        }

        if (glomeOverlay.category)
        {
          glomeOverlay.ListCategoryAds(glomeOverlay.category);
        }
      })
      .attr('value', title);


    if (jQuery('#glome-panel description.category-title').size())
    {
      jQuery('#glome-panel description.category-title').get(0).textContent = title;
    }
  },

  /**
   * Open category view to switch category on/off
   *
   * @param int cat_id    Category ID
   */
  OpenCategoryView: function(cat_id)
  {
    if(! cat_id)
    {
      cat_id = glomeOverlay.category;
    }

    if (! cat_id)
    {
      stored = JSON.parse(jQuery('#glome-ad-pager').attr('data-category'));
      for (i in stored)
      {
        cat_id = stored[i];
        break;
      }
    }

    if (! cat_id)
    {
      return;
    }

    glomeOverlay.SetCategoryTitle(glome.glome_ad_categories[cat_id].name);
    glomeOverlay.PanelShow('category');

    var stack = jQuery('#glome-panel');

    jQuery('#glome-overlay-category')
      .find('button.no')
      .unbind('click')
      .bind('click', function(e)
      {
        glome.glomeCategorySubscription(jQuery('#glome-overlay-category').attr('data-id'), false);

        // Hide the ad displayer
        glomeOverlay.PanelHide();
        window.gBrowser.selectedTab.removeAttribute('glomepanel');
      });
    // Calculate the length according to the category
    var label = stack.find('.show-all-s');
    var text = label.attr('data-original');

    if (! text)
    {
      text = label.attr('value');
      label.attr('data-original', text);
    }

    // Get the count
    var count = glome.glome_ad_categories_count[cat_id];

    jQuery('#glome-overlay-category').attr('data-count', count);
    jQuery('#glome-overlay-category').attr('data-id', cat_id);

    if (! count)
    {
      jQuery('#glome-overlay-category').find('.show-all-s').attr('hidden', 'true');
    }
    else
    {
      jQuery('#glome-overlay-category').find('.show-all-s').removeAttr('hidden');
    }

    label.attr('value', text.replace(/ s /, ' ' + count + ' '))

    jQuery('#glome-overlay-category')
      .find('button.yes')
      .unbind('click')
      .bind('click', function(e)
      {
        // Populate with ads of the category
        glomeOverlay.ListCategoryAds(jQuery('#glome-overlay-category').attr('data-id'));

        jQuery('#glome-panel').attr('view', 'list');
      });
  },

  /**
   * Show all categories
   */
  ShowAllCategories: function()
  {
    glomeOverlay.PanelShow('categories');
    glomeOverlay.SetCategoryTitle('All');

    var template = jQuery('#glome-overlay-categories-list').find('template').text();
    jQuery('#glome-overlay-categories-list').find('> *').not('template').remove();

    for (i in glome.glome_ad_categories)
    {
      if (! glome.glome_ad_categories[i].subscribed)
      {
        continue;
      }

      if (typeof glome.glome_ad_categories_count[i] == 'undefined')
      {
        var count = 0;
      }
      else
      {
        var count = glome.glome_ad_categories_count[i];
      }

      glome.log.debug('glome_ad_categories_count: ' + count);

      if (! count)
      {
        continue;
      }

      var params = glome.glome_ad_categories[i];
      params.count = count;

      var tmp = this.ParseTemplate(template, params);
      var row = jQuery(tmp);

      row.appendTo('#glome-overlay-categories-list');
      row.find('button, .h2')
        .bind('click', function(e)
        {
          var id = Number(jQuery(this).parents('.list-item').attr('data-id'));
          glomeOverlay.category = id;

          glomeOverlay.ListCategoryAds(id);
        });
    }
  },

  /**
   * Don't display ad. Opens category view and posts an action point to Glome API server
   *
   * @param int ad_id
   */
  AdNotNow: function(ad_id)
  {
    glome.log.debug('glomeOverlay.AdNotNow');

    if (! ad_id)
    {
      ad_id = glomeOverlay.currentAd;
    }

    if (! ad_id)
    {
      ad_id = jQuery('#glome-ad-pager').attr('data-ad');
    }

    var url = glome.prefs.getUrl('ads/' + ad_id + '/notnow.json');

    jQuery.ajax
    (
      {
        url: url,
        type: 'POST',
        data:
        {
          user:
          {
            glomeid: glome.prefs.glomeid
          }
        },
        dataType: 'json',
        success: function(data)
        {
          // Set ad status to uninterested
          glome.glomeSetAdStatus(glomeOverlay.currentAd, glome.GLOME_AD_STATUS_UNINTERESTED);

          var ad = glome.glomeGetAd(glomeOverlay.currentAd);

          var cat_id = null;

          if (typeof ad.adcategories[0] != 'undefined')
          {
            glomeOverlay.OpenCategoryView(ad.adcategories[0]);
          }
          else
          {
            glomeOverlay.PanelHide();
          }

          // Update ticker to match the new view count
          glome.glomeUpdateTicker();

          glome.log.debug('AdNotNow request sent successfully');
        }
      }
    );
  },

  /**
   * Display ad
   *
   * @param int ad_id    Ad id
   */
  DisplayAd: function(ad_id)
  {
    glome.log.debug('DisplayAd: ' + ad_id);
    if (! ad_id)
    {
      ad_id = glomeOverlay.currentAd;
    }

    if (! ad_id)
    {
      ad_id = jQuery('#glome-ad-pager').attr('data-ad');
    }

    if (! ad_id)
    {
      return false;
    }

    var url = glome.prefs.getUrl('ads/' + ad_id + '/getit.json');

    jQuery.ajax
    (
      {
        url: url,
        type: 'POST',
        data:
        {
          user:
          {
            glomeid: glome.prefs.glomeid
          }
        },
        dataType: 'json',
        success: function(data)
        {
          // Probably nothing needs to be done
        }
      }
    );

    glomeOverlay.currentAd = ad_id;

    // Get the ad to be displayed
    var ad = glome.glomeGetAd(ad_id);

    if (typeof ad.adcategories[0] != 'undefined')
    {
      glomeOverlay.category = ad.adcategories[0];
    }

    var container = jQuery(document).find('#glome-overlay-single');

    // Set the view mode to single item
    jQuery('#glome-panel').attr('view', 'single');

    // Remove the currently displayed ad
    switch (ad.adtype)
    {
      // @TODO: support Flash
      case 'flash':
        break;

      case 'image':
        container.find('#glome-overlay-single-image:first')
          .unbind('click')
          .bind('click', function()
          {
            jQuery(this).parent().find('.action.yes').trigger('click');
          })
          .css('background-image', 'url("' + ad.content + '")');

        container.find('.description .h1').get(0).textContent = ad.title;
        container.find('.description description.description').get(0).textContent = ad.description;

        break;
    }

    container.find('#glome-overlay-cashback description.bonus').get(0).textContent = ad.bonus_text + ' | ' + ad.bonus_money + ' ' + ad.currency + ' | ' + ad.bonus_percent + '%';

    // Set the category title
    for (i in ad.adcategories)
    {
      cat_id = ad.adcategories[i];

      if (typeof glome.glome_ad_categories[cat_id] != 'undefined')
      {
        glomeOverlay.category = cat_id;
        this.SetCategoryTitle(glome.glome_ad_categories[cat_id].name);
      }
      break;
    }

    if (! glome.prefs.get('glomeid'))
    {
      container.find('.action').attr('hidden', 'true');
    }
    else
    {
      container.find('.action').removeAttr('hidden');
    }

    // Redirect to the vendor page and close the ad display
    container.find('.action.yes')
      .attr('action', ad.action)
      .unbind('click')
      .bind('click', function(e)
      {
        glomeOverlay.GotoAd(glomeOverlay.currentAd);
        return false;
      });

    // Set the ad as uninterested and close the ad display
    container.find('.action.no')
      .unbind('click')
      .bind('click', function(e)
      {
        // Call not now event
        glomeOverlay.AdNotNow(Number(glomeOverlay.currentAd));
        return false;
      });

    glomeOverlay.PanelShow();
  },

  /**
   * Go to the link provided by ad
   *
   * @param int ad_id    Ad id
   */
  GotoAd: function(ad_id)
  {
    this.PanelHide();

    var url = glome.prefs.getUrl('/ads/' + ad_id + '/click/' + glome.prefs.glomeid + '.json');

    window.gBrowser.selectedTab.setAttribute('glomepanel', jQuery('#glome-panel').attr('view'));

    jQuery.ajax({
      url: url,
      type: "GET",
      dataType: 'json',
      success: function(data, textStatus, jqXHR)
      {
        window.gBrowser.selectedTab = window.gBrowser.addTab(data.url);
      }
      // todo: shall we handle error situations?
    });

    // Set ad status to clicked
    glome.glomeSetAdStatus(ad_id, glome.GLOME_AD_STATUS_CLICKED);

    // Remove this ad from new ads list
    glome.glome_new_ad_stack.splice(i, 1);
    return;
  },

  /**
   * Hide Glome mini stack
   */
  HideStack: function()
  {
    window.gBrowser.selectedTab.removeAttribute('glomepanel');
    glomeOverlay.PanelHide();
  },

  /**
   * Populate category list
   *
   * @param int id    glome.sqlite:categories:id
   */
  ListCategoryAds: function(id)
  {
    glome.log.debug('selected category: ' + id);

    if (! id)
    {
      id = glomeOverlay.category;
      glome.log.debug('-- category id now: ' + id);
    }

    // Set the view mode to single item
    var stack = jQuery('#glome-panel');
    stack.get(0).openPopup(document.getElementById('browser'), null, 0, 0);
    stack.attr('view', 'category');
    window.gBrowser.selectedTab.setAttribute('glomepanel', 'visible');

    document.getElementById('glome-controls-window').hidePopup();

    // Header data
    if (typeof glome.glome_ad_categories[id] == 'undefined')
    {
      glomeOverlay.HideStack();
      return;
    }

    jQuery('#glome-panel').find('.category-title').attr('value', glome.glome_ad_categories[id].name);

    // Set the view mode to single item
    jQuery('#glome-panel').attr('view', 'list');

    var container = jQuery('#glome-overlay-category-ads-list');
    var template = container.find('template').text();

    // Remove the old content
    container.find('> *').not('template').remove();

    // Get items for a category
    var ads = glome.glomeGetAdsForCategory(id);

    for (var i = 0; i < ads.length; i++)
    {
      glome.log.debug('-- add ad ' + ads[i].title);
      // Copy the template
      var tmp = this.ParseTemplate(template, ads[i]);

      // Convert HTML to DOM
      jQuery(tmp).appendTo(container);
      glome.log.debug('   added!');
    }

    // Set actions
    container.find('.h2, .action.yes, .thumbnail image')
      .bind('click', function()
      {
        // Closing the last one, hide panel
        if (! jQuery(this).parents('.list-item').siblings('.list-item').size())
        {
          //glomeOverlay.HideStack();
        }

        var item = jQuery(this).parents('.list-item');
        var ad_id = Number(item.attr('data-id'));
        glomeOverlay.DisplayAd(ad_id);
        item.remove();
      });

    container.find('.action.no')
      .bind('click', function()
      {
        // Closing the last one, hide panel
        if (! jQuery(this).parents('.list-item').siblings('.list-item').size())
        {
          glomeOverlay.HideStack();
        }

        var item = jQuery(this).parents('.list-item');
        var ad_id = Number(item.attr('data-id'));

        // Create a new browser tab
        for (let i = 0; i < glome.glome_new_ad_stack.length; i++)
        {
          if (glome.glome_ad_stack[i].id == ad_id)
          {
            // Remove this ad from ads list
            glome.glome_new_ad_stack.splice(i, 1);
          }
        }

        // Set ad status to uninterested
        glomeOverlay.AdNotNow(ad_id);

        item.remove();
      });
  },

  /**
   * Parse a string template and set its variables
   *
   * @param String tmp         Template DOM as string
   * @param Object params      Parameters to replace
   * @return String
   */
  ParseTemplate: function(tmp, params)
  {
    // Replace template string with params values
    while (regs = tmp.match(/::([a-z0-9_]+)/i))
    {
      var value = '';
      var key = regs[1];
      var regexp = new RegExp(regs[0], 'g');

      if (typeof params[key] != 'undefined')
      {
        value = String(params[key]).replace(/&/g, '&amp;');
      }

      tmp = tmp.replace(regexp, value);
    }

    return tmp;
  },

  /**
   * Logs in the user
   */
  Login: function (password)
  {
    glome.log.debug('login called');

    var glomeid = glome.prefs.glomeid;

    if (typeof glomeid != 'undefined' &&
        typeof password != 'undefined')
    {
      var url = glome.prefs.getUrl(glome.prefs.get('api.users')) + '/login.json';

      glome.log.debug('Send to: ' + url);

      var data = {
        user: {
          glomeid: glomeid,
          password: password,
      }};

      jQuery.ajax({
        url: url,
        data: data,
        type: 'POST',
        dataType: 'json',
        beforeSend: function(jqXHR, settings)
        {
          if (typeof glome.prefs.session_token != 'undefined' &&
              typeof glome.prefs.session_cookies != 'undefined')
          {
            glome.log.debug('set HTTP headers for AJAX for logging in');
            jqXHR.setRequestHeader('X-CSRF-Token', glome.prefs.session_token);
            jqXHR.setRequestHeader('Cookie', glome.prefs.session_cookies);
          }
        },
        success: function(data, textStatus, jqXHR)
        {
          glome.log.debug('Glome user login ok');
          if (typeof jqXHR.getResponseHeader('X-CSRF-Token') != 'undefined' &&
              typeof jqXHR.getResponseHeader('Set-Cookie') != 'undefined')
          {
            glome.prefs.session_token = jqXHR.getResponseHeader('X-CSRF-Token');
            glome.prefs.session_cookies = jqXHR.getResponseHeader('Set-Cookie');
          }

          jQuery.ajaxSetup(
          {
            global: false,
            beforeSend: function(jqXHR, settings)
            {
              jqXHR.setRequestHeader('Cookie', glome.prefs.session_cookies);
              jqXHR.setRequestHeader('X-CSRF-Token', glome.prefs.session_token);
              /*
              glome.log.debug('  Overriding HTTP headers for AJAX in ff-overlay after being logged in');
              glome.log.debug('   Cookie:' + glome.prefs.session_cookies);
              glome.log.debug('   X-CSRF-Token:' + glome.prefs.session_token);
              */
            }
          });

          jQuery('#auth_box .feedback .detail').remove();
          jQuery('#auth_box .feedback .message').removeClass('error');
          jQuery('#auth_box .feedback .message').attr('value', "Welcome!");

          glome.prefs.loggedin = true;
          glome.prefs.save();
        },
        error: function(jqXHR, textStatus, errorThrown)
        {
          glome.log.debug('Error logging in via json: ' + jqXHR.status + ', ' + jqXHR.statusText);
          var template = jQuery('#auth_box .feedback .message');
          var messages = jQuery.parseJSON(jqXHR.responseText);
          jQuery('#auth_box .feedback .message').addClass('error');
          jQuery('#auth_box .feedback .message').attr('value', 'Failed to login');
          jQuery('#auth_box .feedback .detail').remove();
          //jQuery.each(messages, function(index, element) {
          //  jQuery('#auth_box .feedback').append('<label class="detail" value="' + element + '" />');
          //});
          glome.prefs.loggedin = false;
          glome.prefs.save();
        },
        complete: function()
        {
          if (jQuery('#auth_box .feedback .message').attr('value') != '')
          {
            jQuery('#auth_box .feedback').attr('hidden', false);
          }
          else
          {
            jQuery('#auth_box .feedback').attr('hidden', true);
          }
          glome.log.debug('authentication completed');
        }
      });
    }
  }
}

/* !Event listeners */

/* !Window DOMTitleChanged event */
window.addEventListener('DOMTitleChanged', function(e)
{
  glomeOverlay.domain = glome.glomeGetCurrentDomain();

  // Hide Glome icon in the addons view
  if (window.top.getBrowser().selectedBrowser.contentWindow.location.href.match(/about:(addons|config|glome)/))
  {
    jQuery('#glome-controls').attr('hidden', 'true');
    return;
  }
}, false)

/* !Window load event */
window.addEventListener('load', function(e)
{
  if (typeof window.glome == 'undefined')
  {
    let sandbox = new Components.utils.Sandbox(window);
    sandbox.window = window;
    sandbox.document = document;

    var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                    .getService(Components.interfaces.nsIObserverService);

    Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
              .getService(Components.interfaces.mozIJSSubScriptLoader)
              .loadSubScript('chrome://glome/content/library/PreferencesManager.js', sandbox);

    Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
              .getService(Components.interfaces.mozIJSSubScriptLoader)
              .loadSubScript("chrome://glome/content/browserWindow.js", sandbox);

    jQuery.ajaxSetup(
    {
      global: false,
      beforeSend: function(jqXHR, settings)
      {
        if (typeof glome.prefs.session_token != 'undefined')
        {
          glome.log.debug('set HTTP headers for AJAX in ff-overlay after loading');
          jqXHR.setRequestHeader('X-CSRF-Token', glome.prefs.session_token);
          jqXHR.setRequestHeader('Cookie', glome.prefs.session_cookies);
        }
      }
    });
  }
  else
  {
    glome = window.glome;
  }

  jQuery('#glome-controls').insertAfter(jQuery('#browser'));
  //jQuery('#glome-panel').appendTo('#tab-view-deck');

  if (typeof glome.log == 'undefined')
  {
    glome.log = new glome.glome.log();
    glome.log.level = 5;
  }

  if (typeof glome.prefs == 'undefined')
  {
    glome.prefs = glome.glome.prefs;
  }

  //glomeOverlay.AdStateChange();
  glomeOverlay.domain = glome.glomeGetCurrentDomain();

  // Hide Glome icon in the addons view
  if (window.top.getBrowser().selectedBrowser.contentWindow.location.href.match(/about:(addons|config|glome)/))
  {
    jQuery('#glome-controls').attr('hidden', 'true');
    return;
  }
  else
  {
    jQuery('#glome-controls').removeAttr('hidden');
  }

  jQuery('#glome-controls-icon-wrapper').removeAttr('hidden');

  // handle login button click
  jQuery(document).on('click', '#login', function()
  {
    glome.log.debug('login clicked');
    password = jQuery('#auth_box textbox#password_once').val();
    glomeOverlay.Login(password);
    glome.log.debug('login clicked ended');
  });
}, false);

/* !Tab select */
/**
 * Bind Glome to tab selection events. Trigger here the code that will process the page
 * (i.e. ad blocking and Glome status changes)
 */
window.addEventListener('TabSelect', function(e)
{
  glome.log.debug('TabSelect in ff-overlay');

  // Hide Glome icon in some of the views
  glomeOverlay.domain = glome.glomeGetCurrentDomain();

  if (window.top.getBrowser().selectedBrowser.contentWindow.location.href.match(/about:(addons|config|glome)/))
  {
    jQuery('#glome-controls').attr('hidden', 'true');
    return;
  }
  else
  {
    jQuery('#glome-controls').removeAttr('hidden');
  }

  stack_panel = document.getElementById('glome-panel');

  // Check if the currently selected tab should have Glome ad stack open
  if (! stack_panel)
  {
    // Stack panel not available, do nothing
  }
  else if (window.gBrowser.selectedTab.hasAttribute('glomepanel'))
  {
    stack_panel.openPopup(document.getElementById('browser'), null, 0, 0);
  }
  else
  {
    stack_panel.hidePopup();
  }

  // Hide the Glome popup
  glomeOverlay.WidgetHide();
}, false);

/* !Window resize event */
window.addEventListener('resize', glomeOverlay.Resize, false);

// update only if ticker updated
jQuery(document).on('tickerupdated', function(event)
{
  glome.log.debug('tickerupdated event triggered');
  glomeOverlay.WidgetShow();
});

// update knock layout, counter etc.
jQuery(document).on('statechanged', function(event)
{
  glome.log.debug('statechanged event triggered');
  glome.log.debug('-- number of all ads / new ads: ' + glome.glome_ad_stack.length + ' / ' + glome.glome_new_ad_stack.length);

  if (typeof glome.prefs == 'undefined')
  {
    glome.log.debug('too bad');
  }
  else
  {
    jQuery('#glome_power_switch').show();

    if ((glome.prefs.password_protection && glome.prefs.loggedin) ||
        (! glome.prefs.password_protection && ! glome.prefs.loggedin))
    {
      if (! glome.prefs.enabled)
      {
        jQuery('#glome-ad-display').hide();
        jQuery('.glome-switch').removeAttr('checked');
        jQuery('#glome-off').show();
        jQuery('#glome-no-ads').hide();
      }
      else
      {
        jQuery('.glome-switch').attr('checked', 'true');
        jQuery('#glome-off').hide();

        if (glome.glome_new_ad_stack.length > 0)
        {
          jQuery('#glome-controls-icon-counter-value').attr('value', glome.glome_new_ad_stack.length);
          jQuery('#glome-controls-icon-counter-value').show();
          jQuery('#glome-no-ads').hide();
        }
        else
        {
          jQuery('#glome-controls-icon-counter-value').hide();
          jQuery('#glome-no-ads').show();
        }
      }
    }
    else
    {
      jQuery('#glome-controls-icon-counter-value').hide();
      if (glome.prefs.password_protection && ! glome.prefs.loggedin)
      {
        //window.jQuery('#main-window').attr('state', 'disabled');
        window.jQuery('#glome-controls-icon-counter-value').hide();
        window.jQuery('#glome_power_switch').hide();
      }
    }
  }
  glome.log.debug('statechange handled');
});
