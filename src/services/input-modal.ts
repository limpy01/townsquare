import { pinia } from "../pinia";
import { type InputModalRequest, useInputStore } from "../stores/input";

export const showInputModal = (request: InputModalRequest) =>
  useInputStore(pinia).open(request);
