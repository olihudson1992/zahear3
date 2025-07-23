"use client"

import React from "react"

interface Props {
  fallback: React.ReactNode
  children: React.ReactNode
}

const ErrorBoundary: React.FC<Props> = ({ fallback, children }) => {
  const [hasError, setHasError] = React.useState(false)

  React.useEffect(() => {
    const errorHandler = (error: any, info: any) => {
      console.error("Caught an error: ", error, info)
      setHasError(true)
    }

    window.addEventListener("error", errorHandler)

    return () => {
      window.removeEventListener("error", errorHandler)
    }
  }, [])

  if (hasError) {
    return fallback
  }

  return children
}

export default ErrorBoundary
