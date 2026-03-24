import express from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

router.get('/api/flight-bookings', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: 'email mangler',
      });
    }

    const { data, error } = await supabase
      .from('flight_bookings')
      .select('*')
      .ilike('passenger_email', email)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.json({
      ok: true,
      data: data || [],
    });
  } catch (e: any) {
    console.error('[FLIGHT BOOKINGS] list failed', e);
    return res.status(500).json({
      ok: false,
      error: e?.message || 'Kunne ikke hente flybookinger',
    });
  }
});

export default router;