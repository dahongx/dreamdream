"use client";
import { createContext } from 'react';
/** Already-public opening component CSS; supplied per chat, never a global registry. */
export const MufySharedComponentStyleContext=createContext('');
/** Per-chat source compatibility, including normal-UI imported components. */
export const MufyNativeSourceContext=createContext(false);
/** Opt-in only for a verified, fixed source-font dependency. */
export const MufyOriginalTitleFontContext=createContext(false);
