import type {ReactNode} from 'react';

/** Keep optional source shortcuts in the same flow as native chat actions. */
export function ChatInputToolbar({wrap=false,children}:{wrap?:boolean;children:ReactNode}){
 return <div className={`nj_chat_input_toolbar mx-auto mb-[var(--space-sm)] flex w-full max-w-[640px] items-center justify-start gap-[var(--space-sm)]${wrap?' flex-wrap':''}`}>{children}</div>;
}
