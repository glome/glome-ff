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
  
  AdModal.prototype.show = function()
  {
    glome.LOG("AdModal::show");
    
    if (   typeof this.opts.types == 'undefined'
        || typeof this.opts.types[0] == 'undefined')
    {
      this.opts.types = ['notfound'];
    }
    
    var stack = glome.jQuery(this.doc.getElementById('ad-stack'));
    var box = glome.jQuery(this.doc.getElementById('ad-overlay'));
    
    stack.attr('visible', true);
    
    // Get the first available display type
    //glome.LOG('use type: ' + this.opts.types[0]);
    box.addClass('visible')
      .attr
      (
        {
          width: this.doc.width,
          height: this.doc.height,
          hidden: false
        }
      );
    
    var panel = glome.jQuery('<panel />')
      .css
      (
        {
          '-moz-appearance': 'none'
        }
      )
      .attr
      (
        {
          top: 0,
          left: 0
        }
      )
      .appendTo('#main-window');
    
    stack.appendTo(panel);
    
    // Hide all ad layers on the display
    box.find('> *').not('stack').attr('hidden', true);
    box.parent().find('#ad-close')
//        .attr('hidden', false)
        .bind('click', function()
        {});
    
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
        var container = glome.jQuery('<box />')
          .attr('id', 'ad-content-local')
          .appendTo(box);
        
        this.showRemote(this.opts, container);
        break;
      
      case 'undefined':
      default:
        box.find('#ad-content-notfound').attr('hidden', false);
    }

    panel.get(0).openPopup(this.mw, 'overlap');
  }
  
  AdModal.prototype.showRemote = function(opts, container)
  {
    container.attr('hidden', false);
    
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
