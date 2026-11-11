export type Plant = {
  id: string;
  name: string;
  code: string;
  location: string | null;
  is_active?: boolean;
};

export type DashboardMetric = {
  value: number;
  unit: string;
  previous_period_value: number;
  has_data: boolean;
};

export type DashboardSummary = {
  plant_scope: string;
  as_of: string;
  metrics: {
    production_tonnes: DashboardMetric;
    dispatches: DashboardMetric;
    sales_revenue_inr: DashboardMetric;
    stock_tonnes: DashboardMetric;
    diesel_litres: DashboardMetric;
  };
  setup_required: string[];
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  plant_ids: string[];
  must_change_password: boolean;
};

type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  must_change_password: boolean;
};

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request("/api/v1/auth/login", undefined, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getPlants(token: string): Promise<Plant[]> {
  return request("/api/v1/plants", token);
}

export function getProfile(token: string): Promise<UserProfile> {
  return request("/api/v1/auth/me", token);
}

export function getDashboard(token: string, plantId?: string): Promise<DashboardSummary> {
  const query = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : "";
  return request(`/api/v1/dashboard${query}`, token);
}

export async function changePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
  const response = await fetch("/api/v1/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed (${response.status})`);
  }
}

export async function logout(token: string): Promise<void> {
  const response = await fetch("/api/v1/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed (${response.status})`);
  }
}
