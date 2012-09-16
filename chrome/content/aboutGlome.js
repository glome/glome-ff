var log = null;

window.addEventListener('load', function(e)
{
  dump('----------------------------------------------------------------------------------------------------------\n');
  dump('typeof glome: ' + typeof glome + '\n');
  dump('typeof glome.log: ' + typeof glome.log + '\n');
  dump('----------------------------------------------------------------------------------------------------------\n');
  log = new glome.log();
  
}, false)

window.addEventListener('DOMContentLoaded', function(e)
{
  dump('----------------------------------------------------------------------------------------------------------\n');
  dump('typeof glome: ' + typeof glome + '\n');
  dump('typeof glome.log: ' + typeof glome.log + '\n');
  dump('----------------------------------------------------------------------------------------------------------\n');
}, false);