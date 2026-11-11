(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MiCarteraV2ClientImportStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const TYPE = 'CLIENT_IMPORT';
  const LOCK_TYPE = 'CLIENT_IMPORT_LOCK';
  const LOCK_ID = 'client-import-lock-v1';
  const LOCK_PATH = 'operations/' + LOCK_ID;
  const MAX_CLIENTS = 100;
  const CLIENT_FIELDS = new Set([
    'id', 'name', 'phone', 'dni', 'address', 'guarantor', 'guarantorPhone',
    'reference', 'route', 'routeId', 'location', 'version'
  ]);
  const AUDIT_FIELDS = new Set([
    'id', 'action', 'entityType', 'entityId', 'operationId', 'actorId', 'role', 'at', 'detail'
  ]);
  const ROLES = new Set(['admin', 'supervisor']);

  function requireValue(condition, code = 'CLIENT_IMPORT_INVALID') {
    if (!condition) throw Object.assign(new Error(code), { code, noQueue: true });
  }

  function validId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  }

  function validTime(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 19) === value.slice(0, 19);
  }

  function record(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function inspectOperation(operation) {
    requireValue(validId(operation?.id) && operation.id !== LOCK_ID && operation.type === TYPE &&
      (operation.operationId === undefined || operation.operationId === operation.id) &&
      typeof operation.actorId === 'string' && operation.actorId.length <= 128 &&
      operation.actorId.length > 0 && operation.actorId === operation.actorId.trim() &&
      validTime(operation.createdAt));
    requireValue(Array.isArray(operation.writes) && operation.writes.length >= 2 &&
      operation.writes.length <= MAX_CLIENTS + 1);

    const paths = new Set();
    const clients = [];
    let audit;
    const writes = Array.from(operation.writes, write => {
      const match = typeof write?.path === 'string' && /^(clients|audit)\/([A-Za-z0-9_-]{1,100})$/.exec(write.path);
      requireValue(match && write.kind === 'create' && write.expectedVersion === 0 && !paths.has(write.path));
      requireValue(record(write.data));
      const data = { ...write.data };
      requireValue(data.id === match[2]);
      paths.add(write.path);

      if (match[1] === 'clients') {
        requireValue(Object.entries(data).every(([key, value]) => CLIENT_FIELDS.has(key) &&
          (key === 'version' ? value === 1 : typeof value === 'string' && value.length <= 1024)));
        requireValue(data.version === 1 && typeof data.name === 'string' && data.name.trim() &&
          (data.route === undefined || data.route === '') && (data.routeId === undefined || data.routeId === ''));
        clients.push(data);
        return { path: write.path, data, kind: 'create', expectedVersion: 0 };
      }

      requireValue(!audit && Object.keys(data).every(key => AUDIT_FIELDS.has(key)) &&
        data.action === 'CLIENTS_IMPORTED' && data.entityType === TYPE &&
        data.entityId === operation.id && data.operationId === operation.id &&
        data.actorId === operation.actorId && ROLES.has(data.role) && validTime(data.at));
      requireValue(record(data.detail));
      const detail = { ...data.detail };
      requireValue(Object.keys(detail).length === 2 && Number.isInteger(detail.count) &&
        Array.isArray(detail.clientIds) && detail.clientIds.length <= MAX_CLIENTS);
      audit = { ...data, detail: { count: detail.count, clientIds: [...detail.clientIds] } };
      return { path: write.path, data: audit, kind: 'create', expectedVersion: 0 };
    });

    requireValue(audit && clients.length && audit.detail.count === clients.length &&
      audit.detail.clientIds.length === clients.length &&
      clients.every((client, index) => audit.detail.clientIds[index] === client.id));
    return {
      operation: {
        id: operation.id, operationId: operation.id, actorId: operation.actorId, type: TYPE,
        createdAt: operation.createdAt, writes
      },
      clients,
      audit
    };
  }

  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (record(value)) {
      return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  async function fingerprint(operation) {
    requireValue(root.crypto?.subtle && root.TextEncoder, 'CLIENT_IMPORT_FINGERPRINT_UNAVAILABLE');
    const bytes = new root.TextEncoder().encode(canonical(operation));
    const digest = await root.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function readClientLock(tx) {
    const lock = await tx.get(LOCK_PATH);
    requireValue(lock == null || lock.id === LOCK_ID && lock.type === LOCK_TYPE &&
      Number.isSafeInteger(lock.version) && lock.version >= 1 && lock.version < Number.MAX_SAFE_INTEGER &&
      !lock.tombstone && !lock.deletedAt, 'CLIENT_IMPORT_LOCK_INVALID');
    return lock;
  }

  function writeClientLock(tx, lock, now) {
    return tx.set(LOCK_PATH, { id: LOCK_ID, type: LOCK_TYPE, version: (lock?.version || 0) + 1, updatedAt: now });
  }

  function retryClientLockConflicts(adapter) {
    return { async runAtomic(callback) {
      for (let retry = 0; ; retry++) {
        let observed;
        try {
          return await adapter.runAtomic(tx => callback({ ...tx, async get(path) {
            const current = await tx.get(path);
            if (path === LOCK_PATH) observed = current?.version ?? 0;
            return current;
          } }));
        } catch (error) {
          // Rules may reject a stale lock increment before Firestore reports a transaction conflict.
          if (error?.code !== 'permission-denied' || observed === undefined || retry >= 2) throw error;
          const latest = await adapter.runAtomic(readClientLock);
          if ((latest?.version ?? 0) <= observed) throw error;
        }
      }
    } };
  }

  function createStore({ adapter, readClients, validateSession, assertNewClients } = {}) {
    requireValue(typeof adapter?.runAtomic === 'function' && typeof readClients === 'function' &&
      typeof validateSession === 'function' && typeof assertNewClients === 'function', 'CLIENT_IMPORT_STORE_CONFIG_REQUIRED');

    const atomic = retryClientLockConflicts(adapter);

    async function execute(input) {
      try {
        const { operation, clients, audit } = inspectOperation(input);
        const checkSession = expected => {
          const scope = validateSession(operation);
          const role = String(scope?.role || '').toLowerCase();
          requireValue(scope?.uid === operation.actorId && role === audit.role, 'CLIENT_IMPORT_SESSION_CHANGED');
          const current = [scope.uid, role, scope.orgId, scope.projectId];
          requireValue(!expected || current.every((value, index) => value === expected[index]), 'CLIENT_IMPORT_SESSION_CHANGED');
          return current;
        };
        const scope = checkSession();
        const hash = await fingerprint(operation);
        const result = await atomic.runAtomic(async tx => {
          checkSession(scope);
          const operationPath = 'operations/' + operation.id;
          const existing = await tx.get(operationPath);
          if (existing != null) {
            requireValue(existing.id === operation.id && existing.actorId === operation.actorId &&
              existing.type === TYPE && existing.fingerprint === hash && existing.status === 'APPLIED' &&
              existing.createdAt === operation.createdAt && existing.writeCount === operation.writes.length &&
              existing.auditId === audit.id &&
              validTime(existing.appliedAt) && !existing.tombstone && !existing.deletedAt, 'OPERATION_ID_COLLISION');
            checkSession(scope);
            return {
              status: 'ALREADY_APPLIED',
              operation: {
                id: operation.id, actorId: operation.actorId, type: TYPE, status: 'APPLIED',
                fingerprint: hash, createdAt: operation.createdAt, appliedAt: existing.appliedAt,
                writeCount: operation.writes.length, auditId: audit.id
              }
            };
          }

          const lock = await readClientLock(tx);

          // Every retried import reads the server list after observing this organization's lock.
          checkSession(scope);
          const remoteClients = await readClients();
          requireValue(Array.isArray(remoteClients), 'CLIENT_IMPORT_CLIENT_READ_INVALID');
          checkSession(scope);
          await assertNewClients(clients, remoteClients);

          const destinations = await Promise.all(operation.writes.map(write => tx.get(write.path)));
          requireValue(destinations.every(current => current == null), 'CLIENT_IMPORT_DESTINATION_EXISTS');
          checkSession(scope);

          const now = new Date().toISOString();
          for (const write of operation.writes) {
            await tx.set(write.path, { ...write.data, version: 1, updatedAt: now });
          }
          const receipt = {
            id: operation.id, type: TYPE, actorId: operation.actorId, fingerprint: hash,
            status: 'APPLIED', createdAt: operation.createdAt, appliedAt: now, writeCount: operation.writes.length, auditId: audit.id
          };
          await tx.set(operationPath, receipt);
          await writeClientLock(tx, lock, now);
          checkSession(scope);
          return { status: 'APPLIED', operation: receipt };
        });
        checkSession(scope);
        return result;
      } catch (error) {
        if (error && typeof error === 'object') throw Object.assign(error, { noQueue: true });
        throw Object.assign(new Error('CLIENT_IMPORT_FAILED'), { noQueue: true });
      }
    }

    return { execute };
  }

  return { createStore, readClientLock, writeClientLock, retryClientLockConflicts };
});
