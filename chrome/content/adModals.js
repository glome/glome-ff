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
    //var target = this.browser;
    
    //glome.LOG('target: ' + target.tagName);
    //glome.EXTRACT(target);
    
    //jQuery(target).css('border', 'solid 1px red');
    
    if (   typeof this.opts.types == 'undefined'
        || typeof this.opts.types[0] == 'undefined')
    {
      this.opts.types = ['notfound'];
    }
    
    var stack = jQuery(this.doc.getElementById('ad-stack'));
    stack.get(0).hidden = false;
    
    // Bind to the context
    stack.get(0).modal = this.cid;
    
    var box = jQuery(this.doc.getElementById('ad-overlay'));
    
    jQuery(target)
      .bind('resize', function()
      {
        var overlay = jQuery(this).find('#ad-overlay');
        
        overlay
          .attr
          (
            {
              width: jQuery(this).width(),
              height: jQuery(this).height() - 20
            }
          );
          
          var close_icon = jQuery(this).find('#ad-close');
          
          var offset_top = Math.round((overlay.height() - overlay.find('#ad-overlay-display').height()) / 2 - 30);
          var offset_right = Math.round((overlay.width() - overlay.find('#ad-overlay-display').width()) / 2 - 30);
          
          close_icon
            .attr
            (
              {
                right: offset_right,
                top: offset_top
              }
            );
      })
      .trigger('resize');
    
    // Get the first available display type
    box.addClass('visible')
      .attr
      (
        {
          width: target.width,
          height: target.height,
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          hidden: false
        }
      )
      .bind('click', function(e)
      {
        var cid = jQuery(this).parent().get(0).modal;
        
        var modal = new AdModal();
        modal.hide(cid);
        
        e.preventDefault();
        //e.stopPropagation();
      });
    
    // Create a new modal panel
    var panel = jQuery('<panel />')
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
    
    stack.appendTo(panel);
  
    var close_icon = box.parent().find('#ad-close');
    
    close_icon
      .bind('click', function(e)
      {
        var cid = jQuery(this).parent().get(0).modal;
        
        var modal = new AdModal();
        modal.hide(cid);
      });
    
    /*
    // @TODO: this should be done according to preferences
    if (typeof this.opts.types[0] != 'undefined')
    {
      var type = this.opts.types[0];
    }
    else
    {
      var type = 'undefined';
    }
    
    // Create content
    switch (type)
    {
      // Display content from remote source
      case 'remote':
        var container = jQuery('<box />')
          .attr('id', 'ad-content-remote')
          .appendTo(box);
        
        var iframe = jQuery('<iframe />')
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
      
      // Display content from local storage
      case 'local':
        var container = jQuery('<vbox />')
          .attr('id', 'ad-content-local')
          .appendTo(box);
        
        this.showLocal(this.opts, container);
        break;
      
      case 'undefined':
      default:
        box.find('#ad-content-notfound').attr('hidden', false);
    }
    */
    
    var rand = Math.round(Math.random() * 10) % 4;
    glome.LOG('random seed: ' + rand);
    
    switch (rand)
    {
      case 0:
      case 1:
        box.find('#ad-overlay-content').find('image').attr('src', 'chrome://glome/skin/temp/audi-image.jpg');
        box.find('#ad-overlay-common').find('.h1').attr('value', 'Audi 2012 test drive!');
        break;
      
      case 2:
      case 3:
        box.find('#ad-overlay-content').find('image').attr('src', 'chrome://glome/skin/temp/bmw-image.jpg');
        box.find('#ad-overlay-common').find('.h1').attr('value', 'BMW is the mightiest!');
        break;
    }
    
    // Open panel as an overlapping popup
    panel.get(0).openPopup(target, 'overlap');
    jQuery(target).trigger('resize');
  }
  
  
  AdModal.prototype.showLocal = function(opts, container)
  {
    container.attr('hidden', false);
    
    // Clear the container if it was already in use
    container.find('#ad-content').remove();
    
    // @TODO: Add media types as needed
    switch (opts.mediaType)
    {
      case 'image':
        var image = jQuery('<image />')
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
      
      var iframe = jQuery('<iframe />');
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
      jQuery('<label />')
          .attr('value', 'hubba bubba')
          .appendTo(content);
      
      jQuery(content).appendTo(container);
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

glome.resizer = function()
{
  glome.LOG('test');
}
