-- =============================================
-- INSERIR TEMPLATES PADRÃO DE DOCUMENTOS
-- =============================================

-- 1. TERMO DE VISTORIA
INSERT INTO documento_templates (
  categoria_id,
  nome,
  codigo,
  descricao,
  conteudo,
  variaveis,
  requer_assinatura
) VALUES (
  (SELECT id FROM documento_categorias WHERE nome = 'Termos'),
  'Termo de Vistoria do Veículo',
  'TERMO_VISTORIA_V1',
  'Termo de vistoria para conferência do estado do veículo',
  '# TERMO DE VISTORIA DO VEÍCULO

**Data da Vistoria:** {{sistema.data_atual}}
**Hora:** {{sistema.hora_atual}}

---

## DADOS DO ASSOCIADO

**Nome:** {{associado.nome}}
**CPF:** {{associado.cpf}}
**Telefone:** {{associado.telefone}}

---

## DADOS DO VEÍCULO

**Marca/Modelo:** {{veiculo.marca}} {{veiculo.modelo}}
**Ano:** {{veiculo.ano}}
**Placa:** {{veiculo.placa}}
**Chassi:** {{veiculo.chassi}}
**Cor:** {{veiculo.cor}}
**Valor FIPE:** {{veiculo.valor_fipe}}

---

## CHECKLIST DE VISTORIA

### Estado Geral
- [ ] Lataria em bom estado
- [ ] Pintura sem avarias significativas
- [ ] Vidros íntegros
- [ ] Retrovisores funcionando
- [ ] Faróis e lanternas funcionando
- [ ] Pneus em bom estado

### Documentação
- [ ] CRLV em dia
- [ ] Placa legível
- [ ] Chassi confere com documento

### Acessórios
- [ ] Estepe presente
- [ ] Macaco e chave de roda
- [ ] Triângulo de sinalização

---

## OBSERVAÇÕES

_____________________________________________________________________

_____________________________________________________________________

_____________________________________________________________________

---

## DECLARAÇÃO

Declaro que o veículo acima descrito foi vistoriado nesta data, encontrando-se nas condições acima relatadas.

{{associado.cidade}}/{{associado.estado}}, {{sistema.data_extenso}}.


_____________________________________________
{{associado.nome}}
Associado


_____________________________________________
Vistoriador
{{empresa.nome}}',
  '[]'::jsonb,
  false
);

-- 2. DECLARAÇÃO DE QUITAÇÃO
INSERT INTO documento_templates (
  categoria_id,
  nome,
  codigo,
  descricao,
  conteudo,
  variaveis,
  requer_assinatura
) VALUES (
  (SELECT id FROM documento_categorias WHERE nome = 'Declarações'),
  'Declaração de Quitação de Débitos',
  'DECL_QUITACAO_V1',
  'Declaração de que o associado não possui débitos',
  '# DECLARAÇÃO DE QUITAÇÃO DE DÉBITOS

A **{{empresa.razao_social}}**, inscrita no CNPJ sob nº {{empresa.cnpj}}, com sede em {{empresa.endereco}}, por meio desta,

**DECLARA**

para os devidos fins que o(a) Sr(a). **{{associado.nome}}**, portador(a) do CPF nº **{{associado.cpf}}**, associado(a) desde **{{associado.data_adesao}}**, referente ao veículo de placa **{{veiculo.placa}}** ({{veiculo.marca}} {{veiculo.modelo}} {{veiculo.ano}}):

**NÃO POSSUI DÉBITOS** junto a esta associação até a presente data.

Esta declaração é válida exclusivamente para os fins a que se destina.

{{associado.cidade}}/{{associado.estado}}, {{sistema.data_extenso}}.


_____________________________________________
{{empresa.nome}}
CNPJ: {{empresa.cnpj}}',
  '[]'::jsonb,
  false
);

-- 3. TERMO DE CANCELAMENTO
INSERT INTO documento_templates (
  categoria_id,
  nome,
  codigo,
  descricao,
  conteudo,
  variaveis,
  requer_assinatura
) VALUES (
  (SELECT id FROM documento_categorias WHERE nome = 'Termos'),
  'Termo de Solicitação de Cancelamento',
  'TERMO_CANCELAMENTO_V1',
  'Termo para formalizar pedido de cancelamento',
  '# TERMO DE SOLICITAÇÃO DE CANCELAMENTO

**Protocolo:** CANC-{{sistema.data_atual}}-{{associado.cpf}}

---

## DADOS DO SOLICITANTE

**Nome:** {{associado.nome}}
**CPF:** {{associado.cpf}}
**Telefone:** {{associado.telefone}}
**E-mail:** {{associado.email}}

---

## DADOS DO CONTRATO

**Número do Contrato:** {{contrato.numero}}
**Plano:** {{contrato.plano}}
**Data de Adesão:** {{associado.data_adesao}}
**Veículo:** {{veiculo.marca}} {{veiculo.modelo}} {{veiculo.ano}} - {{veiculo.placa}}

---

## MOTIVO DO CANCELAMENTO

( ) Dificuldades financeiras
( ) Venda do veículo
( ) Mudança para outra associação
( ) Insatisfação com o serviço
( ) Outros: _________________________________

---

## DECLARAÇÃO

Eu, **{{associado.nome}}**, portador(a) do CPF nº **{{associado.cpf}}**, venho por meio deste SOLICITAR O CANCELAMENTO da minha associação junto à **{{empresa.nome}}**.

Declaro estar ciente de que:

1. O cancelamento será efetivado após a análise e processamento deste pedido;
2. Eventuais débitos pendentes deverão ser quitados;
3. O rastreador instalado no veículo deverá ser devolvido/desinstalado;
4. A cobertura será encerrada na data de efetivação do cancelamento.

{{associado.cidade}}/{{associado.estado}}, {{sistema.data_extenso}}.


_____________________________________________
{{associado.nome}}
CPF: {{associado.cpf}}',
  '[]'::jsonb,
  true
);

-- 4. FICHA CADASTRAL
INSERT INTO documento_templates (
  categoria_id,
  nome,
  codigo,
  descricao,
  conteudo,
  variaveis,
  requer_assinatura
) VALUES (
  (SELECT id FROM documento_categorias WHERE nome = 'Fichas'),
  'Ficha Cadastral Completa',
  'FICHA_CADASTRAL_V1',
  'Ficha com todos os dados cadastrais do associado',
  '# FICHA CADASTRAL DO ASSOCIADO

**Número do Associado:** {{contrato.numero}}
**Data de Cadastro:** {{associado.data_adesao}}

---

## DADOS PESSOAIS

| Campo | Informação |
|-------|------------|
| Nome Completo | {{associado.nome}} |
| CPF | {{associado.cpf}} |
| RG | {{associado.rg}} |
| Telefone | {{associado.telefone}} |
| E-mail | {{associado.email}} |

---

## ENDEREÇO

{{associado.endereco_completo}}

---

## DADOS DO VEÍCULO

| Campo | Informação |
|-------|------------|
| Marca | {{veiculo.marca}} |
| Modelo | {{veiculo.modelo}} |
| Ano | {{veiculo.ano}} |
| Cor | {{veiculo.cor}} |
| Placa | {{veiculo.placa}} |
| Chassi | {{veiculo.chassi}} |
| Renavam | {{veiculo.renavam}} |
| Valor FIPE | {{veiculo.valor_fipe}} |

---

## DADOS DO PLANO

| Campo | Informação |
|-------|------------|
| Plano | {{contrato.plano}} |
| Valor Adesão | {{contrato.valor_adesao}} |
| Valor Mensal | {{contrato.valor_mensal}} |
| Dia de Vencimento | {{contrato.dia_vencimento}} |

---

**Documento gerado em:** {{sistema.data_atual}} às {{sistema.hora_atual}}',
  '[]'::jsonb,
  false
);

-- 5. COMUNICADO DE REAJUSTE
INSERT INTO documento_templates (
  categoria_id,
  nome,
  codigo,
  descricao,
  conteudo,
  variaveis,
  requer_assinatura
) VALUES (
  (SELECT id FROM documento_categorias WHERE nome = 'Comunicados'),
  'Comunicado de Reajuste de Mensalidade',
  'COMUNICADO_REAJUSTE_V1',
  'Comunicado oficial sobre reajuste de valores',
  '# COMUNICADO IMPORTANTE

**{{empresa.nome}}**
CNPJ: {{empresa.cnpj}}

---

Prezado(a) **{{associado.nome}}**,

Comunicamos que, conforme previsto no Estatuto Social e no Regulamento Interno da associação, haverá **reajuste anual** nos valores das contribuições mensais a partir do próximo mês.

## Seu plano atual

- **Plano:** {{contrato.plano}}
- **Veículo:** {{veiculo.marca}} {{veiculo.modelo}} {{veiculo.ano}}
- **Placa:** {{veiculo.placa}}
- **Valor atual:** {{contrato.valor_mensal}}

## Novo valor

O novo valor da sua contribuição mensal será comunicado em breve através dos nossos canais oficiais.

## Importante

Este reajuste visa manter a qualidade dos serviços prestados e o equilíbrio financeiro da associação, garantindo a proteção de todos os associados.

Caso tenha dúvidas, entre em contato conosco:
- **Telefone:** {{empresa.telefone}}
- **E-mail:** contato@praticcar.com.br

Agradecemos sua compreensão e confiança.

Atenciosamente,

**{{empresa.nome}}**
{{sistema.data_extenso}}',
  '[]'::jsonb,
  false
);