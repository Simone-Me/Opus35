import { useCallback, useState } from "react";

const CLOSED_MODAL = {
  isOpen: false,
  category: null,
  workId: null,
  workTitle: "",
  initialValues: {},
  // Changes on every open so the modal remounts with fresh form state.
  openKey: 0,
};

export function useCategoryModal() {
  const [modal, setModal] = useState(CLOSED_MODAL);

  const openModal = useCallback(({ category, workId, workTitle, initialValues }) => {
    setModal((previous) => ({
      isOpen: true,
      category,
      workId,
      workTitle: workTitle || "",
      initialValues: initialValues || {},
      openKey: previous.openKey + 1,
    }));
  }, []);

  const closeModal = useCallback(() => {
    setModal((previous) => ({ ...CLOSED_MODAL, openKey: previous.openKey }));
  }, []);

  return { modal, openModal, closeModal };
}
