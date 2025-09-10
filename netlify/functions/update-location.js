const { createClient } = require('@supabase/supabase-js');

/**
 * Client-side function to update a user's location.
 * POST JSON: { userId: string(uuid), latitude: number, longitude: number }
 * Behavior:
 *  - Updates the 'last_location' field for the specified client.
 */
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId, latitude, longitude } = JSON.parse(event.body || '{}');
    if (!userId || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId, latitude, and longitude are required' }) };
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Format the location into PostGIS's expected format: POINT(longitude latitude)
    const locationString = `POINT(${longitude} ${latitude})`;

    const { error } = await supabaseAdmin
      .from('clients')
      .update({ last_location: locationString })
      .eq('id', userId);

    if (error) {
      console.error(`Error updating location for user ${userId}:`, error);
      throw new Error('Failed to update location: ' + error.message);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Location updated successfully.' })
    };

  } catch (e) {
    console.error('Handler Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};