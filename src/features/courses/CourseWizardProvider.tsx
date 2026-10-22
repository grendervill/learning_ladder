import { createContext, useContext, useState, type ReactNode } from "react"
import { CourseWizard } from "./CourseWizard"

interface CourseWizardContextValue {
  open: () => void
}

const CourseWizardContext = createContext<CourseWizardContextValue>({ open: () => {} })

export function useCourseWizard() {
  return useContext(CourseWizardContext)
}

export function CourseWizardProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <CourseWizardContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <CourseWizard open={open} onClose={() => setOpen(false)} />
    </CourseWizardContext.Provider>
  )
}
