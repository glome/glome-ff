var glome = Components.classes["@glome.me/glome-ext;1"].createInstance().wrappedJSObject;

function fillInVersion() {
  var versionField = document.getElementById("version");
  versionField.value = abp.getInstalledVersion();
}
