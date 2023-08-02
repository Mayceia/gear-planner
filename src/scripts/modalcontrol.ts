interface Modal {
    close(): void;
    element: HTMLElement;
}
let currentModal: Modal | undefined = undefined;

export function setModal(modal: Modal | undefined) {
    if (currentModal) {
        currentModal.close();
    }
    if (modal) {
        document.addEventListener('mousedown', listener);
    }
    else {
        document.removeEventListener('mousedown', listener);
    }
    currentModal = modal;
}

const listener = (ev: MouseEvent) => {
    if (!currentModal) {
        return;
    }
    else {
        const modalElement = currentModal.element;
        if (!(ev.target instanceof HTMLElement)) {
            return;
        }
        let eventTarget = ev.target;
        while (eventTarget) {
            if (modalElement === eventTarget) {
                // Click was on the modal. Ignore.
            }
            else {
                eventTarget = eventTarget.parentElement;
            }
        }
        setModal(undefined);
        ev.stopPropagation();
    }
}