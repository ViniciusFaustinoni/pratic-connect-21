import React from 'react';
import {
  DadosTermoFiliacao,
  formatCPF,
  formatPhone,
  formatCEP,
  formatCurrency,
  formatDate,
  formatDateExtended,
  calcularCotaParticipacao,
  calcularPrimeiraMensalidade,
} from '@/types/termo-filiacao';
import { type TermoAditivo } from '@/hooks/useAditivos';

interface TermoFiliacaoTemplateProps {
  dados: DadosTermoFiliacao;
  aditivos?: TermoAditivo[];
}

export function TermoFiliacaoTemplate({ 
  dados, 
  aditivos = [] 
}: TermoFiliacaoTemplateProps) {
  const { cliente, veiculo, plano, contrato, empresa } = dados;
  
  const cotaParticipacao = calcularCotaParticipacao(
    veiculo.valorFipe, 
    plano.cotaParticipacao || 10
  );
  const primeiraMensalidade = calcularPrimeiraMensalidade(contrato.diaVencimento);
  const dataAssinatura = formatDateExtended(new Date().toISOString());
  const localAssinatura = `${cliente.endereco.cidade}/${cliente.endereco.estado}`;

  return (
    <div 
      id="termo-container"
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10pt',
        lineHeight: 1.15,
        color: '#333333',
        background: '#ffffff',
        maxWidth: '210mm',
        margin: '0 auto',
        padding: '20mm',
      }}
    >
      {/* CABEÇALHO */}
      <div style={{
        textAlign: 'center',
        marginBottom: '20pt',
        paddingBottom: '10pt',
        borderBottom: '2px solid #1e40af',
      }}>
        <div style={{ fontSize: '18pt', fontWeight: 'bold', color: '#1e40af', marginBottom: '6pt' }}>
          ABP PRATICCAR
        </div>
        <div style={{ fontSize: '9pt', color: '#666666', marginBottom: '4pt' }}>
          ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR<br />
          CNPJ: {empresa.cnpj}<br />
          {empresa.logradouro}, {empresa.numero} - {empresa.bairro}<br />
          {empresa.cidade}/{empresa.uf} - CEP {empresa.cep}
        </div>
        <div style={{ fontSize: '16pt', fontWeight: 'bold', color: '#1e40af', marginTop: '12pt', marginBottom: '4pt' }}>
          TERMO DE AFILIAÇÃO AO PROGRAMA DE SOCORRO MÚTUO
        </div>
        <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
          Nº {contrato.numero}
        </div>
      </div>

      {/* SEÇÃO 1: QUALIFICAÇÃO DO ASSOCIADO */}
      <div style={{ marginBottom: '16pt', pageBreakInside: 'avoid' }}>
        <h2 style={{ fontSize: '12pt', fontWeight: 'bold', color: '#1e40af', marginBottom: '10pt', paddingBottom: '4pt', borderBottom: '1px solid #e5e7eb' }}>
          1. QUALIFICAÇÃO DO ASSOCIADO
        </h2>
        
        <div style={{ marginBottom: '6pt' }}>
          <span style={{ fontWeight: 'bold' }}>Nome:</span> {cliente.nome}
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '6pt' }}>
          <div style={{ marginRight: '20pt' }}>
            <span style={{ fontWeight: 'bold' }}>CPF:</span> {formatCPF(cliente.cpf)}
          </div>
          <div>
            <span style={{ fontWeight: 'bold' }}>RG:</span> {cliente.rg || '—'}{cliente.rgOrgao ? ` - ${cliente.rgOrgao}` : ''}
          </div>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '6pt' }}>
          <div style={{ marginRight: '20pt' }}>
            <span style={{ fontWeight: 'bold' }}>Data de Nascimento:</span> {formatDate(cliente.dataNascimento)}
          </div>
          <div>
            <span style={{ fontWeight: 'bold' }}>Estado Civil:</span> {cliente.estadoCivil || '—'}
          </div>
        </div>
        
        <div style={{ marginBottom: '6pt' }}>
          <span style={{ fontWeight: 'bold' }}>Profissão:</span> {cliente.profissao || '—'}
        </div>
        
        <div style={{ marginBottom: '6pt' }}>
          <span style={{ fontWeight: 'bold' }}>E-mail:</span> {cliente.email}
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '6pt' }}>
          <div style={{ marginRight: '20pt' }}>
            <span style={{ fontWeight: 'bold' }}>Telefone:</span> {formatPhone(cliente.telefone)}
          </div>
          <div>
            <span style={{ fontWeight: 'bold' }}>Telefone Secundário:</span> {cliente.telefoneSecundario ? formatPhone(cliente.telefoneSecundario) : '—'}
          </div>
        </div>
        
        <div style={{ marginBottom: '6pt' }}>
          <span style={{ fontWeight: 'bold' }}>Endereço:</span> {cliente.endereco.logradouro}, {cliente.endereco.numero}{cliente.endereco.complemento ? `, ${cliente.endereco.complemento}` : ''}
        </div>
        
        <div style={{ marginBottom: '6pt' }}>
          <span style={{ fontWeight: 'bold' }}>Bairro:</span> {cliente.endereco.bairro}
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          <div style={{ marginRight: '20pt' }}>
            <span style={{ fontWeight: 'bold' }}>Cidade:</span> {cliente.endereco.cidade} - {cliente.endereco.estado}
          </div>
          <div>
            <span style={{ fontWeight: 'bold' }}>CEP:</span> {formatCEP(cliente.endereco.cep)}
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: VEÍCULO PROTEGIDO */}
      <div style={{ marginBottom: '16pt', pageBreakInside: 'avoid' }}>
        <h2 style={{ fontSize: '12pt', fontWeight: 'bold', color: '#1e40af', marginBottom: '10pt', paddingBottom: '4pt', borderBottom: '1px solid #e5e7eb' }}>
          2. VEÍCULO PROTEGIDO
        </h2>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '6pt' }}>
          <div style={{ marginRight: '20pt' }}>
            <span style={{ fontWeight: 'bold' }}>Placa:</span> {veiculo.placa || 'ZERO QUILÔMETRO'}
          </div>
          <div>
            <span style={{ fontWeight: 'bold' }}>Chassi:</span> {veiculo.chassi || '—'}
          </div>
        </div>
        
        <div style={{ marginBottom: '6pt' }}>
          <span style={{ fontWeight: 'bold' }}>Renavam:</span> {veiculo.renavam || '—'}
        </div>
        
        <div style={{ marginBottom: '6pt' }}>
          <span style={{ fontWeight: 'bold' }}>Marca/Modelo:</span> {veiculo.marca} {veiculo.modelo}
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '6pt' }}>
          <div style={{ marginRight: '20pt' }}>
            <span style={{ fontWeight: 'bold' }}>Ano Fabricação/Modelo:</span> {veiculo.anoFab}/{veiculo.anoMod}
          </div>
          <div>
            <span style={{ fontWeight: 'bold' }}>Cor:</span> {veiculo.cor || '—'}
          </div>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '6pt' }}>
          <div style={{ marginRight: '20pt' }}>
            <span style={{ fontWeight: 'bold' }}>Combustível:</span> {veiculo.combustivel || '—'}
          </div>
          <div>
            <span style={{ fontWeight: 'bold' }}>Categoria:</span> {veiculo.categoria || 'Automóvel'}
          </div>
        </div>
        
        <div style={{ marginBottom: '6pt' }}>
          <span style={{ fontWeight: 'bold' }}>Tipo de Uso:</span> {veiculo.tipoUso || 'Particular'}
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '6pt' }}>
          <div style={{ marginRight: '20pt' }}>
            <span style={{ fontWeight: 'bold' }}>Código FIPE:</span> {veiculo.codigoFipe || '—'}
          </div>
          <div>
            <span style={{ fontWeight: 'bold' }}>Valor FIPE na Data da Adesão:</span> {formatCurrency(veiculo.valorFipe)}
          </div>
        </div>
        
        <div style={{ marginBottom: '6pt' }}>
          <span style={{ fontWeight: 'bold' }}>Alienação Fiduciária:</span> {veiculo.alienado ? 'Sim' : 'Não'}
          {veiculo.alienado && veiculo.financeira && (
            <>
              <br />
              <span style={{ fontWeight: 'bold' }}>Agente Financeiro:</span> {veiculo.financeira}
            </>
          )}
        </div>
      </div>

      {/* SEÇÃO 3: PLANO CONTRATADO */}
      <div style={{ marginBottom: '16pt', pageBreakInside: 'avoid' }}>
        <h2 style={{ fontSize: '12pt', fontWeight: 'bold', color: '#1e40af', marginBottom: '10pt', paddingBottom: '4pt', borderBottom: '1px solid #e5e7eb' }}>
          3. PLANO CONTRATADO E COBERTURAS
        </h2>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '6pt' }}>
          <div style={{ marginRight: '20pt' }}>
            <span style={{ fontWeight: 'bold' }}>Plano:</span> {plano.nome}
          </div>
          <div>
            <span style={{ fontWeight: 'bold' }}>Código:</span> {plano.codigo || '—'}
          </div>
        </div>
        
        <h3 style={{ fontSize: '10pt', fontWeight: 'bold', color: '#374151', marginTop: '10pt', marginBottom: '6pt' }}>
          COBERTURAS INCLUÍDAS:
        </h3>
        
        <div style={{ margin: '10pt 0' }}>
          {plano.coberturas.map((cobertura, index) => (
            <div key={index} style={{ fontFamily: "'Courier New', monospace", fontSize: '10pt', marginBottom: '4pt', paddingLeft: '5pt' }}>
              <span style={{ color: '#16a34a', fontWeight: 'bold' }}>[X]</span> {cobertura}
            </div>
          ))}
        </div>
      </div>

      {/* SEÇÃO 4: VALORES E CONDIÇÕES */}
      <div style={{ marginBottom: '16pt', pageBreakInside: 'avoid' }}>
        <h2 style={{ fontSize: '12pt', fontWeight: 'bold', color: '#1e40af', marginBottom: '10pt', paddingBottom: '4pt', borderBottom: '1px solid #e5e7eb' }}>
          4. VALORES E CONDIÇÕES DE PAGAMENTO
        </h2>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '12pt 0', fontSize: '10pt' }}>
          <tbody>
            <tr>
              <td colSpan={2} style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', backgroundColor: '#1e40af', color: 'white', fontWeight: 'bold', textAlign: 'center' }}>
                RESUMO FINANCEIRO
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', backgroundColor: '#f9fafb', width: '60%' }}>
                Valor FIPE do Veículo:
              </td>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 'bold' }}>
                {formatCurrency(veiculo.valorFipe)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', backgroundColor: '#f9fafb' }}>
                Taxa de Filiação (pagamento único):
              </td>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 'bold' }}>
                {formatCurrency(contrato.valorAdesao)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', backgroundColor: '#f9fafb' }}>
                Quota Mensal Estimada:
              </td>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 'bold' }}>
                {formatCurrency(contrato.valorMensal)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', backgroundColor: '#f9fafb' }}>
                Cota de Participação ({plano.cotaParticipacao || 10}%):
              </td>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 'bold' }}>
                {formatCurrency(cotaParticipacao)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', backgroundColor: '#f9fafb' }}>
                Cota Mínima:
              </td>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 'bold' }}>
                {formatCurrency(plano.cotaMinima || 3000)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', backgroundColor: '#f9fafb' }}>
                Dia de Vencimento:
              </td>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 'bold' }}>
                Todo dia {contrato.diaVencimento}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', backgroundColor: '#f9fafb' }}>
                Forma de Pagamento:
              </td>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 'bold' }}>
                {contrato.formaPagamento || 'Boleto Bancário'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', backgroundColor: '#f9fafb' }}>
                Primeira Mensalidade em:
              </td>
              <td style={{ padding: '8pt 10pt', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 'bold' }}>
                {primeiraMensalidade}
              </td>
            </tr>
          </tbody>
        </table>
        
        <p style={{ fontSize: '8pt', color: '#666666', fontStyle: 'italic', marginTop: '8pt' }}>
          A quota mensal é pós-paga e calculada por rateio entre os associados, podendo variar mensalmente conforme os custos do período.
        </p>
      </div>

      {/* SEÇÃO 5: DECLARAÇÕES */}
      <div style={{ marginBottom: '16pt', pageBreakInside: 'avoid' }}>
        <h2 style={{ fontSize: '12pt', fontWeight: 'bold', color: '#1e40af', marginBottom: '10pt', paddingBottom: '4pt', borderBottom: '1px solid #e5e7eb' }}>
          5. DECLARAÇÕES DO ASSOCIADO
        </h2>
        
        <p style={{ marginBottom: '12pt' }}>
          Eu, <strong>{cliente.nome}</strong>, portador(a) do CPF nº <strong>{formatCPF(cliente.cpf)}</strong>, DECLARO para os devidos fins que:
        </p>
        
        {[
          { titulo: '5.1. REGULAMENTO DO PSM', texto: 'Recebi, li e compreendi integralmente o Regulamento do Programa de Socorro Mútuo (PSM) da ABP PraticCar, concordando com todos os seus termos, condições e disposições.' },
          { titulo: '5.2. VERACIDADE DAS INFORMAÇÕES', texto: 'Todas as informações prestadas neste Termo de Afiliação são verdadeiras, completas e atualizadas, estando ciente de que a prestação de informações falsas, incompletas ou a omissão de dados relevantes pode resultar em minha exclusão imediata do programa.' },
          { titulo: '5.3. CONDIÇÃO DO VEÍCULO', texto: 'O veículo descrito neste termo encontra-se em perfeitas condições de conservação, funcionamento e segurança, sem avarias, danos, sinistros anteriores não declarados.' },
          { titulo: '5.4. DOCUMENTAÇÃO REGULAR', texto: 'O veículo está com toda a documentação regularizada e em dia, incluindo licenciamento anual, IPVA, multas e demais impostos e taxas.' },
          { titulo: '5.5. PROCEDÊNCIA DO VEÍCULO', texto: `A procedência do veículo protegido é: ${veiculo.procedencia || 'Usado de particular'}` },
          { titulo: '5.6. COMPREENSÃO DO MUTUALISMO', texto: 'Compreendo plenamente que a ABP PraticCar é uma ASSOCIAÇÃO DE SOCORRO MÚTUO, NÃO SE CONFIGURANDO como empresa seguradora.' },
          { titulo: '5.7. VALOR FIPE DE REFERÊNCIA', texto: `Estou ciente de que o valor de referência para cálculo de eventual indenização será o VALOR FIPE REGISTRADO NO MOMENTO DESTA ADESÃO (${formatCurrency(veiculo.valorFipe)}).` },
          { titulo: '5.8. AUTORIZAÇÃO DE SUB-ROGAÇÃO', texto: 'AUTORIZO expressamente a ABP PraticCar a ser sub-rogada em todos os direitos relativos a eventuais prejuízos causados ao veículo por terceiros.' },
          { titulo: '5.9. RASTREADOR VEICULAR', texto: 'Concordo com a instalação do rastreador veicular, que será realizada por técnico credenciado após aprovação do cadastro.' },
        ].map((item, index) => (
          <div key={index} style={{ marginBottom: '12pt', textAlign: 'justify' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '4pt' }}>{item.titulo}</p>
            <p style={{ fontSize: '9pt', lineHeight: 1.4 }}>{item.texto}</p>
          </div>
        ))}
      </div>

      {/* SEÇÃO 6: LGPD */}
      <div style={{ marginBottom: '16pt', pageBreakInside: 'avoid' }}>
        <h2 style={{ fontSize: '12pt', fontWeight: 'bold', color: '#1e40af', marginBottom: '10pt', paddingBottom: '4pt', borderBottom: '1px solid #e5e7eb' }}>
          6. PROTEÇÃO DE DADOS PESSOAIS (LGPD)
        </h2>
        
        <p style={{ marginBottom: '10pt' }}>Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018):</p>
        
        {[
          { titulo: '6.1. COLETA E TRATAMENTO', texto: 'Autorizo a ABP PraticCar a coletar, armazenar, processar e tratar meus dados pessoais para fins de cadastro, gestão da associação, processamento de pagamentos e comunicações oficiais.' },
          { titulo: '6.2. COMPARTILHAMENTO', texto: 'Autorizo o compartilhamento de meus dados pessoais com empresas de rastreamento, oficinas credenciadas, empresas de assistência 24h e instituições financeiras.' },
          { titulo: '6.3. COMUNICAÇÕES', texto: 'Autorizo o recebimento de comunicações oficiais através de WhatsApp, e-mail, SMS e telefone.' },
          { titulo: '6.4. DIREITOS DO TITULAR', texto: `Estou ciente dos meus direitos como titular de dados, podendo exercê-los através do e-mail ${empresa.lgpdEmail || 'lgpd@praticcar.com.br'}.` },
        ].map((item, index) => (
          <div key={index} style={{ marginBottom: '12pt', textAlign: 'justify' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '4pt' }}>{item.titulo}</p>
            <p style={{ fontSize: '9pt', lineHeight: 1.4 }}>{item.texto}</p>
          </div>
        ))}
      </div>

      {/* SEÇÃO 7: DISPOSIÇÕES FINAIS */}
      <div style={{ marginBottom: '16pt', pageBreakInside: 'avoid' }}>
        <h2 style={{ fontSize: '12pt', fontWeight: 'bold', color: '#1e40af', marginBottom: '10pt', paddingBottom: '4pt', borderBottom: '1px solid #e5e7eb' }}>
          7. DISPOSIÇÕES FINAIS
        </h2>
        
        {[
          'Este Termo de Afiliação entra em vigor na data de sua assinatura.',
          'A proteção somente terá início após a instalação do rastreador veicular por técnico credenciado.',
          'O associado declara ter recebido cópia do Regulamento do PSM.',
          'Fica eleito o foro da Comarca do Rio de Janeiro/RJ para dirimir quaisquer questões.',
          'Este documento foi gerado eletronicamente e será assinado digitalmente, tendo validade jurídica conforme Medida Provisória 2.200-2/2001 e Lei 14.063/2020.',
        ].map((texto, index) => (
          <div key={index} style={{ marginBottom: '12pt', textAlign: 'justify' }}>
            <p style={{ fontSize: '9pt', lineHeight: 1.4 }}>
              <strong>7.{index + 1}.</strong> {texto}
            </p>
          </div>
        ))}
      </div>

      {/* SEÇÃO 8: ASSINATURA */}
      <div style={{ marginTop: '40pt', paddingTop: '20pt', borderTop: '1px solid #e5e7eb', pageBreakInside: 'avoid' }}>
        <h2 style={{ fontSize: '12pt', fontWeight: 'bold', color: '#1e40af', marginBottom: '10pt', paddingBottom: '4pt', borderBottom: '1px solid #e5e7eb' }}>
          8. ASSINATURA
        </h2>
        
        <p style={{ textAlign: 'center', marginBottom: '50pt', fontSize: '10pt' }}>
          {localAssinatura}, {dataAssinatura}
        </p>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: '45%', textAlign: 'center', verticalAlign: 'top' }}>
            <div style={{ borderTop: '1px solid #333333', width: '280px', margin: '0 auto', paddingTop: '6pt', fontSize: '9pt' }}>
              <p style={{ fontWeight: 'bold', fontSize: '10pt' }}>{cliente.nome}</p>
              <p style={{ fontSize: '8pt', color: '#666666' }}>CPF: {formatCPF(cliente.cpf)}</p>
              <p style={{ fontSize: '9pt', color: '#374151' }}>ASSOCIADO</p>
            </div>
          </div>
          
          <div style={{ display: 'inline-block', width: '45%', textAlign: 'center', verticalAlign: 'top', marginLeft: '40pt' }}>
            <div style={{ borderTop: '1px solid #333333', width: '280px', margin: '0 auto', paddingTop: '6pt', fontSize: '9pt' }}>
              <p style={{ fontWeight: 'bold', fontSize: '10pt' }}>ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR</p>
              <p style={{ fontSize: '8pt', color: '#666666' }}>CNPJ: {empresa.cnpj}</p>
              <p style={{ fontSize: '9pt', color: '#374151' }}>ABP PRATICCAR</p>
            </div>
          </div>
        </div>
      </div>

      {/* ADITIVOS DINÂMICOS */}
      {aditivos.map((aditivo) => (
        <div key={aditivo.id} style={{ marginTop: '30pt', border: '2px solid #1e40af', padding: '15pt', borderRadius: '4pt', pageBreakBefore: 'always' }}>
          <h2 style={{ fontSize: '12pt', fontWeight: 'bold', color: '#1e40af', marginBottom: '10pt', paddingBottom: '4pt', borderBottom: '1px solid #e5e7eb' }}>
            {aditivo.nome}
          </h2>
          
          {aditivo.descricao && (
            <p style={{ marginBottom: '12pt', fontSize: '9pt', fontStyle: 'italic', color: '#666666' }}>
              {aditivo.descricao}
            </p>
          )}
          
          {aditivo.conteudo_html ? (
            <div 
              style={{ fontSize: '9pt', lineHeight: 1.4, color: '#333333' }}
              dangerouslySetInnerHTML={{ __html: aditivo.conteudo_html }}
            />
          ) : (
            <p style={{ fontSize: '9pt', color: '#666666' }}>Conteúdo do aditivo não disponível.</p>
          )}
          
          <div style={{ marginTop: '40pt', textAlign: 'center' }}>
            <p style={{ marginBottom: '50pt' }}>Local: _________________________ Data: ____/____/________</p>
            <div style={{ borderTop: '1px solid #333333', width: '280px', margin: '0 auto', paddingTop: '6pt' }}>
              <p style={{ fontWeight: 'bold' }}>{cliente.nome}</p>
              <p style={{ fontSize: '8pt', color: '#666666' }}>CPF: {formatCPF(cliente.cpf)}</p>
            </div>
          </div>
        </div>
      ))}


      {/* RODAPÉ */}
      <div style={{ marginTop: '30pt', textAlign: 'center', fontSize: '8pt', color: '#666666', borderTop: '1px solid #e5e7eb', paddingTop: '10pt' }}>
        ABP PraticCar | Termo de Afiliação Nº {contrato.numero}
      </div>
    </div>
  );
}

export default TermoFiliacaoTemplate;
