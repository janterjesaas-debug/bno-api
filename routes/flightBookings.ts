import express from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

router.get('/api/flight-bookings', async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim();

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'userId mangler',
      });
    }

    const { data, error } = await supabase
      .from('flight_bookings')
      .select('*')
      .eq('user_id', userId)
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