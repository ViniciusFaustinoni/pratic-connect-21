import { User, MapPin, Car, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DadosCliente, DadosEndereco, DadosVeiculo } from '@/hooks/useExtrairDadosDocumentos';

interface DadosExtraidosProps {
  cliente: DadosCliente | null;
  endereco: DadosEndereco | null;
  veiculo: DadosVeiculo | null;
  camposFaltantes: string[];
  avisos: string[];
}

interface CampoExibidoProps {
  label: string;
  valor: string | number | null | undefined;
  obrigatorio?: boolean;
}

function CampoExibido({ label, valor, obrigatorio }: CampoExibidoProps) {
  const temValor = valor !== null && valor !== undefined && valor !== '';
  
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        {label}
        {obrigatorio && !temValor && (
          <AlertTriangle className="h-3 w-3 text-yellow-500" />
        )}
      </span>
      <span className={`text-sm font-medium ${temValor ? 'text-foreground' : 'text-muted-foreground italic'}`}>
        {temValor ? String(valor) : 'Não identificado'}
      </span>
    </div>
  );
}

export function DadosExtraidos({ cliente, endereco, veiculo, camposFaltantes, avisos }: DadosExtraidosProps) {
  const hasAnyData = cliente || endereco || veiculo;

  if (!hasAnyData) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">
            Envie os documentos acima para extrair os dados automaticamente
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Avisos */}
      {(camposFaltantes.length > 0 || avisos.length > 0) && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div className="space-y-2">
                {camposFaltantes.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600">Campos não identificados:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {camposFaltantes.map((campo) => (
                        <Badge key={campo} variant="outline" className="text-xs">
                          {campo}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {avisos.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600">Avisos:</p>
                    <ul className="text-sm text-muted-foreground mt-1 list-disc list-inside">
                      {avisos.map((aviso, i) => (
                        <li key={i}>{aviso}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dados do Cliente */}
      {cliente && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Dados Pessoais</h3>
              {cliente.nome && cliente.cpf && (
                <Badge variant="secondary" className="ml-auto">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Extraído
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <CampoExibido label="Nome Completo" valor={cliente.nome} obrigatorio />
              <CampoExibido label="CPF" valor={cliente.cpf} obrigatorio />
              <CampoExibido label="RG" valor={cliente.rg} />
              <CampoExibido label="Data de Nascimento" valor={cliente.data_nascimento} obrigatorio />
              <CampoExibido label="Sexo" valor={cliente.sexo === 'M' ? 'Masculino' : cliente.sexo === 'F' ? 'Feminino' : cliente.sexo} />
              <CampoExibido label="Nacionalidade" valor={cliente.nacionalidade} />
              <CampoExibido label="Naturalidade" valor={cliente.naturalidade} />
              <CampoExibido label="Nome da Mãe" valor={cliente.nome_mae} />
              <CampoExibido label="Nome do Pai" valor={cliente.nome_pai} />
              {cliente.cnh_numero && (
                <>
                  <CampoExibido label="CNH Número" valor={cliente.cnh_numero} />
                  <CampoExibido label="CNH Categoria" valor={cliente.cnh_categoria} />
                  <CampoExibido label="CNH Validade" valor={cliente.cnh_validade} />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Endereço */}
      {endereco && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Endereço</h3>
              {endereco.cep && endereco.logradouro && (
                <Badge variant="secondary" className="ml-auto">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Extraído
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <CampoExibido label="CEP" valor={endereco.cep} obrigatorio />
              <CampoExibido label="Logradouro" valor={endereco.logradouro} obrigatorio />
              <CampoExibido label="Número" valor={endereco.numero} obrigatorio />
              <CampoExibido label="Complemento" valor={endereco.complemento} />
              <CampoExibido label="Bairro" valor={endereco.bairro} obrigatorio />
              <CampoExibido label="Cidade" valor={endereco.cidade} obrigatorio />
              <CampoExibido label="Estado" valor={endereco.estado} obrigatorio />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Veículo */}
      {veiculo && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Car className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Dados do Veículo</h3>
              {veiculo.chassi && (
                <Badge variant="secondary" className="ml-auto">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Extraído
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <CampoExibido label="Placa" valor={veiculo.placa} />
              <CampoExibido label="Chassi" valor={veiculo.chassi} obrigatorio />
              <CampoExibido label="Renavam" valor={veiculo.renavam} />
              <CampoExibido label="Marca" valor={veiculo.marca} />
              <CampoExibido label="Modelo" valor={veiculo.modelo} />
              <CampoExibido label="Ano Fabricação" valor={veiculo.ano_fabricacao} />
              <CampoExibido label="Ano Modelo" valor={veiculo.ano_modelo} />
              <CampoExibido label="Cor" valor={veiculo.cor} />
              <CampoExibido label="Combustível" valor={veiculo.combustivel} />
              <CampoExibido label="Categoria" valor={veiculo.categoria} />
              <CampoExibido label="Espécie" valor={veiculo.especie} />
              <CampoExibido label="Potência" valor={veiculo.potencia} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
