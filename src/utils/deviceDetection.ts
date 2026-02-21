
export type DeviceArchitecture = 'arm64-v8a' | 'armeabi-v7a' | 'x86_64' | 'universal';

export function getDeviceArchitecture(): DeviceArchitecture {
    if (typeof window === 'undefined') return 'arm64-v8a';

    const ua = window.navigator.userAgent.toLowerCase();

    // Check for 64-bit ARM
    if (ua.includes('arm64') || ua.includes('aarch64') || ua.includes('armv8')) {
        return 'arm64-v8a';
    }

    // Check for 32-bit ARM
    if (ua.includes('armv7') || ua.includes('armeabi')) {
        return 'armeabi-v7a';
    }

    // Check for x86_64
    if (ua.includes('x86_64') || ua.includes('amd64')) {
        return 'x86_64';
    }

    // Default to modern architecture as requested
    return 'arm64-v8a';
}

export function getArchitectureLabel(arch: DeviceArchitecture): string {
    switch (arch) {
        case 'arm64-v8a':
            return 'Dispositivos Modernos (64-bit)';
        case 'armeabi-v7a':
            return 'Dispositivos Antiguos (32-bit)';
        case 'x86_64':
            return 'Emuladores / PC (x86_64)';
        case 'universal':
            return 'Versión Universal (Todo en uno)';
        default:
            return 'Versión Recomendada';
    }
}
