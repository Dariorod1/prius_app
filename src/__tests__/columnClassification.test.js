/**
 * Tests de clasificación de columnas kanban.
 *
 * Prueban la lógica pura de asignación de grupos a columnas
 * (Cola / En Progreso / Finalizado) en los módulos de Confección y Bordado,
 * incluyendo el manejo de prendas excluidas (pausado = true) y
 * transiciones "usuario tonto" (va, vuelve, deshace, repite).
 *
 * No dependen de React ni de Supabase — pura lógica JS.
 */

import { describe, it, expect } from 'vitest';

// ============================================================
// HELPERS — réplica fiel de la lógica de los componentes
// ============================================================

const ESTADOS_COLA_CONF        = ['Corte Finalizado'];
const ESTADOS_EN_PROGRESO_CONF = ['En Confección'];
const ESTADOS_TERMINADO_CONF   = ['Confección Finalizada'];

const ESTADOS_COLA_BRD        = ['Confección Finalizada'];
const ESTADOS_EN_PROGRESO_BRD = ['En Bordado'];
const ESTADOS_TERMINADO_BRD   = ['Bordado Finalizado'];

// ── Confección ──────────────────────────────────────────────

function clasificarConfeccion(grupos) {
  const colaLotes = grupos.filter(g => {
    const np = g.pedidos.filter(p => !p.pausado);
    if (np.length === 0) return true;
    const tieneAlgunaEnProgreso = np.some(p => ESTADOS_EN_PROGRESO_CONF.includes(p.estado));
    const todasTerminadas = np.every(p => ESTADOS_TERMINADO_CONF.includes(p.estado));
    return !tieneAlgunaEnProgreso && !todasTerminadas;
  });

  const enProgresoLotes = grupos.filter(g => {
    const np = g.pedidos.filter(p => !p.pausado);
    if (np.length === 0) return false;
    const tieneAlgunaEnProgreso = np.some(p => ESTADOS_EN_PROGRESO_CONF.includes(p.estado));
    const noTodasTerminadas = !np.every(p => ESTADOS_TERMINADO_CONF.includes(p.estado));
    return tieneAlgunaEnProgreso && noTodasTerminadas;
  });

  const terminadosLotes = grupos.filter(g => {
    const np = g.pedidos.filter(p => !p.pausado);
    if (np.length === 0) return false;
    return np.every(p => ESTADOS_TERMINADO_CONF.includes(p.estado));
  });

  return { colaLotes, enProgresoLotes, terminadosLotes };
}

// ── Bordado ─────────────────────────────────────────────────

function clasificarBordado(grupos) {
  const colaLotes = grupos.filter(g => {
    const np = g.pedidos.filter(p => !p.pausado);
    if (np.length === 0) return g.pedidos.length > 0;
    return !np.some(p => ESTADOS_EN_PROGRESO_BRD.includes(p.estado) || ESTADOS_TERMINADO_BRD.includes(p.estado));
  });

  const terminadosLotes = grupos.filter(g => {
    const np = g.pedidos.filter(p => !p.pausado);
    if (np.length === 0) return false;
    return np.every(p => ESTADOS_TERMINADO_BRD.includes(p.estado));
  });

  const enProgresoLotes = grupos.filter(g => {
    const np = g.pedidos.filter(p => !p.pausado);
    if (np.length === 0) return false;
    return np.some(p => ESTADOS_EN_PROGRESO_BRD.includes(p.estado) || ESTADOS_TERMINADO_BRD.includes(p.estado)) &&
      !np.every(p => ESTADOS_TERMINADO_BRD.includes(p.estado));
  });

  return { colaLotes, enProgresoLotes, terminadosLotes };
}

// ── Factories ────────────────────────────────────────────────

let idCounter = 1;
const mkPedido = (estado, pausado = false) => ({
  id: String(idCounter++),
  estado,
  pausado,
  institucion_id: 'inst-1',
  grado: '3er Grado A',
  tipo_prenda: 'Chomba',
});

const mkGrupo = (pedidos) => ({ pedidos, grado: '3er Grado A', tipo_prenda: 'Chomba' });

// ============================================================
// TESTS — CONFECCIÓN
// ============================================================

describe('Confección — clasificación de columnas', () => {

  it('lote nuevo (todos Corte Finalizado) → Cola', () => {
    const g = mkGrupo([
      mkPedido('Corte Finalizado'),
      mkPedido('Corte Finalizado'),
      mkPedido('Corte Finalizado'),
    ]);
    const { colaLotes, enProgresoLotes, terminadosLotes } = clasificarConfeccion([g]);
    expect(colaLotes).toHaveLength(1);
    expect(enProgresoLotes).toHaveLength(0);
    expect(terminadosLotes).toHaveLength(0);
  });

  it('al menos 1 "En Confección" → En Progreso', () => {
    const g = mkGrupo([
      mkPedido('Corte Finalizado'),
      mkPedido('En Confección'),
      mkPedido('Corte Finalizado'),
    ]);
    const { colaLotes, enProgresoLotes, terminadosLotes } = clasificarConfeccion([g]);
    expect(colaLotes).toHaveLength(0);
    expect(enProgresoLotes).toHaveLength(1);
    expect(terminadosLotes).toHaveLength(0);
  });

  it('todos "Confección Finalizada" → Finalizado', () => {
    const g = mkGrupo([
      mkPedido('Confección Finalizada'),
      mkPedido('Confección Finalizada'),
    ]);
    const { colaLotes, enProgresoLotes, terminadosLotes } = clasificarConfeccion([g]);
    expect(colaLotes).toHaveLength(0);
    expect(enProgresoLotes).toHaveLength(0);
    expect(terminadosLotes).toHaveLength(1);
  });

  it('BUG ANTERIOR — estados mixtos sin nadie En Confección → ahora va a Cola (no En Progreso)', () => {
    // 1 en Corte Finalizado + 2 en Confección Finalizada, pero nadie activamente cosiendo
    const g = mkGrupo([
      mkPedido('Corte Finalizado'),
      mkPedido('Confección Finalizada'),
      mkPedido('Confección Finalizada'),
    ]);
    const { colaLotes, enProgresoLotes, terminadosLotes } = clasificarConfeccion([g]);
    // No debe estar en En Progreso (ese era el bug)
    expect(enProgresoLotes).toHaveLength(0);
    // Debe estar en Cola (el operador debe iniciar la confección manualmente)
    expect(colaLotes).toHaveLength(1);
    expect(terminadosLotes).toHaveLength(0);
  });

  it('usuario tonto — avanza y vuelve varias veces, nunca desaparece del kanban', () => {
    // Simula: Cola → En Progreso → Cola → En Progreso → Finalizado
    const estados = [
      ['Corte Finalizado', 'Corte Finalizado'],
      ['En Confección',    'Corte Finalizado'],
      ['Corte Finalizado', 'Corte Finalizado'],  // devuelto a cola
      ['En Confección',    'En Confección'],
      ['Confección Finalizada', 'Confección Finalizada'],
    ];

    for (const [e1, e2] of estados) {
      const g = mkGrupo([mkPedido(e1), mkPedido(e2)]);
      const { colaLotes, enProgresoLotes, terminadosLotes } = clasificarConfeccion([g]);
      const total = colaLotes.length + enProgresoLotes.length + terminadosLotes.length;
      expect(total).toBe(1); // el lote siempre está en exactamente una columna
    }
  });

  it('todos pausados → Cola (para que el admin pueda reincorporar)', () => {
    const g = mkGrupo([
      mkPedido('Corte Finalizado', true),
      mkPedido('En Confección', true),
    ]);
    const { colaLotes, enProgresoLotes, terminadosLotes } = clasificarConfeccion([g]);
    expect(colaLotes).toHaveLength(1);
    expect(enProgresoLotes).toHaveLength(0);
    expect(terminadosLotes).toHaveLength(0);
  });

  it('excluir 1 prenda de lote en progreso no cambia la columna si quedan activas en progreso', () => {
    const g = mkGrupo([
      mkPedido('En Confección'),
      mkPedido('En Confección', true), // excluida
    ]);
    const { enProgresoLotes } = clasificarConfeccion([g]);
    expect(enProgresoLotes).toHaveLength(1);
  });

  it('excluir todas las prendas en progreso → lote va a Cola si quedan activas en cola', () => {
    const g = mkGrupo([
      mkPedido('Corte Finalizado'),          // activa, en cola
      mkPedido('En Confección', true),       // excluida
    ]);
    const { colaLotes, enProgresoLotes } = clasificarConfeccion([g]);
    expect(colaLotes).toHaveLength(1);
    expect(enProgresoLotes).toHaveLength(0);
  });

  it('excluir prenda finalizada no afecta el conteo de progreso de las activas', () => {
    const g = mkGrupo([
      mkPedido('En Confección'),
      mkPedido('Confección Finalizada', true), // excluida
    ]);
    const { enProgresoLotes } = clasificarConfeccion([g]);
    expect(enProgresoLotes).toHaveLength(1);
  });

  it('reincorporar prenda pausada actualiza columna correctamente', () => {
    // Antes de reincorporar: 1 activa En Confección, 1 excluida
    const antes = mkGrupo([mkPedido('En Confección'), mkPedido('Corte Finalizado', true)]);
    const { enProgresoLotes: ep1 } = clasificarConfeccion([antes]);
    expect(ep1).toHaveLength(1);

    // Después de reincorporar: ambas activas, una en cola, una en progreso
    const despues = mkGrupo([mkPedido('En Confección'), mkPedido('Corte Finalizado')]);
    const { enProgresoLotes: ep2, colaLotes: c2 } = clasificarConfeccion([despues]);
    expect(ep2).toHaveLength(1); // sigue en progreso porque hay 1 En Confección
    expect(c2).toHaveLength(0);
  });
});

// ============================================================
// TESTS — BORDADO
// ============================================================

describe('Bordado — clasificación de columnas', () => {

  it('lote nuevo (todos Confección Finalizada) → Cola', () => {
    const g = mkGrupo([
      mkPedido('Confección Finalizada'),
      mkPedido('Confección Finalizada'),
    ]);
    const { colaLotes, enProgresoLotes, terminadosLotes } = clasificarBordado([g]);
    expect(colaLotes).toHaveLength(1);
    expect(enProgresoLotes).toHaveLength(0);
    expect(terminadosLotes).toHaveLength(0);
  });

  it('al menos 1 "En Bordado" → En Bordado', () => {
    const g = mkGrupo([
      mkPedido('Confección Finalizada'),
      mkPedido('En Bordado'),
    ]);
    const { colaLotes, enProgresoLotes } = clasificarBordado([g]);
    expect(enProgresoLotes).toHaveLength(1);
    expect(colaLotes).toHaveLength(0);
  });

  it('todos "Bordado Finalizado" → Finalizado', () => {
    const g = mkGrupo([
      mkPedido('Bordado Finalizado'),
      mkPedido('Bordado Finalizado'),
    ]);
    const { terminadosLotes, colaLotes, enProgresoLotes } = clasificarBordado([g]);
    expect(terminadosLotes).toHaveLength(1);
    expect(colaLotes).toHaveLength(0);
    expect(enProgresoLotes).toHaveLength(0);
  });

  it('mix En Bordado + Bordado Finalizado → En Bordado (no terminado todavía)', () => {
    const g = mkGrupo([
      mkPedido('En Bordado'),
      mkPedido('Bordado Finalizado'),
    ]);
    const { enProgresoLotes, terminadosLotes } = clasificarBordado([g]);
    expect(enProgresoLotes).toHaveLength(1);
    expect(terminadosLotes).toHaveLength(0);
  });

  it('lote en exactamente una columna en todo momento — usuario tonto', () => {
    const secuencias = [
      ['Confección Finalizada', 'Confección Finalizada'], // Cola
      ['En Bordado',            'Confección Finalizada'], // En Bordado
      ['En Bordado',            'En Bordado'],            // En Bordado
      ['Confección Finalizada', 'Confección Finalizada'], // devuelto a Cola
      ['En Bordado',            'Bordado Finalizado'],    // En Bordado (mix)
      ['Bordado Finalizado',    'Bordado Finalizado'],    // Finalizado
    ];
    for (const [e1, e2] of secuencias) {
      const g = mkGrupo([mkPedido(e1), mkPedido(e2)]);
      const { colaLotes, enProgresoLotes, terminadosLotes } = clasificarBordado([g]);
      const total = colaLotes.length + enProgresoLotes.length + terminadosLotes.length;
      expect(total).toBe(1);
    }
  });

  it('todos pausados → Cola (visible para admin)', () => {
    const g = mkGrupo([
      mkPedido('En Bordado', true),
      mkPedido('Confección Finalizada', true),
    ]);
    const { colaLotes, enProgresoLotes, terminadosLotes } = clasificarBordado([g]);
    expect(colaLotes).toHaveLength(1);
    expect(enProgresoLotes).toHaveLength(0);
    expect(terminadosLotes).toHaveLength(0);
  });

  it('excluir la última prenda no finalizada → lote pasa a Finalizado', () => {
    const g = mkGrupo([
      mkPedido('Bordado Finalizado'),   // activa, finalizada
      mkPedido('En Bordado', true),     // excluida
    ]);
    const { terminadosLotes, enProgresoLotes } = clasificarBordado([g]);
    expect(terminadosLotes).toHaveLength(1);
    expect(enProgresoLotes).toHaveLength(0);
  });

  it('reincorporar prenda excluida vuelve a En Bordado si hay activas bordando', () => {
    // Antes: 1 finalizada + 1 excluida en bordado → lote en Finalizado
    const antes = mkGrupo([
      mkPedido('Bordado Finalizado'),
      mkPedido('En Bordado', true),
    ]);
    const { terminadosLotes: t1 } = clasificarBordado([antes]);
    expect(t1).toHaveLength(1);

    // Después de reincorporar: 1 finalizada + 1 en bordado → En Bordado
    const despues = mkGrupo([
      mkPedido('Bordado Finalizado'),
      mkPedido('En Bordado'),
    ]);
    const { enProgresoLotes: ep, terminadosLotes: t2 } = clasificarBordado([despues]);
    expect(ep).toHaveLength(1);
    expect(t2).toHaveLength(0);
  });

  it('múltiples lotes independientes no se contaminan entre sí', () => {
    const g1 = mkGrupo([mkPedido('Confección Finalizada'), mkPedido('Confección Finalizada')]);
    const g2 = mkGrupo([mkPedido('En Bordado'), mkPedido('Bordado Finalizado')]);
    const g3 = mkGrupo([mkPedido('Bordado Finalizado'), mkPedido('Bordado Finalizado')]);
    const { colaLotes, enProgresoLotes, terminadosLotes } = clasificarBordado([g1, g2, g3]);
    expect(colaLotes).toHaveLength(1);
    expect(enProgresoLotes).toHaveLength(1);
    expect(terminadosLotes).toHaveLength(1);
  });
});

// ============================================================
// TESTS — EXCLUIR / REINCORPORAR (lógica de pausado)
// ============================================================

describe('Excluir / Reincorporar prendas — invariantes', () => {

  it('excluir y reincorporar devuelve el sistema al estado original', () => {
    const g = mkGrupo([
      mkPedido('En Confección'),
      mkPedido('Corte Finalizado'),
    ]);

    const estadoOriginal = clasificarConfeccion([g]);
    expect(estadoOriginal.enProgresoLotes).toHaveLength(1);

    // Simular exclusión de la segunda prenda
    const gExcluido = mkGrupo([
      g.pedidos[0],
      { ...g.pedidos[1], pausado: true },
    ]);
    const estadoExcluido = clasificarConfeccion([gExcluido]);
    expect(estadoExcluido.enProgresoLotes).toHaveLength(1); // sigue en progreso

    // Simular reincorporación
    const gReincorporado = mkGrupo([
      g.pedidos[0],
      { ...g.pedidos[1], pausado: false },
    ]);
    const estadoReincorporado = clasificarConfeccion([gReincorporado]);
    expect(estadoReincorporado.enProgresoLotes).toHaveLength(1); // vuelve al original
    expect(estadoReincorporado.colaLotes).toHaveLength(0);
  });

  it('excluir N veces seguidas = excluir 1 vez (idempotente)', () => {
    // pausado = true múltiples veces no debe cambiar el resultado
    const p = mkPedido('En Confección');
    const g1 = mkGrupo([{ ...p, pausado: true }]);
    const g2 = mkGrupo([{ ...p, pausado: true }]);
    const r1 = clasificarConfeccion([g1]);
    const r2 = clasificarConfeccion([g2]);
    expect(r1.colaLotes).toHaveLength(r2.colaLotes.length);
    expect(r1.enProgresoLotes).toHaveLength(r2.enProgresoLotes.length);
  });

  it('un lote con todos excluidos nunca desaparece del kanban (queda en Cola)', () => {
    // Este es el invariante más crítico: el admin siempre puede verlo para reincorporar
    const estadosBordado = ['Confección Finalizada', 'En Bordado', 'Bordado Finalizado'];
    for (const estado of estadosBordado) {
      const g = mkGrupo([mkPedido(estado, true), mkPedido(estado, true)]);
      const { colaLotes, enProgresoLotes, terminadosLotes } = clasificarBordado([g]);
      const total = colaLotes.length + enProgresoLotes.length + terminadosLotes.length;
      expect(total).toBeGreaterThan(0); // nunca desaparece
    }
  });
});
