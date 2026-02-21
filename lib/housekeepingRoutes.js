"use strict";
// lib/housekeepingRoutes.ts
// Express-ruter for renholds-/vaktmester- og eier-oppgaver.
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = registerHousekeepingRoutes;
const housekeepingStore_1 = require("./housekeepingStore");
// Hjelper for å sende feil svar på en enkel måte
function sendError(res, error, status = 500) {
    console.error('housekeeping_api_error', error?.message || error);
    return res.status(status).json({
        ok: false,
        error: error?.message || String(error),
    });
}
function registerHousekeepingRoutes(app) {
    // ---------- STAFF (ansatte + eiere) ----------
    // List alle ansatte/eiere
    app.get('/api/housekeeping/staff', async (_req, res) => {
        try {
            const staff = await (0, housekeepingStore_1.listStaff)();
            return res.json({ ok: true, data: staff });
        }
        catch (err) {
            return sendError(res, err);
        }
    });
    // Opprett ny ansatt/eier
    app.post('/api/housekeeping/staff', async (req, res) => {
        try {
            const body = req.body || {};
            const user = await (0, housekeepingStore_1.createStaff)({
                displayName: body.displayName,
                email: body.email,
                phone: body.phone,
                role: body.role,
                pin: body.pin,
                active: body.active,
            });
            return res.json({ ok: true, data: user });
        }
        catch (err) {
            return sendError(res, err);
        }
    });
    // Oppdater ansatt/eier
    app.patch('/api/housekeeping/staff/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const body = req.body || {};
            const updated = await (0, housekeepingStore_1.updateStaff)(id, {
                displayName: body.displayName,
                email: body.email,
                phone: body.phone,
                role: body.role,
                pin: body.pin,
                active: body.active,
            });
            if (!updated) {
                return res.status(404).json({ ok: false, error: 'staff_not_found' });
            }
            return res.json({ ok: true, data: updated });
        }
        catch (err) {
            return sendError(res, err);
        }
    });
    // ---------- TASKS (oppgaver) ----------
    // List oppgaver med filtrering via query params
    app.get('/api/housekeeping/tasks', async (req, res) => {
        try {
            const q = req.query || {};
            const filter = {
                status: q.status || undefined,
                type: q.type || undefined,
                resourceId: q.resourceId || undefined,
                assignedToId: q.assignedToId || undefined,
                ownerId: q.ownerId || undefined,
                from: q.from || undefined,
                to: q.to || undefined,
            };
            const tasks = await (0, housekeepingStore_1.listTasks)(filter);
            return res.json({ ok: true, data: tasks });
        }
        catch (err) {
            return sendError(res, err);
        }
    });
    // Hent én oppgave (detaljvisning i appen)
    app.get('/api/housekeeping/tasks/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const task = await (0, housekeepingStore_1.getTask)(id);
            if (!task) {
                return res.status(404).json({ ok: false, error: 'task_not_found' });
            }
            return res.json({ ok: true, data: task });
        }
        catch (err) {
            return sendError(res, err);
        }
    });
    // Opprett ny oppgave (renhold / sengetøy / vaktmester / produkt / annet)
    app.post('/api/housekeeping/tasks', async (req, res) => {
        try {
            const body = req.body || {};
            const input = {
                type: body.type,
                title: body.title,
                description: body.description,
                resourceId: body.resourceId,
                resourceNumber: body.resourceNumber,
                reservationId: body.reservationId,
                ownerId: body.ownerId,
                createdById: body.createdById,
                assignedToId: body.assignedToId,
                priority: body.priority,
                dueAt: body.dueAt,
                estimatedMinutes: body.estimatedMinutes,
                checklist: Array.isArray(body.checklist)
                    ? body.checklist.map((c) => ({ label: c.label }))
                    : [],
            };
            const task = await (0, housekeepingStore_1.createTask)(input);
            return res.json({ ok: true, data: task });
        }
        catch (err) {
            return sendError(res, err);
        }
    });
    // Oppdater generell info på en oppgave (ikke status)
    app.patch('/api/housekeeping/tasks/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const body = req.body || {};
            const updates = {
                title: body.title,
                description: body.description,
                assignedToId: body.assignedToId,
                priority: body.priority,
                dueAt: body.dueAt,
                estimatedMinutes: body.estimatedMinutes,
                ownerId: body.ownerId,
            };
            const task = await (0, housekeepingStore_1.updateTask)(id, updates);
            if (!task) {
                return res.status(404).json({ ok: false, error: 'task_not_found' });
            }
            return res.json({ ok: true, data: task });
        }
        catch (err) {
            return sendError(res, err);
        }
    });
    // Endre status på oppgave + sjekkliste + logg + bilder
    app.post('/api/housekeeping/tasks/:id/status', async (req, res) => {
        try {
            const { id } = req.params;
            const body = req.body || {};
            const payload = {
                status: body.status,
                authorId: body.authorId,
                message: body.message,
                actualMinutes: body.actualMinutes,
                checklist: Array.isArray(body.checklist)
                    ? body.checklist.map((c) => ({
                        id: c.id,
                        completed: !!c.completed,
                    }))
                    : undefined,
                addPhotos: Array.isArray(body.addPhotos)
                    ? body.addPhotos.map((p) => ({
                        url: p.url,
                        caption: p.caption,
                    }))
                    : undefined,
            };
            const task = await (0, housekeepingStore_1.updateTaskStatus)(id, payload);
            if (!task) {
                return res.status(404).json({ ok: false, error: 'task_not_found' });
            }
            // 💡 HER kan du senere legge inn kall til Mews for å oppdatere
            // housekeeping-status når type === 'cleaning' og status === 'completed'.
            return res.json({ ok: true, data: task });
        }
        catch (err) {
            return sendError(res, err);
        }
    });
}
