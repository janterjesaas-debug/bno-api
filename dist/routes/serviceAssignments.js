"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/serviceAssignments.ts
const express_1 = __importDefault(require("express"));
const supabase_1 = require("../lib/supabase");
const router = express_1.default.Router();
/**
 * Hjelp: mappe fra DB-row til API-respons
 */
function mapRowToAssignment(row) {
    return {
        id: row.id,
        mews_space_id: row.mews_space_id,
        mews_service_id: row.mews_service_id,
        unit_name: row.unit_name,
        title: row.title,
        type: row.type,
        priority: row.priority,
        status: row.status,
        date: row.date,
        assignee_id: row.assignee_id,
        assignee_name: row.assignee_name,
        started_at: row.started_at,
        finished_at: row.finished_at,
        total_minutes: row.total_minutes,
        rooms: row.rooms || [],
        products: row.products || [],
        comment: row.comment,
        photos: row.photos || [],
    };
}
/**
 * GET /service/assignments
 * Query:
 *   - assigneeName (valgfri – hvis ikke satt: alle)
 *   - date (valgfri ISO yyyy-mm-dd – hvis ikke satt: dagens dato)
 */
router.get('/assignments', async (req, res) => {
    try {
        const { assigneeName, date } = req.query;
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10); // yyyy-mm-dd
        let query = supabase_1.supabase
            .from('service_assignments')
            .select('*')
            .eq('date', date || todayStr)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true });
        if (assigneeName && typeof assigneeName === 'string') {
            query = query.eq('assignee_name', assigneeName);
        }
        const { data, error } = await query;
        if (error) {
            console.error('Error fetching assignments:', error);
            return res.status(500).json({ ok: false, error: error.message });
        }
        const assignments = (data || []).map(mapRowToAssignment);
        return res.json({ ok: true, assignments });
    }
    catch (err) {
        console.error('GET /service/assignments failed:', err);
        return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});
/**
 * POST /service/assignments
 * Brukes av admin/avdelingsleder (eller for demo) til å opprette oppdrag.
 */
router.post('/assignments', async (req, res) => {
    try {
        const payload = req.body;
        if (!payload.mews_space_id || !payload.unit_name || !payload.title) {
            return res.status(400).json({ ok: false, error: 'Missing required fields' });
        }
        const insertData = {
            mews_space_id: payload.mews_space_id,
            mews_service_id: payload.mews_service_id ?? null,
            unit_name: payload.unit_name,
            title: payload.title,
            type: payload.type,
            priority: payload.priority,
            status: payload.status,
            date: payload.date.slice(0, 10),
            assignee_id: payload.assignee_id ?? null,
            assignee_name: payload.assignee_name,
            started_at: payload.started_at ?? null,
            finished_at: payload.finished_at ?? null,
            total_minutes: payload.total_minutes ?? null,
            rooms: payload.rooms || [],
            products: payload.products || [],
            comment: payload.comment ?? null,
            photos: payload.photos || [],
        };
        const { data, error } = await supabase_1.supabase
            .from('service_assignments')
            .insert(insertData)
            .select('*')
            .single();
        if (error) {
            console.error('Error inserting assignment:', error);
            return res.status(500).json({ ok: false, error: error.message });
        }
        return res.status(201).json({ ok: true, assignment: mapRowToAssignment(data) });
    }
    catch (err) {
        console.error('POST /service/assignments failed:', err);
        return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});
/**
 * PUT /service/assignments/:id
 * Lagres hver gang appen endrer rom / sjekklister / produkter / tid osv.
 * Appen kan sende hele oppdraget (samme form som GET).
 */
router.put('/assignments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const payload = req.body;
        const updateData = {
            status: payload.status,
            priority: payload.priority,
            rooms: payload.rooms || [],
            products: payload.products || [],
            comment: payload.comment ?? null,
            photos: payload.photos || [],
            started_at: payload.started_at ?? null,
            finished_at: payload.finished_at ?? null,
            total_minutes: payload.total_minutes ?? null,
        };
        const { data, error } = await supabase_1.supabase
            .from('service_assignments')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();
        if (error) {
            console.error('Error updating assignment:', error);
            return res.status(500).json({ ok: false, error: error.message });
        }
        return res.json({ ok: true, assignment: mapRowToAssignment(data) });
    }
    catch (err) {
        console.error('PUT /service/assignments/:id failed:', err);
        return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});
/**
 * Enkel «demo»-route for å se at alt virker
 * POST /service/assignments/demo
 */
router.post('/assignments/demo', async (req, res) => {
    try {
        const demo = {
            mews_space_id: 'demo-space-2124',
            mews_service_id: 'demo-service-trysil',
            unit_name: 'Hytte 2124',
            title: 'Sluttrengjøring hytte 2124',
            type: 'vask',
            priority: 'normal',
            status: 'not_started',
            date: new Date().toISOString().slice(0, 10),
            assignee_name: 'Jan Terje',
            rooms: [],
            products: [],
            comment: '',
            photos: [],
        };
        const { data, error } = await supabase_1.supabase
            .from('service_assignments')
            .insert({
            ...demo,
            rooms: demo.rooms,
            products: demo.products,
            photos: demo.photos,
        })
            .select('*')
            .single();
        if (error) {
            console.error('Error inserting demo assignment:', error);
            return res.status(500).json({ ok: false, error: error.message });
        }
        return res.status(201).json({ ok: true, assignment: mapRowToAssignment(data) });
    }
    catch (err) {
        console.error('POST /service/assignments/demo failed:', err);
        return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});
exports.default = router;
