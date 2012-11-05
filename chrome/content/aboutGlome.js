// Initialize SQLite
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

// Database connection
let db = Services.storage.openDatabase(FileUtils.getFile("ProfD", ["glome.sqlite"])); // Will also create the file if it does not exist
let q = 'UPDATE categories SET subscribed = :subscribed WHERE id = :id';

var log = null;

window.addEventListener('load', function(e)
{
  log = new window.glome.glome.log();
  log.level = 5;

  glomeInitAboutView();
  document.title = 'Glome';

}, false)

function glomeInitAboutView()
{
  log.debug('glomeInitAboutView starts');
  let q = 'SELECT * FROM categories';
  log.debug(q);
  let statement = db.createStatement(q);
  log.debug('-- statement created');

  // Empty the current category selections
  jQuery('#glome-dashboard-container').find('.box-container').find('.item').remove();

  statement.executeAsync
  (
    {
      handleResult: function(results)
      {
        for (let row = results.getNextRow(); row; row = results.getNextRow())
        {
          var category =
          {
            id: row.getResultByName('id'),
            name: row.getResultByName('name'),
            subscribed: row.getResultByName('subscribed')
          }

          var tmp = jQuery('#glome-category-template').text().toString();
          var regs = tmp.match(/::([a-z0-9_]+)/i);

          // Replace with category values
          do
          {
            regs = tmp.match(/::([a-z0-9_]+)/i);
            var value = '';
            var key = regs[1];
            var regexp = new RegExp(regs[0], 'g');

            if (typeof category[key] != 'undefined')
            {
              value = String(category[key]);
              value = value.replace(/&(amp;)?/g, '&amp;');
            }

            tmp = tmp.replace(regexp, value);
          }
          while (tmp.match(/::([a-z0-9_]+)/i));

          if (   typeof category.subscribed != 'undefined'
              && category.subscribed)
          {
            jQuery(tmp).appendTo(jQuery('#glome-selector-enabled').find('.box-container'));
          }
          else
          {
            jQuery(tmp).appendTo(jQuery('#glome-selector-disabled').find('.box-container'));
          }
        }
      },
      handleCompletion: function()
      {
        jQuery('#glome-dashboard-container').find('.box-container').find('.item button.toggle')
          .bind('click', function()
          {
            var item = jQuery(this).parents('.item');

            if (jQuery(this).parents('#glome-selector-disabled').size())
            {
              item.appendTo(jQuery('#glome-selector-enabled').find('.box-container'));
              var subscribed = 1;
            }
            else
            {
              item.appendTo(jQuery('#glome-selector-disabled').find('.box-container'));
              var subscribed = 0;
            }

            var q = "UPDATE categories SET subscribed = :subscribed WHERE id = :id";
            let statement = db.createStatement(q);
            statement.params.subscribed = subscribed;
            statement.params.id = Number(item.attr('data-id'));

            statement.executeAsync();
          });
      }
    }
  );
  log.debug('glomeInitAboutView ends');
}

/**
 * Switch Glome state
 */
function glomeChangeState()
{
  glome.glomeTogglePref('enabled');

  // Set the checkbox status
  if (! glome.glomePrefs.enabled)
  {
    jQuery('.glome-switch').removeAttr('checked');
    jQuery('#glome-dashboard-deck').attr('hidden', 'true');
  }
  else
  {
    jQuery('.glome-switch').attr('checked', 'true');
    jQuery('#glome-dashboard-deck').removeAttr('hidden');
  }
}