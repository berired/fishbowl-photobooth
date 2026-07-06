import { create } from "zustand";
import {
  packageById,
  STRIP_PHOTO_COUNT,
  type PackageId,
} from "./frames";

export type Page = "main" | "selection" | "capture";

export type Status =
  | "idle"
  | "selecting-package"
  | "selecting-variant"
  | "selecting-frame"
  | "bursting"
  | "retake-check"
  | "selecting-photos"
  | "selecting-keychain-photo"
  | "final-review"
  | "sending"
  | "done";

export type Session = {
  page: Page;
  packageId: PackageId | null;
  variantId: string | null;
  /** Photos to pick for the strip: 3 (half) or 4 (full). */
  requiredCount: number;
  /** True for the Lapu-Lapu package — adds the keychain photo pick. */
  needsKeychain: boolean;
  frameId: string | null;
  burstPhotos: string[];
  selectedPhotoIds: string[]; // indexes into burstPhotos, as strings
  /** Index into burstPhotos (as string) chosen for the keychain. */
  keychainPhotoId: string | null;
  status: Status;
  /** Non-null while a send attempt has failed; user stays on final review. */
  sendError: string | null;
};

type Actions = {
  tapStart: () => void;
  choosePackage: (id: PackageId) => void;
  backToPackage: () => void;
  chooseVariant: (variantId: string) => void;
  backToVariant: () => void;
  chooseFrame: (frameId: string) => void;
  beginBurst: () => void;
  addBurstPhoto: (dataUrl: string) => void;
  finishBurst: () => void;
  retakeAll: () => void;
  acceptBurst: () => void;
  togglePhoto: (id: string) => void;
  confirmSelection: () => void;
  chooseKeychainPhoto: (id: string) => void;
  backToPhotoSelection: () => void;
  startSending: () => void;
  sendFailed: (message: string) => void;
  sendSucceeded: () => void;
  resetSession: () => void;
};

const initial: Session = {
  page: "main",
  packageId: null,
  variantId: null,
  requiredCount: 0,
  needsKeychain: false,
  frameId: null,
  burstPhotos: [],
  selectedPhotoIds: [],
  keychainPhotoId: null,
  status: "idle",
  sendError: null,
};

export const useSession = create<Session & Actions>((set, get) => ({
  ...initial,

  tapStart: () => set({ page: "selection", status: "selecting-package" }),

  choosePackage: (id) =>
    set({
      packageId: id,
      needsKeychain: packageById(id).keychain,
      variantId: null,
      frameId: null,
      status: "selecting-variant",
    }),

  backToPackage: () =>
    set({ status: "selecting-package", variantId: null, frameId: null }),

  chooseVariant: (variantId) => {
    const pkg = packageById(get().packageId!);
    const variant = pkg.variants.find((v) => v.id === variantId)!;
    set({
      variantId,
      requiredCount: STRIP_PHOTO_COUNT[variant.stripType],
      frameId: null,
      status: "selecting-frame",
    });
  },

  backToVariant: () => set({ status: "selecting-variant", frameId: null }),

  chooseFrame: (frameId) => set({ frameId, page: "capture", status: "idle" }),

  beginBurst: () =>
    set({
      status: "bursting",
      burstPhotos: [],
      selectedPhotoIds: [],
      keychainPhotoId: null,
    }),

  addBurstPhoto: (dataUrl) =>
    set((s) => ({ burstPhotos: [...s.burstPhotos, dataUrl] })),

  finishBurst: () => set({ status: "retake-check" }),

  // "Retake? Yes" — discard all 6, restart the burst from attempt 1.
  retakeAll: () =>
    set({
      burstPhotos: [],
      selectedPhotoIds: [],
      keychainPhotoId: null,
      status: "bursting",
    }),

  acceptBurst: () => set({ status: "selecting-photos" }),

  togglePhoto: (id) => {
    const { selectedPhotoIds, requiredCount } = get();
    if (selectedPhotoIds.includes(id)) {
      set({ selectedPhotoIds: selectedPhotoIds.filter((x) => x !== id) });
    } else if (selectedPhotoIds.length < requiredCount) {
      set({ selectedPhotoIds: [...selectedPhotoIds, id] });
    }
  },

  confirmSelection: () => {
    const { needsKeychain } = get();
    set(
      needsKeychain
        ? { status: "selecting-keychain-photo", keychainPhotoId: null, sendError: null }
        : { status: "final-review", sendError: null },
    );
  },

  chooseKeychainPhoto: (id) =>
    set({ keychainPhotoId: id, status: "final-review", sendError: null }),

  backToPhotoSelection: () =>
    set({ status: "selecting-photos", keychainPhotoId: null, sendError: null }),

  startSending: () => set({ status: "sending", sendError: null }),

  sendFailed: (message) => set({ status: "final-review", sendError: message }),

  sendSucceeded: () => set({ status: "done", sendError: null }),

  // Full reset between customers — nothing survives into the next session.
  resetSession: () => set({ ...initial }),
}));
