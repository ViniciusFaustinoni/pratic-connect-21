-- ============================================
-- Template de Contrato de Adesão para Autentique
-- ============================================

-- Inserir template padrão de Contrato de Adesão
INSERT INTO documento_templates (
  id,
  categoria_id,
  nome,
  codigo,
  descricao,
  versao,
  conteudo,
  variaveis,
  config_layout,
  cabecalho_html,
  rodape_html,
  ativo,
  requer_assinatura
) VALUES (
  gen_random_uuid(),
  '2296484a-3664-4ddc-a1fe-355c616ac32f', -- Categoria: Contratos
  'Contrato de Adesão - Proteção Veicular',
  'CONTRATO_ADESAO_V1',
  'Template padrão para contratos de adesão enviados para assinatura via Autentique. As variáveis são substituídas automaticamente pelos dados do contrato, associado, veículo e plano.',
  1,
  '# CONTRATO DE ADESÃO
## {{plano.nome}}

**Nº {{contrato.numero}}**
Data de Emissão: {{sistema.data_atual}}

---

## 1. DADOS DO CONTRATANTE

| Campo | Valor |
|-------|-------|
| Nome Completo | {{associado.nome}} |
| CPF | {{associado.cpf}} |
| Email | {{associado.email}} |
| Telefone | {{associado.telefone}} |
| Endereço | {{associado.endereco_completo}} |

---

## 2. DADOS DO VEÍCULO

| Campo | Valor |
|-------|-------|
| Marca/Modelo | {{veiculo.marca}} {{veiculo.modelo}} |
| Placa | {{veiculo.placa}} |
| Ano | {{veiculo.ano}} |
| Cor | {{veiculo.cor}} |
| Chassi | {{veiculo.chassi}} |
| Valor FIPE | {{veiculo.valor_fipe}} |

---

## 3. VALORES DO CONTRATO

| Descrição | Valor |
|-----------|-------|
| Plano | {{plano.nome}} |
| Taxa de Adesão | {{contrato.valor_adesao}} |
| Mensalidade | {{contrato.valor_mensal}} |
| Dia de Vencimento | Todo dia {{contrato.dia_vencimento}} |
| Data de Início | {{contrato.data_inicio}} |

---

## 4. COBERTURAS CONTRATADAS - {{plano.nome}}

{{plano.coberturas_html}}

**Franquia:** {{plano.franquia}}
**Carência:** {{plano.carencia}}

---

## 5. TERMOS E CONDIÇÕES

### 5.1 Objeto do Contrato
O presente contrato tem por objeto a prestação de serviços de proteção veicular, incluindo rastreamento, assistência 24 horas e coberturas conforme plano contratado.

### 5.2 Obrigações do Contratante
O CONTRATANTE se compromete a:
- Manter os dados cadastrais atualizados;
- Efetuar o pagamento das mensalidades até a data de vencimento;
- Manter o dispositivo de rastreamento em perfeito funcionamento;
- Comunicar imediatamente qualquer sinistro em até 24 horas;
- Registrar Boletim de Ocorrência em caso de roubo/furto.

### 5.3 Obrigações da Contratada
A CONTRATADA se compromete a:
- Prestar os serviços de proteção conforme estabelecido neste contrato;
- Manter o sistema de rastreamento em funcionamento 24 horas;
- Prestar assistência 24 horas conforme condições do plano;
- Realizar a indenização conforme as coberturas contratadas.

### 5.4 Vigência e Rescisão
O contrato tem vigência de 12 (doze) meses, renovável automaticamente. A rescisão pode ser solicitada a qualquer momento, mediante aviso prévio de 30 dias e pagamento de eventuais débitos pendentes.

### 5.5 Disposições Gerais
Este contrato está sujeito às condições gerais de proteção veicular da {{empresa.nome}}, disponíveis no site da associação.

### 5.6 Foro
Fica eleito o foro da comarca de {{empresa.cidade}}/{{empresa.uf}} para dirimir quaisquer controvérsias oriundas deste contrato.

---

## 6. DECLARAÇÃO E ASSINATURA

Ao assinar eletronicamente este documento, o CONTRATANTE declara:
- Estar ciente e de acordo com todas as condições estabelecidas neste contrato;
- Que as informações prestadas são verdadeiras e completas;
- Que leu e compreendeu as coberturas, carências e exclusões do plano {{plano.nome}};
- Que autoriza a instalação do dispositivo de rastreamento no veículo.

---

**{{associado.nome}}**
Contratante

---

*Documento gerado eletronicamente e assinado digitalmente via plataforma Autentique.*
*Este contrato tem validade jurídica conforme Lei nº 14.063/2020.*

{{empresa.nome}} - CNPJ: {{empresa.cnpj}}
{{empresa.endereco_completo}}
{{empresa.telefone}} | {{empresa.email}}',
  '[
    {"codigo": "associado.nome", "nome": "Nome do Associado", "obrigatoria": true},
    {"codigo": "associado.cpf", "nome": "CPF do Associado", "obrigatoria": true},
    {"codigo": "associado.email", "nome": "Email do Associado", "obrigatoria": true},
    {"codigo": "associado.telefone", "nome": "Telefone do Associado", "obrigatoria": false},
    {"codigo": "associado.endereco_completo", "nome": "Endereço Completo", "obrigatoria": false},
    {"codigo": "veiculo.marca", "nome": "Marca do Veículo", "obrigatoria": false},
    {"codigo": "veiculo.modelo", "nome": "Modelo do Veículo", "obrigatoria": false},
    {"codigo": "veiculo.placa", "nome": "Placa do Veículo", "obrigatoria": false},
    {"codigo": "veiculo.ano", "nome": "Ano do Veículo", "obrigatoria": false},
    {"codigo": "veiculo.cor", "nome": "Cor do Veículo", "obrigatoria": false},
    {"codigo": "veiculo.chassi", "nome": "Chassi do Veículo", "obrigatoria": false},
    {"codigo": "veiculo.valor_fipe", "nome": "Valor FIPE", "obrigatoria": false},
    {"codigo": "contrato.numero", "nome": "Número do Contrato", "obrigatoria": true},
    {"codigo": "contrato.valor_adesao", "nome": "Valor da Adesão", "obrigatoria": true},
    {"codigo": "contrato.valor_mensal", "nome": "Valor Mensal", "obrigatoria": true},
    {"codigo": "contrato.dia_vencimento", "nome": "Dia do Vencimento", "obrigatoria": true},
    {"codigo": "contrato.data_inicio", "nome": "Data de Início", "obrigatoria": true},
    {"codigo": "plano.nome", "nome": "Nome do Plano", "obrigatoria": true},
    {"codigo": "plano.coberturas_html", "nome": "Coberturas do Plano (HTML)", "obrigatoria": false},
    {"codigo": "plano.franquia", "nome": "Franquia do Plano", "obrigatoria": false},
    {"codigo": "plano.carencia", "nome": "Carência do Plano", "obrigatoria": false},
    {"codigo": "empresa.nome", "nome": "Nome da Empresa", "obrigatoria": true},
    {"codigo": "empresa.cnpj", "nome": "CNPJ da Empresa", "obrigatoria": true},
    {"codigo": "empresa.endereco_completo", "nome": "Endereço da Empresa", "obrigatoria": false},
    {"codigo": "empresa.cidade", "nome": "Cidade da Empresa", "obrigatoria": false},
    {"codigo": "empresa.uf", "nome": "UF da Empresa", "obrigatoria": false},
    {"codigo": "empresa.telefone", "nome": "Telefone da Empresa", "obrigatoria": false},
    {"codigo": "empresa.email", "nome": "Email da Empresa", "obrigatoria": false},
    {"codigo": "sistema.data_atual", "nome": "Data Atual", "obrigatoria": false}
  ]'::jsonb,
  '{
    "margemTopo": 50,
    "margemBaixo": 50,
    "margemEsquerda": 50,
    "margemDireita": 50,
    "tamanhoFonte": 12,
    "fontePrincipal": "Helvetica",
    "mostrarCabecalho": true,
    "mostrarRodape": true,
    "mostrarNumeroPagina": true,
    "orientacao": "retrato"
  }'::jsonb,
  '',
  '',
  true,
  true
)
ON CONFLICT (codigo) DO UPDATE SET
  conteudo = EXCLUDED.conteudo,
  variaveis = EXCLUDED.variaveis,
  config_layout = EXCLUDED.config_layout,
  updated_at = now();