import {
  canUseContactPicker as implCanUseContactPicker,
  canUseWebShare as implCanUseWebShare,
  dedupe as implDedupe,
  isValidEmail as implIsValidEmail,
  isValidPhone as implIsValidPhone,
  mailtoLink as implMailtoLink,
  normalizePhone as implNormalizePhone,
  parseFile as implParseFile,
  parsePasted as implParsePasted,
  pickFromDevice as implPickFromDevice,
  shareInvite as implShareInvite,
  smsLink as implSmsLink,
  sendServerInvite as implSendServerInvite,
} from "./useContactInvites.js";

export type Contact = {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  channel?: "sms" | "email";
};

export const canUseContactPicker: () => boolean = implCanUseContactPicker;
export const canUseWebShare: () => boolean = implCanUseWebShare;
export const normalizePhone: (raw: string) => string = implNormalizePhone;
export const dedupe: (contacts: Contact[]) => Contact[] = implDedupe;
export const pickFromDevice: () => Promise<Contact[]> = implPickFromDevice;
export const parsePasted: (text: string) => Contact[] = implParsePasted;
export const parseFile: (file: File) => Promise<Contact[]> = implParseFile;
export const shareInvite: (url: string, text: string) => Promise<void> =
  implShareInvite;
export const smsLink: (phone: string, body: string) => string = implSmsLink;
export const mailtoLink: (
  email: string,
  subject: string,
  body: string,
) => string = implMailtoLink;
export const sendServerInvite: (
  contact: Contact,
  payload: any,
) => Promise<void> = implSendServerInvite;
export const isValidEmail: (value: string | undefined) => boolean =
  implIsValidEmail;
export const isValidPhone: (value: string | undefined) => boolean =
  implIsValidPhone;
