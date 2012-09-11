var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                             .getService(Components.interfaces.nsIWindowMediator);
                     
var Notification = (function()
{
  Notification.prototype.DEFAULTS =
  {
    onYes: null,
    onNo: null,
    onLater: null,
    
    // Preferred notification types
    types: ['local', 'remote'],
    
    // Iframe location
    frameSrc: null,
    
    // Locally displayed content
    content: null,
    
    // Media
    mediaType: null,
    mediaSrc: null
  };
  
  function Notification(title, cid, opts)
  {
    glome.LOG('Notification constructor called');
    glome.LOG([title, cid, opts]);
    
    this.title = title;
    this.cid = cid;
    this.opts = opts; // @TODO: merge with defaults
    
    mainWindow = windowMediator.getMostRecentWindow("navigator:browser");
    this.gBrowser = mainWindow.gBrowser;
    this.nb = this.gBrowser.getNotificationBox();
    
    jQuery('#glome-status').addClass('pending');
  }
  
  Notification.prototype.handleYesClicked = function(e)
  {
    glome.LOG('Yes clicked');        
    this.n.close();
    jQuery('#glome-status').removeClass('pending');
    
    if (this.opts.onYes)
    {
      this.opts.onYes.apply(this);
    }
  }
  
  Notification.prototype.handleNoClicked = function(e)
  {
    glome.LOG('No clicked');
    glome.LOG('send cid to profile decline list');
    this.n.close();
    jQuery('#glome-status').removeClass('pending');
    
    if (this.opts.onNo)
    {
      this.opts.onNo.apply(this);
    }
  }
  
  Notification.prototype.handleLaterClicked = function(e)
  {
      glome.LOG('Later clicked');
      glome.LOG('send cid to profile later list');
      this.n.close();
      jQuery('#glome-status').removeClass('pending');
      
      if (this.opts.onLater)
      {
        this.opts.onLater.apply(this);
      }
  }
  
  Notification.prototype.show = function()
  {
    glome.LOG('Notification::show');
    
    var id = 'glome-ad-notif-' + this.cid;
    glome.LOG('notification id: '+id);
    
    this.n = this.nb.getNotificationWithValue(id);
    if (!this.n)
    {
      this.nb.appendNotification('', id, '', this.nb.PRIORITY_INFO_HIGH, []);
      this.n = this.nb.getNotificationWithValue(id);
      
      var p = this.n.ownerDocument.getAnonymousElementByAttribute(this.n, 'anonid', 'details');
      var cb = p.parentElement.getElementsByClassName('messageCloseButton')[0];
      cb.setAttribute('hidden', true);
      
      var b = this.n.ownerDocument.createElement("hbox"); // create a new XUL menuitem
      b.setAttribute('flex', '1');
      b.setAttribute('glome-attr', '1');
      b.setAttribute('align', 'center');

      var img = this.n.ownerDocument.createElement('image');
      img.setAttribute('src', "chrome://glome/skin/icons/glome-32x32.png");
      img.setAttribute('class', 'messageLogo');
      b.appendChild(img);

      var title = this.n.ownerDocument.createElement('label');
      title.setAttribute('value', this.title);
      b.appendChild(title);
      
      var buttons = this.n.ownerDocument.createElement('hbox');
      
      var _self = this;
      
      var acceptButton = this.n.ownerDocument.createElement('button');
      acceptButton.setAttribute('label', 'Yes');
      acceptButton.addEventListener('click', function(e){_self.handleYesClicked(e);});
      buttons.appendChild(acceptButton);
      
      var noButton = this.n.ownerDocument.createElement('button');
      noButton.setAttribute('label', 'No');
      noButton.addEventListener('click', function(e){_self.handleNoClicked(e);});
      buttons.appendChild(noButton);
      
      var laterButton = this.n.ownerDocument.createElement('button');
      laterButton.setAttribute('label', 'Later');
      laterButton.addEventListener('click', function(e){_self.handleLaterClicked(e);});
      buttons.appendChild(laterButton);
      
      b.appendChild(buttons);
      
      p.parentNode.replaceChild(b, p);
      
      // DEBUG: lazy clicker problem here. Remove this before commits.
      //this.handleYesClicked();
    }
    this.n.persistence = 10;
  }
  
  return Notification;
})();

glome.notifications =
{
  create: function(title, cid, opts)
  {
    return new Notification(title, cid, opts);
  }  
};

