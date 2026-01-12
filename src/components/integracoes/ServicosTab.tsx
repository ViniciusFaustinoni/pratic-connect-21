import { CreditCard, MessageSquare, MapPin, FileSignature, Zap, CheckCircle, XCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const integracoes = [
  { 
    id: 'asaas', 
    nome: 'ASAAS', 
    desc: 'Boletos, Pix e cobranças automáticas', 
    icon: CreditCard, 
    color: 'text-green-500 bg-green-500/10', 
    ativo: false 
  },
  { 
    id: 'whatsapp', 
    nome: 'WhatsApp Evolution API', 
    desc: 'Mensagens e notificações em massa', 
    icon: MessageSquare, 
    color: 'text-emerald-500 bg-emerald-500/10', 
    ativo: false 
  },
  { 
    id: 'rastreadores', 
    nome: 'Rede Veículos', 
    desc: 'Rastreamento veicular em tempo real', 
    icon: MapPin, 
    color: 'text-blue-500 bg-blue-500/10', 
    ativo: false 
  },
  { 
    id: 'autentique', 
    nome: 'Autentique', 
    desc: 'Assinatura digital de contratos', 
    icon: FileSignature, 
    color: 'text-purple-500 bg-purple-500/10', 
    ativo: false 
  },
  { 
    id: 'n8n', 
    nome: 'n8n', 
    desc: 'Automações e workflows', 
    icon: Zap, 
    color: 'text-orange-500 bg-orange-500/10', 
    ativo: true 
  },
];

export function ServicosTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integracoes.map((integracao) => {
          const Icon = integracao.icon;
          return (
            <Card key={integracao.id} className="border-border/50 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${integracao.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{integracao.nome}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{integracao.desc}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={integracao.ativo ? 'default' : 'secondary'} 
                    className={`gap-1 ${integracao.ativo ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-muted text-muted-foreground'}`}
                  >
                    {integracao.ativo ? (
                      <><CheckCircle className="w-3 h-3" /> Conectado</>
                    ) : (
                      <><XCircle className="w-3 h-3" /> Desconectado</>
                    )}
                  </Badge>
                </div>

                <div className="mt-4 pt-4 border-t border-border/50">
                  <Button variant="outline" size="sm" className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Configurar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Card */}
      <Card className="border-border/50 bg-amber-500/5 border-amber-500/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Configuração de Integrações</p>
              <p className="text-sm text-muted-foreground mt-1">
                Entre em contato com o suporte técnico para ativar novas integrações ou alterar configurações existentes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
