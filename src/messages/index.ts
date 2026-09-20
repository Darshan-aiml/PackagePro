import en from "./en.json";
import hi from "./hi.json";
import ta from "./ta.json";

export const messages = { en, hi, ta } as const;
export type MessageLocale = keyof typeof messages;