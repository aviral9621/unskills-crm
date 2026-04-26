import { createContext, useContext, type ReactNode } from 'react'

interface ImpersonationContextValue {
  studentId: string | null
  isImpersonating: boolean
}

const ImpersonationContext = createContext<ImpersonationContextValue>({
  studentId: null,
  isImpersonating: false,
})

export function ImpersonationProvider({
  studentId,
  children,
}: { studentId: string; children: ReactNode }) {
  return (
    <ImpersonationContext.Provider value={{ studentId, isImpersonating: true }}>
      {children}
    </ImpersonationContext.Provider>
  )
}

export function useImpersonation() {
  return useContext(ImpersonationContext)
}
