import axiosClient from '@/lib/axiosClient';

export interface SubscriptionStatus {
  isActive: boolean;
  daysRemaining: number;
  isExpired: boolean;
  isSuspended: boolean;
  canRenew: boolean;
  gracePeriodDays: number;
}

export class SubscriptionService {
  static async getSubscriptionStatus(negocioId: string): Promise<SubscriptionStatus> {
    const { data } = await axiosClient.get(`/api/subscription/status/${negocioId}`);
    return data;
  }

  static async suspendBusiness(negocioId: string, forceManual = true): Promise<void> {
    await axiosClient.post(`/api/subscription/suspend/${negocioId}`, { forceManual });
  }

  static async reactivateBusiness(negocioId: string, payload: { specificDate?: string; daysToAdd?: number }): Promise<void> {
    await axiosClient.post(`/api/subscription/reactivate/${negocioId}`, payload);
  }

  static async checkAndProcessSuspensions(): Promise<void> {
    await axiosClient.post('/api/subscription/auto-suspend');
  }

  static async getSubscriptionStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    suspended: number;
    gracePeriod: number;
  }> {
    const { data } = await axiosClient.get('/api/subscription/stats');
    return data.stats;
  }

  static async activateBusiness(negocioId: string): Promise<void> {
    await axiosClient.post(`/api/subscription/activate/${negocioId}`);
  }

  static async setExpirationDate(negocioId: string, newExpirationDate: Date): Promise<void> {
    await axiosClient.post(`/api/subscription/set-expiration/${negocioId}`, {
      expirationDate: newExpirationDate.toISOString()
    });
  }

  static async extendSubscription(negocioId: string, daysToAdd: number): Promise<void> {
    await axiosClient.post(`/api/subscription/extend/${negocioId}`, { daysToAdd });
  }
}
