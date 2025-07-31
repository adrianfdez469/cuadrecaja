class AudioService {
  private audioContext: AudioContext | null = null;
  private successSound: AudioBuffer | null = null;
  private errorSound: AudioBuffer | null = null;

  constructor() {
    this.initAudioContext();
  }

  private async initAudioContext() {
    try {
      // Verificar si estamos en el navegador (no en el servidor)
      if (typeof window === 'undefined') {
        console.warn('Audio context no disponible: ejecutándose en servidor');
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (typeof window === 'undefined' || !this.audioContext) {
      throw new Error('Audio context no disponible');
    }

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
    // Verificar si estamos en el navegador y tenemos audio context
    if (typeof window === 'undefined' || !this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      oscillator.type = type;

      // Configurar envelope (fade in/out)
      const now = this.audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01); // Fade in
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000); // Fade out

      oscillator.start(now);
      oscillator.stop(now + duration / 1000);

    } catch (error) {
      console.warn('Error reproduciendo sonido:', error);
    }
  }

  // Método para activar el audio context (necesario en algunos navegadores)
  async resumeAudioContext() {
    // Verificar si estamos en el navegador
    if (typeof window === 'undefined') return;
    
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}

// Crear instancia singleton
const audioService = new AudioService();

export default audioService; 