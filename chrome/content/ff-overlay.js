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
    jQuery('#glome-panel')
      .attr
      (
        {
          width: jQuery('#browser').width(),
          height: jQuery('#browser').height()
        }
      );
  },
  
  /**
   * Change Glome state from the toolbar icon
   */
  ChangeState: function()
  {
    glomeOverlay.log.debug('Change state initiated');
    
    var state = glome.glomeSwitch('enabled');
    var domain = glome.glomeGetCurrentDomain();
    
    // Set the checkbox status
    if (!glome.glomePrefs.enabled)
    {
      jQuery('.glome-switch').removeAttr('checked');
      glomeOverlay.HideStack();
      
      content.document.glomeblock = null;
    }
    else
    {
      jQuery('.glome-switch').attr('checked', 'true');
    }
    
    if (!domain)
    {
      return;
    }
    
    var element = jQuery('#glome-switch-domain');
    var overlay = jQuery('#main-window');
    
    // Remove the current domain from the disabled list
    if (state)
    {
      element.attr('domain', 'working');
      overlay.attr('state', 'active');
      glomeOverlay.log.debug('glome set on, hide domain switcher');
      glome.glomePrefs.enableForDomain(domain);
    }
    else
    {
      element.attr('domain', glomeOverlay.GetPanelState());
      element.get(0).hidden = false;
      overlay.attr('state', 'disabled');
      glomeOverlay.log.debug('glome set on, reveal domain switcher');
    }
    
    glome.glomeUpdateTicker();
    glomeOverlay.WidgetShow();
    glomeOverlay.AdStateChange();
    
    glomeOverlay.log.debug('Change state finished');
  },
  
  /**
   * Change the panel state according to Glome status and domain restrictions:
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
    if (glome.glomePrefs.enabled)
    {
      return 'working';
    }
    
    var domain = glome.glomeGetCurrentDomain();
    
    if (!domain)
    {
      return 'undefined';
    }
    
    return glome.glomePrefs.getDomainStatus(domain).toString();
  },
  
  /**
   * Switch the state for the current domain
   */
  ChangeDomainState: function()
  {
    var domain = glome.glomeGetCurrentDomain();
    
    if (!domain)
    {
      return;
    }
    
    var element = document.getElementById('glome-switch-domain');
    
    // Toggle the status
    var status = glome.glomePrefs.getDomainStatus(domain);
    switch (status)
    {
      // Enable Glome globally and enable for domain
      case 'on':
        glome.glomePrefs.enableForDomain(domain);
        glome.glomeTogglePref('enabled');
        break;
      
      // Enable Glome globally, disable for domain and hide popup
      case 'off':
        glome.glomePrefs.disableForDomain(domain);
        glome.glomeTogglePref('enabled');
        glomeOverlay.WidgetHide();
        break;
    }
    
    // Update with new status
    element.setAttribute('domain', glome.glomePrefs.getDomainStatus(domain));
    glomeOverlay.AdStateChange();
  },
  
  /**
   * Change the advertisement visible on knocker
   * 
   * @param int dt    Delta for ad display related to current
   */
  ChangeKnockingItem: function(dt)
  {
    glomeOverlay.log.debug('glomeOverlay.ChangeKnockingItem');
    
    if (!dt)
    {
      var dt = 0;
    }
    
    if (glomeOverlay.knockType == 'ad')
    {
      var items = glome.glome_ad_stack;
    }
    else
    {
      var items = new Array();
      for (i in glome.glome_ad_categories)
      {
        if (!glome.glome_ad_categories_count[i])
        {
          continue;
        }
        items.push(glome.glome_ad_categories[i]);
      }
    }
    
    jQuery('#glome-ad-display').attr('mode', glomeOverlay.knockType);
    
    var item_count = items.length;
    
    if (!item_count)
    {
      jQuery('#glome-controls-wrapper').find('.active').attr('hidden', true);
    }
    else
    {
      jQuery('#glome-controls-wrapper').find('.active').removeAttr('hidden');
    }
    
    if (item_count == 1)
    {
      jQuery('#glome-ad-pager').parent().attr('hidden', 'true');
    }
    else
    {
      jQuery('#glome-ad-pager').parent().removeAttr('hidden');
    }
    
    if (!glomeOverlay.knockIndex)
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
    jQuery('#glome-ad-pager-page').attr('value', (index + 1) + '/' + item_count);
    
    if (glomeOverlay.knockType == 'ad')
    {
      glomeOverlay.ad_id = selected.id;
      jQuery('#glome-ad-pager').attr('data-ad', selected.id);
      jQuery('#glome-ad-pager').attr('data-category', JSON.stringify(selected.adcategories));
      document.getElementById('glome-ad-description-title').textContent = selected.title;
    }
    else
    {
      var text = jQuery('#glome-controls-wrapper').find('.active').find('.label.category').attr('value');
      var category = selected.id;
      glomeOverlay.category = category;
      
      text = text.replace(/\-s/, glome.glome_ad_categories_count[category]);
      text = text.replace(/\-c/, selected.name);
      
      jQuery('#glome-ad-pager').attr('data-ad', null);
      jQuery('#glome-ad-pager').attr('data-category', selected.id);
      document.getElementById('glome-ad-description-title').textContent = selected.name;
      jQuery('#glome-ad-description-value').attr('value', text);
    }
    
    // Randomize value in this point
    //var worth = Math.round(Math.random() * 10000) / 100;
    
    //jQuery('#glome-ad-description-value').attr('value', 'Up to ' + worth + ' e per order');
  },
  
  /**
   * Process the popup right before showing it
   */
  WidgetShow: function()
  {
    // Check from counter how many items there are and display content accordingly
    if (glome.glome_ad_stack.length == 0)
    {
      glomeOverlay.knockType = 'category';
/*
      jQuery('#glome-controls-wrapper').find('.active.single').attr('hidden');
      var max = 0;
      var selected = null;
      var category = null;
      
      for (i in glome.glome_ad_categories_count)
      {
        var count = glome.glome_ad_categories_count[i];
        if (max < count)
        {
          if (typeof glome.glome_ad_categories[i] == 'undefined')
          {
            continue;
          }
          
          max = count;
          selected = i;
          category = glome.glome_ad_categories[i];
        }
      }
      
      if (category)
      {
        jQuery('#glome-controls-wrapper').find('.active.single').attr('hidden', 'true');
        jQuery('#glome-controls-wrapper').find('.active.category').removeAttr('hidden');
        jQuery('#glome-controls-wrapper').find('.active.category').attr('data-catid', selected);
        
        var action = jQuery('#glome-controls-wrapper').find('.active.category').find('.link');
        
        label.attr('hidden', 'true');
        label.next('description').remove();
        
        if (!label.attr('data-text'))
        {
          label.attr('data-text', label.attr('value'));
        }
        
        if (!action.attr('data-text'))
        {
          action.attr('data-text', action.attr('value'));
        }
        
        // Reformat with variable
        var text = jQuery('#glome-controls-wrapper').find('.active').find('.label.category').attr('value');
        text = text.replace(/\-s/, max);
        text = text.replace(/\-c/, category.name);
        
        jQuery('<description />')
          .text(text)
          .insertAfter(label);
        
        action
          .unbind('click')
          .bind('click', function()
          {
            var cat_id = Number(jQuery(this).parents('[data-catid]').attr('data-catid'));
            glomeOverlay.log.error('Category id: ' + cat_id);
            
            if (!cat_id)
            {
              return;
            }
            
            document.getElementById('glome-controls-window').hidePopup();
            var stack = jQuery('#glome-panel');
            stack.attr('view', 'category');
            
            stack.get(0).openPopup(document.getElementById('browser'), null, 0, 0);
            window.gBrowser.selectedTab.setAttribute('glomepanel', 'visible');
            
            // Populate with ads of the category
            glomeOverlay.ListCategoryAds(cat_id);
          });
        
        jQuery('#glome-controls-wrapper').find('.active.category').attr('data-catid', selected);
        return;
      }
      else
      {
        jQuery('#glome-controls-wrapper').find('.active.category').attr('hidden', 'true');
      }
*/
    }
    else
    {
      glomeOverlay.knockType = 'ad';
    }
    
    glomeOverlay.log.debug('Widget show');
    var state = glomeOverlay.GetPanelState();
    glomeOverlay.log.debug('--state: ' + state);
    jQuery('#glome-switch-domain').attr('domain', state);
    
    if (state == 'working')
    {
      jQuery('.glome-switch').attr('checked', 'true');
    }
    else
    {
      jQuery('.glome-switch').removeAttr('checked');
    }
    
    glomeOverlay.ChangeKnockingItem();
    glomeOverlay.log.debug('Widget shown');
  },
  
  /**
   * Hide the popup
   */
  WidgetHide: function()
  {
    document.getElementById('glome-controls-window').hidePopup();
  },
  
  OpenCategoryView: function(cat_id)
  {
    document.getElementById('glome-controls-window').hidePopup();
    
    if(!cat_id)
    {
      cat_id = glomeOverlay.category;
    }
    
    if (!cat_id)
    {
      stored = JSON.parse(jQuery('#glome-ad-pager').attr('data-category'));
      for (i in stored)
      {
        cat_id = stored[i];
        break;
      }
    }
    
    if (!cat_id)
    {
      return;
    }
    
    var stack = jQuery('#glome-panel');
    stack.attr('view', 'category');
    
    stack.get(0).openPopup(document.getElementById('browser'), null, 0, 0);
    window.gBrowser.selectedTab.setAttribute('glomepanel', 'visible');
    
    jQuery('#glome-overlay-category')
      .find('button.no')
      .unbind('click')
      .bind('click', function(e)
      {
        glome.glomeCategorySubscription(jQuery('#glome-overlay-category').attr('data-id'), false);
        
        // Hide the ad displayer
        glomeOverlay.HideStack();
        window.gBrowser.selectedTab.removeAttribute('glomepanel');
      });
    
    // Calculate the length according to the category
    var label = stack.find('.show-all-s');
    let text = label.attr('data-original');
    
    if (!text)
    {
      text = label.attr('value');
      label.attr('data-original', text);
    }
    
    
    // Change the titles
    jQuery('#glome-panel').find('.category-title').attr('value', glome.glome_ad_categories[cat_id].name);
    
    // Get the count
    var count = glome.glome_ad_categories_count[cat_id];
    
    jQuery('#glome-overlay-category').attr('data-count', count);
    jQuery('#glome-overlay-category').attr('data-id', cat_id);
    
    if (!count)
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
  
  DisplayAd: function(ad_id)
  {
    if (!ad_id)
    {
      var ad_id = jQuery('#glome-ad-pager').attr('data-ad');
    }
    
    if (!ad_id)
    {
      return false;
    }
    
    // Get the ad to be displayed
    var ad = glome.glomeGetAd(ad_id);
    
    var container = jQuery(document).find('#glome-overlay-single');
    
    // Set the view mode to single item
    jQuery('#glome-panel').attr('view', 'single');
    
    // Remove the currently displayed ad
    
    switch (ad.adtype)
    {
      case 'image':
        container.find('#glome-overlay-single-image').css('background-image', 'url("' + ad.content + '")');
        
  /*
        var img = container.find('#glome-overlay-single-image').find('image');
        img.attr
        (
          {
            src: ad.content,
            width: ad.width,
            height: ad.height,
          }
        );
  */
        
        container.find('label.header').attr('value', ad.title);
        container.find('.description description').get(0).textContent = ad.description;
        
        break;
    }
    
    // Set the category title
    for (i in ad.adcategories)
    {
      cat_id = ad.adcategories[i];
      jQuery('#glome-panel').find('.category-title').attr('value', glome.glome_ad_categories[cat_id].name);
    }
    
    // Redirect to the vendor page and close the ad display
    container.find('.action.yes')
      .attr('action', ad.action)
      .unbind('click')
      .bind('click', function(e)
      {
        glomeOverlay.GotoAd(glomeOverlay.ad_id);
        return false;
      });
    
    // Set the ad as uninterested and close the ad display
    container.find('.action.no')
      .unbind('click')
      .bind('click', function(e)
      {
        // Set ad status to uninterested
        glome.glomeSetAdStatus(glomeOverlay.ad_id, glome.GLOME_AD_STATUS_UNINTERESTED);
        
        var cat_id = null;
        
        // Display the category view
        for (i = 0; i < glome.glome_ad_stack; i++)
        {
          if (glome.glome_ad_stack[i].id == glomeOverlay.ad_id)
          {
            for (var k = 0; k < glome.glome_ad_stack[i].adcategories.length; k++)
            {
              cat_id = glome.glome_ad_stack[i].adcategories[k];
              break;
            }
            break;
          }
        }
        
        glomeOverlay.OpenCategoryView(cat_id);
        
        // Update ticker to match the new view count
        glome.glomeUpdateTicker();
        
        return false;
      });
    
    document.getElementById('glome-panel').openPopup(document.getElementById('browser'), null, 0, 0);
    document.getElementById('glome-controls-window').hidePopup();
      
    // Set ad as displayed
    //glome.glomeSetAdStatus(glomeOverlay.ad_id, glome.GLOME_AD_STATUS_VIEWED);
  },
  
  GotoAd: function(ad_id)
  {
    glomeOverlay.WidgetHide();
    
    // Create a new browser tab
    for (let i = 0; i < glome.glome_ad_stack.length; i++)
    {
      if (glome.glome_ad_stack[i].id == ad_id)
      {
        window.gBrowser.selectedTab.setAttribute('glomepanel', jQuery('#glome-panel').attr('view'));
        window.gBrowser.selectedTab = window.gBrowser.addTab(glome.glome_ad_stack[i].action);
        
        // Set ad status to clicked
        glome.glomeSetAdStatus(ad_id, glome.GLOME_AD_STATUS_CLICKED);
        
        // Remove this ad from ads list
        glome.glome_ad_stack.splice(i, 1);
        
        return;
      }
    }
  },
  
  /*
  <box id="glome-overlay-categories-list-template" class="list-item template">
    <box class="thumbnail">
      <description></description>
    </box>
    <vbox flex="1">
      <label class="h2" value="" />
      <label value="Up to 13 per order." />
    </vbox>
    <vbox class="buttons">
      <button>See ad</button>
      <button>Not now</button>
    </vbox>
  </box>
  */
  
  HideStack: function()
  {
    window.gBrowser.selectedTab.removeAttribute('glomepanel');
    document.getElementById('glome-panel').hidePopup();
  },
  
  AdStateChange: function()
  {
    // Display ads if Glome is off or disabled for this domain
    var domain = glome.glomeGetCurrentDomain();
    var status = glome.glomePrefs.getDomainStatus(domain);
    glomeOverlay.log.debug('glomeOverlay.AdStateChange');
    glomeOverlay.log.debug('enabled: ' + glome.glomePrefs.enabled);
    glomeOverlay.log.debug('-- typeof: ' + typeof glome.glomePrefs.enabled);
    glomeOverlay.log.debug('domain: ' + domain);
    glomeOverlay.log.debug('status: ' + status);
    
    if (   glome.glomePrefs.enabled === false
        || glome.glomePrefs.getDomainStatus(domain) === 'on')
    {
      glomeOverlay.RevealAds();
    }
    else
    {
      glomeOverlay.HideAds();
    }
  },
  
  RevealAds: function()
  {
    return;
    
    glomeOverlay.log.debug('glomeOverlay.RevealAds');
    jQuery(content.document).find('[data-glomeblock]')
      .removeAttr('hidden')
      .removeAttr('data-glomeblock');
  },
  
  HideAds: function()
  {
    return;
    
    glomeOverlay.log.debug('glomeOverlay.HideAds');
    var date = new Date();
    
    // Prevent this from being run more often than every 10 seconds
    if (   typeof content.document.glomeblock != 'undefined'
        && content.document.glomeblock > date.getTime() - 10 * 1000)
    {
      //log.debug('-- too fast, too soon');
      return;
    }
    
    content.document.glomeblock = date.getTime();
    var elements = jQuery(content.document).find('div').not('[data-glomeblock]');
    
    //var elements = jQuery(selected_tab.contentDocument).find('body, div, img, object, embed');
    glomeOverlay.log.debug('Found ' + elements.size() + ' elements');
    
    var filters = new Array();
    filters.push('ad-container');
    filters.push('Adtech');
    filters.push('banner');
    filters.push('advert');
    
    for (i = 0; i < elements.size(); i++)
    {
      var element = elements.eq(i);
      
      if (!element.attr('id'))
      {
        continue;
      }
      
      // Parent element has already been blocked
      if (element.attr('data-glomeblock') == 'true')
      {
        glomeOverlay.log.debug('-- already blocked');
        continue;
      }
      
      var values = new Array();
      var removable = false;
      
      glomeOverlay.log.debug('type: ' + element.get(0).tagName);
      
      switch (element.get(0).tagName.toLowerCase())
      {
        case 'img':
          values.push(element.attr('src'));
          break;
        
        case 'object':
        case 'embed':
          values.push(element.attr('src'));
          values.push(element.find('param[name="movie"]').attr('value'));
          //removable = true;
          break;
        
        case 'div':
        case 'body':
          values.push(element.attr('id'));
          values.push(element.css('background-image'));
          values.push(element.css('list-style-image'));
          break;
      }
      
      // Remove empty values
      for (n = 0; n < values.length; n++)
      {
        if (!values[n])
        {
          values.splice(n, 1);
        }
      }
      
      if (!values.length)
      {
        continue;
      }
      
      for (n = 0; n < filters.length; n++)
      {
        glomeOverlay.log.debug('Create a filter for ' + filters[n]);
        var filter = new RegExp(filters[n]);
        var match = false;
        
        for (k = 0; k < values.length; k++)
        {
          var value = values[k];
          
          if (value.match(filter))
          {
            match = true;
            
            if (removable)
            {
              element.remove();
            }
            else
            {
              element.attr('data-glomeblock', 'true');
              element.attr('hidden', 'true');
              element.css('display', 'none !important');
            }
          }
        }
        
        // Already filtered out, no need to continue
        if (match)
        {
          continue;
        }
      }
    }
  },
  
  /**
   * Populate category list
   * 
   * @param int id    glome.sqlite:categories:id
   */
  ListCategoryAds: function(id)
  {
    glomeOverlay.log.error(glomeOverlay);
    glomeOverlay.log.error('selected category: ' + id);
    
    if (!id)
    {
      id = glomeOverlay.category;
      glomeOverlay.log.error('-- now: ' + id);
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
    
    var container = jQuery('#glome-overlay-categories-ads-list');
    var template = container.find('template').text();
    
    // Remove the old content
    container.find('> *').not('template').remove();
    
    // Get items for a category
    var ads = glome.glomeGetAdsForCategory(id);
    
    for (var i = 0; i < ads.length; i++)
    {
      // Copy the template
      var tmp = template;
      
      var ad = ads[i];
      
      // Replace with ad values
      while (regs = tmp.match(/::([a-z0-9_]+)/i))
      {
        var value = '';
        var key = regs[1];
        var regexp = new RegExp(regs[0], 'g');
        
        if (typeof ad[key] != 'undefined')
        {
          value = ad[key];
        }
        
        tmp = tmp.replace(regexp, value);
      }
      
      // Convert HTML to DOM
      jQuery(tmp).appendTo(container);
    }
    
    // Set actions
    container.find('.action.yes')
      .bind('click', function()
      {
        // Closing the last one, hide panel
        if (!jQuery(this).parents('.list-item').siblings('.list-item').size())
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
        if (!jQuery(this).parents('.list-item').siblings('.list-item').size())
        {
          glomeOverlay.HideStack();
        }
        
        var item = jQuery(this).parents('.list-item');
        var ad_id = Number(item.attr('data-id'));
        
        // Create a new browser tab
        for (let i = 0; i < glome.glome_ad_stack.length; i++)
        {
          if (glome.glome_ad_stack[i].id == ad_id)
          {
            // Remove this ad from ads list
            glome.glome_ad_stack.splice(i, 1);
          }
        }
        
        // Set ad status to uninterested
        glome.glomeSetAdStatus(ad_id, glome.GLOME_AD_STATUS_UNINTERESTED);
        
        item.remove();
      });
  }
  
}

/*
Glome.onFirefoxLoad = function(event) {
  document.getElementById("contentAreaContextMenu")
          .addEventListener("popupshowing", function (e){ Glome.showFirefoxContextMenu(e); }, false);
};

Glome.showFirefoxContextMenu = function(event) {
  // show or hide the menuitem based on what the context menu is on
  document.getElementById("context-glome").hidden = false;//gContextMenu.onImage;
};

window.addEventListener("load", function () { Glome.onFirefoxLoad(); }, false);
*/

/* !Event listeners */

/* !Window DOMContentLoaded event */
/**
 * Bind Glome to DOM content loader event. This is to catch each and every page load
 * by Glome in order to know when to reveal or hide content
 */
window.addEventListener('DOMContentLoaded', function(e)
{
  glomeOverlay.AdStateChange();
  glomeOverlay.domain = glome.glomeGetCurrentDomain();
  
  // Initialize page
  glome.glomeInitPage(e);
  
}, false);

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
  jQuery('#glome-controls').insertAfter(jQuery('#browser'));
  
  if (typeof glomeOverlay.log == 'undefined')
  {
    // Connect to the Glome glomeOverlay.logging method
    glomeOverlay.log = new glome.glome.log();
    glomeOverlay.log.level = 3;
  }
  
  glomeOverlay.AdStateChange();
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
  
}, false);

/* !Tab select */
/**
 * Bind Glome to tab selection events. Trigger here the code that will process the page
 * (i.e. ad blocking and Glome status changes)
 */
window.addEventListener('TabSelect', function(e)
{
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
  if (!stack_panel)
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
  
  // Initialize page
  glome.glomeInitPage(e);
  glome.updateTicker();
  
  // Hide the Glome popup
  glomeOverlay.WidgetHide();
  glomeOverlay.AdStateChange();
  
/*
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
  
  
  for (var found = false, index = 0, tabbrowser = wm.getEnumerator('navigator:browser').getNext().gBrowser;
      index < tabbrowser.tabContainer.childNodes.length && !found;
      index++)
  {
      // Get the next tab
      var currentTab = tabbrowser.tabContainer.childNodes[index];
  
      // Does this tab contain our custom attribute?
      if (currentTab.hasAttribute('glomepanel'))
      {
        var mode = currentTab.getAttribute('glomepanel');
        
        var stack = jQuery('#glome-panel');
        stack.attr('view', mode);
        
        stack.get(0).openPopup(document.getElementById('browser'), null, 0, 0);
      }
  }
*/

}, false);

/* !Window resize */
window.addEventListener('resize', glomeOverlay.Resize, false);

