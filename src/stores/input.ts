import { defineStore } from "pinia";
import { pinia } from "../pinia";
import { useModalStore } from "./modals";

export type InputModalKind = "input" | "confirm" | "text";
export type InputResult = string[] | boolean;

export interface InputModalData {
  name: string[];
  length?: number;
  placeholder?: string[];
}

export interface InputModalRequest {
  inputType: string;
  inputModal: InputModalKind;
  inputData: InputModalData;
}

type InputHandler = (value: InputResult) => void;
type InputRejecter = (reason: null) => void;

const initialState = () => ({
  inputType: "",
  inputModal: "" as InputModalKind | "",
  inputData: {} as Partial<InputModalData>,
  inputResolver: null as InputHandler | null,
  inputRejecter: null as InputRejecter | null,
});

export const useInputStore = defineStore("input", {
  state: initialState,
  actions: {
    open(request: InputModalRequest) {
      return new Promise<InputResult>((resolve, reject) => {
        this.inputResolver = resolve;
        this.inputRejecter = reject;
        this.inputType = request.inputType;
        this.inputModal = request.inputModal;
        this.inputData = request.inputData;
        useModalStore(pinia).toggle("input");
      });
    },
    resolve(value: InputResult) {
      this.inputResolver?.(value);
    },
    close() {
      if (this.inputResolver && this.inputModal === "text") {
        this.inputResolver(true);
      } else {
        this.inputRejecter?.(null);
      }

      this.clearHandlers();
      const modals = useModalStore(pinia);
      if (modals.input) modals.toggle("input");
    },
    clearHandlers() {
      this.inputResolver = null;
      this.inputRejecter = null;
    },
  },
});
