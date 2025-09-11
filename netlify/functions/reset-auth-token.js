const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

/**
 * Admin: Generate a new auth_token for a specific user.
 * POST JSON: { userId: string(uuid) }
 */
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId } = JSON.parse(event.body || '{}');
    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Generate a new, cryptographically secure token
    const newAuthToken = crypto.randomUUID();

    // Update the user's record with the new token
    const { data, error } = await supabaseAdmin
      .from('clients')
      .update({ auth_token: newAuthToken })
      .eq('id', userId)
      .select('id, auth_token')
      .single();

    if (error) {
      console.error(`Error generating token for user ${userId}:`, error);
      throw new Error('Failed to generate new token: ' + error.message);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Новый токен успешно сгенерирован.', 
        newToken: data.auth_token 
      })
    };

  } catch (e) {
    console.error('Handler Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
