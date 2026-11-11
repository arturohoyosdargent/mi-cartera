// Mi Cartera PRO V2 - preparación y validación de altas de clientes por archivo.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./import-preview-core-v2.js'));
  } else {
    root.MiCarteraV2ClientImportCore = factory(root.MiCarteraV2ImportPreviewCore);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (preview) {
  'use strict';

  const MAX_CLIENTS = 100;
  const fields = [
    ['name', 'nombre', 160],
    ['phone', 'teléfono', 48],
    ['dni', 'DNI o documento', 64],
    ['address', 'dirección', 400],
    ['guarantor', 'nombre del fiador', 160],
    ['guarantorPhone', 'teléfono del fiador', 48],
    ['reference', 'referencia', 400],
    ['location', 'ubicación', 64]
  ];
  const clientKeys = new Set([...fields.map(([key]) => key), 'route', 'routeId', 'id', 'version']);
  const identityLabels = ['Identificador', 'DNI o documento', 'Teléfono'];
  const trim = value => String(value ?? '').trim();
  const phoneKey = value => trim(value).replace(/\D/g, '');

  function documentKey(value) {
    const key = trim(value).normalize('NFKC').trim().toUpperCase();
    return /^[0-9\s.-]+$/.test(key) ? key.replace(/\D/g, '') : key;
  }

  function identityKeys(client) {
    return [
      trim(client?.id) || trim(client?.__firestoreId),
      documentKey(client?.dni) || documentKey(client?.document) || documentKey(client?.documento),
      phoneKey(client?.phone) || phoneKey(client?.telefono)
    ];
  }

  function duplicateIssues(entries, existingClients) {
    const current = identityLabels.map(() => new Set());
    const seen = identityLabels.map(() => new Map());
    for (const client of existingClients) {
      identityKeys(client).forEach((key, index) => {
        if (key) current[index].add(key);
      });
    }
    const issues = [];
    for (const { client, label } of entries) {
      identityKeys(client).forEach((key, index) => {
        if (!key) return;
        const field = identityLabels[index];
        if (current[index].has(key)) issues.push(label + ': ' + field + ' coincide con la cartera actual.');
        const prior = seen[index].get(key);
        if (prior) issues.push(label + ': ' + field + ' repetido en ' + prior.toLowerCase() + '.');
        else seen[index].set(key, label);
      });
    }
    return issues;
  }

  function manualIdentityChanges(previous, client) {
    const before = identityKeys(previous);
    return identityKeys(client).map((key, index) => index > 0 && key !== before[index] ? key : '');
  }

  function assertManualIdentity(client, changes, existingClients) {
    const id = identityKeys(client)[0];
    for (const existing of existingClients) {
      const keys = identityKeys(existing);
      if (keys[0] === id) continue;
      const match = changes.findIndex((key, index) => key && key === keys[index]);
      if (match >= 0) {
        throw Object.assign(new Error(identityLabels[match] + ' coincide con la cartera actual.'), {
          code: 'CLIENT_DUPLICATE', noQueue: true
        });
      }
    }
  }

  function validLocation(value) {
    if (!value) return true;
    const coordinates = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1).trim() : value;
    const match = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(coordinates);
    return !!match && Math.abs(Number(match[1])) <= 90 && Math.abs(Number(match[2])) <= 180;
  }

  function fieldIssues(client) {
    const issues = [];
    if (!client.name) issues.push('El nombre es obligatorio.');
    if (!phoneKey(client.phone)) issues.push('El teléfono es obligatorio y debe contener al menos un dígito.');
    for (const [key, label, max] of fields) {
      if (client[key].length > max) issues.push('El campo ' + label + ' supera el límite de ' + max + ' caracteres.');
    }
    if (!validLocation(client.location)) issues.push('La ubicación debe contener latitud y longitud válidas.');
    return issues;
  }

  function prepare(rawRows, { existingClients = [], hasOmittedCells = false } = {}) {
    if (typeof preview?.validate !== 'function' || !Array.isArray(existingClients)) {
      return { eligible: false, clients: [], issues: ['No se pudo verificar el archivo y la cartera actual.'] };
    }
    const result = preview.validate(rawRows, { existingClients });
    const issues = [...result.errors];
    const entries = [];
    if (hasOmittedCells) issues.push('El archivo contiene celdas omitidas por fórmulas o errores.');
    if (result.total > MAX_CLIENTS) {
      issues.push('Se pueden importar hasta ' + MAX_CLIENTS + ' clientes por archivo.');
      return { eligible: false, clients: [], issues };
    }
    for (const row of result.rows) {
      const label = 'Fila ' + row.number;
      if (row.errors.length || row.duplicate) {
        const errors = row.errors.length ? row.errors : ['Revisa el duplicado.'];
        for (const error of errors) issues.push(label + ': ' + error);
        continue;
      }
      const client = Object.fromEntries(fields.map(([key]) => [key, trim(row.values[key])]));
      client.route = '';
      client.routeId = '';
      const errors = fieldIssues(client);
      if (errors.length) {
        for (const error of errors) issues.push(label + ': ' + error);
      } else {
        entries.push({ client, label });
      }
    }
    issues.push(...duplicateIssues(entries, existingClients));
    const eligible = !issues.length && !!entries.length;
    return { eligible, clients: eligible ? entries.map(({ client }) => client) : [], issues };
  }

  function assertNewClients(clients, existingClients = []) {
    if (!Array.isArray(clients) || !clients.length || clients.length > MAX_CLIENTS || !Array.isArray(existingClients)) {
      throw new Error('Se requiere una cartera verificable y de 1 a ' + MAX_CLIENTS + ' clientes nuevos.');
    }
    const entries = Array.from(clients, (client, index) => {
      const label = 'Cliente ' + (index + 1);
      if (!client || typeof client !== 'object' || Array.isArray(client) ||
          Object.keys(client).length !== clientKeys.size || Object.keys(client).some(key => !clientKeys.has(key)) ||
          typeof client.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(client.id) || client.version !== 1 ||
          client.route !== '' || client.routeId !== '' ||
          fields.some(([key]) => typeof client[key] !== 'string' || client[key] !== client[key].trim())) {
        throw new Error(label + ': el registro no corresponde a un alta de cliente válida.');
      }
      const [issue] = fieldIssues(client);
      if (issue) throw new Error(label + ': ' + issue);
      return { client, label };
    });
    const [issue] = duplicateIssues(entries, existingClients);
    if (issue) throw new Error(issue);
    return true;
  }

  return { prepare, assertNewClients, manualIdentityChanges, assertManualIdentity, MAX_CLIENTS };
});
