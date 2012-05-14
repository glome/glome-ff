var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                               .getService(Components.interfaces.nsIWindowMediator);
                               
var AdModal = (function() {
  AdModal.prototype.DEFAULTS = {
  };
    
  function AdModal(cid, opts) {
    glome.LOG("AdModal::constructor");
    this.cid = cid;
    this.opts = opts;
    
    // @TODO: we need a safer way to open the modal window. This breaks if there
    // is ANY other window (e.g. console) opened after without user actions, e.g. on start up
    this.win = windowMediator.getMostRecentWindow("navigator:browser");
    
    this.doc = this.win.document;
    this.mw = this.doc.getElementById('main-window');
  }
  
  AdModal.prototype.hide = function(cid)
  {
    if (!cid)
    {
      cid = this.cid;
    }
    
    if (!cid)
    {
      return false;
    }
    
    // Get opened stacks and filter the one that is displaying the ad modal
    var stacks = this.doc.getElementsByTagName('stack');
    
    for (var i = 0; i < stacks.length; i++)
    {
      if (stacks[i].modal == cid)
      {
        stacks[i].hidden = true;
      }
    }
  }
  
  AdModal.prototype.show = function()
  {
    glome.LOG("AdModal::show");
    
    var browserEnumerator = windowMediator.getEnumerator("navigator:browser");
    var tabbrowser = browserEnumerator.getNext().gBrowser;
    this.tab = tabbrowser.selectedTab;
    this.browser = tabbrowser.getBrowserForTab(this.tab);
    
    glome.LOG('browser: ' + this.browser);
    
    // Quick switch for the modal target
    var target = this.mw;
    
    if (   typeof this.opts.types == 'undefined'
        || typeof this.opts.types[0] == 'undefined')
    {
      this.opts.types = ['notfound'];
    }
    
    var stack = glome.jQuery(this.doc.getElementById('ad-stack'));
    
    // Bind to the context
    stack.get(0).modal = this.cid;
    
    var box = glome.jQuery(this.doc.getElementById('ad-overlay'));
    
    // Get the first available display type
    box.addClass('visible')
      .attr
      (
        {
          width: target.width,
          height: target.height,
          hidden: false
        }
      )
      .bind('click', function(e)
      {
        var cid = glome.jQuery(this).parent().get(0).modal;
        
        var modal = new AdModal();
        modal.hide(cid);
      });
    
    // Create a new modal panel
    var panel = glome.jQuery('<panel />')
      .css
      (
        {
          //'-moz-appearance': 'none'
        }
      )
      .attr
      (
        {
          id: 'glome-panel',
          noautohide: true,
          close: true,
          top: 0,
          left: 0
        }
      )
      .appendTo(target);
    
    // Add key listener
    
    stack
      .appendTo(panel);
    
    // Hide all ad layers on the display
    box.find('> *').not('stack').attr('hidden', true);
    box.parent().find('#ad-close')
      .attr('hidden', false)
      .bind('click', function(e)
      {
        var cid = glome.jQuery(this).parent().get(0).modal;
        
        var modal = new AdModal();
        modal.hide(cid);
      });
    
    // @TODO: this should be done according to preferences
    if (typeof this.opts.types[0] != 'undefined')
    {
      var type = this.opts.types[0];
    }
    else
    {
      var type = 'undefined';
    }
    
    glome.LOG('Display type: ' + type);
    
    // Create content
    switch (type)
    {
      case 'remote':
        var container = glome.jQuery('<box />')
          .attr('id', 'ad-content-remote')
          .appendTo(box);
        
        var iframe = glome.jQuery('<iframe />')
          .attr
          (
            {
              src: this.opts.frameSrc,
              hidden: false,
              width: container.width()
            }
          )
          .appendTo(container);
        break;
      
      case 'local':
        var container = glome.jQuery('<vbox />')
          .attr('id', 'ad-content-local')
          .appendTo(box);
        
        this.showLocal(this.opts, container);
        break;
      
      case 'undefined':
      default:
        box.find('#ad-content-notfound').attr('hidden', false);
    }
    
    // Open panel as an overlapping popup
    panel.get(0).openPopup(target, 'overlap');
  }
  
  AdModal.prototype.showLocal = function(opts, container)
  {
    container.attr('hidden', false);
    
    // Clear the container if it was already in use
    container.find('> *').remove();
    
    // @TODO: Add media types as needed
    switch (opts.mediaType)
    {
      case 'image':
        var image = glome.jQuery('<image />')
          .attr
          (
            {
              onload: function()
              {
                // Onload has to be added as attribute, there is
                // apparently no event for image onload in XUL.
                glome.LOG(this.boxObject.width + 'x' + this.boxObject.height);
              },
              src: opts.mediaSrc
            }
          )
          .appendTo(container);
        break;
      
      case 'flash':
        opts.content = '<embed id="ad_flash_layer" src="' + opts.mediaSrc + '" quality="high" width="100%" height="100%" align="middle" allowScriptAccess="all" type="application/x-shockwave-flash" swLiveConnect="true" pluginspage="http://www.macromedia.com/go/getflashplayer" />';
        break;
    }
    
    if (opts.content)
    {
      // content = opts.content.replace(/<(\/)?(?!html:)/g, '<$1html:');
      xmlns = opts.content.replace(/<(\/)?(?!html:)/g, '<$1html:');
      glome.LOG(xmlns);
      
      var iframe = glome.jQuery('<iframe />');
      iframe
        .addClass('content-iframe')
        .attr
        (
          {
            type: 'content',
            width: container.width(),
            flex: 1,
            src: 'data:text/html,' + encodeURIComponent(opts.content)
//            ' xmlns:html': 'http://www.w3.org/1999/xhtml'
          }
        )
//        .text(content)
        .appendTo(container);
      
      /*
      var content = this.doc.createElement('box');
      glome.jQuery('<label />')
          .attr('value', 'hubba bubba')
          .appendTo(content);
      
      glome.jQuery(content).appendTo(container);
      */
    }
  }
  
  return AdModal;
})();

glome.adModals = {
  create: function(cid, opts)
  {
    return new AdModal(cid, opts);
  }
};
