import axios from 'axios';

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
    const { data } = await axios.get(`/api/subscription/status/${negocioId}`);
    return data;
  }

  static async suspendBusiness(negocioId: string, forceManual = true): Promise<void> {
    await axios.post(`/api/subscription/suspend/${negocioId}`, { forceManual });
  }

  static async reactivateBusiness(negocioId: string, newLimitTime: Date): Promise<void> {
    await axios.post(`/api/subscription/reactivate/${negocioId}`, {
      specificDate: newLimitTime.toISOString()
    });
  }

  static async checkAndProcessSuspensions(): Promise<void> {
    await axios.post('/api/subscription/auto-suspend');
  }

  static async getSubscriptionStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    suspended: number;
    gracePeriod: number;
  }> {
    const { data } = await axios.get('/api/subscription/stats');
    return data.stats;
  }

  static async activateBusiness(negocioId: string): Promise<void> {
    await axios.post(`/api/subscription/activate/${negocioId}`);
  }

  static async setExpirationDate(negocioId: string, newExpirationDate: Date): Promise<void> {
    await axios.post(`/api/subscription/set-expiration/${negocioId}`, {
      expirationDate: newExpirationDate.toISOString()
    });
  }

  static async extendSubscription(negocioId: string, daysToAdd: number): Promise<void> {
    await axios.post(`/api/subscription/extend/${negocioId}`, { daysToAdd });
  }
}
