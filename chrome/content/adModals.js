
var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                               .getService(Components.interfaces.nsIWindowMediator);
                               
var AdModal = (function() {
  AdModal.prototype.DEFAULTS = {
  };
    
  function AdModal(cid, opts) {
    glome.LOG("AdModal::constructor");
    this.cid = cid;
    
    this.win = windowMediator.getMostRecentWindow("navigator:browser");
    
    this.doc = this.win.document;
    this.mw = this.doc.getElementById('main-window');
  }
  
  AdModal.prototype.show = function() {
    glome.LOG("AdModal::show");
      
    var hbox = this.doc.getElementById('ad-overlay');
    hbox.setAttribute('width', this.doc.width);
    hbox.setAttribute('height', this.doc.height);
    hbox.setAttribute('hidden', false);

    var panel = this.doc.createElement('panel');
    panel.setAttribute('style', '-moz-appearance: none !important;background-color:transparent !important;border:none !important;');
    panel.appendChild(hbox);
    panel.setAttribute('top', 0);
    panel.setAttribute('left', 0);
    this.doc.getElementById('main-window').appendChild(panel);
    panel.openPopup(this.doc.getElementById('main-window'), 'overlap');
  }
  
  return AdModal;
})();

glome.adModals = {
  create: function(cid, opts)
  {
    return new AdModal(cid, opts);
  }
};
