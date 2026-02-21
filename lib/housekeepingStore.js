"use strict";
// lib/housekeepingStore.ts
// Enkel filbasert lagring av renholds- og vaktmesteroppgaver + ansatte/eiere.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStaff = listStaff;
exports.createStaff = createStaff;
exports.updateStaff = updateStaff;
exports.listTasks = listTasks;
exports.createTask = createTask;
exports.updateTask = updateTask;
exports.updateTaskStatus = updateTaskStatus;
exports.getTask = getTask;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
// ---------- Fil-setup ----------
const DATA_FILE = path.join(__dirname, '..', 'data', 'housekeeping.json');
let loaded = false;
let store = {
    version: 1,
    tasks: [],
    staff: [],
};
function nowIso() {
    return new Date().toISOString();
}
async function ensureLoaded() {
    if (loaded)
        return;
    try {
        await fs.promises.mkdir(path.dirname(DATA_FILE), { recursive: true });
        const raw = await fs.promises.readFile(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        store = {
            version: 1,
            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
            staff: Array.isArray(parsed.staff) ? parsed.staff : [],
        };
    }
    catch (err) {
        if (err?.code !== 'ENOENT') {
            console.warn('housekeepingStore: klarte ikke å lese eksisterende fil:', err?.message || err);
        }
        // Starter med tomt lager
        store = { version: 1, tasks: [], staff: [] };
    }
    loaded = true;
}
async function save() {
    if (!loaded)
        return;
    const json = JSON.stringify(store, null, 2);
    await fs.promises.writeFile(DATA_FILE, json, 'utf8');
}
// ---------- STAFF (ansatte / eiere) ----------
async function listStaff() {
    await ensureLoaded();
    // returner aktive først
    return store.staff.slice().sort((a, b) => {
        if (a.active === b.active) {
            return a.displayName.localeCompare(b.displayName);
        }
        return a.active ? -1 : 1;
    });
}
async function createStaff(input) {
    await ensureLoaded();
    const now = nowIso();
    const user = {
        id: (0, crypto_1.randomUUID)(),
        displayName: (input.displayName || '').trim() || 'Uten navn',
        email: input.email?.trim() || undefined,
        phone: input.phone?.trim() || undefined,
        role: input.role || 'housekeeping',
        pin: input.pin?.trim() || undefined,
        active: input.active !== false,
        createdAt: now,
        updatedAt: now,
    };
    store.staff.push(user);
    await save();
    return user;
}
async function updateStaff(id, updates) {
    await ensureLoaded();
    const u = store.staff.find((s) => s.id === id);
    if (!u)
        return undefined;
    if (typeof updates.displayName === 'string') {
        u.displayName = updates.displayName.trim() || u.displayName;
    }
    if (updates.email !== undefined) {
        u.email = updates.email ? updates.email.trim() : undefined;
    }
    if (updates.phone !== undefined) {
        u.phone = updates.phone ? updates.phone.trim() : undefined;
    }
    if (updates.role) {
        u.role = updates.role;
    }
    if (updates.pin !== undefined) {
        u.pin = updates.pin ? updates.pin.trim() : undefined;
    }
    if (typeof updates.active === 'boolean') {
        u.active = updates.active;
    }
    u.updatedAt = nowIso();
    await save();
    return u;
}
async function listTasks(filter = {}) {
    await ensureLoaded();
    let tasks = store.tasks.slice();
    if (filter.status && filter.status !== 'all') {
        tasks = tasks.filter((t) => t.status === filter.status);
    }
    if (filter.type && filter.type !== 'all') {
        tasks = tasks.filter((t) => t.type === filter.type);
    }
    if (filter.resourceId) {
        tasks = tasks.filter((t) => t.resourceId === filter.resourceId);
    }
    if (filter.assignedToId) {
        tasks = tasks.filter((t) => t.assignedToId === filter.assignedToId);
    }
    if (filter.ownerId) {
        tasks = tasks.filter((t) => t.ownerId === filter.ownerId);
    }
    if (filter.from) {
        const fromTime = new Date(filter.from).getTime();
        if (Number.isFinite(fromTime)) {
            tasks = tasks.filter((t) => new Date(t.createdAt).getTime() >= fromTime);
        }
    }
    if (filter.to) {
        const toTime = new Date(filter.to).getTime();
        if (Number.isFinite(toTime)) {
            tasks = tasks.filter((t) => new Date(t.createdAt).getTime() <= toTime);
        }
    }
    // Nyeste først
    tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return tasks;
}
async function createTask(input) {
    await ensureLoaded();
    if (!input.type) {
        throw new Error('Task type is required');
    }
    if (!input.title) {
        throw new Error('Task title is required');
    }
    if (!input.resourceId) {
        throw new Error('resourceId (Mews resource/space id) is required');
    }
    const now = nowIso();
    const checklist = Array.isArray(input.checklist)
        ? input.checklist.map((c) => ({
            id: (0, crypto_1.randomUUID)(),
            label: c.label || '',
            completed: false,
        }))
        : [];
    const task = {
        id: (0, crypto_1.randomUUID)(),
        type: input.type,
        title: input.title.trim(),
        description: input.description?.trim() || undefined,
        resourceId: input.resourceId,
        resourceNumber: input.resourceNumber?.trim() || undefined,
        reservationId: input.reservationId || undefined,
        ownerId: input.ownerId || undefined,
        createdById: input.createdById || undefined,
        assignedToId: input.assignedToId || undefined,
        status: 'open',
        priority: input.priority || 'normal',
        dueAt: input.dueAt || undefined,
        estimatedMinutes: typeof input.estimatedMinutes === 'number'
            ? input.estimatedMinutes
            : undefined,
        actualMinutes: undefined,
        checklist,
        photos: [],
        logs: [],
        createdAt: now,
        updatedAt: now,
        startedAt: undefined,
        completedAt: undefined,
    };
    store.tasks.push(task);
    await save();
    return task;
}
async function updateTask(id, updates) {
    await ensureLoaded();
    const t = store.tasks.find((x) => x.id === id);
    if (!t)
        return undefined;
    if (typeof updates.title === 'string') {
        t.title = updates.title.trim() || t.title;
    }
    if (updates.description !== undefined) {
        t.description = updates.description
            ? updates.description.trim()
            : undefined;
    }
    if (updates.assignedToId !== undefined) {
        t.assignedToId = updates.assignedToId || undefined;
    }
    if (updates.priority) {
        t.priority = updates.priority;
    }
    if (updates.dueAt !== undefined) {
        t.dueAt = updates.dueAt || undefined;
    }
    if (updates.estimatedMinutes !== undefined) {
        t.estimatedMinutes =
            typeof updates.estimatedMinutes === 'number'
                ? updates.estimatedMinutes
                : undefined;
    }
    if (updates.ownerId !== undefined) {
        t.ownerId = updates.ownerId || undefined;
    }
    t.updatedAt = nowIso();
    await save();
    return t;
}
async function updateTaskStatus(id, payload) {
    await ensureLoaded();
    const t = store.tasks.find((x) => x.id === id);
    if (!t)
        return undefined;
    const now = nowIso();
    // Status + tidsstempler
    if (payload.status && payload.status !== t.status) {
        t.status = payload.status;
        if (payload.status === 'in_progress' && !t.startedAt) {
            t.startedAt = now;
        }
        if (payload.status === 'completed') {
            t.completedAt = now;
            if (typeof payload.actualMinutes === 'number') {
                t.actualMinutes = payload.actualMinutes;
            }
        }
    }
    if (Array.isArray(payload.checklist) && payload.checklist.length) {
        const indexById = {};
        t.checklist.forEach((item) => {
            indexById[item.id] = item;
        });
        payload.checklist.forEach((ci) => {
            const item = indexById[ci.id];
            if (!item)
                return;
            if (item.completed !== ci.completed) {
                item.completed = ci.completed;
                item.completedAt = ci.completed ? nowIso() : undefined;
            }
        });
    }
    if (Array.isArray(payload.addPhotos) && payload.addPhotos.length) {
        payload.addPhotos.forEach((p) => {
            if (!p.url)
                return;
            const photo = {
                id: (0, crypto_1.randomUUID)(),
                url: p.url,
                caption: p.caption || undefined,
                uploadedAt: nowIso(),
            };
            t.photos.push(photo);
        });
    }
    if (payload.message) {
        const entry = {
            id: (0, crypto_1.randomUUID)(),
            authorId: payload.authorId,
            createdAt: now,
            message: payload.message,
        };
        t.logs.push(entry);
    }
    t.updatedAt = nowIso();
    await save();
    return t;
}
// Hent én task (nyttig for detaljer på mobil)
async function getTask(id) {
    await ensureLoaded();
    return store.tasks.find((t) => t.id === id);
}
exports.default = {
    listStaff,
    createStaff,
    updateStaff,
    listTasks,
    createTask,
    updateTask,
    updateTaskStatus,
    getTask,
};
