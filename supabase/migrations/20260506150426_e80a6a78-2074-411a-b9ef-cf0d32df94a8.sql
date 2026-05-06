UPDATE public.documento_templates
SET conteudo = $$# TERMO DE SOLICITAÇÃO DE CANCELAMENTO

**Protocolo:** CANC-{{sistema.data_atual}}-{{associado.cpf}}

---

## DADOS DO SOLICITANTE

Eu, **{{associado.nome}}**, portador(a) da identidade de nº **{{associado.rg}}**, inscrito(a) no CPF sob o nº **{{associado.cpf}}**, residente ao endereço **{{associado.endereco_completo}}**, telefone **{{associado.telefone}}**, e-mail **{{associado.email}}**.

---

## DADOS DO CONTRATO E VEÍCULO

**Número do Contrato:** {{contrato.numero}}
**Plano:** {{contrato.plano}}
**Data de Adesão:** {{associado.data_adesao}}
**Veículo:** {{veiculo.marca}} {{veiculo.modelo}} {{veiculo.ano}}
**Placa:** {{veiculo.placa}}

---

## SOLICITAÇÃO

Solicito o **cancelamento de todos os benefícios** oferecidos pela **{{empresa.nome}}**, inclusive o benefício da proteção veicular do veículo **{{veiculo.marca}} {{veiculo.modelo}}**, placa **{{veiculo.placa}}**.

---

## MOTIVO DO CANCELAMENTO

{{cancelamento.motivo}}

---

## CLÁUSULA DO RASTREADOR — FIEL DEPOSITÁRIO

Declaro estar ciente que, na instalação do equipamento rastreador em regime de **comodato**, o associado se torna **fiel depositário** do aparelho. Na hipótese de não fazer mais parte do quadro associativo da {{empresa.nome}}, o associado deverá **devolver o rastreador** à associação.

Em caso de **não devolução** do equipamento rastreador, será devido à associação o valor de **R$ 400,00 (quatrocentos reais)**, conforme prevê o regulamento de benefícios da associação.

---

## DECLARAÇÕES ADICIONAIS

Declaro estar ciente de que:

1. O cancelamento será efetivado após análise e processamento deste pedido;
2. Eventuais débitos pendentes deverão ser quitados;
3. A cobertura será encerrada na data de efetivação do cancelamento.

---

**Data:** {{sistema.data_atual}}

{{associado.cidade}}/{{associado.estado}}


_____________________________________________
**{{associado.nome}}**
CPF: {{associado.cpf}}

ASSINATURA DO ASSOCIADO$$,
    versao = versao + 1,
    updated_at = now()
WHERE id = 'e8c4b55a-d79f-4e64-b684-7c5b10088e19';