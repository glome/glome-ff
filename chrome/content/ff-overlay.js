// This is probably obsolete after changing to floating Glome icon
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

/**
 * Bind Glome to DOM content loader event. This is to catch each and every page load
 * by Glome in order to know when to reveal or hide content
 */
window.addEventListener('DOMContentLoaded', function(e)
{
  // Initialize page
  glome.glomeInitPage(e);
}, false);

/**
 * Bind Glome to tab selection events. Trigger here the code that will process the page
 * (i.e. ad blocking and Glome status changes)
 */
window.addEventListener('TabSelect', function(e)
{
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
  
  // Hide the Glome popup
  glomeWidgetHide();
  
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

/**
 * Resize Glome related canvases according to the resizing of the main window
 * 
 * @param Object e    onresize event
 */
function glomeResize(e)
{
  jQuery('#glome-panel')
    .attr
    (
      {
        width: jQuery('#browser').width(),
        height: jQuery('#browser').height()
      }
    );
}

// Register window resize events
window.addEventListener('resize', glomeResize, false);

/**
 * Change Glome state from the toolbar icon
 */
function glomeChangeState()
{
  glome.glome.LOG('Change state initiated');
  
  var state = glome.glomeSwitch('enabled');
  var domain = glome.glomeGetCurrentDomain();
  
  // Set the checkbox status
  if (!glome.glomePrefs.enabled)
  {
    jQuery('.glome-switch').removeAttr('checked');
    glomeHideStack();
  }
  else
  {
    jQuery('.glome-switch').attr('checked', 'true');
  }
  
  if (!domain)
  {
    return;
  }
  
  var element = document.getElementById('glome-switch-domain');
  var overlay = document.getElementById('main-window');
  
  glome.glome.LOG(typeof element);
  
  // Remove the current domain from the disabled list
  if (state)
  {
    element.setAttribute('domain', 'working');
    overlay.setAttribute('state', 'active');
    glome.glome.LOG('glome set on, hide domain switcher');
    glome.glomePrefs.enableForDomain(domain);
  }
  else
  {
    element.setAttribute('domain', glomeGetPanelState());
    element.hidden = false;
    overlay.setAttribute('state', 'disabled');
    glome.glome.LOG('glome set on, reveal domain switcher');
  }
  
  glome.glome.LOG('Change state finished');
}

/**
 * Change the panel state according to Glome status and domain restrictions:
 * 
 * 'working' if Glome is up and running everywhere
 * 'on' if Glome is off and the current domain is not disabled
 * 'off' if Glome is off and the current domain is explicitly disabled
 * 
 * @return string
 */
function glomeGetPanelState()
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
}

/**
 * Switch the state for the current domain
 */
function glomeChangeDomainState()
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
      glomeWidgetHide();
      break;
  }
  
  // Update with new status
  element.setAttribute('domain', glome.glomePrefs.getDomainStatus(domain));
}

/**
 * Process the popup right before showing it
 */
function glomeWidgetShow()
{
  var state = glomeGetPanelState();
  document.getElementById('glome-switch-domain').setAttribute('domain', state);
  
  glomeChangeKnockingAd();
}

/**
 * Change the advertisement visible on knocker
 * 
 * @param int dt    Delta for ad display related to current
 */
function glomeChangeKnockingAd(dt)
{
  if (!dt)
  {
    var dt = 0;
  }
  
  glome.pages = glome.glome_ad_stack.length;
  
  if (!glome.pages)
  {
    jQuery('#glome-controls-wrapper').find('.active').attr('hidden', true);
  }
  else
  {
    jQuery('#glome-controls-wrapper').find('.active').removeAttr('hidden');
  }
  
  if (!glome.page)
  {
    glome.page = 0;
  }
  
  glome.page += dt;
  
  if (glome.page < 0)
  {
    glome.page = glome.pages - 1;
  }
  
  if (glome.page >= glome.pages)
  {
    glome.page = 0;
  }
  
  index = glome.page;
  
  // Display ad
  var ad = glome.glome_ad_stack[index];
  
  glome.ad_id = ad.id;
  
  var current = index + 1;
  
  jQuery('#glome-ad-pager-page').attr('value', (index + 1) + '/' + glome.pages);
  
  // Randomize value in this point
  var worth = Math.round(Math.random() * 10000) / 100;
  
  document.getElementById('glome-ad-description-title').textContent = ad.title;
  jQuery('#glome-ad-description-value').attr('value', 'Up to ' + worth + ' e per order');
}

/**
 * Hide the popup
 */
function glomeWidgetHide()
{
  document.getElementById('glome-controls-window').hidePopup();
}

function glomeOpenCategoryView(cat_id)
{
  var stack = jQuery('#glome-panel');
  stack.attr('view', 'category');
  
  stack.get(0).openPopup(document.getElementById('browser'), null, 0, 0);
  window.gBrowser.selectedTab.setAttribute('glomepanel', 'visible');
  
  jQuery('#glome-overlay-category')
    .find('button.no')
    .unbind('click')
    .bind('click', function(e)
    {
      glome.glomeCategorySubscription(1, false);
      
      // Hide the ad displayer
      glomeHideStack();
      window.gBrowser.selectedTab.removeAttribute('glomepanel');
    });
  
  // @TODO: calculate the length according to the category. Requires changes in Glome data API
  var label = stack.find('.show-all-s');
  let text = label.attr('data-original');
  
  if (!text)
  {
    text = label.attr('value');
    label.attr('data-original', text);
  }
  
  label.attr('value', text.replace(/ s /, ' ' + glome.glome_ad_stack.length + ' '))
  
  jQuery('#glome-overlay-category')
    .find('button.yes')
    .unbind('click')
    .bind('click', function(e)
    {
      // Populate with ads of the category
      jQuery('#glome-overlay-categories-list')
        .populate_category_list(1);
      
      jQuery('#glome-panel').attr('view', 'list');
    });
  
  document.getElementById('glome-controls-window').hidePopup();
}

function glomeDisplayAd(ad_id)
{
  if (!ad_id)
  {
    let ad_id = glome.ad_id;
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
  
  // Redirect to the vendor page and close the ad display
  container.find('.action.yes')
    .attr('action', ad.action)
    .unbind('click')
    .bind('click', function(e)
    {
      glomeGotoAd(glome.ad_id);
      return false;
    });
  
  // Set the ad as uninterested and close the ad display
  container.find('.action.no')
    .unbind('click')
    .bind('click', function(e)
    {
      // Set ad status to uninterested
      glome.glomeSetAdStatus(glome.ad_id, glome.GLOME_AD_STATUS_UNINTERESTED);
      
      // Hide the ad displayer
      glomeHideStack();
      
      // Update ticker to match the new view count
      glome.glomeUpdateTicker();
      
      return false;
    });
  
  document.getElementById('glome-panel').openPopup(document.getElementById('browser'), null, 0, 0);
  document.getElementById('glome-controls-window').hidePopup();
    
  // Set ad as displayed
  //glome.glomeSetAdStatus(glome.ad_id, glome.GLOME_AD_STATUS_VIEWED);
}

function glomeExtract(target)
{
  return glome.glomeExtract(target);
}

function glomeGotoAd(ad_id)
{
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
}

jQuery.fn.populate_category_list = function(id)
{
  // Set the view mode to single item
  jQuery('#glome-panel').attr('view', 'list');
  
  var container = jQuery('#glome-overlay-categories-ads-list');
  var template = container.find('template').text();
  
  // Remove the old content
  container.find('> *').not('template').remove();
  
  for (var i = 0; i < glome.glome_ad_stack.length; i++)
  {
    // Copy the template
    var tmp = template;
    
    var ad = glome.glome_ad_stack[i];
    glome.glomeExtract(ad);
    
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
        glomeHideStack();
      }
      
      var item = jQuery(this).parents('.list-item');
      var ad_id = Number(item.attr('data-id'));
      glomeGotoAd(ad_id);
      item.remove();
    });
  
  container.find('.action.no')
    .bind('click', function()
    {
      // Closing the last one, hide panel
      if (!jQuery(this).parents('.list-item').siblings('.list-item').size())
      {
        glomeHideStack();
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

setTimeout(function()
{
  document.getElementById('glome-panel').openPopup(document.getElementById('browser'), null, 0, 0);
  jQuery('#glome-overlay-categories-list').populate_category_list(1);
}, 1500);


function glomeHideStack()
{
  window.gBrowser.selectedTab.removeAttribute('glomepanel');
  document.getElementById('glome-panel').hidePopup();
}

