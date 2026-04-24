
# Plano — Campos manuais de Código Hinova (somente obrigatórios no envio ao SGA)

## 1) O que o SGA exige obrigatoriamente em cada chamada

A integração faz duas chamadas para gravar uma adesão (`sga-hinova-sync`):

**`POST /associado/cadastrar`** — campos com código Hinova:
- `codigo_conta` (qual conta da regional)
- `codigo_voluntario` (vendedor responsável)
- `codigo_regional` (quando a conta tem mais de uma regional)
- `codigo_cooperativa` (quando a conta tem mais de uma)

**`POST /veiculo/cadastrar`** — campos com código Hinova:
- `codigo_associado` (vem do passo anterior — automático)
- `codigo_plano` (plano contratado)
- `codigo_cor` (cor do veículo)
- `codigo_combustivel` (combustível)
- `codigo_tipo_veiculo` (carro / moto / caminhão / etc.)
- `codigo_voluntario` (vendedor)
- `codigo_situacao` (pendente/ativo)
- `produtos_vinculados[].codigo_produto` (cada cobertura e benefício do plano)

Tudo o mais (RG, profissão, "como conheceu", forma de pagamento, etc.) é opcional na API e hoje resolvido por defaults globais — fora do escopo deste plano.

---

## 2) Inventário — onde já existe campo manual de código Hinova

| Entidade do nosso sistema | Onde se cadastra | Campo manual hoje? |
|---|---|---|
| Conta / Regional / Cooperativa / Voluntário padrão / Situações | Configurações → Integrações → Hinova | ✅ existe (sheet de configuração) |
| Plano de proteção | Cadastro de Planos (`PlanFormModal`) → `codigo_sga_plano` | ✅ existe |
| Cobertura | `CoberturaUnificadaFormModal` → `codigo_sga` | ✅ existe |
| Benefício | `BeneficioFormModal` → `codigo_sga` | ✅ existe |
| Vendedor / Consultor | Consultores → Editar (`ConsultorEditSheet`) → `codigo_sga_voluntario` | ✅ existe |
| **Cor de veículo** | Tabela global `hinova_mapeamentos` (tipo `cor`) | ⚠️ só via tela de mapeamentos — ok |
| **Combustível** | `hinova_mapeamentos` (tipo `combustivel`) | ⚠️ só via mapeamentos — ok |
| **Tipo de veículo (carro/moto/...)** | `hinova_mapeamentos` (tipo `tipo_veiculo`) | ⚠️ só via mapeamentos — ok |
| **Tipo de foto/documento** | `hinova_mapeamentos` (tipo `tipo_foto`) | ⚠️ só via mapeamentos — ok |

**Conclusão dos gaps:** já há campo manual em todas as entidades obrigatórias. O único ponto fraco é que **Cor, Combustível e Tipo de Veículo** ficam num lugar separado (Configurações → Mapeamentos Hinova), longe de quem cadastra o veículo. Quando falta um valor (ex.: cor "Grafite" não mapeada), o sync quebra com mensagem técnica.

---

## 3) O que será implementado

### 3.1. Tela de Mapeamentos Hinova — UX guiada (Configurações → Integrações → Mapeamentos)

A tela `IntegracaoHinovaMapeamentos.tsx` já existe, mas é genérica. Vamos:

- **Pré-popular as opções** lendo os valores reais que aparecem no sistema:
  - **Cores**: distinct de `veiculos.cor` que ainda não têm mapeamento.
  - **Combustíveis**: distinct de `veiculos.combustivel`.
  - **Tipos de veículo**: as categorias do catálogo de planos (`carro`, `moto`, `caminhao`, etc.).
- Mostrar, em cima de cada aba, um **alerta amarelo** listando os valores **sem código Hinova cadastrado** (ex.: "3 cores sem mapeamento: Grafite, Vinho, Champagne") com botão "Adicionar agora".
- Para cada linha existente, manter edição inline do `codigo_hinova`.

### 3.2. Validação prévia ao envio (pre-check antes do `cadastrar`)

Antes de chamar `sga-hinova-sync`, rodar um pre-check no front (já existe `useChecklistSGA.ts` — estender) que valida e mostra mensagens humanas:

| Falta | Mensagem | Onde resolver |
|---|---|---|
| Vendedor sem `codigo_sga_voluntario` | "Vendedor X não tem Código Hinova" | Botão → abre `ConsultorEditSheet` |
| Plano sem `codigo_sga_plano` | "Plano Y não tem Código Hinova" | Botão → abre `PlanFormModal` |
| Cobertura/benefício do plano sem `codigo_sga` | "Cobertura Z do plano Y sem código" | Botão → abre form do item |
| Cor/combustível/tipo do veículo sem mapeamento | "Cor 'Grafite' não tem código Hinova mapeado" | Botão → abre Mapeamentos com a aba correta + valor pré-preenchido |
| Configuração global incompleta (`codigo_conta`, `codigo_regional`, `codigo_cooperativa`) | "Integração Hinova sem código de conta" | Botão → abre `ConfigurarIntegracaoSheet` |

O pre-check bloqueia o botão "Enviar ao SGA" e mostra os itens em uma lista clicável — **nenhuma adesão chega ao Hinova com payload incompleto**.

### 3.3. Fallback explícito de `codigo_voluntario`

Hoje a edge function já tem o fallback "voluntário do vendedor → voluntário padrão da integração". Vamos apenas tornar isso visível na UI:

- Na linha do vendedor sem código próprio, badge **"Usará código padrão (X)"** em vez de bloquear.
- Se o padrão também estiver vazio, aí sim bloquear.

---

## 4) Arquivos afetados

- `src/pages/configuracoes/IntegracaoHinovaMapeamentos.tsx` — pré-popular opções, alerta de pendências, deep-link por aba.
- `src/hooks/useChecklistSGA.ts` — estender com checagens de cor/combustível/tipo do veículo + cooperativa/regional.
- `src/components/cadastro/VeiculoFinanceiroSGA.tsx` (e/ou `BotaoAtivarSGA`) — exibir o checklist humano antes de habilitar o envio.
- (sem mudanças no edge function — payload já está correto.)

---

## 5) Fora do escopo (campos opcionais)

Os campos abaixo **não** ganharão UI de "código Hinova manual" por entidade, porque a API SGA aceita defaults globais já configuráveis em Configurações → Integrações:
- `codigo_profissao` (default global)
- `codigo_como_conheceu` (default global)
- `codigo_tipo_cobranca_recorrente` (default global)
- `codigo_situacao` (default `pendente`/`ativo` já configurado)
- Campos opcionais de RG, naturalidade, estado civil, etc.

---

## 6) Resultado esperado

- Nenhuma adesão será enviada ao SGA com mapeamento faltante.
- Quando falta um código, o usuário vê **exatamente** o que falta e tem botão para resolver na própria tela.
- Cor/combustível/tipo de veículo passam a ter inventário visível (não mais "descobre quando quebra").
- Vendedores sem código herdam do padrão da integração e isso fica explícito.
