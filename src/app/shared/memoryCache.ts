// shared/memoryCache.ts
// Simple in-memory cache — free-tier friendly (no Redis required)

type CacheEntry = {
  data: unknown;
  expires: number;
};

const store = new Map<string, CacheEntry>();
const MAX_KEYS = 800;

export const memoryCache = {
  get<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      store.delete(key);
      return null;
    }
    return entry.data as T;
  },

  set(key: string, data: unknown, ttlSeconds = 60) {
    if (store.size >= MAX_KEYS) {
      const firstKey = store.keys().next().value;
      if (firstKey) store.delete(firstKey);
    }
    store.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
    });
  },

  del(key: string | string[]) {
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) store.delete(k);
  },

  delByPrefix(prefix: string) {
    for (const key of [...store.keys()]) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  clear() {
    store.clear();
  },

  size() {
    return store.size;
  },
};

// ─────────────────────────────────────────────────────────────
// TTLs (seconds)
// ─────────────────────────────────────────────────────────────
export const TTL = {
  adminDashboard: 300,
  teacherDashboard: 90,
  studentDashboard: 90,

  departments: 3600,
  semesters: 3600,
  shifts: 3600,
  subjects: 1800,
  groups: 900,
  subjectGroups: 900,

  notices: 120,
  events: 180,
  routines: 300,
  studentsList: 120,
  teachersList: 180,
  overview: 90,
  attendanceList: 60,
  practicalList: 60,
} as const;

// ─────────────────────────────────────────────────────────────
// Cache key helpers
// ─────────────────────────────────────────────────────────────
export const cacheKey = {
  adminDashboard: () => "dashboard:admin",
  teacherDashboard: (userId: number) => `dashboard:teacher:${userId}`,
  studentDashboard: (userId: number) => `dashboard:student:${userId}`,

  departments: (q = "") => `departments:${q}`,
  semesters: (q = "") => `semesters:${q}`,
  shifts: (q = "") => `shifts:${q}`,
  subjects: (q = "") => `subjects:${q}`,
  groups: (q = "") => `groups:${q}`,
  subjectGroups: (q = "") => `subjectGroups:${q}`,

  notices: (q = "") => `notices:${q}`,
  events: (q = "") => `events:${q}`,
  routines: (q = "") => `routines:${q}`,
  students: (q = "") => `students:${q}`,
  teachers: (q = "") => `teachers:${q}`,
  overview: (userId: number) => `overview:${userId}`,
};

// ─────────────────────────────────────────────────────────────
// Invalidation helpers — call after mutations
// ─────────────────────────────────────────────────────────────
export const invalidateDashboardCache = (opts?: {
  admin?: boolean;
  teacherUserId?: number;
  studentUserId?: number;
  allTeachers?: boolean;
  allStudents?: boolean;
}) => {
  if (!opts || opts.admin) memoryCache.del(cacheKey.adminDashboard());
  if (opts?.teacherUserId)
    memoryCache.del(cacheKey.teacherDashboard(opts.teacherUserId));
  if (opts?.studentUserId)
    memoryCache.del(cacheKey.studentDashboard(opts.studentUserId));
  if (opts?.allTeachers) memoryCache.delByPrefix("dashboard:teacher:");
  if (opts?.allStudents) memoryCache.delByPrefix("dashboard:student:");
};

export const invalidateMasterData = () => {
  memoryCache.delByPrefix("departments:");
  memoryCache.delByPrefix("semesters:");
  memoryCache.delByPrefix("shifts:");
  memoryCache.delByPrefix("subjects:");
  memoryCache.delByPrefix("groups:");
  memoryCache.delByPrefix("subjectGroups:");
};

export const invalidateNotices = () => memoryCache.delByPrefix("notices:");
export const invalidateEvents = () => memoryCache.delByPrefix("events:");
export const invalidateRoutines = () => memoryCache.delByPrefix("routines:");
export const invalidateStudents = () => memoryCache.delByPrefix("students:");
export const invalidateTeachers = () => memoryCache.delByPrefix("teachers:");
export const invalidateOverview = (userId?: number) => {
  if (userId) memoryCache.del(cacheKey.overview(userId));
  else memoryCache.delByPrefix("overview:");
};
