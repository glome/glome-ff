const GLOME_DEVELOPMENT_MODE = true;

var Glome =
{
  onLoad: function()
  {
    // initialization code
    this.LOG("Glome - onLoad");
    this.initialized = true;
    //this.strings = document.getElementById("feeeme-strings");
  },

  onMenuItemCommand: function(e)
  {
      this.LOG("onMenuItemCommand");
    // var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
    //                               .getService(Components.interfaces.nsIPromptService);
    // promptService.alert(window, this.strings.getString("helloMessageTitle"),
    //                             this.strings.getString("helloMessage"));
      Glome.showNotification();
  },

  onToolbarButtonCommand: function(e)
  {
    // just reuse the function above.  you can change this, obviously!
    Glome.onMenuItemCommand(e);
  },
  LOG: function(input)
  {
    console.log(input);
    GLOME_LOG(input);
  },
  
  showNotification: function()
  {
    this.LOG("showNotification");
    
    let opts = {
        onYes: function() {
          console.log('onYes clicked!');
        }
    };
    let nofif = new Glome.Notification('Audi would like to take you on a test drive, interested?', 1, opts);
    console.log('nofif',nofif);
    nofif.show();
    
    // let nb = gBrowser.getNotificationBox();
    // let acceptButton = new Object();
    // let declineButton = new Object();
    // let message = "Audi Center haluaisi pyytää sinut koeajolle";
    // let that = this;
    // 
    // acceptButton.label = "Katso";
    // acceptButton.accessKey = "K";
    // acceptButton.popup = null;
    // acceptButton.callback = function() { that.acceptRequest(); };
    // 
    // declineButton.label = "Hylkää";
    // declineButton.accessKey = "H";
    // declineButton.popup = null;//document.getElementById("ad-panel");
    // declineButton.callback = function() { that.declineRequest(); };
    // 
    // nb.appendNotification(
    //   message, "feeeme-ad-notification",
    //   "chrome://feeeme/skin/toolbar-button.png",
    //   nb.PRIORITY_INFO_HIGH, [ acceptButton, declineButton ]);
  },
  
  acceptRequest: function()
  {
    //this._sendHBClick('cpc');
    //this._sendHBClick('cpa');
    var hbox = document.getElementById('ad-overlay');
    // var hbox = document.createElement('hbox');
    //    hbox .setAttribute('style', 'background-color:rgba(6, 59, 127, 0.7);');
    hbox.setAttribute('width', window.document.width);
    hbox.setAttribute('height', window.document.height);
    hbox.setAttribute('hidden', false);
    
    var panel = document.createElement('panel');
    panel.setAttribute('style', '-moz-appearance: none !important;background-color:transparent !important;border:none !important;');
    panel.appendChild(hbox);
    panel.setAttribute('top', 0);
    panel.setAttribute('left', 0);
    document.getElementById('main-window').appendChild(panel);
    panel.openPopup(document.getElementById('main-window'), 'overlap');
  },
  declineRequest: function()
  {
      //this._sendHBClick('cpc');
  },
  _sendHBClick: function(event_type)
  {    
    var method = 'get';
    var data =
    {
        'events': event_type,
        'f': Math.ceil(Math.random() * 1000000)
    };
    var url = 'http://hb.glomedev:8000/tracking_pixel.gif';
    
    var req = new XMLHttpRequest();
    var postdata = null;
    
    if (data !== undefined) {
        url += (url.match(/\?/) == null ? '?' : '&');
        
        for (var key in data) {
            url += key + '=' + data[key] + '&';
        }
    }
    
    if (url.substr(url.length - 1, 1) == '&') {
        url = url.substring(0, url.length - 1);
    }
    
    //url += (url.match(/\?/) == null ? '?' : '&') + (new Date()).getTime();
    
    this.LOG("_sendHBClick url: "+url);
    
    req.open(method.toUpperCase(), url, true);
    
    req.onreadystatechange = function(aEvt)
    {  
      if (req.readyState == 4)
      {
        if (req.status == 200) {
          if (GLOME_DEVELOPMENT_MODE)
          {
              this.LOG(req.status+"\n");
              this.LOG(req.responseText+"\n");
          }
          
          //listener.finished(req.responseXML, req.status);
        } else {
          if (GLOME_DEVELOPMENT_MODE)
          {
              this.LOG("Error loading page\n");
              this.LOG(req.status+"\n");
              this.LOG(req.responseXML+"\n");
              this.LOG(req.responseText+"\n");
          }
        }
      }
    };
    
    //req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    //req.setRequestHeader("Content-Type", 'application/x-www-form-urlencoded');
    //req.overrideMimeType('text/xml');
    
    try
    {
       req.send(postdata);
    }
    catch (e)
    {
       this.LOG("Exception when sending request: \n");
       this.LOG(e);
    }
  }
};

//window.addEventListener("load", function () { Glome.onLoad(); }, false);

window.addEventListener("load", function()
{
  //Glome.onLoad();  
  let sandbox = new Components.utils.Sandbox(window);
  sandbox.window = window;
  sandbox.document = document;
  Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
            .getService(Components.interfaces.mozIJSSubScriptLoader)
            .loadSubScript("chrome://glome/content/browserWindow.js", sandbox);
  
}, false);
