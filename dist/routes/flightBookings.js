"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supabase_1 = require("../lib/supabase");
const router = express_1.default.Router();
router.get('/api/flight-bookings', async (req, res) => {
    try {
        const userId = String(req.query.userId || '').trim();
        const email = String(req.query.email || '').trim().toLowerCase();
        if (!userId && !email) {
            return res.status(400).json({
                ok: false,
                error: 'userId eller email mangler',
            });
        }
        let query = supabase_1.supabase
            .from('flight_bookings')
            .select('*')
            .order('outbound_departure_at', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false });
        if (userId) {
            query = query.eq('user_id', userId);
        }
        else {
            query = query.ilike('customer_email', email);
        }
        const { data, error } = await query;
        if (error) {
            throw error;
        }
        const now = new Date();
        const list = Array.isArray(data) ? data : [];
        const upcoming = list
            .filter((item) => {
            const departure = item?.outbound_departure_at
                ? new Date(item.outbound_departure_at)
                : null;
            return !!departure && !Number.isNaN(departure.getTime()) && departure >= now;
        })
            .sort((a, b) => {
            const aTime = new Date(a.outbound_departure_at).getTime();
            const bTime = new Date(b.outbound_departure_at).getTime();
            return aTime - bTime;
        });
        return res.json({
            ok: true,
            data: list,
            meta: {
                total: list.length,
                nextTrip: upcoming[0] || null,
            },
        });
    }
    catch (e) {
        console.error('[FLIGHT BOOKINGS] list failed', e);
        return res.status(500).json({
            ok: false,
            error: e?.message || 'Kunne ikke hente flybookinger',
        });
    }
});
exports.default = router;
