const { createClient } = require('@supabase/supabase-js');

let _admin = null;

function getAdmin() {
  if (!_admin) {
    _admin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

module.exports = { getAdmin };
