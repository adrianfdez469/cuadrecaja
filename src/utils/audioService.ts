class AudioService {
  private audioContext: AudioContext | null = null;
  private successSound: AudioBuffer | null = null;
  private errorSound: AudioBuffer | null = null;

  constructor() {
    this.initAudioContext();
  }

  private async initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      await this.loadSounds();
    } catch (error) {
      console.warn('Audio context no disponible:', error);
    }
  }

  private async loadSounds() {
    if (!this.audioContext) return;

    try {
      // Cargar sonidos desde archivos (opcional)
      // this.successSound = await this.loadAudioFile('/sounds/success.mp3');
      // this.errorSound = await this.loadAudioFile('/sounds/error.mp3');
    } catch (error) {
      console.warn('No se pudieron cargar los archivos de audio:', error);
    }
  }

  private async loadAudioFile(url: string): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('Audio context no disponible');

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  // Generar sonido de éxito (beep agudo)
  playSuccessSound() {
    this.playBeep(800, 200, 'sine'); // Frecuencia alta, duración corta
  }

  // Generar sonido de error (beep bajo)
  playErrorSound() {
    this.playBeep(200, 400, 'sawtooth'); // Frecuencia baja, duración larga
  }

  // Generar beep personalizado
  private playBeep(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.audioContext) {
      console.warn('Audio context no disponible');
      return;
    }

    try {
      // Crear oscilador
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      // Configurar oscilador
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      oscillator.type = type;

      // Configurar ganancia (volumen)
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime); // Volumen al 30%
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);

      // Conectar nodos
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Reproducir sonido
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration / 1000);

      // Limpiar recursos
      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
      };
    } catch (error) {
      console.warn('Error al reproducir sonido:', error);
    }
  }

  // Método para activar el audio context (necesario en algunos navegadores)
  async resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}

// Crear instancia singleton
const audioService = new AudioService();

export default audioService; 