

# Consultas Juridicas 360 — Pesquisa Unificada e Antecedentes

## Resumo

Transformar a pagina `/juridico/consultas` em uma central de pesquisa 360 para o advogado. A pagina atual (pareceres juridicos internos) sera movida para `/juridico/pareceres` e a rota `/juridico/consultas` recebera a nova funcionalidade: barra de busca inteligente (CPF, placa, protocolo, nome), tabs por tipo de resultado (Associados, Veiculos, Eventos, Processos, Antecedentes, Regulamento), cards expandiveis com visao 360, e pesquisa de antecedentes via IA.

## Migracao de Banco

Criar tabela `pesquisas_antecedentes` para salvar relatorios:

```text
CREATE TABLE public.pesquisas_antecedentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf_cnpj varchar NOT NULL,
  nome varchar NOT NULL,
  resultado jsonb NOT NULL DEFAULT '{}',
  score_risco varchar, -- baixo, atencao, alto
  associado_id uuid REFERENCES associados(id),
  processo_id uuid REFERENCES processos(id),
  pesquisado_por uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pesquisas_antecedentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage pesquisas" ON public.pesquisas_antecedentes FOR ALL USING (auth.uid() IS NOT NULL);
```

## Arquivos a Criar

### 1. `src/pages/juridico/ConsultasUnificadas.tsx` (novo — pagina principal)

Pagina completa com:

**Barra de busca grande centralizada** (estilo Google):
- Input com placeholder "Buscar por CPF, placa, protocolo, nome..."
- Deteccao automatica do tipo de busca:
  - 11 digitos ou formato XXX.XXX.XXX-XX → busca associado por CPF
  - Formato ABC1D23 ou ABC-1234 (7 chars) → busca veiculo por placa
  - Formato EVT-20XX-XXXX → busca sinistro por protocolo
  - Formato XXXX/20XX → busca processo por numero
  - Texto livre → busca por nome em associados, parte_contraria_nome em processos

**Tabs abaixo da busca:**
- Associados / Veiculos / Eventos / Processos / Antecedentes / Regulamento

**Cada tab renderiza o componente correspondente** passando o termo de busca.

### 2. `src/components/juridico/consultas/ConsultaAssociado.tsx`

Recebe `associadoId` ou resultado de busca. Mostra:

- Card "Dados Pessoais": nome, CPF, telefone, email, endereco, status (badge), data adesao, plano
- Card "Veiculos": lista de veiculos do associado com placa, marca/modelo, valor FIPE, status, coberturas. Link para cada veiculo.
- Card "Historico de Eventos": todos os sinistros do associado, ordenados por data. Badge "Historico frequente" se > 3 eventos em 24 meses.
- Card "Processos Juridicos": processos onde associado_id = id. Numero, tipo, status, advogado.
- Card "Sindicancias": busca sinistros com sindicancia vinculada. Alerta vermelho se fraude comprovada.
- Card "Situacao Financeira": query em `cobrancas` — total em aberto, boletos atrasados, valor em debito.

Queries: todas com `useQuery` usando o `associadoId` como chave.

### 3. `src/components/juridico/consultas/ConsultaVeiculo.tsx`

Recebe `veiculoId` ou resultado de busca por placa. Mostra:

- Card "Dados do Veiculo": placa, marca/modelo/ano/cor, chassi, RENAVAM, valor FIPE, combustivel, coberturas ativas, uso_aplicativo. Alerta se veiculo de leilao.
- Card "Proprietario Atual": dados do associado dono. Link para consulta do associado.
- Card "Historico de Proprietarios": busca veiculos com `substituido_por` ou troca de `associado_id` (se existir historico no sistema).
- Card "Historico de Eventos": sinistros com `veiculo_id = id`. Alerta se > 3 eventos.
- Card "Vistoria de Adesao": usa hook `useFotosVistoriaPorVeiculo` ja existente para exibir fotos agrupadas.

### 4. `src/components/juridico/consultas/ConsultaEvento.tsx`

Recebe `eventoId` (sinistro). Mostra visao consolidada:

- Timeline visual simplificada: data do evento, comunicacao, documentacao recebida, vistoria, analise, sindicancia (se houver), juridico (se houver), pagamento (se houver), conclusao. Usa dados de `status` e timestamps do sinistro + andamentos.
- Card "Valores": valor FIPE, valor participacao, valor indenizacao, valor pago.
- Card "Sindicancias Vinculadas": busca `sindicancias` com `sinistro_id = id`.
- Card "Processos Vinculados": busca `processos` com `sinistro_id = id`.
- Card "Documentos": busca documentos do sinistro em `documentos_sinistro` (ou tabela equivalente).

### 5. `src/components/juridico/consultas/ConsultaProcessos.tsx`

Lista de processos encontrados pela busca (por numero ou texto). Cada resultado e um card com: numero, tipo (badge), partes, status (badge), advogado, valor da causa. Link para `/juridico/processos/:id`.

### 6. `src/components/juridico/consultas/ConsultaAntecedentes.tsx`

Interface de pesquisa de antecedentes:

- Campos: CPF ou CNPJ (obrigatorio) + Nome completo (obrigatorio)
- Botao "Pesquisar Antecedentes" — chama edge function `pesquisar-antecedentes`
- Enquanto pesquisa: skeleton + spinner
- Resultado organizado em secoes colapsaveis:
  - Situacao Cadastral
  - Processos Judiciais Publicos
  - Protestos
  - Redes Sociais Publicas
  - Noticias
  - Score de Risco visual (verde/amarelo/vermelho)
- Campo "Resultado Manual" — textarea para o advogado colar pesquisas externas
- Botao "Salvar Relatorio" — grava na tabela `pesquisas_antecedentes`
- Se houver processo vinculado (select opcional), salva referencia
- Historico de pesquisas anteriores (lista abaixo)

### 7. `src/components/juridico/consultas/ConsultaRegulamento.tsx`

Secao de referencia com artigos do regulamento organizados por tema:

- Acordeao (Accordion) com temas:
  - "Irregularidades e Nao Coberturas (art. 7)" — subitens 7.2, 7.58
  - "Ressarcimento Integral (art. 10)" — subitens 10.1, 10.2, 10.4, 10.5, 10.11, 10.12
  - "Documentacao (art. 8)" — subitens 8.3, 8.5, 8.6
- Cada artigo expandivel com texto completo (hardcoded inicialmente, pode ser migrado para tabela depois)
- Campo de busca dentro do regulamento (filtra artigos por texto)

### 8. `supabase/functions/pesquisar-antecedentes/index.ts` (novo)

Edge function que usa Lovable AI para pesquisar informacoes publicas:

- Recebe: `{ cpf_cnpj, nome }`
- Usa `LOVABLE_API_KEY` com modelo `google/gemini-3-flash-preview`
- Prompt instruindo a IA a pesquisar e organizar informacoes publicas sobre a pessoa/empresa
- Retorna JSON estruturado com secoes: situacao_cadastral, processos, protestos, redes_sociais, noticias, score_risco
- Trata erros 429/402 como os outros edge functions do projeto

## Arquivos a Modificar

### 9. `src/App.tsx`

- Adicionar rota `/juridico/pareceres` → `ConsultasJuridicas` (componente existente renomeado)
- Alterar rota `/juridico/consultas` → `ConsultasUnificadas` (nova pagina)
- Importar novos componentes

### 10. `src/components/layout/AppSidebar.tsx`

Atualizar menu do juridico:
- "Consultas" → `/juridico/consultas` (nova pagina 360) com icone Search
- Adicionar "Pareceres" → `/juridico/pareceres` com icone HelpCircle

### 11. `src/components/layout/GlobalBreadcrumb.tsx`

Adicionar patterns para:
- `/juridico/consultas` → "Consultas 360"
- `/juridico/pareceres` → "Pareceres Jurídicos"

### 12. `supabase/config.toml`

Adicionar configuracao da nova edge function:
```text
[functions.pesquisar-antecedentes]
verify_jwt = false
```

## Detalhes Tecnicos

- A barra de busca usa deteccao por regex no frontend. CPF: `/^\d{11}$/` ou `/^\d{3}\.\d{3}\.\d{3}-\d{2}$/`. Placa: `/^[A-Z]{3}\d[A-Z0-9]\d{2}$/i` ou `/^[A-Z]{3}-\d{4}$/i`. Protocolo: `/^EVT-\d{4}-\d+$/i`. Processo: `/^\d+\/\d{4}$/`.
- Cada componente de consulta faz suas proprias queries com `useQuery` — nao ha uma query gigante. O componente so e montado quando a tab esta ativa.
- A consulta por associado faz 6 queries paralelas (dados pessoais, veiculos, sinistros, processos, sindicancias, cobrancas).
- O regulamento e hardcoded em um arquivo de constantes (`src/data/regulamento.ts`) — pode ser migrado para BD depois.
- O componente de antecedentes salva o resultado bruto da IA como JSONB para consulta futura.
- A LOVABLE_API_KEY ja esta configurada no projeto.
- Nenhuma dependencia nova necessaria.

## Ordem de Implementacao

1. Migracao: criar tabela `pesquisas_antecedentes`
2. Criar `src/data/regulamento.ts` com os artigos do regulamento
3. Criar os 6 componentes de consulta em `src/components/juridico/consultas/`
4. Criar `src/pages/juridico/ConsultasUnificadas.tsx` (pagina principal com busca + tabs)
5. Criar edge function `pesquisar-antecedentes`
6. Atualizar `src/App.tsx` — nova rota `/juridico/pareceres`, alterar `/juridico/consultas`
7. Atualizar sidebar e breadcrumb
8. Atualizar `supabase/config.toml`

