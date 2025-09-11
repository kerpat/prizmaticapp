const { createClient } = require('@supabase/supabase-js');

/**
 * Verify a user's auth token and return their data if valid.
 * POST JSON: { token: string }
 */
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { token } = JSON.parse(event.body || '{}');
    if (!token) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Token is required' }) };
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find the user by their auth token
    const { data: client, error } = await supabaseAdmin
        .from('clients')
        .select('id, name, auth_token') // Select the token to be sure
        .eq('auth_token', token)
        .single();

    if (error || !client) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired token.' }) };
    }

    // Token is valid, return user info
    return {
      statusCode: 200,
      body: JSON.stringify({
        userId: client.id,
        userName: client.name
      })
    };

  } catch (e) {
    console.error('Handler Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
