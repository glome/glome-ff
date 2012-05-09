var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                               .getService(Components.interfaces.nsIWindowMediator);
                               
var AdModal = (function() {
  AdModal.prototype.DEFAULTS = {
  };
    
  function AdModal(cid, opts) {
    glome.LOG("AdModal::constructor");
    this.cid = cid;
    
    
    // @TODO: we need a safer way to open the modal window. This breaks if there
    // is ANY other window (e.g. console) opened after without user actions, e.g. on start up
    this.win = windowMediator.getMostRecentWindow("navigator:browser");
    
    this.doc = this.win.document;
    this.mw = this.doc.getElementById('main-window');
  }
  
  AdModal.prototype.show = function() {
    glome.LOG("AdModal::show");
    
    var hbox = glome.jQuery(this.doc.getElementById('ad-overlay'));
    
    hbox
      .css
      (
        {
          'background': 'rgba(0, 0, 0, 0.5)'
        }
      )
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
          '-moz-appearance': 'none',
          'background-color': 'white !important',
          'border-style': 'solid 1px red'
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
        
    hbox.appendTo(panel);

    panel.get(0).openPopup(this.doc.getElementById('main-window'), 'overlap');
  }
  
  return AdModal;
})();

glome.adModals = {
  create: function(cid, opts)
  {
    return new AdModal(cid, opts);
  }
};
