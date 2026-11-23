import type { ComponentProps, ReactNode } from "react"
import { Button as SdkButton } from "@ui-sdk/react/button"
import styles from "./button.module.css"

export type ButtonProps = Pick<
  ComponentProps<typeof SdkButton>,
  "type" | "disabled" | "onClick" | "aria-label"
> & {
  children: ReactNode
  className?: string
  busy?: boolean
}

export function Button({ busy = false, disabled, className, ...props }: ButtonProps) {
  return (
    <SdkButton
      {...props}
      className={className ? `${styles.button} ${className}` : styles.button}
      disabled={disabled || busy}
      focusableWhenDisabled={busy && !disabled}
      aria-busy={busy || undefined}
    />
  )
}
