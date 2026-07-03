import api from "@/lib/api";

export interface AssetPayload {
  name: string;
  category: string;
  description?: string | null;
  image_url?: string | null;
  merk?: string | null;
  type?: string | null;
  serial_number?: string | null;
  no_spmb?: string | null;
  no_po?: string | null;
  kelengkapan?: string | null;
}

export interface UnitPayload {
  unit_code: string;
  condition?: "good" | "minor" | "major";
  notes?: string | null;
}

export const getAllAssets = (params?: { page?: number; limit?: number }) =>
  api.get("/api/assets", { params });

export const getAvailableAssets = () => api.get("/api/assets/available");

export const getAssetById = (id: string) => api.get(`/api/assets/${id}`);

export const getUnitsByAsset = (assetId: string) =>
  api.get(`/api/assets/${assetId}/units`);

export const createAsset = (data: AssetPayload) =>
  api.post("/api/assets", data);

export const updateAsset = (id: string, data: Partial<AssetPayload>) =>
  api.put(`/api/assets/${id}`, data);

export const deleteAsset = (id: string) => api.delete(`/api/assets/${id}`);

export const createUnit = (assetId: string, data: UnitPayload) =>
  api.post(`/api/assets/${assetId}/units`, data);

export const updateUnit = (unitId: string, data: Partial<UnitPayload>) =>
  api.patch(`/api/assets/units/${unitId}`, data);

export const deleteUnit = (unitId: string) =>
  api.delete(`/api/assets/units/${unitId}`);
