var nativeJSON = Cc["@mozilla.org/dom/json;1"]
  .createInstance(Ci.nsIJSON);

function init(gid)
{
  //debug("connectionSession::init", gid);
  this.gid = gid;
  this._connected = false;
  this._connecting = false;
  this._after_connect_cbs = [];
}

function isConnected() {
  return this._connected;
}

function onConnect() {
  throw new Error('onConnect callback must be assigned.');
}

function onDisconnect() {
  throw new Error('onDisconnect callback must be assigned.');
}

function onOutput() {
  throw new Error('onOutput callback must be assigned.');
}

function onReceived() {
}

function connect(cb) {
  if (cb)
    this._after_connect_cbs.push(cb);
  if (this._connecting)
    return;
  this._connecting = true;
  this.onConnect();
}

function connected() {
  this._connected = true;
  this._connecting = false;  
  
  if (this._after_connect_cbs.length) {
    for each (var cb in this._after_connect_cbs)
      cb.apply(this);
    this._after_connect_cbs = [];
  }
}

function disconnect() {
  this._connected = false;
  this.onDisconnect();
}

function send(string)
{
  this.onOutput(this._buildMessagePackage(string)+"\n");
}

function receive(string)
{
  //debug("connectionSession::receive", string);
  this._last_received_raw = string;
  this._last_received = null;
  
  try {
    this._last_received = nativeJSON.decode(string);
  } catch (e) {
    //dump(e);
  }
  
  this.onReceived(this._last_received, this._last_received_raw);  
}

function _buildMessagePackage(data)
{
  var packet = {
    gid: this.gid,
    data: data
  };
  return nativeJSON.encode(packet);
}

function debug()
{
  var s = 'D, GLOME: ' + Array.prototype.slice.call(arguments).join(' :: ');
  if(!s.match(/\n$/))
    s += '\n';
  dump(s);
}
