// Tutoriais padrão (seed) — gravados no banco quando um admin clica
// em "Restaurar tutoriais padrão". As imagens são referenciadas como
// `local:<arquivo.png>` e resolvidas pelo helper `resolverImagemTutorial`.
//
// Quando um admin adicionar imagens novas pelo painel, elas vão para o
// bucket Storage `tutoriais` e ficam como URL completa.

export interface TutorialDefaultStep {
  numero: number;
  titulo: string;
  descricao: string;
  imagem_url?: string | null;
  dicas?: string[];
  links?: { label: string; url: string }[];
}

export interface TutorialDefault {
  slug: string;
  titulo: string;
  descricao: string;
  categoria: string;
  tempo_estimado_min: number;
  novo?: boolean;
  ordem?: number;
  steps: TutorialDefaultStep[];
}

import { trocaTitularidade } from './troca-titularidade';
import { cotacaoAteAtivacao } from './cotacao-ate-ativacao';
import { aprovacaoTrocaTitularidadeCadastro } from './aprovacao-troca-titularidade-cadastro';
import { aprovacaoTrocaTitularidadeMonitoramento } from './aprovacao-troca-titularidade-monitoramento';

// Os arquivos legados usam ES6 imports para as imagens. Convertemos a URL
// importada de volta para `local:<filename>` para gravar no DB de forma
// portátil (a resolução de volta para asset bundle acontece no front).
function toLocal(imagem: string | undefined): string | null {
  if (!imagem) return null;
  // Vite injeta hashes no path; pegamos só o nome base sem hash.
  const match = imagem.match(/([a-z0-9-]+)(?:-[A-Za-z0-9_]+)?\.png/i);
  if (!match) return null;
  return `local:${match[1]}.png`;
}

function fromLegacy(t: typeof trocaTitularidade): TutorialDefault {
  return {
    slug: t.slug,
    titulo: t.titulo,
    descricao: t.descricao,
    categoria: t.categoria,
    tempo_estimado_min: t.tempoEstimadoMin,
    novo: t.novo,
    steps: t.steps.map((s) => ({
      numero: s.numero,
      titulo: s.titulo,
      descricao: s.descricao,
      imagem_url: toLocal(s.imagem),
      dicas: s.dicas ?? [],
      links: s.links ?? [],
    })),
  };
}

export const TUTORIAIS_PADRAO: TutorialDefault[] = [
  fromLegacy(cotacaoAteAtivacao),
  fromLegacy(trocaTitularidade),
  fromLegacy(aprovacaoTrocaTitularidadeCadastro),
  fromLegacy(aprovacaoTrocaTitularidadeMonitoramento),
];
