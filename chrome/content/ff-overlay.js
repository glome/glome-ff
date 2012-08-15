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
function glomeChangeState(id)
{
  state = window.glome.glomeSwitch('enabled', this);
  
  // Match the current domain
  var domain = current_url.match(/^.+:\/\/(.+?)(\/.*$|$)/)[1];
  alert(domain);
  
  if (state)
  {
    // @TODO: remove current domain
    // window.glome.glomeEnableDomain(window.glome.glomeGetCurrentDomain());
    return true;
  }
  
  // @TODO: Suggest to turn off for just this site
}

/**
 * Switch the state of a domain
 * 
 * @param String domain    Domain that needs to be switched
 * @return boolean         Success status
 */
function glomeSwitchDomain(domain)
{
  if (!domain)
  {
    domain = glome.glomeGetCurrentDomain();
  }
  
  // @TODO: Get requested domain status
  // status = glome.glomeGetDomainStatus(domain);
  
  // @TODO: Switch domain
  if (status)
  {
    //glome.glomeDisableDomain(domain);
  }
  else
  {
    //glome.glomeEnableDomain(domain);
  }
}