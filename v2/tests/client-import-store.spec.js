const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createStore } = require('../app/cloud/client-import-store-v2.js');

const time = '2026-11-09T12:00:00.000Z';
const lock = 'operations/client-import-lock-v1';
const admin = { uid: 'synthetic-admin', role: 'admin', orgId: 'synthetic-org', projectId: 'synthetic-project' };

class AtomicAdapter {
  constructor(seed = {}) {
    this.db = new Map(Object.entries(seed));
    this.writes = [];
    this.attempts = 0;
    this.loseAck = false;
  }

  async runAtomic(callback) {
    for (let attempt = 0; attempt < 5; attempt++) {
      this.attempts++;
      const reads = new Map();
      const writes = new Map();
      const snapshot = new Map(this.db);
      const result = await callback({
        get: async path => {
          assert.equal(writes.size, 0, 'Firestore requires reads before writes');
          reads.set(path, snapshot.get(path));
          return structuredClone(snapshot.get(path) ?? null);
        },
        set: async (path, data) => writes.set(path, structuredClone(data))
      });
      if (Array.from(reads).some(([path, value]) => this.db.get(path) !== value)) continue;
      for (const [path, value] of writes) this.db.set(path, value);
      this.writes.push(...writes.keys());
      if (this.loseAck) {
        this.loseAck = false;
        throw Object.assign(new Error('Respuesta perdida'), { code: 'unavailable' });
      }
      return result;
    }
    throw new Error('Conflicto de prueba sin resolver');
  }
}

function client(id, dni) {
  return { id, name: 'Cliente de prueba ' + id, dni, phone: '010000000', address: '', route: '', routeId: '', version: 1 };
}

function operation(id, clients, scope = admin) {
  const create = (path, data) => ({ kind: 'create', path, data, expectedVersion: 0 });
  return {
    id, actorId: scope.uid, type: 'CLIENT_IMPORT', createdAt: time,
    writes: [
      ...clients.map(record => create('clients/' + record.id, record)),
      create('audit/audit-' + id, {
        id: 'audit-' + id, action: 'CLIENTS_IMPORTED', entityType: 'CLIENT_IMPORT',
        entityId: id, operationId: id, actorId: scope.uid, role: scope.role, at: time,
        detail: { count: clients.length, clientIds: clients.map(record => record.id) }
      })
    ]
  };
}

function setup(adapter, overrides = {}) {
  let freshReads = 0;
  const store = createStore({
    adapter,
    validateSession: () => admin,
    readClients: async () => {
      freshReads++;
      return Array.from(adapter.db.entries()).filter(([path]) => path.startsWith('clients/')).map(([, record]) => record);
    },
    assertNewClients: (clients, existing) => {
      const identities = new Set(existing.map(record => record.dni));
      for (const record of clients) {
        if (identities.has(record.dni)) throw new Error('DNI duplicado en el servidor');
        identities.add(record.dni);
      }
    },
    ...overrides
  });
  return { store, freshReads: () => freshReads };
}

test('commits only new clients, one bounded audit, receipt and scoped lock', async () => {
  const adapter = new AtomicAdapter();
  const { store } = setup(adapter);
  const first = client('client-1', '01000001');
  const result = await store.execute(operation('import-1', [first]));
  assert.equal(result.status, 'APPLIED');
  assert.equal(result.operation.id, 'import-1');
  assert.equal(result.operation.actorId, admin.uid);
  assert.equal(result.operation.type, 'CLIENT_IMPORT');
  assert.equal(result.operation.writeCount, 2);
  assert.match(result.operation.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(adapter.db.get('clients/client-1').dni, '01000001');
  assert.equal(adapter.db.get('clients/client-1').version, 1);
  assert.deepEqual(adapter.db.get('audit/audit-import-1').detail, { count: 1, clientIds: ['client-1'] });
  assert.equal(adapter.db.get(lock).version, 1);
  assert.deepEqual(new Set(adapter.writes), new Set(['clients/client-1', 'audit/audit-import-1', 'operations/import-1', lock]));
});

test('refuses financial paths, unsafe client fields, invalid audit and non-creates before writing', async () => {
  const adapter = new AtomicAdapter();
  const { store } = setup(adapter);
  const unsafe = [
    op => { op.writes[0].path = 'credits/client-1'; },
    op => { op.writes[0].data.balance = 1; },
    op => { op.writes[0].data.routeId = 'another-route'; },
    op => { op.writes[0].kind = 'set'; },
    op => { op.writes[0].expectedVersion = 1; },
    op => { op.writes.length = 3; },
    op => {
      const { id, ...data } = op.writes[0].data;
      op.writes[0].data = Object.assign(Object.create({ id }), data);
    },
    op => { op.writes[1].data.detail.dni = '01000001'; },
    op => { op.writes[1].data.detail.clientIds = new Array(101).fill('client-1'); },
    op => { op.writes[1].data.detail.clientIds = ['another-client']; },
    op => { op.writes[1].data.at = '2026-02-31T00:00:00.000Z'; },
    op => { op.writes[1].data.role = 'supervisor'; }
  ];
  for (const mutate of unsafe) {
    const op = operation('import-1', [client('client-1', '01000001')]);
    mutate(op);
    await assert.rejects(store.execute(op), error => error.noQueue === true);
  }
  const tooMany = Array.from({ length: 101 }, (_, index) => client('client-' + index, '10000' + index));
  await assert.rejects(store.execute(operation('import-2', tooMany)), /CLIENT_IMPORT_INVALID/);
  assert.equal(adapter.attempts, 0);
  assert.equal(adapter.db.size, 0);
});

test('protects existing destinations, tombstones and a fresh server duplicate without partial writes', async () => {
  const op = operation('import-1', [client('client-1', '01000001'), client('client-2', '01000002')]);
  for (const [path, record] of [
    ['clients/client-2', { id: 'client-2', version: 4, tombstone: true, dni: '99999999' }],
    ['audit/audit-import-1', { id: 'audit-import-1' }],
    ['clients/other-id', client('other-id', '01000002')],
    [lock, { id: 'client-import-lock-v1', type: 'UNRELATED', version: 1 }]
  ]) {
    const adapter = new AtomicAdapter({ [path]: record });
    await assert.rejects(setup(adapter).store.execute(op));
    assert.deepEqual(Array.from(adapter.db), [[path, record]]);
    assert.equal(adapter.writes.length, 0);
  }
});

test('returns only the same actor and payload receipt after a lost acknowledgement', async () => {
  const adapter = new AtomicAdapter();
  const { store, freshReads } = setup(adapter);
  const record = client('client-1', '01000001');
  const op = operation('import-1', [record]);
  adapter.loseAck = true;
  await assert.rejects(store.execute(op), { code: 'unavailable', noQueue: true });
  const written = adapter.writes.length;
  const result = await store.execute(op);
  assert.equal(result.status, 'ALREADY_APPLIED');
  assert.equal(result.operation.id, 'import-1');
  assert.equal(freshReads(), 1);
  await assert.rejects(store.execute(operation('import-1', [{ ...record, name: 'Modificado' }])), /OPERATION_ID_COLLISION/);
  const other = { ...admin, uid: 'synthetic-supervisor', role: 'supervisor' };
  const otherStore = setup(adapter, { validateSession: () => other }).store;
  await assert.rejects(otherStore.execute(operation('import-1', [record], other)), /OPERATION_ID_COLLISION/);
  assert.equal(adapter.writes.length, written);
});

test('an import receipt identifies its exact audit and rejects a replaced audit link', async () => {
  const adapter = new AtomicAdapter();
  const { store } = setup(adapter);
  const op = operation('linked-receipt', [client('client-linked', '01000001')]);
  const receiptPath = 'operations/linked-receipt';
  const first = await store.execute(op);
  assert.equal(first.operation.auditId, 'audit-linked-receipt');
  assert.equal((await store.execute(op)).operation.auditId, 'audit-linked-receipt');
  const receipt = adapter.db.get(receiptPath);
  adapter.db.set(receiptPath, { ...receipt, auditId: 'unrelated-audit' });
  await assert.rejects(store.execute(op), /OPERATION_ID_COLLISION/);
  assert.equal(adapter.db.get('audit/audit-linked-receipt').actorId, admin.uid);
});

test('rejects a changed organization while a server read is pending', async () => {
  const adapter = new AtomicAdapter();
  let current = admin;
  const { store } = setup(adapter, {
    validateSession: () => current,
    readClients: async () => {
      current = { ...admin, orgId: 'other-org' };
      return [];
    }
  });
  await assert.rejects(store.execute(operation('import-1', [client('client-1', '01000001')])), /CLIENT_IMPORT_SESSION_CHANGED/);
  assert.equal(adapter.writes.length, 0);
});

test('rechecks a concurrent import after the organization lock changes', { timeout: 3000 }, async () => {
  const adapter = new AtomicAdapter();
  let reads = 0;
  let ready;
  const bothReading = new Promise(resolve => { ready = resolve; });
  const { store } = setup(adapter, {
    readClients: async () => {
      const snapshot = Array.from(adapter.db.entries()).filter(([path]) => path.startsWith('clients/')).map(([, record]) => record);
      if (++reads === 2) ready();
      if (reads <= 2) await bothReading;
      return snapshot;
    }
  });

  const results = await Promise.allSettled([
    store.execute(operation('import-1', [client('client-1', '01000001')])),
    store.execute(operation('import-2', [client('client-2', '01000001')]))
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), ['fulfilled', 'rejected']);
  assert.match(results.find(result => result.status === 'rejected').reason.message, /DNI duplicado/);
  assert.equal(reads, 3);
  assert.equal(adapter.db.get(lock).version, 1);
  assert.equal(adapter.writes.length, 4);
});
