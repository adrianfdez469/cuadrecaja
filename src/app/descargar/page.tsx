import React from 'react';
import { Button } from '@mui/material';
import CloudOff from '@mui/icons-material/CloudOff';

import { StatusScreen } from '@/components/StatusScreen';

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
            <StatusScreen
                icon={<CloudOff />}
                hue="negative"
                title="No pudimos cargar la descarga"
                description="La información de la versión no está disponible en este momento. Vuelve a intentarlo en unos minutos."
                actions={
                    <Button variant="contained" href="/descargar">
                        Reintentar
                    </Button>
                }
            />
        );
    }
}
