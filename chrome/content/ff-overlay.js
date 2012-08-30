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
  // Initialize page
  glome.glomeInitPage(e);
  
  // Hide the Glome popup
  glomePopupHide();
  
}, false);

/**
 * Change Glome state from the toolbar icon
 */
function glomeChangeState()
{
  glome.glome.LOG('Change state initiated');
  
  var state = glome.glomeSwitch('enabled');
  var domain = glome.glomeGetCurrentDomain();
  
  if (!domain)
  {
    //return;
    domain = 'www.google.fi';
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
      glomePopupHide();
      break;
  }
  
  // Update with new status
  element.setAttribute('domain', glome.glomePrefs.getDomainStatus(domain));
}

/**
 * Process the popup right before showing it
 */
function glomePopupShow()
{
  var state = glomeGetPanelState();
  document.getElementById('glome-switch-domain').setAttribute('domain', state);
  
  // Set the checkbox status
  if (!glome.glomePrefs.enabled)
  {
    document.getElementById('glome_power_switch').removeAttribute('checked');
  }
  else
  {
    document.getElementById('glome_power_switch').setAttribute('checked', 'true');
  }
  
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
  dump('page: ' + glome.page + ', pages: ' + glome.pages + ', dt: ' + dt + '\n')
  
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
  dump('-- index: ' + index + '\n')
  
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
function glomePopupHide()
{
  document.getElementById('glome-controls-window').hidePopup();
}

function glomeOpenCategoryView(cat_id)
{
  var stack = jQuery('#ad-stack-panel');
  stack.attr('view', 'category');
  
  stack.get(0).openPopup(document.getElementById('browser'), null, 0, 0);
  
  jQuery('#ad-overlay-category')
    .find('button.no')
    .unbind('click')
    .bind('click', function(e)
    {
      glome.glomeCategorySubscription(1, false);
      
      // Hide the ad displayer
      document.getElementById('ad-stack-panel').hidePopup();
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
  
  jQuery('#ad-overlay-category')
    .find('button.yes')
    .unbind('click')
    .bind('click', function(e)
    {
      // Populate with ads of the category
      jQuery('#ad-overlay-categories-list')
        .populate_category_list(1);
      
      jQuery('#ad-stack-panel').attr('view', 'list');
    });
  
  document.getElementById('glome-controls-window').hidePopup();
}

function glomeDisplayAd()
{
  // Get the ad to be displayed
  var ad = glome.glomeGetAd(glome.ad_id);
  
  var container = jQuery(document).find('#ad-overlay-single');
  
  // Set the view mode to single item
  jQuery('#ad-stack-panel').attr('view', 'single');
  
  // Remove the currently displayed ad
  dump('Got ' + container.size() + ' container\n');
  
  switch (ad.adtype)
  {
    case 'image':
      container.find('#ad-overlay-single-image').css('background-image', 'url("' + ad.content + '")');
      dump(container.find('#ad-overlay-single-image').css('background-image') + '\n');
      
/*
      var img = container.find('#ad-overlay-single-image').find('image');
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
      // Create a new browser tab
      window.gBrowser.selectedTab = window.gBrowser.addTab(jQuery(this).attr('action'));
      
      // Set ad status to clicked
      glome.glomeSetAdStatus(glome.ad_id, glome.GLOME_AD_STATUS_CLICKED);
      
      // Hide the ad displayer
      document.getElementById('ad-stack-panel').hidePopup();
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
      document.getElementById('ad-stack-panel').hidePopup();
      
      // Update ticker to match the new view count
      glome.glomeUpdateTicker();
      
      return false;
    });
  
  glomeExtract(ad);
  
  document.getElementById('ad-stack-panel').openPopup(document.getElementById('browser'), null, 0, 0);
  document.getElementById('glome-controls-window').hidePopup();
    
  // Set ad as displayed
  //glome.glomeSetAdStatus(glome.ad_id, glome.GLOME_AD_STATUS_VIEWED);
}

function glomeExtract(target)
{
  return glome.glomeExtract(target);
}

jQuery.fn.populate_category_list = function(id)
{
  // @TODO: Get the ads of this particular category. This needs changes to data API on Glome server
  // and cannot be finished before that.
  
  
}