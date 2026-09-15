// PRÉSTAMO YA — REPARACIÓN DEFINITIVA DE PROPIETARIOS Y SINCRONIZACIÓN
// v4 — Alfredo + Víctor
(() => {
  'use strict';

  if (window.__prestamoYaOwnerRepairV4) return;
  window.__prestamoYaOwnerRepairV4 = true;

  const ORG_ID =
    window.MI_CARTERA_CLOUD?.orgId || 'mi-cartera';

  const TARGETS = {
    '1789432343734': {
      name: 'Alfredo Lopez Martel',
      phone: '51947127238'
    },
    '1789205624924': {
      name: 'Víctor Coronado Cordova',
      phone: '51944581617'
    }
  };

  const norm = v =>
    String(v ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const digits = v =>
    String(v ?? '').replace(/\D/g, '');

  async function firebaseApi() {
    const [
      A,
      U,
      F
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')
    ]);

    if (!A.getApps().length) return null;

    const app = A.getApp();

    return {
      auth: U.getAuth(app),
      fs: F.getFirestore(app),
      F
    };
  }

  async function findClient(api, rule) {
    if (!api?.auth?.currentUser) return null;

    const ref =
      api.F.collection(
        api.fs,
        `orgs/${ORG_ID}/clients`
      );

    const snap =
      await api.F.getDocs(
        api.F.query(
          ref,
          api.F.where('orgId', '==', ORG_ID)
        )
      );

    const matches = [];

    for (const d of snap.docs) {
      const c = d.data() || {};

      if (
        norm(c.name) === norm(rule.name) &&
        digits(c.phone) === digits(rule.phone)
      ) {
        matches.push({
          ...c,
          id: d.id,
          __firestoreId: d.id
        });
      }
    }

    if (matches.length !== 1) {
      console.warn(
        '[OwnerRepairV4] Cliente no inequívoco:',
        rule.name,
        matches.length
      );
      return null;
    }

    return matches[0];
  }

  async function getCredit(api, creditId) {
    if (!api?.auth?.currentUser) return null;

    const ref =
      api.F.doc(
        api.fs,
        `orgs/${ORG_ID}/credits/${creditId}`
      );

    const snap = await api.F.getDoc(ref);

    if (!snap.exists()) return null;

    return {
      ...snap.data(),
      id: snap.id
    };
  }

  async function getPayments(api, creditId) {
    if (!api?.auth?.currentUser) return [];

    const ref =
      api.F.collection(
        api.fs,
        `orgs/${ORG_ID}/payments`
      );

    const snap =
      await api.F.getDocs(
        api.F.query(
          ref,
          api.F.where('orgId', '==', ORG_ID),
          api.F.where('creditId', '==', creditId)
        )
      );

    return snap.docs.map(d => ({
      ...d.data(),
      id: d.id
    }));
  }

  function paymentAmount(p) {
    const value =
      p.amount ??
      p.monto ??
      p.paidAmount ??
      p.paymentAmount ??
      0;

    const n = Number(value);

    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function localPaymentTotal(creditId) {
    const payments =
      Array.isArray(window.db?.payments)
        ? window.db.payments
        : [];

    return payments
      .filter(
        p =>
          String(p?.creditId) ===
          String(creditId)
      )
      .reduce(
        (sum, p) =>
          sum + paymentAmount(p),
        0
      );
  }

  function rebuildSchedule(credit, paidTotal) {
    if (!Array.isArray(credit.schedule)) {
      return;
    }

    let remaining = Math.max(
      0,
      Number(paidTotal) || 0
    );

    for (const row of credit.schedule) {
      const amount = Math.max(
        0,
        Number(
          row.amount ??
          row.installment ??
          row.cuota ??
          0
        )
      );

      const paid = Math.min(
        amount,
        remaining
      );

      row.paid = paid;
      row.balance = Math.max(
        0,
        amount - paid
      );

      if (paid >= amount && amount > 0) {
        row.status = 'Pagada';
      } else if (paid > 0) {
        row.status = 'Parcial';
      } else {
        row.status = 'Pendiente';
      }

      remaining -= paid;

      if (remaining < 0) {
        remaining = 0;
      }
    }
  }

  function putLocalCredit(credit) {
    window.db = window.db || {};
    window.db.credits =
      Array.isArray(window.db.credits)
        ? window.db.credits
        : [];

    const index =
      window.db.credits.findIndex(
        c =>
          String(c?.id) ===
          String(credit.id)
      );

    if (index >= 0) {
      window.db.credits[index] = {
        ...window.db.credits[index],
        ...credit
      };
    } else {
      window.db.credits.push(credit);
    }
  }

  async function repairOne(
    api,
    creditId,
    rule
  ) {
    const client =
      await findClient(api, rule);

    if (!client) {
      console.warn(
        '[OwnerRepairV4] No se pudo resolver cliente:',
        rule.name
      );
      return false;
    }

    const cloudCredit =
      await getCredit(api, creditId);

    if (!cloudCredit) {
      console.warn(
        '[OwnerRepairV4] Crédito no encontrado:',
        creditId
      );
      return false;
    }

    const localCredit =
      (window.db?.credits || []).find(
        c =>
          String(c?.id) ===
          String(creditId)
      ) || {};

    const credit = {
      ...cloudCredit,
      ...localCredit,
      id: creditId
    };

    // PROPIETARIO AUTORITATIVO
    credit.clientId = client.id;

    if (
      !credit.routeId &&
      client.routeId
    ) {
      credit.routeId = client.routeId;
    }

    // Reconciliación de pagos:
    // tomamos el mayor entre:
    // 1. cloud credit.paid
    // 2. local credit.paid
    // 3. pagos reales almacenados
    const cloudPaid =
      Number(cloudCredit.paid || 0);

    const localPaid =
      Number(localCredit.paid || 0);

    const cloudPayments =
      await getPayments(
        api,
        creditId
      );

    const cloudPaymentTotal =
      cloudPayments.reduce(
        (sum, p) =>
          sum + paymentAmount(p),
        0
      );

    const localPaymentTotalValue =
      localPaymentTotal(creditId);

    const paidTotal =
      Math.max(
        cloudPaid,
        localPaid,
        cloudPaymentTotal,
        localPaymentTotalValue
      );

    credit.paid = paidTotal;

    rebuildSchedule(
      credit,
      paidTotal
    );

    // Guardamos primero el crédito corregido
    await api.F.setDoc(
      api.F.doc(
        api.fs,
        `orgs/${ORG_ID}/credits/${creditId}`
      ),
      {
        ...credit,
        id: creditId,
        clientId: client.id,
        orgId: ORG_ID,
        userId:
          api.auth.currentUser.uid,
        updatedAt:
          new Date().toISOString(),
        ownerRepairVersion: 'v4'
      },
      {
        merge: true
      }
    );

    // Actualizamos local
    putLocalCredit(credit);

    console.log(
      '[OwnerRepairV4] CORREGIDO',
      creditId,
      rule.name,
      'clientId:',
      client.id,
      'paid:',
      paidTotal
    );

    return true;
  }

  async function repairAll() {
    try {
      const api =
        await firebaseApi();

      if (
        !api?.auth?.currentUser
      ) {
        console.warn(
          '[OwnerRepairV4] Sin sesión Firebase'
        );
        return false;
      }

      let changed = false;

      for (
        const [creditId, rule]
        of Object.entries(TARGETS)
      ) {
        try {
          const ok =
            await repairOne(
              api,
              creditId,
              rule
            );

          if (ok) {
            changed = true;
          }
        } catch (e) {
          console.error(
            '[OwnerRepairV4] Error crédito',
            creditId,
            e
          );
        }
      }

      if (changed) {
        try {
          window.persist?.();
        } catch (_) {}

        try {
          window.renderAll?.();
        } catch (_) {}
      }

      return changed;

    } catch (e) {
      console.error(
        '[OwnerRepairV4] Error general',
        e
      );

      return false;
    }
  }

  // Exponer reparación manual
  window.__prestamoYaRepairOwnersV4 =
    repairAll;

  // Ejecutar cuando Firebase esté listo
  function boot() {
    setTimeout(
      () => {
        repairAll().catch(
          console.error
        );
      },
      4500
    );
  }

  window.addEventListener(
    'load',
    boot
  );

  // IMPORTANTE:
  // cada vez que Cloud sincroniza,
  // volvemos a reparar DESPUÉS del pull.
  function hookCloudSync() {
    if (
      typeof window.cloudSyncNow !==
      'function'
    ) {
      setTimeout(
        hookCloudSync,
        1000
      );
      return;
    }

    if (
      window.__prestamoYaCloudSyncV4Hooked
    ) {
      return;
    }

    window.__prestamoYaCloudSyncV4Hooked =
      true;

    const original =
      window.cloudSyncNow;

    window.cloudSyncNow =
      async function (...args) {
        const result =
          await original.apply(
            this,
            args
          );

        try {
          await repairAll();
        } catch (e) {
          console.error(
            '[OwnerRepairV4] reparación post-sync',
            e
          );
        }

        return result;
      };

    console.log(
      '[OwnerRepairV4] CloudSync protegido'
    );
  }

  hookCloudSync();

})();
