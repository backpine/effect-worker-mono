import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field"
import { Input } from "@ui-sdk/react/input"
import styles from "./text-field.module.css"

export type TextFieldProps = {
  name: string
  label: string
  type?: "text" | "email"
  autoComplete?: string
  required?: boolean
  value: string
  onValueChange: (value: string) => void
}

export function TextField({ label, name, type = "text", ...input }: TextFieldProps) {
  return (
    <Field name={name} className={styles.field}>
      <FieldLabel className={styles.label}>{label}</FieldLabel>
      <Input {...input} type={type} className={styles.input} />
      <FieldError className={styles.error} />
    </Field>
  )
}
