// lib/housekeepingStore.ts
// Enkel filbasert lagring av renholds- og vaktmesteroppgaver + ansatte/eiere.

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// ---------- Typer ----------

export type StaffRole =
  | 'admin'
  | 'manager'
  | 'reception'
  | 'housekeeping'
  | 'maintenance'
  | 'owner';

export interface StaffUser {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  role: StaffRole;
  // Evt. PIN til innlogging i appen – lagres som ren tekst i denne enkle versjonen.
  pin?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TaskType =
  | 'cleaning'
  | 'linen'
  | 'maintenance'
  | 'product'
  | 'other';
export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
}

export interface TaskLogEntry {
  id: string;
  authorId?: string;
  createdAt: string;
  message: string;
}

export interface PhotoRef {
  id: string;
  url: string;
  caption?: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  description?: string;

  // Mews-koblinger
  resourceId: string; // Mews Resource/Space Id (hytte/rom)
  resourceNumber?: string; // "Hytte 4", "Leil. 12B" – kun visning
  reservationId?: string; // Mews ReservationId
  ownerId?: string; // referanse til StaffUser med role = 'owner'

  createdById?: string;
  assignedToId?: string;

  status: TaskStatus;
  priority: 'low' | 'normal' | 'high';

  dueAt?: string; // ISO-dato
  startedAt?: string;
  completedAt?: string;

  estimatedMinutes?: number;
  actualMinutes?: number;

  checklist: ChecklistItem[];
  photos: PhotoRef[];
  logs: TaskLogEntry[];

  createdAt: string;
  updatedAt: string;
}

interface StoreData {
  version: 1;
  tasks: Task[];
  staff: StaffUser[];
}

// ---------- Fil-setup ----------

const DATA_FILE = path.join(__dirname, '..', 'data', 'housekeeping.json');

let loaded = false;
let store: StoreData = {
  version: 1,
  tasks: [],
  staff: [],
};

function nowIso() {
  return new Date().toISOString();
}

async function ensureLoaded() {
  if (loaded) return;

  try {
    await fs.promises.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const raw = await fs.promises.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    store = {
      version: 1,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      staff: Array.isArray(parsed.staff) ? parsed.staff : [],
    };
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.warn(
        'housekeepingStore: klarte ikke å lese eksisterende fil:',
        err?.message || err
      );
    }
    // Starter med tomt lager
    store = { version: 1, tasks: [], staff: [] };
  }

  loaded = true;
}

async function save() {
  if (!loaded) return;
  const json = JSON.stringify(store, null, 2);
  await fs.promises.writeFile(DATA_FILE, json, 'utf8');
}

// ---------- STAFF (ansatte / eiere) ----------

export async function listStaff(): Promise<StaffUser[]> {
  await ensureLoaded();
  // returner aktive først
  return store.staff.slice().sort((a, b) => {
    if (a.active === b.active) {
      return a.displayName.localeCompare(b.displayName);
    }
    return a.active ? -1 : 1;
  });
}

export interface CreateStaffInput {
  displayName: string;
  email?: string;
  phone?: string;
  role?: StaffRole;
  pin?: string;
  active?: boolean;
}

export async function createStaff(input: CreateStaffInput): Promise<StaffUser> {
  await ensureLoaded();
  const now = nowIso();

  const user: StaffUser = {
    id: randomUUID(),
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

export interface UpdateStaffInput {
  displayName?: string;
  email?: string | null;
  phone?: string | null;
  role?: StaffRole;
  pin?: string | null;
  active?: boolean;
}

export async function updateStaff(
  id: string,
  updates: UpdateStaffInput
): Promise<StaffUser | undefined> {
  await ensureLoaded();
  const u = store.staff.find((s) => s.id === id);
  if (!u) return undefined;

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

// ---------- TASKS ----------

export interface TaskFilter {
  status?: TaskStatus | 'all';
  type?: TaskType | 'all';
  resourceId?: string;
  assignedToId?: string;
  ownerId?: string;
  from?: string; // filtrer på createdAt >= from
  to?: string; // createdAt <= to
}

export async function listTasks(filter: TaskFilter = {}): Promise<Task[]> {
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
      tasks = tasks.filter(
        (t) => new Date(t.createdAt).getTime() >= fromTime
      );
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

export interface CreateTaskInput {
  type: TaskType;
  title: string;
  description?: string;
  resourceId: string;
  resourceNumber?: string;
  reservationId?: string;
  ownerId?: string;
  createdById?: string;
  assignedToId?: string;
  priority?: 'low' | 'normal' | 'high';
  dueAt?: string;
  estimatedMinutes?: number;
  checklist?: { label: string }[];
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
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
  const checklist: ChecklistItem[] = Array.isArray(input.checklist)
    ? input.checklist.map((c) => ({
        id: randomUUID(),
        label: c.label || '',
        completed: false,
      }))
    : [];

  const task: Task = {
    id: randomUUID(),
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
    estimatedMinutes:
      typeof input.estimatedMinutes === 'number'
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

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assignedToId?: string | null;
  priority?: 'low' | 'normal' | 'high';
  dueAt?: string | null;
  estimatedMinutes?: number | null;
  ownerId?: string | null;
}

export async function updateTask(
  id: string,
  updates: UpdateTaskInput
): Promise<Task | undefined> {
  await ensureLoaded();
  const t = store.tasks.find((x) => x.id === id);
  if (!t) return undefined;

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

export interface UpdateTaskStatusInput {
  status: TaskStatus;
  authorId?: string;
  message?: string;
  checklist?: { id: string; completed: boolean }[];
  actualMinutes?: number;
  addPhotos?: { url: string; caption?: string }[];
}

export async function updateTaskStatus(
  id: string,
  payload: UpdateTaskStatusInput
): Promise<Task | undefined> {
  await ensureLoaded();

  const t = store.tasks.find((x) => x.id === id);
  if (!t) return undefined;

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
    const indexById: Record<string, ChecklistItem> = {};
    t.checklist.forEach((item) => {
      indexById[item.id] = item;
    });
    payload.checklist.forEach((ci) => {
      const item = indexById[ci.id];
      if (!item) return;
      if (item.completed !== ci.completed) {
        item.completed = ci.completed;
        item.completedAt = ci.completed ? nowIso() : undefined;
      }
    });
  }

  if (Array.isArray(payload.addPhotos) && payload.addPhotos.length) {
    payload.addPhotos.forEach((p) => {
      if (!p.url) return;
      const photo: PhotoRef = {
        id: randomUUID(),
        url: p.url,
        caption: p.caption || undefined,
        uploadedAt: nowIso(),
      };
      t.photos.push(photo);
    });
  }

  if (payload.message) {
    const entry: TaskLogEntry = {
      id: randomUUID(),
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
export async function getTask(id: string): Promise<Task | undefined> {
  await ensureLoaded();
  return store.tasks.find((t) => t.id === id);
}

export default {
  listStaff,
  createStaff,
  updateStaff,
  listTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  getTask,
};
