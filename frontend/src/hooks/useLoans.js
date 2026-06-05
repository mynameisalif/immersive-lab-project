// ============================================================
// useLoans.js
// ============================================================
import { useState, useEffect } from "react";
import { getLoans, getLoanById } from "@/services/loan.service";
import { getPendingApprovals } from "@/services/approval.service";

export const useLoans = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const res = await getLoans();
      setLoans(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Gagal memuat data peminjaman");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  return { loans, loading, error, refetch: fetchLoans };
};

export const usePendingApprovals = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const res = await getPendingApprovals();
      setApprovals(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Gagal memuat data persetujuan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  return { approvals, loading, error, refetch: fetchApprovals };
};

export default useLoans;
