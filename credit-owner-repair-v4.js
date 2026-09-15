(() => {
  'use strict';

  if (window.__prestamoYaOwnerRepairV5) return;
  window.__prestamoYaOwnerRepairV5 = true;

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
    try {
      const [A, U, F] = await Promise.all([
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
    } catch (e) {
      console.error('[OwnerRepairV5] Firebase API error', e);
      return null;
    }
  }

  function localClient(rule) {
    const clients = Array.isArray(window.db?.clients)
      ? window.db.clients
      : [];

    const matches = clients.filter(c =>
      norm(c?.name) === norm(rule.name) &&
      digits(c?.phone) === digits(rule.phone)
    );

    return matches.length === 1 ? matches[0] : null;
  }

  async function cloudClient(api, rule) {
    if (!api?.auth?.currentUser) return null;

    try {
      const ref = api.F.collection(
        api.fs,
        `orgs/${ORG_ID}/clients`
      );

      const snap = await api.F.getDocs(
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
            __firestoreId: d.id
          });
        }
      }

      return matches.length === 1 ? matches[0] : null;
    } catch (e) {
      console.error('[OwnerRepairV5] cloud client lookup error', e);
      return null;
    }
  }

  async function getCredit(api, creditId) {
    try {
      const ref = api.F.doc(
        api.fs,
        `orgs/${ORG_ID}/credits/${creditId}`
      );

      const snap = await api.F.getDoc(ref);

      if (!snap.exists()) return null;

      return {
        ...snap.data(),
        id: snap.id
      };
    } catch (e) {
      console.error('[OwnerRepairV5] credit lookup error', creditId, e);
      return null;
    }
  }

  async function getPayments(api, creditId) {
    try {
      const ref = api.F.collection(
        api.fs,
        `orgs/${ORG_ID}/payments`
      );

      const snap = await api.F.getDocs(
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
    } catch (e) {
      console.error('[OwnerRepairV5] payment lookup error', creditId, e);
      return [];
    }
  }

  function paymentAmount(p) {
    const value =
      p?.amount ??
      p?.monto ??
      p?.paidAmount ??
      p?.paymentAmount ??
      0;

    const n = Number(value);

    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function localPaymentTotal(creditId) {
    const payments = Array.isArray(window.db?.payments)
      ? window.db.payments
      : [];

    return payments
      .filter(p => String(p?.creditId) === String(creditId))
      .reduce(
        (sum, p) => sum + paymentAmount(p),
        0
      );
  }

  function rebuildSchedule(credit, paidTotal) {
    if (!Array.isArray(credit.schedule)) return;

    let remaining = Math.max(
      0,
      Number(paidTotal) || 0
    );

    for (const row of credit.schedule) {
      const amount = Math.max(
        0,
        Number(
          row?.amount ??
          row?.installment ??
          row?.cuota ??
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
        c => String(c?.id) === String(credit.id)
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

  async function repairOne(api, creditId, rule) {
    const local = localClient(rule);
    const cloud = await cloudClient(api, rule);

    /*
      MUY IMPORTANTE:
      La interfaz trabaja con el ID interno del cliente.
      No usamos automáticamente el ID del documento Firestore.
    */

    const canonicalClientId =
      local?.id ??
      local?.uid ??
      cloud?.id ??
      cloud?.uid ??
      cloud?.__firestoreId ??
      null;

    if (!canonicalClientId) {
      console.warn(
        '[OwnerRepairV5] No canonical client ID:',
        creditId,
        rule
      );
      return false;
    }

    const cloudCredit =
      await getCredit(api, creditId);

    if (!cloudCredit) {
      console.warn(
        '[OwnerRepairV5] Credit not found:',
        creditId
      );
      return false;
    }

    const localCredit =
      (window.db?.credits || [])
        .find(
          c =>
            String(c?.id) ===
            String(creditId)
        ) || {};

    /*
      El crédito existente es la fuente.
      No se crea uno nuevo.
      Se conserva ID, capital, total y calendario.
    */

    const credit = {
      ...cloudCredit,
      ...localCredit,
      id: creditId
    };

    const previousClientId =
      credit.clientId;

    credit.clientId =
      canonicalClientId;

    if (
      !credit.routeId &&
      (local?.routeId || cloud?.routeId)
    ) {
      credit.routeId =
        local?.routeId ||
        cloud?.routeId;
    }

    /*
      Reconciliación de pagos:
      nunca sumamos local + nube.
      Tomamos el mayor valor confirmado.
    */

    const cloudPaid =
      Number(cloudCredit.paid) || 0;

    const localPaid =
      Number(localCredit.paid) || 0;

    const cloudPayments =
      await getPayments(api, creditId);

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

    /*
      Escritura definitiva en Firestore.
    */

    const payload = {
      ...credit,
      id: creditId,
      clientId: canonicalClientId,
      orgId: ORG_ID,
      userId:
        api.auth.currentUser.uid,
      updatedAt:
        new Date().toISOString(),
      ownerRepairVersion: 'v5'
    };

    await api.F.setDoc(
      api.F.doc(
        api.fs,
        `orgs/${ORG_ID}/credits/${creditId}`
      ),
      payload,
      { merge: true }
    );

    /*
      Actualización inmediata de la copia local.
    */

    putLocalCredit(credit);

    console.log(
      '[OwnerRepairV5] repaired',
      creditId,
      rule.name,
      'clientId:',
      canonicalClientId,
      'paid:',
      paidTotal,
      'previousClientId:',
      previousClientId
    );

    return true;
  }

  async function repairAll() {
    const api =
      await firebaseApi();

    if (!api?.auth?.currentUser) {
      console.warn(
        '[OwnerRepairV5] User not authenticated yet'
      );
      return false;
    }

    let changed = false;

    for (
      const [creditId, rule]
      of Object.entries(TARGETS)
    ) {
      try {
        const repaired =
          await repairOne(
            api,
            creditId,
            rule
          );

        if (repaired) {
          changed = true;
        }
      } catch (e) {
        console.error(
          '[OwnerRepairV5] repair failed',
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

      try {
        window.renderCredits?.();
      } catch (_) {}
    }

    return changed;
  }

  window.__prestamoYaRepairOwnersV5 =
    repairAll;

  /*
    EJECUCIÓN INICIAL.
    Importante: este archivo se carga dinámicamente
    después de window.load, por lo que NO dependemos
    exclusivamente del evento load.
  */

  function boot() {
    setTimeout(() => {
      repairAll().catch(console.error);
    }, 1500);
  }

  if (
    document.readyState ===
    'complete'
  ) {
    boot();
  } else {
    window.addEventListener(
      'load',
      boot,
      { once: true }
    );
  }

  /*
    BLINDAJE:
    cualquier cloudSyncNow posterior
    vuelve a ejecutar la reparación.
  */

  function hookCloudSync() {
    if (
      typeof window.cloudSyncNow !==
      'function'
    ) {
      setTimeout(
        hookCloudSync,
        500
      );
      return;
    }

    if (
      window.__prestamoYaCloudSyncV5Hooked
    ) {
      return;
    }

    window.__prestamoYaCloudSyncV5Hooked =
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
            '[OwnerRepairV5] post-sync repair error',
            e
          );
        }

        return result;
      };

    console.log(
      '[OwnerRepairV5] cloudSyncNow protegido'
    );
  }

  hookCloudSync();

})();
