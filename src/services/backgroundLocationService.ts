import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * Interface do plugin BackgroundGeolocation
 * Baseado em @capacitor-community/background-geolocation
 */
interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (location: BackgroundLocation | null, error: BackgroundError | null) => void
  ): Promise<string>;
  
  removeWatcher(options: { id: string }): Promise<void>;
  
  openSettings(): Promise<void>;
}

interface BackgroundLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  bearing: number | null;
  speed: number | null;
  time: number;
}

interface BackgroundError {
  code: string;
  message: string;
}

// Registrar o plugin apenas se estiver em ambiente nativo
const BackgroundGeolocation = Capacitor.isNativePlatform() 
  ? registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')
  : null;

/**
 * Serviço de rastreamento de localização em segundo plano
 * Funciona apenas em apps nativos (Android/iOS via Capacitor)
 * 
 * Características:
 * - Continua funcionando mesmo com app fechado
 * - Envia localização a cada 50m de movimento ou 5 minutos
 * - Mostra notificação persistente no Android
 */
class BackgroundLocationService {
  private watcherId: string | null = null;
  private profissionalId: string | null = null;
  private isRunning: boolean = false;

  /**
   * Verifica se está rodando em plataforma nativa
   */
  isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Inicia o rastreamento em segundo plano
   */
  async iniciar(profissionalId: string): Promise<boolean> {
    if (!BackgroundGeolocation) {
      console.warn('[BackgroundLocation] Plugin não disponível (ambiente web)');
      return false;
    }

    if (this.isRunning) {
      console.log('[BackgroundLocation] Já está rodando');
      return true;
    }

    this.profissionalId = profissionalId;

    try {
      this.watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: 'PRATIC Profissional',
          backgroundMessage: 'Rastreando sua localização para atribuir tarefas próximas...',
          requestPermissions: true,
          stale: false, // Não usar localização em cache
          distanceFilter: 50, // Mínimo 50m de movimento para atualizar
        },
        async (location, error) => {
          if (error) {
            console.error('[BackgroundLocation] Erro no watcher:', error.code, error.message);
            
            // Se for erro de permissão, notificar o usuário
            if (error.code === 'NOT_AUTHORIZED') {
              console.warn('[BackgroundLocation] Permissão negada - abrir configurações');
            }
            return;
          }

          if (location) {
            await this.enviarLocalizacao(location.latitude, location.longitude, location.accuracy);
          }
        }
      );

      this.isRunning = true;
      console.log('[BackgroundLocation] Watcher iniciado com ID:', this.watcherId);
      return true;
    } catch (error) {
      console.error('[BackgroundLocation] Erro ao iniciar:', error);
      return false;
    }
  }

  /**
   * Envia localização para o banco de dados
   */
  private async enviarLocalizacao(latitude: number, longitude: number, accuracy?: number): Promise<void> {
    if (!this.profissionalId) {
      console.warn('[BackgroundLocation] Sem profissional ID configurado');
      return;
    }

    try {
      const { error } = await supabase
        .from('vistoriadores_localizacao')
        .upsert({
          vistoriador_id: this.profissionalId,
          latitude,
          longitude,
          em_servico: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'vistoriador_id' });

      if (error) {
        console.error('[BackgroundLocation] Erro ao salvar localização:', error);
        return;
      }

      console.log(
        `[BackgroundLocation] Localização enviada: (${latitude.toFixed(5)}, ${longitude.toFixed(5)})` +
        (accuracy ? ` precisão: ${accuracy.toFixed(0)}m` : '')
      );
    } catch (error) {
      console.error('[BackgroundLocation] Erro ao enviar localização:', error);
    }
  }

  /**
   * Para o rastreamento em segundo plano
   */
  async parar(): Promise<void> {
    if (!BackgroundGeolocation || !this.watcherId) {
      console.log('[BackgroundLocation] Nada para parar');
      return;
    }

    try {
      await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
      this.watcherId = null;
      this.isRunning = false;
      console.log('[BackgroundLocation] Watcher removido com sucesso');
    } catch (error) {
      console.error('[BackgroundLocation] Erro ao parar:', error);
    }
  }

  /**
   * Abre as configurações de localização do dispositivo
   */
  async abrirConfiguracoes(): Promise<void> {
    if (!BackgroundGeolocation) {
      console.warn('[BackgroundLocation] Plugin não disponível');
      return;
    }

    try {
      await BackgroundGeolocation.openSettings();
    } catch (error) {
      console.error('[BackgroundLocation] Erro ao abrir configurações:', error);
    }
  }

  /**
   * Verifica se o serviço está ativo
   */
  estaAtivo(): boolean {
    return this.isRunning;
  }
}

// Singleton do serviço
export const backgroundLocationService = new BackgroundLocationService();
