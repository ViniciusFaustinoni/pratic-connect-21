import { useState, useRef } from 'react';
import { Loader2, Upload, FileCheck2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCriarSolicitacao,
  SOLICITACAO_CATEGORIAS,
  SOLICITACAO_FORMAS_PAGAMENTO,
  SOLICITACAO_SETORES,
  SOLICITACAO_PRIORIDADES,
} from '@/hooks/useSolicitacoesFinanceiras';

interface NovaSolicitacaoModalProps {
  open: boolean;
  onClose: () => void;
}

const initialFormData = {
  tipo: 'pagamento',
  setor: '',
  categoria: '',
  prioridade: 'normal',
  numero_documento: '',
  descricao: '',
  valor: '',
  solicitante_nome: '',
  solicitante_telefone: '',
  favorecido_nome: '',
  favorecido_documento: '',
  forma_pagamento: '',
  banco: '',
  agencia: '',
  conta: '',
  pix_chave: '',
  data_vencimento: '',
  observacao: '',
};

export function NovaSolicitacaoModal({ open, onClose }: NovaSolicitacaoModalProps) {
  const { profile } = useAuth();
  const criar = useCriarSolicitacao();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState(() => ({
    ...initialFormData,
    solicitante_nome: profile?.nome ?? '',
    solicitante_telefone: profile?.telefone ?? '',
  }));
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatValor = (value: string) => {
    const clean = value.replace(/\D/g, '');
    const number = parseInt(clean || '0') / 100;
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const parseValor = (value: string) => parseFloat(value.replace(/\./g, '').replace(',', '.') || '0');

  const handleClose = () => {
    setFormData({ ...initialFormData, solicitante_nome: profile?.nome ?? '', solicitante_telefone: profile?.telefone ?? '' });
    setComprovante(null);
    onClose();
  };

  const isValid =
    formData.setor !== '' &&
    formData.categoria !== '' &&
    formData.descricao.trim() !== '' &&
    parseValor(formData.valor) > 0 &&
    formData.solicitante_nome.trim() !== '' &&
    formData.data_vencimento !== '' &&
    !!comprovante;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !comprovante) {
      toast.error('Preencha os campos obrigatórios e anexe o comprovante');
      return;
    }

    setUploading(true);
    try {
      // Upload do comprovante (obrigatório)
      const safeName = comprovante.name.replace(/[^\w.\-]/g, '_');
      const path = `${profile?.id ?? 'anon'}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from('solicitacoes-financeiras')
        .upload(path, comprovante, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('solicitacoes-financeiras').getPublicUrl(path);

      await criar.mutateAsync({
        tipo: formData.tipo as 'pagamento' | 'reembolso',
        setor: formData.setor,
        categoria: formData.categoria,
        prioridade: formData.prioridade as 'baixa' | 'normal' | 'alta' | 'urgente',
        numero_documento: formData.numero_documento,
        descricao: formData.descricao,
        valor: parseValor(formData.valor),
        solicitante_id: profile?.id ?? null,
        solicitante_nome: formData.solicitante_nome,
        solicitante_telefone: formData.solicitante_telefone,
        favorecido_nome: formData.favorecido_nome || formData.solicitante_nome,
        favorecido_documento: formData.favorecido_documento,
        forma_pagamento: formData.forma_pagamento,
        banco: formData.banco,
        agencia: formData.agencia,
        conta: formData.conta,
        pix_chave: formData.pix_chave,
        data_vencimento: formData.data_vencimento,
        observacao: formData.observacao,
        comprovante_url: urlData.publicUrl,
        criado_por: profile?.id ?? null,
      });

      handleClose();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao enviar o comprovante. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const busy = uploading || criar.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação Financeira</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo + Setor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(v) => handleChange('tipo', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagamento">Pagamento</SelectItem>
                  <SelectItem value="reembolso">Reembolso de Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Setor *</Label>
              <Select value={formData.setor} onValueChange={(v) => handleChange('setor', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {SOLICITACAO_SETORES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conta/Despesa + Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta / Despesa *</Label>
              <Select value={formData.categoria} onValueChange={(v) => handleChange('categoria', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {SOLICITACAO_CATEGORIAS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={formData.prioridade} onValueChange={(v) => handleChange('prioridade', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOLICITACAO_PRIORIDADES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="numero_documento">Nº da Nota Fiscal / Documento</Label>
            <Input
              id="numero_documento"
              value={formData.numero_documento}
              onChange={(e) => handleChange('numero_documento', e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Explicação / Justificativa *</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder="Explique o motivo desta solicitação"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="valor"
                  value={formData.valor}
                  onChange={(e) => handleChange('valor', formatValor(e.target.value))}
                  placeholder="0,00"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_vencimento">Vencimento *</Label>
              <Input
                id="data_vencimento"
                type="date"
                value={formData.data_vencimento}
                onChange={(e) => handleChange('data_vencimento', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="solicitante_nome">Solicitante *</Label>
              <Input
                id="solicitante_nome"
                value={formData.solicitante_nome}
                onChange={(e) => handleChange('solicitante_nome', e.target.value)}
                placeholder="Nome de quem está solicitando"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="solicitante_telefone">WhatsApp do solicitante</Label>
              <Input
                id="solicitante_telefone"
                value={formData.solicitante_telefone}
                onChange={(e) => handleChange('solicitante_telefone', e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          {/* Favorecido */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Favorecido do pagamento
            </h4>
            <div className="space-y-2">
              <Label htmlFor="favorecido_nome">Nome (se diferente do solicitante)</Label>
              <Input
                id="favorecido_nome"
                value={formData.favorecido_nome}
                onChange={(e) => handleChange('favorecido_nome', e.target.value)}
                placeholder="Deixe em branco para usar o solicitante"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="favorecido_documento">CPF / CNPJ</Label>
              <Input
                id="favorecido_documento"
                value={formData.favorecido_documento}
                onChange={(e) => handleChange('favorecido_documento', e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* Pagamento */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Dados para pagamento
            </h4>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formData.forma_pagamento} onValueChange={(v) => handleChange('forma_pagamento', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {SOLICITACAO_FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.forma_pagamento === 'pix' && (
              <div className="space-y-2">
                <Label htmlFor="pix_chave">Chave PIX</Label>
                <Input
                  id="pix_chave"
                  value={formData.pix_chave}
                  onChange={(e) => handleChange('pix_chave', e.target.value)}
                  placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                />
              </div>
            )}

            {formData.forma_pagamento === 'transferencia' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="banco">Banco</Label>
                  <Input id="banco" value={formData.banco} onChange={(e) => handleChange('banco', e.target.value)} placeholder="Nome do banco" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agencia">Agência</Label>
                    <Input id="agencia" value={formData.agencia} onChange={(e) => handleChange('agencia', e.target.value)} placeholder="0000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conta">Conta</Label>
                    <Input id="conta" value={formData.conta} onChange={(e) => handleChange('conta', e.target.value)} placeholder="00000-0" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Comprovante obrigatório */}
          <div className="space-y-2">
            <Label>Comprovante (nota fiscal / recibo / foto) *</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
            />
            {comprovante ? (
              <div className="flex items-center justify-between rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate">
                  <FileCheck2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="truncate">{comprovante.name}</span>
                </span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setComprovante(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Anexar comprovante
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={formData.observacao}
              onChange={(e) => handleChange('observacao', e.target.value)}
              placeholder="Informações adicionais..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !isValid}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar para liberação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
