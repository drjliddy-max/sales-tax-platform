import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { authService } from './auth';
import { ApiResponse, PaginatedResponse } from '@/types';
import { TenantApiResponse } from '@/types/tenant';

class ApiService {
  private static instance: ApiService;
  private api: AxiosInstance;

  private constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token and tenant context
    this.api.interceptors.request.use(
      async (config) => {
        const token = await authService.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add tenant context from localStorage
        const tenantId = localStorage.getItem('selectedTenantId');
        if (tenantId) {
          config.headers['X-Tenant-ID'] = tenantId;
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, redirect to login
          authService.login();
        }
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.api.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.api.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.api.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.api.patch<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.api.delete<ApiResponse<T>>(url, config);
    return response.data;
  }

  async getPaginated<T>(
    url: string,
    params?: Record<string, any>
  ): Promise<PaginatedResponse<T>> {
    const response = await this.api.get<PaginatedResponse<T>>(url, { params });
    return response.data;
  }

  // Tenant-aware API methods
  async getTenant<T>(url: string, config?: AxiosRequestConfig): Promise<TenantApiResponse<T>> {
    const response = await this.api.get<TenantApiResponse<T>>(url, config);
    return response.data;
  }

  async postTenant<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<TenantApiResponse<T>> {
    const response = await this.api.post<TenantApiResponse<T>>(url, data, config);
    return response.data;
  }

  async putTenant<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<TenantApiResponse<T>> {
    const response = await this.api.put<TenantApiResponse<T>>(url, data, config);
    return response.data;
  }

  async deleteTenant<T>(url: string, config?: AxiosRequestConfig): Promise<TenantApiResponse<T>> {
    const response = await this.api.delete<TenantApiResponse<T>>(url, config);
    return response.data;
  }

  getCurrentTenantId(): string | null {
    return localStorage.getItem('selectedTenantId');
  }

  setTenantId(tenantId: string): void {
    localStorage.setItem('selectedTenantId', tenantId);
  }

  clearTenantContext(): void {
    localStorage.removeItem('selectedTenantId');
    localStorage.removeItem('currentTenant');
    localStorage.removeItem('userRole');
    localStorage.removeItem('permissions');
  }
}

export const apiService = ApiService.getInstance();

// Tenant-scoped API endpoints
export const businessApi = {
  getAll: () => apiService.getTenant<any[]>('/business'),
  getById: (id: string) => apiService.getTenant<any>(`/business/${id}`),
  create: (data: any) => apiService.postTenant<any>('/business', data),
  update: (id: string, data: any) => apiService.putTenant<any>(`/business/${id}`, data),
  delete: (id: string) => apiService.deleteTenant(`/business/${id}`),
};

export const transactionApi = {
  getAll: (businessId?: string, params?: Record<string, any>) => {
    const url = businessId ? `/transactions?businessId=${businessId}` : '/transactions';
    return apiService.getPaginated<any>(url, params);
  },
  getById: (id: string) => apiService.getTenant<any>(`/transactions/${id}`),
  create: (data: any) => apiService.postTenant<any>('/transactions', data),
  update: (id: string, data: any) => apiService.putTenant<any>(`/transactions/${id}`, data),
  delete: (id: string) => apiService.deleteTenant(`/transactions/${id}`),
};

export const reportsApi = {
  getAll: (businessId?: string) => {
    const url = businessId ? `/reports?businessId=${businessId}` : '/reports';
    return apiService.getPaginated<any>(url);
  },
  generate: (data: any) => apiService.postTenant<any>('/reports/generate', data),
  download: (id: string) => apiService.getTenant(`/reports/${id}/download`),
};

export const insightsApi = {
  generate: (businessId: string) => apiService.postTenant<any>(`/insights-simple/generate/${businessId}`),
  getAll: (businessId?: string) => {
    const url = businessId ? `/insights/${businessId}` : '/insights';
    return apiService.getTenant<any[]>(url);
  },
};

export const taxApi = {
  calculate: (data: any) => apiService.postTenant<any>('/tax/calculate', data),
  getRates: (params?: Record<string, any>) => apiService.getPaginated<any>('/tax/rates', params),
  updateRates: () => apiService.postTenant('/tax/update-rates'),
};

// Tenant management API
export const tenantApi = {
  // User tenant access
  getUserTenants: () => apiService.get<any[]>('/tenants/user-access'),
  getTenantDetails: (tenantId: string) => apiService.get<any>(`/tenants/${tenantId}/details`),
  switchTenant: (tenantId: string) => apiService.post('/tenants/switch', { tenantId }),
  
  // Tenant CRUD operations
  getAll: () => apiService.get<any[]>('/tenants'),
  getById: (id: string) => apiService.get<any>(`/tenants/${id}`),
  create: (data: any) => apiService.post<any>('/tenants', data),
  update: (id: string, data: any) => apiService.put<any>(`/tenants/${id}`, data),
  delete: (id: string) => apiService.delete(`/tenants/${id}`),
  
  // Tenant user management
  getUsers: (tenantId: string) => apiService.get<any[]>(`/tenants/${tenantId}/users`),
  inviteUser: (tenantId: string, data: any) => apiService.post<any>(`/tenants/${tenantId}/invitations`, data),
  updateUserRole: (tenantId: string, userId: string, data: any) => 
    apiService.put<any>(`/tenants/${tenantId}/users/${userId}`, data),
  removeUser: (tenantId: string, userId: string) => 
    apiService.delete(`/tenants/${tenantId}/users/${userId}`),
  
  // Tenant settings
  getSettings: (tenantId: string) => apiService.get<any>(`/tenants/${tenantId}/settings`),
  updateSettings: (tenantId: string, data: any) => 
    apiService.put<any>(`/tenants/${tenantId}/settings`, data),
  
  // Tenant billing
  getBilling: (tenantId: string) => apiService.get<any>(`/tenants/${tenantId}/billing`),
  updateBilling: (tenantId: string, data: any) => 
    apiService.put<any>(`/tenants/${tenantId}/billing`, data),
  
  // Tenant audit logs
  getAuditLogs: (tenantId: string, params?: Record<string, any>) => 
    apiService.getPaginated<any>(`/tenants/${tenantId}/audit-logs`, params),
};
