import { create } from 'zustand'
import { FALLBACK_NODES } from '../lib/ontologyBootstrap'

export const useOntologyStore = create((set) => ({
  /** Подпись последнего применённого моста планирования (flowCode + initial nodes/edges) */
  lastConsumedPlanningSignature: null,

  schemaNodes: null,
  schemaEdges: null,
  mode: 'schema',
  codeValue: null,

  applyPlanningHandoff: ({ signature, schemaNodes, schemaEdges, codeValue, mode }) =>
    set({
      lastConsumedPlanningSignature: signature,
      schemaNodes,
      schemaEdges,
      codeValue,
      mode: mode ?? 'schema',
    }),

  setMode: (mode) => set({ mode }),

  setCodeValue: (codeValue) => set({ codeValue }),

  setSchemaEdges: (arg) =>
    set((state) => {
      const prev = Array.isArray(state.schemaEdges) ? state.schemaEdges : []
      const next = typeof arg === 'function' ? arg(prev) : arg
      return { schemaEdges: Array.isArray(next) ? next : prev }
    }),

  setSchemaNodes: (arg) =>
    set((state) => {
      const prev = state.schemaNodes?.length ? state.schemaNodes : FALLBACK_NODES
      const next = typeof arg === 'function' ? arg(prev) : arg
      if (!next || !Array.isArray(next) || next.length === 0) {
        if (prev && prev.length > 0) return { schemaNodes: prev }
        return { schemaNodes: FALLBACK_NODES }
      }
      return { schemaNodes: next }
    }),

  resetExpoPreset: () =>
    set({
      lastConsumedPlanningSignature: null,
      schemaNodes: null,
      schemaEdges: null,
      mode: 'schema',
      codeValue: null,
    }),
}))
