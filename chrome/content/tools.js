function GLOME_LOG(text)
{
    if (! GLOME_DEVELOPMENT_MODE) {
        return;
    }
    
    if (typeof console != undefined) {
      console.log(text);
    } else {
      Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService)
      .logStringMessage(text);
    }
}
