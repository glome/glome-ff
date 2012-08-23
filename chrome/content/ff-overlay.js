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
    //return;
    domain = 'www.google.fi';
  }
  
  return glome.glomePrefs.getDomainStatus(domain).toString();
}

function glomeChangeDomainState()
{
  var domain = glome.glomeGetCurrentDomain();
  
  if (!domain)
  {
    //return;
    domain = 'www.google.fi';
  }
  
  var element = document.getElementById('glome-switch-domain');
  
  // Toggle the status
  var status = glome.glomePrefs.getDomainStatus(domain);
  switch (status)
  {
    case 'on':
      glome.glomePrefs.enableForDomain(domain);
      break;
    
    case 'off':
      glome.glomePrefs.disableForDomain(domain);
      break;
  }
  
  // Update with new status
  element.setAttribute('domain', glome.glomePrefs.getDomainStatus(domain));
}