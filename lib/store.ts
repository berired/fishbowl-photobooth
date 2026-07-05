import { create } from "zustand";
import { requiredCountFor, type BubbleType } from "./frames";

export type Page = "main" | "selection" | "capture";

export type Status =
  | "idle"
  | "selecting-bubble"
  | "selecting-frame"
  | "bursting"
  | "retake-check"
  | "selecting-photos"
  | "final-review"
  | "sending"
  | "done";

export type Session = {
  page: Page;
  bubbleType: BubbleType | null;
  requiredCount: number;
  frameId: string | null;
  burstPhotos: string[];
  selectedPhotoIds: string[]; // indexes into burstPhotos, as strings
  status: Status;
  /** Non-null while a send attempt has failed; user stays on final review. */
  sendError: string | null;
};

type Actions = {
  tapStart: () => void;
  chooseBubbleType: (t: BubbleType) => void;
  backToBubbleType: () => void;
  chooseFrame: (frameId: string) => void;
  beginBurst: () => void;
  addBurstPhoto: (dataUrl: string) => void;
  finishBurst: () => void;
  retakeAll: () => void;
  acceptBurst: () => void;
  togglePhoto: (id: string) => void;
  confirmSelection: () => void;
  backToPhotoSelection: () => void;
  startSending: () => void;
  sendFailed: (message: string) => void;
  sendSucceeded: () => void;
  resetSession: () => void;
};

const initial: Session = {
  page: "main",
  bubbleType: null,
  requiredCount: 0,
  frameId: null,
  burstPhotos: [],
  selectedPhotoIds: [],
  status: "idle",
  sendError: null,
};

export const useSession = create<Session & Actions>((set, get) => ({
  ...initial,

  tapStart: () => set({ page: "selection", status: "selecting-bubble" }),

  chooseBubbleType: (t) =>
    set({
      bubbleType: t,
      requiredCount: requiredCountFor(t),
      frameId: null,
      status: "selecting-frame",
    }),

  backToBubbleType: () => set({ status: "selecting-bubble", frameId: null }),

  chooseFrame: (frameId) => set({ frameId, page: "capture", status: "idle" }),

  beginBurst: () =>
    set({ status: "bursting", burstPhotos: [], selectedPhotoIds: [] }),

  addBurstPhoto: (dataUrl) =>
    set((s) => ({ burstPhotos: [...s.burstPhotos, dataUrl] })),

  finishBurst: () => set({ status: "retake-check" }),

  // "Retake? Yes" — discard all 6, restart the burst from attempt 1.
  retakeAll: () =>
    set({ burstPhotos: [], selectedPhotoIds: [], status: "bursting" }),

  acceptBurst: () => set({ status: "selecting-photos" }),

  togglePhoto: (id) => {
    const { selectedPhotoIds, requiredCount } = get();
    if (selectedPhotoIds.includes(id)) {
      set({ selectedPhotoIds: selectedPhotoIds.filter((x) => x !== id) });
    } else if (selectedPhotoIds.length < requiredCount) {
      set({ selectedPhotoIds: [...selectedPhotoIds, id] });
    }
  },

  confirmSelection: () => set({ status: "final-review", sendError: null }),

  backToPhotoSelection: () =>
    set({ status: "selecting-photos", sendError: null }),

  startSending: () => set({ status: "sending", sendError: null }),

  sendFailed: (message) => set({ status: "final-review", sendError: message }),

  sendSucceeded: () => set({ status: "done", sendError: null }),

  // Full reset between customers — nothing survives into the next session.
  resetSession: () => set({ ...initial }),
}));
