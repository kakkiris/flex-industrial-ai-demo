import { customAlphabet } from "nanoid";

const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

export const id = (prefix: string) => `${prefix}_${nano()}`;
