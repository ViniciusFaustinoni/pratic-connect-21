import { Tutorial } from './types';
import { cotacaoAteAtivacao } from './cotacao-ate-ativacao';
import { trocaTitularidade } from './troca-titularidade';
import { aprovacaoTrocaTitularidadeCadastro } from './aprovacao-troca-titularidade-cadastro';

export const tutoriais: Tutorial[] = [
  cotacaoAteAtivacao,
  trocaTitularidade,
  aprovacaoTrocaTitularidadeCadastro,
];

export function getTutorialBySlug(slug: string): Tutorial | undefined {
  return tutoriais.find((t) => t.slug === slug);
}

export type { Tutorial, TutorialStep, TutorialStepLink } from './types';
