const { createClient } = require('@supabase/supabase-js');

/**
 * Admin: Assign a bike to a pending rental and activate it.
 * POST JSON: { rental_id: number, bike_id: number }
 * Behavior:
 *  - Updates the rental status to 'active' and links the bike_id.
 *  - Updates the bike status to 'rented'.
 */
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { rental_id, bike_id } = JSON.parse(event.body || '{}');
    if (!rental_id || !bike_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'rental_id and bike_id are required' }) };
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Use a transaction to ensure both updates succeed or fail together
    const { error } = await supabaseAdmin.rpc('assign_bike_to_rental', { 
        p_rental_id: rental_id,
        p_bike_id: bike_id
    });

    if (error) {
        console.error('Error assigning bike:', error);
        throw new Error('Failed to assign bike: ' + error.message);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Bike assigned and rental activated successfully.' })
    };

  } catch (e) {
    console.error('Handler Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};