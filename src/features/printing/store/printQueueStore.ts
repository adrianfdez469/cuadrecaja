import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PRINT_QUEUE_STORAGE_KEY } from "@/constants/ticket";
import { ITicketPayload } from "../types/ITicketData";

export type PrintJobStatus = "pending" | "printing" | "done" | "failed";

export interface IPrintJob {
  id: string;
  saleIdentifier: string;
  tiendaId: string;
  payload: ITicketPayload;
  attempts: number;
  status: PrintJobStatus;
  createdAt: number;
  lastError?: string;
  printedAt?: number;
}

interface PrintQueueState {
  jobs: IPrintJob[];
  enqueue: (job: Omit<IPrintJob, "id" | "attempts" | "status" | "createdAt">) => string;
  markPrinting: (id: string) => void;
  markDone: (id: string) => void;
  markFailed: (id: string, error: string) => void;
  removeJob: (id: string) => void;
  getPendingJobs: () => IPrintJob[];
  getPendingCount: () => number;
  hasPendingForSale: (saleIdentifier: string) => boolean;
}

export const usePrintQueueStore = create<PrintQueueState>()(
  persist(
    (set, get) => ({
      jobs: [],
      enqueue: (job) => {
        const existing = get().jobs.find(
          (j) =>
            j.saleIdentifier === job.saleIdentifier &&
            (j.status === "pending" || j.status === "printing"),
        );
        if (existing) return existing.id;

        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `pj-${Date.now()}`;
        const newJob: IPrintJob = {
          ...job,
          id,
          attempts: 0,
          status: "pending",
          createdAt: Date.now(),
        };
        set((state) => ({ jobs: [...state.jobs, newJob] }));
        return id;
      },
      markPrinting: (id) =>
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id
              ? { ...j, status: "printing" as const, attempts: j.attempts + 1 }
              : j,
          ),
        })),
      markDone: (id) =>
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id
              ? { ...j, status: "done" as const, printedAt: Date.now() }
              : j,
          ),
        })),
      markFailed: (id, error) =>
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id
              ? { ...j, status: "failed" as const, lastError: error }
              : j,
          ),
        })),
      removeJob: (id) =>
        set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) })),
      getPendingJobs: () =>
        get().jobs.filter((j) => j.status === "pending" || j.status === "failed"),
      getPendingCount: () =>
        get().jobs.filter(
          (j) => j.status === "pending" || j.status === "failed",
        ).length,
      hasPendingForSale: (saleIdentifier) =>
        get().jobs.some(
          (j) =>
            j.saleIdentifier === saleIdentifier &&
            (j.status === "pending" || j.status === "failed"),
        ),
    }),
    { name: PRINT_QUEUE_STORAGE_KEY },
  ),
);
