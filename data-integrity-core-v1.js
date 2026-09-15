(() => {
  'use strict';

  if (window.__prestamoYaDataIntegrityCoreV1) return;
  window.__prestamoYaDataIntegrityCoreV1 = true;

  const ORG_ID =
    window.MI_CARTERA_CLOUD?.orgId || 'mi-cartera';

  let firebaseCache = null;

  function log(...args) {
    console.log(
      '[Préstamo Ya DataIntegrityV1]',
      ...args
    );
  }

  function warn(...args) {
    console.warn(
      '[Préstamo Ya DataIntegrityV1]',
      ...args
    );
  }

  function clone(value) {
    try {
      return JSON.parse(
        JSON.stringify(value)
      );
    } catch (_) {
      return value;
    }
  }

  function creditKey(id) {
    return String(id);
  }

  function paymentKey(id) {
    return String(id);
  }

  async function firebaseApi() {
    if (firebaseCache) {
      return firebaseCache;
    }

    try {
      const [A, U, F] =
        await Promise.all([
          import(
            'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'
          ),
          import(
            'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'
          ),
          import(
            'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js'
          )
        ]);

      if (!A.getApps().length) {
        return null;
      }

      const app = A.getApp();

      firebaseCache = {
        A,
        U,
        F,
        app,
        auth: U.getAuth(app),
        fs: F.getFirestore(app)
      };

      return firebaseCache;
    } catch (e) {
      warn(
        'Firebase API no disponible',
        e
      );

      return null;
    }
  }

  function localStateSnapshot() {
    const credits =
      Array.isArray(window.db?.credits)
        ? window.db.credits
        : [];

    const payments =
      Array.isArray(window.db?.payments)
        ? window.db.payments
        : [];

    const creditMap = new Map();

    credits.forEach(c => {
      if (c?.id == null) return;

      creditMap.set(
        creditKey(c.id),
        clone(c)
      );
    });

    const paymentMap = new Map();

    payments.forEach(p => {
      if (p?.id == null) return;

      paymentMap.set(
        paymentKey(p.id),
        clone(p)
      );
    });

    return {
      credits,
      payments,
      creditMap,
      paymentMap,
      capturedAt:
        new Date().toISOString()
    };
  }

  function mergeImmutableRelations(before) {
    if (!window.db) return;

    const currentCredits =
      Array.isArray(window.db.credits)
        ? window.db.credits
        : [];

    const currentPayments =
      Array.isArray(window.db.payments)
        ? window.db.payments
        : [];

    /*
      REGLA 1:
      El propietario de un crédito existente
      es inmutable.

      Ninguna sincronización puede cambiar
      clientId silenciosamente.
    */

    for (const current of currentCredits) {
      if (current?.id == null) continue;

      const old =
        before.creditMap.get(
          creditKey(current.id)
        );

      if (!old) continue;

      if (
        old.clientId != null &&
        String(old.clientId) !==
          String(current.clientId)
      ) {
        warn(
          'Cambio de propietario bloqueado',
          current.id,
          old.clientId,
          current.clientId
        );

        current.clientId =
          old.clientId;
      }

      /*
        routeId también se mantiene asociado
        al crédito salvo modificación explícita
        desde la matriz.
      */

      if (
        old.routeId != null &&
        current.routeId == null
      ) {
        current.routeId =
          old.routeId;
      }
    }

    /*
      REGLA 2:
      Un pago existente nunca puede cambiar
      de crédito.
    */

    for (const current of currentPayments) {
      if (current?.id == null) continue;

      const old =
        before.paymentMap.get(
          paymentKey(current.id)
        );

      if (!old) continue;

      if (
        old.creditId != null &&
        String(old.creditId) !==
          String(current.creditId)
      ) {
        warn(
          'Cambio de crédito del pago bloqueado',
          current.id,
          old.creditId,
          current.creditId
        );

        current.creditId =
          old.creditId;
      }
    }

    /*
      REGLA 3:
      Una operación local existente no desaparece
      silenciosamente después de una sincronización.
    */

    const currentPaymentIds =
      new Set(
        currentPayments.map(
          p => paymentKey(p.id)
        )
      );

    for (const old of before.payments) {
      if (!old?.id) continue;

      if (
        !currentPaymentIds.has(
          paymentKey(old.id)
        )
      ) {
        window.db.payments.push(
          clone(old)
        );
      }
    }

    /*
      REGLA 4:
      Un crédito local existente tampoco puede
      desaparecer por una sustitución ciega.
    */

    const currentCreditIds =
      new Set(
        currentCredits.map(
          c => creditKey(c.id)
        )
      );

    for (const old of before.credits) {
      if (!old?.id) continue;

      if (
        !currentCreditIds.has(
          creditKey(old.id)
        )
      ) {
        window.db.credits.push(
          clone(old)
        );
      }
    }
  }

  async function writePaymentAndCredit(
    payment,
    credit
  ) {
    const api =
      await firebaseApi();

    if (
      !api?.auth?.currentUser ||
      !payment ||
      !credit
    ) {
      return false;
    }

    try {
      const paymentRef =
        api.F.doc(
          api.fs,
          `orgs/${ORG_ID}/payments/${payment.id}`
        );

      const creditRef =
        api.F.doc(
          api.fs,
          `orgs/${ORG_ID}/credits/${credit.id}`
        );

      const clientId =
        credit.clientId ?? null;

      await api.F.setDoc(
        paymentRef,
        {
          ...clone(payment),
          id: payment.id,
          creditId: credit.id,
          clientId,
          orgId: ORG_ID,
          userId:
            api.auth.currentUser.uid,
          integrityVersion: 'v1',
          updatedAt:
            new Date().toISOString()
        },
        { merge: true }
      );

      await api.F.setDoc(
        creditRef,
        {
          ...clone(credit),
          id: credit.id,
          clientId,
          orgId: ORG_ID,
          userId:
            api.auth.currentUser.uid,
          integrityVersion: 'v1',
          updatedAt:
            new Date().toISOString()
        },
        { merge: true }
      );

      log(
        'Pago y crédito persistidos',
        payment.id,
        credit.id,
        clientId
      );

      return true;
    } catch (e) {
      warn(
        'No se pudo persistir pago/crédito',
        e
      );

      return false;
    }
  }

  async function writeCredit(
    credit
  ) {
    const api =
      await firebaseApi();

    if (
      !api?.auth?.currentUser ||
      !credit
    ) {
      return false;
    }

    try {
      const ref =
        api.F.doc(
          api.fs,
          `orgs/${ORG_ID}/credits/${credit.id}`
        );

      await api.F.setDoc(
        ref,
        {
          ...clone(credit),
          id: credit.id,
          clientId:
            credit.clientId,
          orgId: ORG_ID,
          userId:
            api.auth.currentUser.uid,
          integrityVersion: 'v1',
          updatedAt:
            new Date().toISOString()
        },
        { merge: true }
      );

      return true;
    } catch (e) {
      warn(
        'No se pudo persistir crédito',
        e
      );

      return false;
    }
  }

  /*
    PROTECCIÓN DEL REGISTRO DE PAGOS.
  */

  function hookRegisterPayment() {
    if (
      typeof window.registerPayment !==
      'function'
    ) {
      setTimeout(
        hookRegisterPayment,
        500
      );
      return;
    }

    if (
      window.__prestamoYaRegisterPaymentV1
    ) {
      return;
    }

    window.__prestamoYaRegisterPaymentV1 =
      true;

    const original =
      window.registerPayment;

    window.registerPayment =
      async function(id, ...args) {
        const before =
          localStateSnapshot();

        const result =
          await original.call(
            this,
            id,
            ...args
          );

        try {
          const credit =
            window.db?.credits?.find(
              c =>
                String(c.id) ===
                String(id)
            );

          const payment =
            window.db?.payments
              ?.slice()
              .reverse()
              .find(
                p =>
                  String(p.creditId) ===
                  String(id) &&
                  !before.paymentMap.has(
                    paymentKey(p.id)
                  )
              );

          if (
            credit &&
            payment
          ) {
            await writePaymentAndCredit(
              payment,
              credit
            );
          }
        } catch (e) {
          warn(
            'Error post-pago',
            e
          );
        }

        return result;
      };

    log(
      'registerPayment protegido'
    );
  }

  /*
    PROTECCIÓN DE CREACIÓN / MODIFICACIÓN
    DE CRÉDITOS.
  */

  function hookSaveCredit() {
    if (
      typeof window.saveCredit !==
      'function'
    ) {
      setTimeout(
        hookSaveCredit,
        500
      );
      return;
    }

    if (
      window.__prestamoYaSaveCreditV1
    ) {
      return;
    }

    window.__prestamoYaSaveCreditV1 =
      true;

    const original =
      window.saveCredit;

    window.saveCredit =
      async function(...args) {
        const before =
          localStateSnapshot();

        const result =
          await original.apply(
            this,
            args
          );

        try {
          const credits =
            Array.isArray(
              window.db?.credits
            )
              ? window.db.credits
              : [];

          /*
            Créditos nuevos.
          */

          for (const credit of credits) {
            if (
              !before.creditMap.has(
                creditKey(credit.id)
              )
            ) {
              await writeCredit(
                credit
              );
            }
          }

          /*
            Créditos existentes:
            escribir su estado actual sin permitir
            cambiar silenciosamente de propietario.
          */

          for (const credit of credits) {
            const old =
              before.creditMap.get(
                creditKey(credit.id)
              );

            if (!old) continue;

            if (
              String(old.clientId) !==
              String(credit.clientId)
            ) {
              credit.clientId =
                old.clientId;
            }

            await writeCredit(
              credit
            );
          }
        } catch (e) {
          warn(
            'Error post-crédito',
            e
          );
        }

        return result;
      };

    log(
      'saveCredit protegido'
    );
  }

  /*
    PROTECCIÓN DE SINCRONIZACIÓN.
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
      window.__prestamoYaCloudSyncIntegrityV1
    ) {
      return;
    }

    window.__prestamoYaCloudSyncIntegrityV1 =
      true;

    const original =
      window.cloudSyncNow;

    window.cloudSyncNow =
      async function(...args) {
        const before =
          localStateSnapshot();

        const result =
          await original.apply(
            this,
            args
          );

        try {
          mergeImmutableRelations(
            before
          );

          /*
            Después de restaurar relaciones
            protegidas, persistimos localmente.
          */

          if (
            typeof window.persist ===
            'function'
          ) {
            window.persist();
          }

          /*
            Volvemos a escribir los créditos
            que hayan sido protegidos.
          */

          for (
            const credit
            of window.db?.credits || []
          ) {
            const old =
              before.creditMap.get(
                creditKey(credit.id)
              );

            if (!old) continue;

            if (
              String(old.clientId) !==
              String(credit.clientId)
            ) {
              credit.clientId =
                old.clientId;
            }

            await writeCredit(
              credit
            );
          }

          log(
            'Sincronización validada'
          );
        } catch (e) {
          warn(
            'Error validando sincronización',
            e
          );
        }

        return result;
      };

    log(
      'cloudSyncNow protegido'
    );
  }

  /*
    VALIDACIÓN GLOBAL.
  */

  function validateIntegrity() {
    if (!window.db) return;

    const clients =
      Array.isArray(window.db.clients)
        ? window.db.clients
        : [];

    const credits =
      Array.isArray(window.db.credits)
        ? window.db.credits
        : [];

    const payments =
      Array.isArray(window.db.payments)
        ? window.db.payments
        : [];

    const clientIds =
      new Set(
        clients.map(
          c => String(c.id)
        )
      );

    for (const credit of credits) {
      if (
        credit.clientId == null
      ) {
        warn(
          'Crédito sin propietario',
          credit.id
        );
        continue;
      }

      if (
        !clientIds.has(
          String(credit.clientId)
        )
      ) {
        warn(
          'Crédito con clientId inexistente',
          credit.id,
          credit.clientId
        );
      }
    }

    const creditIds =
      new Set(
        credits.map(
          c => String(c.id)
        )
      );

    for (const payment of payments) {
      if (
        !creditIds.has(
          String(payment.creditId)
        )
      ) {
        warn(
          'Pago con creditId inexistente',
          payment.id,
          payment.creditId
        );
      }
    }
  }

  function boot() {
    hookRegisterPayment();
    hookSaveCredit();
    hookCloudSync();

    setTimeout(
      validateIntegrity,
      1000
    );
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

  window.__prestamoYaValidateIntegrityV1 =
    validateIntegrity;

  log(
    'Data Integrity Core V1 activo'
  );

})();
