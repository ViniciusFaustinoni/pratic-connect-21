// Componentes unificados de execução de vistoria de evento.
// Usados por Regulador, Técnico interno e Prestador externo.
// Fonte canônica: ainda em src/components/regulador para evitar quebra de imports legados.
export { OrcamentoPDFImport } from '@/components/regulador/OrcamentoPDFImport';
export type { DadosExtraidos } from '@/components/regulador/OrcamentoPDFImport';
export { VistoriaEventoOrcamento } from '@/components/regulador/VistoriaEventoOrcamento';
export { VistoriaEventoMidias } from '@/components/regulador/VistoriaEventoMidias';
export { VistoriaEventoDados } from '@/components/regulador/VistoriaEventoDados';
