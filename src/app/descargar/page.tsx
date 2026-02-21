import React from 'react';
import DownloadClient from './DownloadClient';
import { DeviceArchitecture } from '@/utils/deviceDetection';

interface ReleaseInfo {
    version: string;
    apks: Record<DeviceArchitecture, string>;
    changelog: Record<string, Array<{ [key: string]: string }>>;
}

async function getReleaseData(): Promise<ReleaseInfo> {
    const response = await fetch('https://docs.google.com/uc?export=download&id=1ekvyYpK0K693H0fYskQO4qMlM1vgkmrv', {
        next: { revalidate: 3600 } // Cache results for 1 hour
    });

    if (!response.ok) {
        throw new Error('Failed to fetch release data');
    }

    return response.json();
}

export default async function DownloadPage() {
    try {
        const releaseData = await getReleaseData();
        return <DownloadClient release={releaseData} />;
    } catch (error) {
        console.error('Error fetching release data:', error);
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'sans-serif',
                textAlign: 'center',
                padding: '20px',
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
            }}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    maxWidth: '400px'
                }}>
                    <h1 style={{ color: '#d32f2f', marginTop: 0 }}>Oops!</h1>
                    <p style={{ color: '#555', marginBottom: '30px' }}>No pudimos cargar la información de descarga en este momento.</p>
                    <a href="/descargar" style={{
                        padding: '12px 24px',
                        backgroundColor: '#1976d2',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        display: 'inline-block'
                    }}>
                        Reintentar
                    </a>
                </div>
            </div>
        );
    }
}
