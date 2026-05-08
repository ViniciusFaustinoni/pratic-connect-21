import { Tutorial } from './types';
import { cotacaoAteAtivacao } from './cotacao-ate-ativacao';

export const tutoriais: Tutorial[] = [
  cotacaoAteAtivacao,
];

export function getTutorialBySlug(slug: string): Tutorial | undefined {
  return tutoriais.find((t) => t.slug === slug);
}

export type { Tutorial, TutorialStep, TutorialStepLink } from './types';
