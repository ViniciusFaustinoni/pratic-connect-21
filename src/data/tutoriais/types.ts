export interface TutorialStepLink {
  label: string;
  url: string;
}

export interface TutorialStep {
  numero: number;
  titulo: string;
  descricao: string;
  /** Caminho da imagem (importada via ES6 ou URL pública). Opcional. */
  imagem?: string;
  dicas?: string[];
  links?: TutorialStepLink[];
}

export interface Tutorial {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  categoria: string;
  tempoEstimadoMin: number;
  novo?: boolean;
  steps: TutorialStep[];
}
