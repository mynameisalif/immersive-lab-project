import api from "@/lib/api";

export const getPendingApprovals = async (params?: {
  page?: number;
  limit?: number;
}) => {
  return api.get("/api/approvals/pending", { params });
};

export const approveLoan = (loanId: string, reason: string) =>
  api.post(`/api/approvals/${loanId}/approve`, { reason });

export const rejectLoan = (loanId: string, reason: string) =>
  api.post(`/api/approvals/${loanId}/reject`, { reason });

export const getApprovalHistory = (loanId: string) =>
  api.get(`/api/approvals/${loanId}/history`);
