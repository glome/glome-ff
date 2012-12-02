// Initialize SQLite
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

// Database connection
let db = Services.storage.openDatabase(FileUtils.getFile("ProfD", ["glome.sqlite"])); // Will also create the file if it does not exist
let q = 'UPDATE categories SET subscribed = :subscribed WHERE id = :id';

window.addEventListener('load', function(e)
{
  if (typeof window.glome == 'undefined')
  {
    try
    {
      glome = Components.classes["@glome.me/glome-ext;1"].createInstance().wrappedJSObject;
    }
    catch (e)
    {
      dump("GET GLOME EXCEPTION");
      dump(e);
    }

    log = new glome.log();
    log.level = 5;
  }
  else
  {
    glome = window.glome;
  }

  glomeInitAboutView();
  glomeSetListeners();

}, false)

function glomeInitAboutView()
{
  // intial state of the password protection switch
  if (typeof glome.prefs != 'undefined')
  {
    if (typeof glome.prefs.password_protection != 'undefined')
    {
      if (glome.prefs.password_protection)
      {
        jQuery('#glome_security_switch').attr('checked', true);
      }
      else
      {
        jQuery('#glome_security_switch').removeAttr('checked');
      }
    }
  }

  //log.debug('glomeInitAboutView starts');
  let q = 'SELECT * FROM categories';
  //log.debug(q);
  let statement = db.createStatement(q);
  //log.debug('-- statement created');

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
}

/**
 * Bind actions to some events
 */
function glomeSetListeners()
{
  var password = '';
  var password_confirmation = '';

  // password on / off switch
  jQuery(document).on('click', '#glome_security_switch', function()
  {
    jQuery('#password_box .feedback .message').attr('value', '');
    jQuery('#password_box .feedback .detail').remove();

    if (jQuery(this).attr('checked') === 'true')
    {
      log.debug('turn password protection ON');
      jQuery('#password_box').attr('hidden', false);
      jQuery('#password_box .feedback .message').attr('value', '');
    }
    else
    {
      log.debug('turn password protection OFF');
      jQuery('#password_box').attr('hidden', true);
      password = password_confirmation = '';
      glomeSetPassword(password, password_confirmation);
    }
  });

  // save button
  jQuery(document).on('click', '#save_password', function() {
    password = jQuery('textbox#password_once').val();
    password_confirmation = jQuery('textbox#password_confirmation').val();
    glomeSetPassword(password, password_confirmation);
  });
}

/**
 * Switch Glome state
 */
function glomeChangeState()
{
  log.debug('aboutGlome glomeChangeState called');

  glome.glomeTogglePref('enabled');

  // Set the checkbox status
  if (! glome.prefs.enabled)
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


/**
 * Updates user password; used by a trigger
 */
function glomeSetPassword(password, password_confirmation)
{
  log.debug('aboutGlome glomeSetPassword called');

  var glomeid = glome.prefs.get('glomeid');

  if (typeof glomeid != 'undefined' &&
      typeof password != 'undefined' &&
      typeof password_confirmation != 'undefined')
  {
    log.debug('Set password:' + password + ', confirmation:' + password_confirmation);

    var url = glome.prefs.getUrl(glome.prefs.get('api.users')) + '/' + glomeid + '.json';

    log.debug('Send to: ' + url);

    var data = {
      user: {
        password: password,
        password_confirmation: password_confirmation
    }};

    jQuery.ajax({
      url: url,
      data: data,
      type: 'PUT',
      dataType: 'json',
      beforeSend: function(jqXHR, settings)
      {
        if (typeof glome.prefs.session_token != 'undefined')
        {
          //log.debug('set HTTP headers for AJAX');
          jqXHR.setRequestHeader('X-CSRF-Token', glome.prefs.session_token);
          jqXHR.setRequestHeader('Cookie', glome.prefs.session_cookies);
        }
      },
      success: function(data, textStatus, jqXHR)
      {
        log.debug('Glome profile updated');

        if (data.encrypted_password == '')
        {
          glome.prefs.password_protection = false;
        }
        else
        {
          glome.prefs.password_protection = true;
          glome.prefs.loggedin = true;
        }
        glome.prefs.save();

        jQuery('#password_box .feedback .detail').remove();
        jQuery('#password_box .feedback .message').removeClass('error');
        jQuery('#password_box .feedback .message').attr('value', "Password was successfully saved.");
      },
      error: function(jqXHR, textStatus, errorThrown)
      {
        log.debug('Error saving password via json: ' + jqXHR.status + ', ' + jqXHR.statusText);
        var template = jQuery('#password_box .feedback .message');
        var messages = jQuery.parseJSON(jqXHR.responseText);
        jQuery('#password_box .feedback .message').addClass('error');
        jQuery('#password_box .feedback .message').attr('value', 'Error(s) occured while saving the password:');
        jQuery('#password_box .feedback .detail').remove();
        jQuery.each(messages.password, function(index, element)
        {
          jQuery('#password_box .feedback').append('<label class="detail" value="Password ' + element + '" />');
        });
      },
      complete: function(jqXHR)
      {
        if (jQuery('#password_box .feedback .message').attr('value') != '')
        {
          jQuery('#password_box .feedback').attr('hidden', false);
        }
        else
        {
          jQuery('#password_box .feedback').attr('hidden', true);
        }
        log.debug('saving password completed');
      }
    });
  }
}
