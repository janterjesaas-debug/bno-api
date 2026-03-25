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
        return res.json({
            ok: true,
            data: data || [],
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
