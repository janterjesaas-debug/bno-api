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
        const email = String(req.query.email || '').trim().toLowerCase();
        if (!email) {
            return res.status(400).json({
                ok: false,
                error: 'email mangler',
            });
        }
        const { data, error } = await supabase_1.supabase
            .from('flight_bookings')
            .select('*')
            .eq('passenger_email', email)
            .order('created_at', { ascending: false });
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
