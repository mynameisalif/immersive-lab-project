import api from "@/lib/api";

export interface LoanPayload {
  asset_id: string;
  quantity: number;
  category: "kelas_praktikum" | "event_kegiatan";
  borrow_date: string;
  return_deadline: string;
  dosen_id?: string | null;
  notes?: string | null;
}

export interface UnitCondition {
  asset_unit_id: string;
  return_condition: "good" | "minor" | "major";
  return_notes?: string | null;
}

export const getLoans = () => api.get("/api/loans");

export const getLoanById = (id: string) => api.get(`/api/loans/${id}`);

export const createLoan = (data: LoanPayload, proposalFile?: File | null) => {
  if (proposalFile) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined)
        formData.append(key, String(value));
    });
    formData.append("proposal", proposalFile);
    return api.post("/api/loans", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }
  return api.post("/api/loans", data);
};

export const uploadProposal = (loanId: string, file: File) => {
  const formData = new FormData();
  formData.append("proposal", file);
  return api.post(`/api/loans/${loanId}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const confirmPickup = (loanId: string, unitIds: string[]) =>
  api.patch(`/api/loans/${loanId}/pickup`, { unit_ids: unitIds });

export const confirmReturn = (
  loanId: string,
  unitConditions: UnitCondition[],
) =>
  api.patch(`/api/loans/${loanId}/return`, { unit_conditions: unitConditions });
