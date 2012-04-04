/*
 * Manages connections to Glome servers.
 * This file is included from nsGlome.js.
 */

// These are development values
var host = "127.0.0.1";
var port = 5000;

let loader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
  .getService(Ci.mozIJSSubScriptLoader);
    
function Session() {};
loader.loadSubScript('chrome://glome/content/connectionSession.js', Session.prototype);

glome.connection = {
  open: function()
  {
    glome.LOG("Connection::open");
    
    this.threadManager = Cc["@mozilla.org/thread-manager;1"]
      .getService(Ci.nsIThreadManager);
    
    var self = this;
    
    glome.ConnectionSession = new Session();
    glome.ConnectionSession.onConnect = function() {
      glome.LOG("ConnectionSession::onConnect");
      
      try {
        self.transport = Cc["@mozilla.org/network/socket-transport-service;1"]
          .getService(Ci.nsISocketTransportService)
          .createTransport(["starttls"], 0, host, port, null);

        self.inputStream = self.transport.openInputStream(0, 0, 0);
        self.inputInterface = Cc['@mozilla.org/intl/converter-input-stream;1'].createInstance(Ci.nsIConverterInputStream);
        self.inputInterface.init(self.inputStream, 'UTF-8', 1024, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

        self.outputStream = self.transport.openOutputStream(Ci.nsITransport.OPEN_BLOCKING, 0, 0);
      } catch (e) {
        glome.LOG("ConnectionSession::onConnect ERROR", e);
      }
      
      var _s = this;
      
      self.transport.setEventSink({
        onTransportStatus: function(transport, status, progress, total) {
          //glome.LOG("transport::onTransportStatus");
          switch (status) {
            case Ci.nsISocketTransport.STATUS_RESOLVING:
              //glome.LOG("status == resolving");
              break
            case Ci.nsISocketTransport.STATUS_CONNECTING_TO:
              //glome.LOG("status == connecting");
              break
            case Ci.nsISocketTransport.STATUS_CONNECTED_TO:
              glome.LOG("status == connected");
              _s.connected();
              break
            case Ci.nsISocketTransport.STATUS_SENDING_TO:
              glome.LOG("status == sending");
              break
            case Ci.nsISocketTransport.STATUS_WAITING_FOR:
              //glome.LOG("status == waiting");
              break
            case Ci.nsISocketTransport.STATUS_RECEIVING_FROM:
              glome.LOG("status == receiving");
              break
          }
        }
      }, self.threadManager.currentThread);
    }
    glome.ConnectionSession.onDisconnect = function() {
      glome.LOG("ConnectionSession::onDisconnect");
      self.inputStream.close();
      self.outputStream.close();
    }
    glome.ConnectionSession.onOutput = function(packet) {
      glome.LOG("ConnectionSession::onOutput ",packet);
      self.outputStream.write(packet, packet.length);
    }
    glome.ConnectionSession.init("GLOME_ID_HERE");
    glome.ConnectionSession.connect(function() {
      this.send('initial connection payload here');
    });
    glome.ConnectionSession.onReceived = function(data, raw) {
      glome.LOG("ConnectionSession::onReceived");
      glome.LOG('data:'+data);
      glome.LOG('raw:'+raw);
    }
    
    var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
    pump.init(this.inputStream, -1, -1, 0, 0, false);
    pump.asyncRead({
      onStartRequest: function(request, context) {
        glome.LOG("Connection - onStartRequest");
      },
      onStopRequest: function(request, context, status) {
        glome.LOG("Connection - onStopRequest");
        glome.ConnectionSession.disconnect();
      },
      onDataAvailable: function(request, context, inputStream, offset, count) {
        //glome.LOG("Connection - onDataAvailable: " + count);
        var str = {};
        self.inputInterface.readString(count, str);
        glome.ConnectionSession.receive(str.value);
      }
    }, null);
  },
  
  sendTest: function()
  {
    glome.LOG("Connection::sendTest");
    
    var msg = "some message";
    
    if (!glome.ConnectionSession.isConnected()) {
      glome.LOG("ConnectionSession::not connected");
      glome.ConnectionSession.connect(function() {
        this.send(msg);
      });
    } else {      
      glome.LOG("ConnectionSession::is connected");
      glome.ConnectionSession.send(msg);
    }    
  }
}
