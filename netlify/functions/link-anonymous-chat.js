const { createClient } = require('@supabase/supabase-js');

/**
 * Admin: Link an anonymous chat to a registered client profile.
 * POST JSON: { anonymousChatId: string, clientId: string(uuid) }
 */
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { anonymousChatId, clientId } = JSON.parse(event.body || '{}');
    if (!anonymousChatId || !clientId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'anonymousChatId and clientId are required' }) };
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Update all messages matching the anonymous ID with the correct client_id
    const { data, error } = await supabaseAdmin
      .from('support_messages')
      .update({ 
          client_id: clientId,
          anonymous_chat_id: null // Очищаем анонимный ID после привязки
      })
      .eq('anonymous_chat_id', anonymousChatId);

    if (error) {
      console.error(`Error linking chat ${anonymousChatId} to client ${clientId}:`, error);
      throw new Error('Failed to link chat: ' + error.message);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Чат успешно привязан к клиенту.'
      })
    };

  } catch (e) {
    console.error('Handler Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
