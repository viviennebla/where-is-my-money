import { ReactNode } from 'react'
import Navbar from './Navbar'

interface Props {
  children: ReactNode
  containerClass?: string
}

export default function AppShell({ children, containerClass = 'max-w-4xl' }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className={`${containerClass} mx-auto px-4 py-6`}>
        {children}
      </main>
    </div>
  )
}
