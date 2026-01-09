"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn("w-14 h-7 rounded-full bg-muted animate-pulse", className)} />
    )
  }

  const isDark = resolvedTheme === "dark"

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark")
  }

  return (
    <div
      className={cn(
        "relative w-14 h-7 rounded-full cursor-pointer transition-colors duration-300",
        isDark 
          ? "bg-slate-700" 
          : "bg-sky-200",
        className
      )}
      onClick={toggleTheme}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && toggleTheme()}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
    >
      <div className="absolute inset-0 flex items-center justify-between px-1.5">
        <div className={cn(
          "transition-opacity duration-300",
          isDark ? "opacity-50" : "opacity-100"
        )}>
          <Sun className="h-4 w-4 text-amber-500" />
        </div>
        
        <div className={cn(
          "transition-opacity duration-300",
          isDark ? "opacity-100" : "opacity-50"
        )}>
          <Moon className="h-4 w-4 text-slate-300" />
        </div>
      </div>
      
      <div
        className={cn(
          "absolute top-0.5 h-6 w-6 rounded-full shadow-md transition-all duration-300 flex items-center justify-center",
          isDark 
            ? "left-[calc(100%-26px)] bg-slate-800" 
            : "left-0.5 bg-white"
        )}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-slate-300" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        )}
      </div>
    </div>
  )
}
