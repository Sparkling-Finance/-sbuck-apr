export * from "./constants";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
