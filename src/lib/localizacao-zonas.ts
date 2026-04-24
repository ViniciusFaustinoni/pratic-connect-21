const normalize = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const BAIXADA_CIDADES = new Set([
  'belford roxo',
  'duque de caxias',
  'guapimirim',
  'itaguai',
  'japeri',
  'mage',
  'mesquita',
  'nilopolis',
  'nova iguacu',
  'paracambi',
  'queimados',
  'sao joao de meriti',
  'seropedica',
]);

const OCEANICA_BAIRROS = new Set([
  'camboinhas',
  'engenho do mato',
  'itaipu',
  'itatiaia',
  'jacare',
  'maravista',
  'piratininga',
  'serra grande',
  'santo antonio',
]);

const ZONA_NORTE_RJ = new Set([
  'abolicao', 'agua santa', 'andaraí', 'andaraí', 'bancarios', 'benfica', 'bonsucesso', 'brás de pina', 'bras de pina',
  'cachambi', 'cacuia', 'cavalcanti', 'cidade universitaria', 'cocota', 'coelho neto', 'complexo do alemao', 'cordovil',
  'del castilho', 'encantado', 'engenheiro leal', 'engenho da rainha', 'engenho de dentro', 'engenho novo', 'freguesia',
  'galeao', 'grajau', 'guadalupe', 'higienopolis', 'honorio gurgel', 'ilha do governador', 'inhamá', 'inhama', 'iraja',
  'jacare', 'jacarezinho', 'jardim america', 'jardim carioca', 'jardim guanabara', 'lins de vasconcelos', 'madureira',
  'manguinhos', 'mare', 'maria da graca', 'meier', 'monero', 'olaria', 'oswaldo cruz', 'parada de lucas', 'parque anchieta',
  'pavuna', 'penha', 'penha circular', 'piedade', 'pilares', 'pitangueiras', 'portuguesa', 'praia da bandeira', 'quintino bocaiuva',
  'ramos', 'riachuelo', 'ribeira', 'ricardo de albuquerque', 'rocha', 'rocha miranda', 'sampaio', 'sao cristovao',
  'taua', 'thomaz coelho', 'todos os santos', 'tomas coelho', 'vaz lobo', 'vicente de carvalho', 'vigario geral', 'vila da penha',
  'vila isabel', 'vila kosmos', 'vista alegre', 'zumbi',
]);

const ZONA_SUL_RJ = new Set([
  'botafogo', 'catete', 'copacabana', 'cosme velho', 'flamengo', 'gávea', 'gavea', 'gloria', 'humaita', 'ipanema',
  'jardim botanico', 'lagoa', 'laranjeiras', 'leblon', 'leme', 'rocinha', 'sao conrado', 'urca', 'vidigal',
]);

const ZONA_OESTE_RJ = new Set([
  'ananil', 'anchieta', 'bangu', 'barra da tijuca', 'barra de guaratiba', 'camorim', 'campo grande', 'cidade de deus',
  'cosmos', 'curicica', 'deodoro', 'freguesia', 'gardênia azul', 'gardenia azul', 'gericino', 'grumari', 'guaratiba',
  'inhôaiba', 'inhoaiba', 'itaguaí', 'itaguai', 'jacarepagua', 'joa', 'magalhaes bastos', 'paciência', 'paciencia',
  'padre miguel', 'pechincha', 'pedra de guaratiba', 'praça seca', 'praca seca', 'realengo', 'recreio dos bandeirantes',
  'santa cruz', 'santissimo', 'senador camara', 'senador vasconcelos', 'sepétiba', 'sepetiba', 'sulacap', 'tanque',
  'taquara', 'vargem grande', 'vargem pequena', 'vila militar', 'vila valqueire',
]);

export function getZonaAtendimento(bairro?: string | null, cidade?: string | null, uf?: string | null): string | null {
  const bairroNorm = normalize(bairro);
  const cidadeNorm = normalize(cidade);
  const ufNorm = normalize(uf);

  if (!bairroNorm && !cidadeNorm) return null;
  if (BAIXADA_CIDADES.has(cidadeNorm)) return 'Baixada';
  if (cidadeNorm === 'niteroi' && OCEANICA_BAIRROS.has(bairroNorm)) return 'Oceânica';
  if (cidadeNorm !== 'rio de janeiro' && ufNorm !== 'rj') return null;
  if (ZONA_NORTE_RJ.has(bairroNorm)) return 'Zona Norte';
  if (ZONA_SUL_RJ.has(bairroNorm)) return 'Zona Sul';
  if (ZONA_OESTE_RJ.has(bairroNorm)) return 'Zona Oeste';
  return null;
}

export function formatLocalizacaoComZona(bairro?: string | null, cidade?: string | null, uf?: string | null) {
  const zona = getZonaAtendimento(bairro, cidade, uf);
  return [bairro, cidade, zona].filter(Boolean).join(' · ');
}