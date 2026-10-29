/**
 * Where contributions wait for an admin's decision, and where accepted religious-holiday
 * announcements live. Upstash Redis in production; an in-memory store for local dev and tests.
 *
 * Redis layout (prefix `3otla:`):
 * - `contrib:<id>`             the contribution (JSON)
 * - `contrib:status:<status>`  sorted set of ids by creation time, one per status
 * - `live:confirmations`       hash `holidayId:hijriYear` → accepted confirmation (JSON)
 */
import type { Confirmation } from "@3otla/data";
import { Redis } from "@upstash/redis";
import type { Contribution } from "@/api/contributions";

export const STATUSES = ["pending", "accepted", "rejected"] as const;
export type ContributionStatus = (typeof STATUSES)[number];

/** Omit that keeps each variant of a union. */
type WithoutHoneypot<T> = T extends unknown ? Omit<T, "website"> : never;

export interface StoredContribution {
  id: string;
  status: ContributionStatus;
  createdAt: string;
  /** What the contributor sent, validated (honeypot removed). */
  contribution: WithoutHoneypot<Contribution>;
  /** For announcements: the confirmation that accepting applies. */
  confirmation?: Confirmation;
  decidedAt?: string;
  /** GitHub login of the admin who decided. */
  decidedBy?: string;
  note?: string;
}

export interface LiveConfirmation {
  confirmation: Confirmation;
  contributionId: string;
}

export type NewContribution = Pick<StoredContribution, "contribution" | "confirmation">;

export class StoreError extends Error {
  constructor(
    readonly code: "not_found" | "not_pending" | "not_accepted" | "already_confirmed",
    message: string,
  ) {
    super(message);
  }
}

export interface ContributionStore {
  add(input: NewContribution): Promise<StoredContribution>;
  get(id: string): Promise<StoredContribution | null>;
  /** Newest first. */
  list(status: ContributionStatus, limit?: number): Promise<StoredContribution[]>;
  counts(): Promise<Record<ContributionStatus, number>>;
  /**
   * Accept or reject a pending contribution. Accepting an announcement makes its
   * confirmation live, unless that holiday is already confirmed (`already_confirmed`).
   */
  decide(
    id: string,
    status: "accepted" | "rejected",
    by: string,
    note?: string,
  ): Promise<StoredContribution>;
  /** Undo an acceptance: the contribution becomes rejected and its confirmation is removed. */
  revert(id: string, by: string): Promise<StoredContribution>;
  liveConfirmations(): Promise<LiveConfirmation[]>;
}

const keyOf = (c: Pick<Confirmation, "holidayId" | "hijriYear">) => `${c.holidayId}:${c.hijriYear}`;
const newId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 12);

/** Decision rules shared by both stores. */
function applyDecision(
  current: StoredContribution | null,
  id: string,
  status: "accepted" | "rejected",
  by: string,
  note: string | undefined,
  live: ReadonlyMap<string, LiveConfirmation>,
): StoredContribution {
  if (!current) throw new StoreError("not_found", `No contribution ${id}`);
  if (current.status !== "pending") {
    throw new StoreError("not_pending", `Contribution ${id} is already ${current.status}`);
  }
  if (status === "accepted" && current.confirmation) {
    const existing = live.get(keyOf(current.confirmation));
    if (existing) {
      throw new StoreError(
        "already_confirmed",
        `${keyOf(current.confirmation)} is already confirmed by contribution ${existing.contributionId}. Revert it first.`,
      );
    }
  }
  return {
    ...current,
    status,
    decidedAt: new Date().toISOString(),
    decidedBy: by,
    ...(note?.trim() ? { note: note.trim().slice(0, 500) } : {}),
  };
}

function applyRevert(current: StoredContribution | null, id: string, by: string) {
  if (!current) throw new StoreError("not_found", `No contribution ${id}`);
  if (current.status !== "accepted") {
    throw new StoreError("not_accepted", `Contribution ${id} is ${current.status}, not accepted`);
  }
  return {
    ...current,
    status: "rejected" as const,
    decidedAt: new Date().toISOString(),
    decidedBy: by,
    note: `Reverted by ${by}${current.note ? ` (was: ${current.note})` : ""}`,
  };
}

export function createMemoryStore(): ContributionStore {
  const items = new Map<string, StoredContribution>();
  const live = new Map<string, LiveConfirmation>();
  const sorted = (status: ContributionStatus) =>
    [...items.values()]
      .filter((c) => c.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    async add(input) {
      const item: StoredContribution = {
        ...input,
        id: newId(),
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      items.set(item.id, item);
      return item;
    },
    async get(id) {
      return items.get(id) ?? null;
    },
    async list(status, limit = 100) {
      return sorted(status).slice(0, limit);
    },
    async counts() {
      return {
        pending: sorted("pending").length,
        accepted: sorted("accepted").length,
        rejected: sorted("rejected").length,
      };
    },
    async decide(id, status, by, note) {
      const next = applyDecision(items.get(id) ?? null, id, status, by, note, live);
      items.set(id, next);
      if (status === "accepted" && next.confirmation) {
        live.set(keyOf(next.confirmation), { confirmation: next.confirmation, contributionId: id });
      }
      return next;
    },
    async revert(id, by) {
      const next = applyRevert(items.get(id) ?? null, id, by);
      items.set(id, next);
      if (next.confirmation) live.delete(keyOf(next.confirmation));
      return next;
    },
    async liveConfirmations() {
      return [...live.values()];
    },
  };
}

export function createRedisStore(redis: Redis, prefix = "3otla:"): ContributionStore {
  const item = (id: string) => `${prefix}contrib:${id}`;
  const index = (status: ContributionStatus) => `${prefix}contrib:status:${status}`;
  const liveKey = `${prefix}live:confirmations`;

  async function liveMap(): Promise<Map<string, LiveConfirmation>> {
    const all = (await redis.hgetall<Record<string, LiveConfirmation>>(liveKey)) ?? {};
    return new Map(Object.entries(all));
  }

  async function move(prev: ContributionStatus, next: StoredContribution) {
    const tx = redis.multi();
    tx.set(item(next.id), next);
    tx.zrem(index(prev), next.id);
    tx.zadd(index(next.status), { score: Date.parse(next.createdAt), member: next.id });
    return tx;
  }

  return {
    async add(input) {
      const created: StoredContribution = {
        ...input,
        id: newId(),
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      const tx = redis.multi();
      tx.set(item(created.id), created);
      tx.zadd(index("pending"), { score: Date.parse(created.createdAt), member: created.id });
      await tx.exec();
      return created;
    },
    async get(id) {
      return redis.get<StoredContribution>(item(id));
    },
    async list(status, limit = 100) {
      const ids = await redis.zrange<string[]>(index(status), 0, limit - 1, { rev: true });
      if (ids.length === 0) return [];
      const found = await redis.mget<(StoredContribution | null)[]>(...ids.map(item));
      return found.filter((c): c is StoredContribution => c !== null);
    },
    async counts() {
      const [pending, accepted, rejected] = await Promise.all(
        STATUSES.map((s) => redis.zcard(index(s))),
      );
      return { pending: pending ?? 0, accepted: accepted ?? 0, rejected: rejected ?? 0 };
    },
    async decide(id, status, by, note) {
      const [current, live] = await Promise.all([this.get(id), liveMap()]);
      const next = applyDecision(current, id, status, by, note, live);
      const tx = await move("pending", next);
      if (status === "accepted" && next.confirmation) {
        tx.hset(liveKey, {
          [keyOf(next.confirmation)]: { confirmation: next.confirmation, contributionId: id },
        });
      }
      await tx.exec();
      return next;
    },
    async revert(id, by) {
      const next = applyRevert(await this.get(id), id, by);
      const tx = await move("accepted", next);
      if (next.confirmation) tx.hdel(liveKey, keyOf(next.confirmation));
      await tx.exec();
      return next;
    },
    async liveConfirmations() {
      return [...(await liveMap()).values()];
    },
  };
}

type Env = Record<string, string | undefined>;

const globalStore = globalThis as { __3otlaMemoryStore?: ContributionStore };

/**
 * Redis when configured (the Vercel Upstash integration sets KV_REST_API_*). Without it,
 * an in-memory store in development so the flow can be tried locally, and none in
 * production (contributions are then disabled).
 */
export function storeFromEnv(env: Env): ContributionStore | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (url && token) return createRedisStore(new Redis({ url, token }));
  if (env.NODE_ENV === "development") {
    globalStore.__3otlaMemoryStore ??= createMemoryStore();
    return globalStore.__3otlaMemoryStore;
  }
  return null;
}
