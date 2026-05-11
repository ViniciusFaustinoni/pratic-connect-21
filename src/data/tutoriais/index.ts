import { Tutorial } from './types';
import { cotacaoAteAtivacao } from './cotacao-ate-ativacao';
import { trocaTitularidade } from './troca-titularidade';
import { aprovacaoTrocaTitularidadeCadastro } from './aprovacao-troca-titularidade-cadastro';
import { aprovacaoTrocaTitularidadeMonitoramento } from './aprovacao-troca-titularidade-monitoramento';

export const tutoriais: Tutorial[] = [
  cotacaoAteAtivacao,
  trocaTitularidade,
  aprovacaoTrocaTitularidadeCadastro,
  aprovacaoTrocaTitularidadeMonitoramento,
];

export function getTutorialBySlug(slug: string): Tutorial | undefined {
  return tutoriais.find((t) => t.slug === slug);
}

export type { Tutorial, TutorialStep, TutorialStepLink } from './types';
