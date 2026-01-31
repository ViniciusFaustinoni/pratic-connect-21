import { useState } from 'react';
import { Edit2, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CpfInput, TelefoneInput, PlacaInput } from '@/components/inputs/MaskedInputs';
import { useUpdateContrato } from '@/hooks/useContratos';
import { toast } from 'sonner';
import type { ContratoWithRelations } from '@/hooks/useContratos';

interface ClienteEditData {
  nome: string;
  telefone: string;
  email: string;
  cpf: string;
}

interface VeiculoEditData {
  marca: string;
  modelo: string;
  ano: string;
  placa: string;
  cor: string;
  renavam: string;
}

interface ContratoEditFormProps {
  contrato: ContratoWithRelations;
  onCancel: () => void;
  onSuccess: () => void;
}

export function ContratoEditForm({ contrato, onCancel, onSuccess }: ContratoEditFormProps) {
  const updateContrato = useUpdateContrato();
  
  const client = contrato.associados || contrato.leads;
  
  // Estado para dados do cliente (exibidos apenas, não editáveis no contrato)
  const [clienteData, setClienteData] = useState<ClienteEditData>({
    nome: client?.nome || '',
    telefone: client?.telefone || '',
    email: client?.email || '',
    cpf: ('cpf' in (client || {}) ? (client as any)?.cpf : '') || '',
  });
  
  // Estado para dados do veículo
  const [veiculoData, setVeiculoData] = useState<VeiculoEditData>({
    marca: contrato.veiculo_marca || '',
    modelo: contrato.veiculo_modelo || '',
    ano: contrato.veiculo_ano?.toString() || '',
    placa: contrato.veiculo_placa || '',
    cor: contrato.veiculo_cor || '',
    renavam: contrato.veiculo_renavam || '',
  });

  const handleSave = async () => {
    try {
      await updateContrato.mutateAsync({
        id: contrato.id,
        veiculo_marca: veiculoData.marca,
        veiculo_modelo: veiculoData.modelo,
        veiculo_ano: veiculoData.ano ? parseInt(veiculoData.ano) : null,
        veiculo_placa: veiculoData.placa,
        veiculo_cor: veiculoData.cor || null,
        veiculo_renavam: veiculoData.renavam || null,
      });
      
      toast.success('Dados atualizados com sucesso!');
      onSuccess();
    } catch (error) {
      toast.error('Erro ao atualizar dados');
    }
  };

  return (
    <div className="space-y-6">
      {/* Dados do Cliente - Apenas leitura por enquanto */}
      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
          Dados do Cliente
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input 
              value={clienteData.nome} 
              disabled
              className="mt-1 bg-muted"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <TelefoneInput 
              value={clienteData.telefone}
              onChange={(val) => setClienteData(prev => ({ ...prev, telefone: val }))}
              disabled
              className="mt-1 bg-muted"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">CPF</Label>
            <CpfInput 
              value={clienteData.cpf}
              onChange={(val) => setClienteData(prev => ({ ...prev, cpf: val }))}
              disabled
              className="mt-1 bg-muted"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input 
              type="email"
              value={clienteData.email}
              disabled
              className="mt-1 bg-muted"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          * Para editar dados do cliente, acesse o cadastro do associado/lead.
        </p>
      </section>

      {/* Dados do Veículo - Editável */}
      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
          Dados do Veículo
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Marca</Label>
            <Input 
              value={veiculoData.marca}
              onChange={(e) => setVeiculoData(prev => ({ ...prev, marca: e.target.value }))}
              className="mt-1"
              placeholder="Ex: Volkswagen"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Modelo</Label>
            <Input 
              value={veiculoData.modelo}
              onChange={(e) => setVeiculoData(prev => ({ ...prev, modelo: e.target.value }))}
              className="mt-1"
              placeholder="Ex: Gol"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Input 
              value={veiculoData.ano}
              onChange={(e) => setVeiculoData(prev => ({ ...prev, ano: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              className="mt-1"
              placeholder="Ex: 2020"
              maxLength={4}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Placa</Label>
            <PlacaInput 
              value={veiculoData.placa}
              onChange={(val) => setVeiculoData(prev => ({ ...prev, placa: val }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Cor</Label>
            <Input 
              value={veiculoData.cor}
              onChange={(e) => setVeiculoData(prev => ({ ...prev, cor: e.target.value }))}
              className="mt-1"
              placeholder="Ex: Prata"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Renavam</Label>
            <Input 
              value={veiculoData.renavam}
              onChange={(e) => setVeiculoData(prev => ({ ...prev, renavam: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
              className="mt-1"
              placeholder="00000000000"
              maxLength={11}
            />
          </div>
        </div>
      </section>

      {/* Botões de Ação */}
      <div className="flex gap-2 pt-4 border-t">
        <Button 
          variant="outline" 
          onClick={onCancel}
          className="flex-1"
        >
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button 
          onClick={handleSave}
          className="flex-1"
          disabled={updateContrato.isPending}
        >
          {updateContrato.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
}
